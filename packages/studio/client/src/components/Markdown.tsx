import { memo, useContext, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import { toString as hastText } from "hast-util-to-string";
import type { Element, ElementContent } from "hast";
import { Sparkles, Copy, Check } from "lucide-react";
import { openPreviewLink, openArtifact, parsePreviewTarget, openExternalLink, type PreviewTarget } from '../previewLinks';
import { ThinkingAccordion } from './ThinkingAccordion';
import { MarkdownMedia, IMAGE_FILE, VIDEO_FILE, ImageEndpointContext, revealLinkedFile } from './MarkdownImage';
import { tr } from '../i18n';

/** Marks a link (or media) so the chat's right-click menu can offer Show in folder / Open in browser. */
export function linkData(target: PreviewTarget) {
  return target.kind === 'web' ? { 'data-link-url': target.url } : target.kind === 'file' ? { 'data-link-file': target.path } : {};
}

const mediaKind = (file: string) => IMAGE_FILE.test(file) ? 'image' as const : VIDEO_FILE.test(file) ? 'video' as const : null;

/** Links and images inside a block (not inside nested paragraphs or lists when `shallow`). */
function linkTargets(node: Element | undefined, shallow: boolean): { href: string; label: string }[] {
  const found: { href: string; label: string }[] = [];
  const walk = (children: ElementContent[]) => {
    for (const child of children) {
      if (child.type !== 'element') continue;
      if (shallow && ['p', 'ul', 'ol', 'blockquote'].includes(child.tagName)) continue;
      if (child.tagName === 'a' && typeof child.properties.href === 'string') found.push({ href: child.properties.href, label: hastText(child) });
      else if (child.tagName === 'img' && typeof child.properties.src === 'string') found.push({ href: child.properties.src, label: String(child.properties.alt || '') });
      else walk(child.children);
    }
  };
  if (node) walk(node.children);
  return found;
}

/** Local images and videos linked in a paragraph, shown in full under it instead of splitting the sentence. */
function mediaBlocks(node: Element | undefined, shallow = false): ReactNode[] {
  const seen = new Set<string>();
  const out: ReactNode[] = [];
  for (const { href, label } of linkTargets(node, shallow)) {
    try {
      const target = parsePreviewTarget(href);
      const kind = target.kind === 'file' ? mediaKind(target.path) : null;
      if (target.kind !== 'file' || !kind || seen.has(target.path)) continue;
      seen.add(target.path);
      out.push(<MarkdownMedia key={`media-${target.path}`} path={target.path} label={label} kind={kind} />);
    } catch { /* not a file link */ }
  }
  return out;
}

/** "> " lines: one quote block, with a Copy button for text meant to be pasted elsewhere (a post, a message). */
function QuoteBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText((body.current?.innerText || '').trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard refused */ }
  };
  return <blockquote className="md-quote">
    <button type="button" className="md-copy-btn md-quote-copy" title={tr("คัดลอกข้อความนี้")} onClick={() => void copy()}>
      {copied ? <Check size={12} style={{ color: 'var(--running, #91bf9f)' }} /> : <Copy size={12} />}
      <span>{copied ? tr("คัดลอกแล้ว") : tr("คัดลอก")}</span>
    </button>
    <div ref={body} className="markdown">{children}</div>
  </blockquote>;
}

function link(label: ReactNode, href: string): ReactNode {
  try {
    const target = parsePreviewTarget(href);
    // Images and videos are shown under their paragraph (see mediaBlocks); the link stays in the text.
    return (
      <a
        className="md-link"
        href={target.kind === 'web' ? target.url : '#preview-file'}
        title={tr`คลิกเพื่อเปิดใน Preview (Ctrl+Click เพื่อเปิดในเบราว์เซอร์): ${href}`}
        onClick={(event) => {
          event.preventDefault();
          if (event.ctrlKey || event.metaKey) openExternalLink(href);
          else openPreviewLink(href);
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
            openExternalLink(href);
          }
        }}
        {...linkData(target)}
      >
        {label}
      </a>
    );
  } catch {
    return <span title={tr("ลิงก์ชนิดนี้ไม่รองรับ")}>{label}</span>;
  }
}

/** Does inline code look like a file or folder path the AI wants the user to find? */
export function looksLikeFilePath(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 400 || /[\n<>"|?*]/.test(value.replace(/^[a-z]:/i, ''))) return false;
  if (/^[a-z]:[\\/]/i.test(value)) return true;
  if (/^\/(?:Users|home|tmp|var|opt|mnt|Volumes|private)\/\S+$/.test(value)) return true;
  return /^\.{0,2}[\\/]?[\w.@-]+(?:[\\/][\w.@ -]+)+\.\w{1,8}$/.test(value) && !/\s/.test(value) && !/^\w+:\/\//.test(value);
}

/** `D:\Test\site.zip` in an answer: one click opens its folder; right-click offers Preview and Copy path. */
function FilePathCode({ path }: { path: string }) {
  const endpoint = useContext(ImageEndpointContext);
  const [problem, setProblem] = useState('');
  const open = async () => {
    if (!window.superai?.revealFile) return openPreviewLink(path);
    try { setProblem(''); await revealLinkedFile(endpoint, path); }
    catch (error) { setProblem((error as Error).message); setTimeout(() => setProblem(''), 4000); }
  };
  return <>
    <code
      className="md-path"
      role="button"
      tabIndex={0}
      data-link-file={path}
      title={window.superai?.platform === 'darwin' ? tr("คลิกเพื่อแสดงใน Finder (คลิกขวาดูตัวเลือกเพิ่ม)") : tr("คลิกเพื่อเปิดโฟลเดอร์ (คลิกขวาดูตัวเลือกเพิ่ม)")}
      onClick={() => void open()}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void open(); } }}
    >{path}</code>
    {problem && <span className="md-path-problem" role="status">{problem}</span>}
  </>;
}

function CodeBlock({ code, language, children }: { code: string; language: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const lang = (language || "").toLowerCase().trim();
  const isArtifact =
    ['html', 'svg', 'xml', 'mermaid', 'jsx', 'tsx', 'react'].includes(lang) ||
    (!lang && /^\s*<(!DOCTYPE|html|svg|div|main)/i.test(code));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard refused
    }
  };

  const handleOpenArtifact = () => {
    const title = lang ? `${lang.toUpperCase()} Artifact` : 'Interactive Preview';
    openArtifact(title, lang || 'html', code);
  };

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span className="md-code-lang">{lang ? lang.toUpperCase() : 'CODE'}</span>
        <div className="md-code-actions">
          {isArtifact && (
            <button
              type="button"
              className="md-artifact-btn md-canvas-btn"
              title={tr("เปิดดูผลลัพธ์สดๆ ใน Canvas (Side-by-Side)")}
              onClick={handleOpenArtifact}
            >
              <Sparkles size={12} />
              <span>{tr("เปิดใน Canvas")}</span>
            </button>
          )}
          <button type="button" className="md-copy-btn" title={tr("คัดลอกโค้ด")} onClick={copy}>
            {copied ? <Check size={12} style={{ color: 'var(--running, #91bf9f)' }} /> : <Copy size={12} />}
            <span>{copied ? tr("คัดลอกแล้ว") : tr("คัดลอก")}</span>
          </button>
        </div>
      </div>
      <pre tabIndex={0}>{children}</pre>
    </div>
  );
}

function ArtifactCard({ title, language, content }: { title: string; language: string; content: string }) {
  const open = () => openArtifact(title || 'Canvas Artifact', language || 'html', content);
  return (
    <div className="md-artifact-card">
      <div className="md-artifact-card-info">
        <Sparkles size={16} className="md-artifact-card-sparkle" />
        <div>
          <strong>{title || 'Canvas Artifact'}</strong>
          <small>{language ? language.toUpperCase() : 'INTERACTIVE PREVIEW'}</small>
        </div>
      </div>
      <button type="button" className="md-artifact-btn md-canvas-btn" onClick={open} title={tr("เปิดดูผลลัพธ์สดๆ ใน Canvas")}>
        <Sparkles size={12} />
        <span>{tr("เปิดใน Canvas")}</span>
      </button>
    </div>
  );
}

/**
 * AI answers are written loosely: keep them reading as the AI meant.
 * - quote lines separated by blank lines stay one quote card
 * - link targets with spaces (`[clip](D:/my clips/a.mp4)`) still link
 * - "•" bullets are a list
 * Fenced code is left untouched.
 */
export function prepareMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const quote = /^\s*>/;
  let fence = '';
  for (let i = 0; i < lines.length; i++) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = '';
      continue;
    }
    if (fence) continue;
    lines[i] = lines[i]
      .replace(/^(\s*)•\s+/, '$1- ')
      .replace(/\]\(([^()<>\n]*?\s[^()<>\n]*?)\)/g, (whole, dest: string) => /\s+"[^"]*"$/.test(dest) ? whole : `](<${dest.trim()}>)`);
  }
  for (let i = 1; i < lines.length - 1; i++) {
    if (lines[i].trim() || !quote.test(lines[i - 1])) continue;
    let next = i;
    while (next < lines.length && !lines[next].trim()) next++;
    if (next < lines.length && quote.test(lines[next])) for (let j = i; j < next; j++) lines[j] = '>';
  }
  return lines.join("\n");
}

const languageOf = (node: Element | undefined) => {
  const classes = node?.properties.className;
  const found = (Array.isArray(classes) ? classes : []).map(String).find((name) => name.startsWith('language-'));
  return found ? found.slice('language-'.length) : '';
};

const components: Components = {
  a: ({ href, children }) => <>{href ? link(children, href) : children}</>,
  img: ({ src, alt }) => <>{typeof src === 'string' && src ? link(alt || src, src) : alt}</>,
  p: ({ node, children }) => <><p>{children}</p>{mediaBlocks(node)}</>,
  li: ({ node, children, className }) => <li className={className}>{children}{mediaBlocks(node, true)}</li>,
  blockquote: ({ children }) => <QuoteBlock>{children}</QuoteBlock>,
  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
  h5: ({ children }) => <h5 className="md-h5">{children}</h5>,
  h6: ({ children }) => <h6 className="md-h6">{children}</h6>,
  table: ({ children }) => <div className="md-table-wrap"><table>{children}</table></div>,
  pre: ({ node, children }) => {
    const code = node?.children.find((child): child is Element => child.type === 'element' && child.tagName === 'code');
    return <CodeBlock code={code ? hastText(code).replace(/\n$/, '') : ''} language={languageOf(code)}>{children}</CodeBlock>;
  },
  code: ({ node, className, children }) => {
    const text = node ? hastText(node) : '';
    // Fenced code always ends with a newline; inline code never does.
    if (!text.endsWith('\n') && looksLikeFilePath(text)) return <FilePathCode path={text.trim()} />;
    return <code className={className}>{children}</code>;
  },
};

const remarkPlugins = [remarkGfm, remarkBreaks];
const rehypePlugins = [[rehypeHighlight, { detect: false }]] as never;
// Every link goes through parsePreviewTarget, which allows only http(s) and local files.
const keepUrl = (url: string) => url;

/** Safe Markdown for AI answers (GitHub flavour, no raw HTML) with the app's own links, media, quotes and code blocks. */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const thinkingBlocks: string[] = [];
  const artifactBlocks: { title: string; language: string; content: string }[] = [];
  let remainingText = text;

  const thinkingRegex = /<(?:thinking|thought|think)>([\s\S]*?)<\/(?:thinking|thought|think)>/gi;
  let match;
  while ((match = thinkingRegex.exec(text)) !== null) {
    if (match[1]?.trim()) thinkingBlocks.push(match[1].trim());
  }
  if (thinkingBlocks.length > 0) remainingText = text.replace(thinkingRegex, '').trim();

  const artifactRegex = /<(?:antArtifact|artifact)([\s\S]*?)>([\s\S]*?)<\/(?:antArtifact|artifact)>/gi;
  let artMatch;
  while ((artMatch = artifactRegex.exec(remainingText)) !== null) {
    const attrs = artMatch[1] || '';
    const titleMatch = attrs.match(/title="([^"]+)"/i);
    const typeMatch = attrs.match(/(?:type|language)="([^"]+)"/i);
    artifactBlocks.push({
      title: titleMatch ? titleMatch[1] : 'Canvas Artifact',
      language: typeMatch ? typeMatch[1] : 'html',
      content: (artMatch[2] || '').trim(),
    });
  }
  if (artifactBlocks.length > 0) remainingText = remainingText.replace(artifactRegex, '').trim();

  return (
    <div className="markdown">
      {thinkingBlocks.map((thought, idx) => <ThinkingAccordion key={`thought-${idx}`} thought={thought} />)}
      {artifactBlocks.map((art, idx) => <ArtifactCard key={`art-${idx}`} title={art.title} language={art.language} content={art.content} />)}
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components} urlTransform={keepUrl}>
        {prepareMarkdown(remainingText)}
      </ReactMarkdown>
    </div>
  );
});
