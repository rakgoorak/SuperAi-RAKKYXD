// Finds the Thai interface text in the source: every tr('…') and tr`…` call.
//
//   node scripts/i18n-text.mjs            list the source strings as JSON
//   node scripts/i18n-text.mjs --wrap     wrap bare Thai text in tr() (one-off codemod; review the diff)
//
// A source string is the Thai text itself; a template's values appear as {0}, {1}, …
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ts = createRequire(import.meta.url)('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THAI = /[฀-๿]/;

export const AREAS = {
  client: { dir: 'packages/studio/client/src', helper: 'packages/studio/client/src/i18n.ts', skip: /[\\/](i18n\.ts|locales[\\/].*)$/ },
  server: { dir: 'packages/studio/server', helper: 'packages/studio/server/i18n.ts', skip: /[\\/](i18n\.ts|locales[\\/].*)$/ },
};

export function files(area) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (!['node_modules', 'dist', 'public'].includes(entry.name)) walk(file); }
      else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) && !area.skip.test(file)) out.push(file);
    }
  };
  walk(path.join(root, area.dir));
  return out.sort();
}

const parse = (file) => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
/** The key of a template: its text with {n} where each value goes. */
const templateKey = (node) => node.head.text + node.templateSpans.map((span, index) => `{${index}}` + span.literal.text).join('');
const isTr = (expression) => ts.isIdentifier(expression) && expression.text === 'tr';

/** Every source string used through tr in one area, in file order. */
export function sources(areaName) {
  const found = new Map();
  for (const file of files(AREAS[areaName])) {
    const visit = (node) => {
      if (ts.isCallExpression(node) && isTr(node.expression) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
        const key = node.arguments[0].text;
        if (!found.has(key)) found.set(key, path.relative(root, file).replace(/\\/g, '/'));
      } else if (ts.isTaggedTemplateExpression(node) && isTr(node.tag)) {
        const key = ts.isNoSubstitutionTemplateLiteral(node.template) ? node.template.text : templateKey(node.template);
        if (!found.has(key)) found.set(key, path.relative(root, file).replace(/\\/g, '/'));
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(file));
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// One-off codemod.

const MATCHERS = new Set(['includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'match', 'matchAll', 'test', 'replace', 'replaceAll', 'split', 'search', 'has', 'get', 'getItem', 'setItem', 'removeItem']);
const COMPARE = new Set([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]);

/** Text that is data to compare against or a type, not something a person reads. */
function notDisplayed(node) {
  const parent = node.parent;
  if (!parent) return true;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent) || ts.isCaseClause(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) || ts.isElementAccessExpression(parent)) return true;
  if (ts.isBinaryExpression(parent) && COMPARE.has(parent.operatorToken.kind)) return true;
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression;
    if (ts.isIdentifier(callee) && (callee.text === 't' || callee.text === 'tr')) return true;
    if (ts.isPropertyAccessExpression(callee) && (callee.name.text === 't' || MATCHERS.has(callee.name.text))) return true;
  }
  if (ts.isNewExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === 'RegExp') return true;
  if (ts.isTaggedTemplateExpression(parent)) return true;
  for (let up = parent; up; up = up.parent) if (ts.isTypeNode(up)) return true;
  return false;
}

/**
 * `only`: when given, a string is wrapped only if this says it is shown to a person (the server
 * mixes interface text with prompts written for the AI, which must stay as they are).
 */
export function wrap(areaName, only) {
  const area = AREAS[areaName];
  let total = 0;
  const skipped = [];
  for (const file of files(area)) {
    const source = parse(file);
    const text = source.text;
    const edits = [];
    const where = (node) => `${path.relative(root, file).replace(/\\/g, '/')}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    const visit = (node) => {
      if (ts.isJsxText(node) && THAI.test(node.text)) {
        const raw = text.slice(node.pos, node.end);
        const lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
        const core = raw.slice(lead.length, raw.length - tail.length);
        // JSX joins wrapped lines with one space.
        const value = core.replace(/\s*\n\s*/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        edits.push([node.pos + lead.length, node.end - tail.length, `{tr(${JSON.stringify(value)})}`]);
      } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && THAI.test(node.text)) {
        if (notDisplayed(node) || (only && !only(node, source))) skipped.push(`${where(node)}  ${node.text.slice(0, 70)}`);
        else if (ts.isJsxAttribute(node.parent)) edits.push([node.getStart(), node.end, `{tr(${JSON.stringify(node.text)})}`]);
        else edits.push([node.getStart(), node.end, `tr(${JSON.stringify(node.text)})`]);
      } else if (ts.isTemplateExpression(node) && (THAI.test(node.head.text) || node.templateSpans.some((span) => THAI.test(span.literal.text)))) {
        if (notDisplayed(node) || (only && !only(node, source))) skipped.push(`${where(node)}  ${templateKey(node).slice(0, 70)}`);
        else edits.push([node.getStart(), node.getStart(), 'tr']);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (!edits.length) continue;
    total += edits.length;
    let out = text;
    for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + value + out.slice(end);
    if (!/import \{[^}]*\btr\b[^}]*\} from ['"][^'"]*i18n(\.js)?['"]/.test(out)) {
      let from = path.relative(path.dirname(file), path.join(root, area.helper)).replace(/\\/g, '/').replace(/\.ts$/, areaName === 'server' ? '.js' : '');
      if (!from.startsWith('.')) from = './' + from;
      const line = `import { tr } from '${from}';`;
      const newline = out.includes('\r\n') ? '\r\n' : '\n';
      const imports = [...out.matchAll(/^import [^;]*?;[ \t]*\r?$/gms)];
      const at = imports.length ? imports.at(-1).index + imports.at(-1)[0].replace(/\r$/, '').length : 0;
      out = at ? out.slice(0, at) + newline + line + out.slice(at) : line + newline + out;
    }
    fs.writeFileSync(file, out);
  }
  return { total, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const area = process.argv.includes('--server') ? 'server' : 'client';
  if (process.argv.includes('--wrap')) {
    const result = wrap(area);
    console.error(`wrapped ${result.total}; left alone ${result.skipped.length}`);
    console.log(result.skipped.join('\n'));
  } else console.log(JSON.stringify([...sources(area).keys()], null, 1));
}
