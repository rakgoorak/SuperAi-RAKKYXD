import type { ReactNode } from "react";
import { openPreviewLink, parsePreviewTarget } from '../previewLinks';

function link(label: string, href: string, key: string): ReactNode {
  try {
    const target = parsePreviewTarget(href);
    return <a key={key} className="md-link" href={target.kind === 'web' ? target.url : '#preview-file'} title={`เปิดใน Preview: ${href}`}
      onClick={event => { event.preventDefault(); openPreviewLink(href); }}
      onAuxClick={event => { if (event.button === 1) { event.preventDefault(); openPreviewLink(href); } }}>{label}</a>;
  } catch { return <span key={key} title="ลิงก์ชนิดนี้ไม่รองรับ">{label}</span>; }
}

/** Minimal, safe Markdown for AI answers: headings, lists, tables, code blocks, bold, inline code and links. No HTML. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]\n]+\]\((?:<[^>\n]+>|[^)\n]+)\)|(?:https?:\/\/|www\.)[^\s<>]+)/g).map((part, i) =>
    /^\[[^\]\n]+\]\((?:<[^>\n]+>|[^)\n]+)\)$/.test(part) ? (
      link(part.slice(1, part.indexOf("](")), part.slice(part.indexOf("](") + 2, -1), `${key}-${i}`)
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
  const out: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
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
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) code.push(lines[i]);
      out.push(<pre key={out.length}>{code.join("\n")}</pre>);
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
