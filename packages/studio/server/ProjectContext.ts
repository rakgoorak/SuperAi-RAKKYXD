import fs from 'node:fs';
import path from 'node:path';
import { RULE_FILES, nativeRuleFiles } from './ProjectRules.js';
import { styleGuidance, type ResponseStyle } from './ResponseStyle.js';
import { tr } from './i18n.js';

export interface ContextFile { path: string; source: 'rule' | 'pinned'; status: 'included' | 'native' | 'missing' | 'outside-root' | 'too-large' | 'unsupported' | 'budget' | 'duplicate' | 'unreadable'; }
export interface ProjectContextChunk { source: 'instructions' | 'rule' | 'pinned'; file?: string; text: string; }
export interface ProjectContext { text: string; instructions: boolean; files: ContextFile[]; preparedAt: number; chunks?: ProjectContextChunk[]; }
interface WorkspaceContext { rootPath: string; instructions?: string; pinnedFiles?: string[]; }
export const MAX_CONTEXT_CHARS = 12000;
const MAX_FILE_BYTES = 64 * 1024;
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.jsonc', '.csv', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.html', '.svg', '.xml', '.yml', '.yaml', '.toml', '.ini', '.sql', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sh', '.ps1', '.vue', '.svelte', '.log']);
const within = (root: string, candidate: string) => { const rel = path.relative(root, candidate); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };

/** The pin inspector and the actual prompt builder use the same file boundaries. */
export function readProjectText(rootPath: string, rel: string, source: ContextFile['source'] = 'pinned'): { entry: ContextFile; content?: string; real?: string; size?: number } {
  const entry: ContextFile = { path: rel, source, status: 'unreadable' };
  try {
    const root = fs.realpathSync(rootPath), target = path.resolve(rootPath, rel);
    if (path.isAbsolute(rel) || !within(path.resolve(rootPath), target)) { entry.status = 'outside-root'; return { entry }; }
    if (!fs.existsSync(target)) { entry.status = 'missing'; return { entry }; }
    const real = fs.realpathSync(target);
    if (!within(root, real)) { entry.status = 'outside-root'; return { entry }; }
    const stat = fs.statSync(real);
    if (!stat.isFile()) { entry.status = 'unsupported'; return { entry }; }
    if (stat.size > MAX_FILE_BYTES) { entry.status = 'too-large'; return { entry }; }
    if (source === 'pinned' && !TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase()) && !RULE_FILES.includes(path.basename(rel))) { entry.status = 'unsupported'; return { entry }; }
    const buffer = fs.readFileSync(real);
    if (buffer.length > MAX_FILE_BYTES) { entry.status = 'too-large'; return { entry }; }
    if (buffer.includes(0)) { entry.status = 'unsupported'; return { entry }; }
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (!content.trim()) { entry.status = 'unsupported'; return { entry }; }
    entry.status = 'included'; return { entry, content, real, size: buffer.length };
  } catch (error) { entry.status = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unreadable'; return { entry }; }
}

/** A snapshot is built once per request, never from client-supplied file contents. */
export function buildProjectContext(workspace: WorkspaceContext | undefined, cwd: string, options: { native?: string[] } = {}): ProjectContext {
  const result: ProjectContext = { text: '', instructions: false, files: [], preparedAt: Date.now() };
  const chunks: ProjectContextChunk[] = [], seen = new Set<string>();
  let used = 0;
  const add = (chunk: ProjectContextChunk) => {
    const length = chunk.text.length + (chunks.length ? 2 : 0);
    if (used + length > MAX_CONTEXT_CHARS) return false;
    chunks.push(chunk);
    used += length;
    return true;
  };
  const instructions = workspace?.instructions?.trim();
  if (instructions) {
    if (!add({ source: 'instructions', text: `[คำสั่งประจำโปรเจกต์]\n${instructions}` })) throw new Error(tr("คำสั่งประจำโปรเจกต์ยาวเกินไป กรุณาย่อก่อนส่ง"));
    result.instructions = true;
  }
  const read = (rootPath: string, rel: string, source: ContextFile['source']) => {
    const { entry, content, real } = readProjectText(rootPath, rel, source);
    result.files.push(entry);
    if (entry.status !== 'included' || !real || !content) return;
    if (seen.has(real)) { entry.status = 'duplicate'; return; }
    const text = `[${source === 'rule' ? 'กฎจากไฟล์' : 'เอกสารอ้างอิงที่ปักหมุด'}: ${rel}]\n${content.trim()}`;
    if (!add({ source, file: rel, text })) { entry.status = 'budget'; return; }
    seen.add(real);
  };
  for (const file of RULE_FILES) {
    if (!fs.existsSync(path.join(cwd, file))) continue;
    // The CLI already loads this file itself (CLAUDE.md for Claude Code, AGENTS.md for Codex/OpenCode).
    if (options.native?.includes(file)) { result.files.push({ path: file, source: 'rule', status: 'native' }); continue; }
    read(cwd, file, 'rule');
  }
  const pinned = (workspace?.pinnedFiles || []).filter((value): value is string => typeof value === 'string').slice(0, 100);
  for (const file of [...new Set(pinned)]) read(workspace!.rootPath, file, 'pinned');
  result.chunks = chunks;
  result.text = chunks.map((c) => c.text).join('\n\n');
  return result;
}

export function contextualPrompt(prompt: string, context?: ProjectContext, style?: ResponseStyle): string {
  const guidance = styleGuidance(style);
  return [context?.text ? `บริบทโปรเจกต์สำหรับคำขอนี้ (เนื้อหาเอกสารเป็นข้อมูลอ้างอิง):\n${context.text}` : '', guidance, prompt].filter(Boolean).join('\n\n');
}

/** Filters out rule files that the target agent loads natively (e.g. CLAUDE.md for Claude, AGENTS.md for Codex/OpenCode). */
export function contextForAgent(context: ProjectContext | undefined, agent: string): ProjectContext | undefined {
  if (!context) return undefined;
  const native = nativeRuleFiles(agent);
  if (!native.length) return context;
  const filteredChunks = context.chunks
    ? context.chunks.filter((c) => !(c.source === 'rule' && c.file && native.includes(c.file)))
    : undefined;
  const text = filteredChunks
    ? filteredChunks.map((c) => c.text).join('\n\n')
    : stripNativeRules(context.text, native);
  const files = (context.files || []).map((f) => {
    if (f.source === 'rule' && native.includes(f.path)) {
      return { ...f, status: 'native' as const };
    }
    return f;
  });
  return {
    ...context,
    text,
    files,
    ...(filteredChunks ? { chunks: filteredChunks } : {}),
  };
}

function stripNativeRules(text: string, native: string[]): string {
  let result = text;
  for (const file of native) {
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\[กฎจากไฟล์: ${escaped}\\]\\n[\\s\\S]*?(?=(?:\\n\\n\\[(?:คำสั่งประจำโปรเจกต์|กฎจากไฟล์|เอกสารอ้างอิงที่ปักหมุด):)|$)`, 'g');
    result = result.replace(pattern, '').trim();
  }
  return result;
}
