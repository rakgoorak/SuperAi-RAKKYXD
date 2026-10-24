import { useState, type ReactNode } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { openPreviewLink, openArtifact, parsePreviewTarget } from '../previewLinks';
import { ThinkingAccordion } from './ThinkingAccordion';
import { MarkdownImage } from './MarkdownImage';

function link(label: string, href: string, key: string): ReactNode {
  try {
    const target = parsePreviewTarget(href);
    const anchor = (
      <a
        key={key}
        className="md-link"
        href={target.kind === 'web' ? target.url : '#preview-file'}
        title={`เปิดใน Preview: ${href}`}
        onClick={(event) => {
          event.preventDefault();
          openPreviewLink(href);
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            event.preventDefault();
            openPreviewLink(href);
          }
        }}
      >
        {label}
      </a>
    );
    return target.kind === 'file' && /\.(png|jpe?g|gif|webp|avif)$/i.test(target.path)
      ? <MarkdownImage key={`${key}-${target.path}`} path={target.path} label={label} fallback={anchor} /> : anchor;
  } catch {
    return (
      <span key={key} title="ลิงก์ชนิดนี้ไม่รองรับ">
        {label}
      </span>
    );
  }
}

function CodeBlock({ code, language }: { code: string; language: string }) {
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
      // fallback
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
              className="md-artifact-btn"
              title="เปิดดูผลลัพธ์สดๆ ในแผง Artifact"
              onClick={handleOpenArtifact}
            >
              <Sparkles size={12} />
              <span>เปิดใน Artifact</span>
            </button>
          )}
          <button
            type="button"
            className="md-copy-btn"
            title="คัดลอกโค้ด"
            onClick={copy}
          >
            {copied ? (
              <Check size={12} style={{ color: 'var(--running, #91bf9f)' }} />
            ) : (
              <Copy size={12} />
            )}
            <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
          </button>
        </div>
      </div>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Minimal, safe Markdown for AI answers: headings, lists, tables, code blocks, bold, inline code and links. No HTML. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|!?\[[^\]\n]+\]\((?:<[^>\n]+>|[^)\n]+)\)|(?:https?:\/\/|www\.)[^\s<>]+)/g).map((part, i) =>
    /^!?\[[^\]\n]+\]\((?:<[^>\n]+>|[^)\n]+)\)$/.test(part) ? (
      link(part.slice(part.startsWith('!') ? 2 : 1, part.indexOf("](")), part.slice(part.indexOf("](") + 2, -1), `${key}-${i}`)
    ) : /^(?:https?:\/\/|www\.)/i.test(part) ? (() => {
      const href = part.replace(/[.,;!?\u3002\uff0c\uff1b\uff01\uff1f]+$/, '');
      return <span key={`${key}-${i}`}>{link(href, href, `${key}-${i}-url`)}{part.slice(href.length)}</span>;
    })() : part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`${key}-${i}`}>{inline(part.slice(2, -2), `${key}-${i}-bold`)}</strong>
    ) : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code key={`${key}-${i}`}>{part.slice(1, -1)}</code>
    ) : (
      part
    ),
  );
}

export function Markdown({ text }: { text: string }) {
  const thinkingBlocks: string[] = [];
  let remainingText = text;

  const thinkingRegex = /<(?:thinking|thought)>([\s\S]*?)<\/(?:thinking|thought)>/gi;
  let match;
  while ((match = thinkingRegex.exec(text)) !== null) {
    if (match[1]?.trim()) {
      thinkingBlocks.push(match[1].trim());
    }
  }

  if (thinkingBlocks.length > 0) {
    remainingText = text.replace(thinkingRegex, '').trim();
  }

  const out: ReactNode[] = [];
  thinkingBlocks.forEach((thought, idx) => {
    out.push(<ThinkingAccordion key={`thought-${idx}`} thought={thought} />);
  });

  const lines = remainingText.replace(/\r\n/g, "\n").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((item, i) => <li key={i}>{inline(item, `li${out.length}-${i}`)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush();
      const match = line.match(/^```(\w+)?/);
      const language = match?.[1] || "";
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      out.push(<CodeBlock key={out.length} code={code.join("\n")} language={language} />);
      continue;
    }
    const row = /^\s*\|.*\|\s*$/;
    if (row.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] || "") && lines[i + 1].includes("-")) {
      flush();
      const cells = (text: string) => text.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      const body: string[][] = [];
      const at = i;
      for (i += 2; i < lines.length && row.test(lines[i]); i++) body.push(cells(lines[i]));
      i--;
      out.push(
        <table key={out.length}>
          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, `th${at}-${j}`)}</th>)}</tr></thead>
          <tbody>{body.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inline(c, `td${at}-${k}-${j}`)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      out.push(<h4 key={out.length} className={`md-h${heading[1].length}`}>{inline(heading[2], `h${i}`)}</h4>);
    } else if (bullet || numbered) {
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet || numbered)![1]);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      out.push(<p key={out.length}>{inline(line, `p${i}`)}</p>);
    }
  }
  flush();
  return <div className="markdown">{out}</div>;
}
