import { getLocale, tr } from './i18n';
type Item = {
  kind?: string;
  text?: string;
  title?: string;
  output?: string;
  status?: string;
  attachments?: string[];
  tool?: string;
  at?: number;
  todos?: { text: string; status: string }[];
};

type TeamRun = {
  mode: string;
  prompt: string;
  output?: string;
  panel?: { seat: { name: string; provider: string }; output: string; error?: string }[];
  tasks?: { title: string; output: string; error?: string }[];
  error?: string;
};

export function exportFilename(title: string, format: 'md' | 'json' | 'html') {
  let name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').slice(0, 100) || 'conversation';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `conversation-${name}`;
  return `${name}.${format}`;
}

const fence = (value: string) => {
  const ticks = '`'.repeat(Math.max(3, ...Array.from(value.matchAll(/`+/g), item => item[0].length + 1)));
  return `${ticks}text\n${value}\n${ticks}`;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function conversationMarkdown(title: string, items: Item[]) {
  return `# ${title}\n\n${items.map(item => {
    if (item.kind === 'user') return tr`## ผู้ใช้\n\n${item.text || ''}${item.attachments?.length ? tr`\n\nไฟล์แนบ: ${item.attachments.join(', ')}` : ''}`;
    if (item.kind === 'assistant') return `## AI\n\n${item.text || ''}`;
    if (item.kind === 'tool') return tr`### เครื่องมือ: ${item.title || item.tool || ''} (${item.status || ''})\n\n${fence(item.output || '')}`;
    if (item.kind === 'todos') return tr`### รายการงาน\n\n${(item.todos || []).map(todo => `- [${todo.status === 'completed' ? 'x' : ' '}] ${todo.text}`).join('\n')}`;
    return item.text ? `> ${item.text.split('\n').join('\n> ')}` : '';
  }).filter(Boolean).join('\n\n')}\n`;
}

export function teamMarkdown(title: string, runs: TeamRun[]) {
  return `# ${title}\n\n${runs.map(run => [
    tr`## ผู้ใช้\n\n${run.prompt}`,
    ...(run.panel || []).map(answer => `### ${answer.seat.name} (${answer.seat.provider})\n\n${answer.output || answer.error || ''}`),
    ...(run.tasks || []).map(task => `### ${task.title}\n\n${task.output || task.error || ''}`),
    run.output ? tr`## คำตอบสรุป\n\n${run.output}` : '',
    run.error ? tr`> ข้อผิดพลาด: ${run.error}` : '',
  ].filter(Boolean).join('\n\n')).join('\n\n---\n\n')}\n`;
}

export function conversationSummaryText(title: string, items: Item[]): string {
  const users = items.filter(i => i.kind === 'user');
  const assistants = items.filter(i => i.kind === 'assistant');
  const lastUser = users[users.length - 1]?.text || '';
  const lastAssistant = assistants[assistants.length - 1]?.text || '';
  return tr`### ${title}\n\n**คำขอ:** ${lastUser.slice(0, 500)}${lastUser.length > 500 ? '...' : ''}\n\n**ผลลัพธ์:**\n${lastAssistant.slice(0, 1500)}${lastAssistant.length > 1500 ? '...' : ''}\n\n_สร้างโดย SuperAi & RAKKYXD_`;
}

const HTML_STYLE = `
  :root { color-scheme: dark; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Thai", Helvetica, Arial, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    line-height: 1.6;
    margin: 0;
    padding: 32px 16px;
  }
  .container { max-width: 860px; margin: 0 auto; }
  header { border-bottom: 1px solid #30363d; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 600; }
  .meta { color: #8b949e; font-size: 13px; display: flex; gap: 12px; }
  .badge { background: #238636; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .entry { margin-bottom: 20px; border-radius: 8px; border: 1px solid #30363d; background: #161b22; overflow: hidden; }
  .entry-header { padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid #30363d; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
  .entry.user .entry-header { color: #58a6ff; }
  .entry.assistant .entry-header { color: #3fb950; }
  .entry-body { padding: 14px; white-space: pre-wrap; font-size: 14px; word-break: break-word; }
  .tool-details { margin-top: 8px; border: 1px solid #30363d; border-radius: 6px; padding: 6px 10px; background: #0d1117; }
  .tool-details summary { cursor: pointer; color: #a5d6ff; font-size: 12px; font-weight: 500; }
  .tool-details pre { margin: 8px 0 0 0; padding: 8px; background: #161b22; border-radius: 4px; overflow-x: auto; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .todos-list { list-style: none; padding-left: 0; margin: 8px 0; }
  .todos-list li { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 13px; }
  @media print {
    body { background: #fff; color: #000; }
    .entry { border-color: #ddd; background: #fafafa; }
    .tool-details { border-color: #eee; }
  }
`;

export function conversationHtml(title: string, items: Item[]): string {
  const content = items.map(item => {
    if (item.kind === 'user') {
      const attachments = item.attachments?.length ? `<div style="margin-top:8px;font-size:12px;color:#8b949e">📎 ${escapeHtml(tr("ไฟล์แนบ"))}: ${escapeHtml(item.attachments.join(', '))}</div>` : '';
      return `
        <div class="entry user">
          <div class="entry-header"><span>👤 ${escapeHtml(tr("ผู้ใช้"))}</span></div>
          <div class="entry-body">${escapeHtml(item.text || '')}${attachments}</div>
        </div>
      `;
    }
    if (item.kind === 'assistant') {
      return `
        <div class="entry assistant">
          <div class="entry-header"><span>🤖 ${escapeHtml(tr("ผู้ช่วย AI"))}</span></div>
          <div class="entry-body">${escapeHtml(item.text || '')}</div>
        </div>
      `;
    }
    if (item.kind === 'tool') {
      const status = item.status === 'failed' ? tr("ไม่สำเร็จ")
        : item.status === 'completed' ? tr("เสร็จแล้ว")
        : item.status === 'running' ? tr("กำลังทำงาน")
        : item.status || 'done';
      return `
        <div class="entry tool">
          <div class="entry-header"><span>🔧 ${escapeHtml(tr("เครื่องมือ"))}: ${escapeHtml(item.title || item.tool || '')}</span><span style="font-size:11px;color:${item.status === 'failed' ? '#f85149' : '#8b949e'}">${escapeHtml(status)}</span></div>
          <div class="entry-body">
            <details class="tool-details" open>
              <summary>${escapeHtml(tr("ผลลัพธ์เครื่องมือ"))}</summary>
              <pre><code>${escapeHtml(item.output || tr("ไม่มีผลลัพธ์"))}</code></pre>
            </details>
          </div>
        </div>
      `;
    }
    if (item.kind === 'todos') {
      const tasks = (item.todos || []).map(t => `<li><input type="checkbox" ${t.status === 'completed' ? 'checked' : ''} disabled /> ${escapeHtml(t.text)}</li>`).join('');
      return `
        <div class="entry todos">
          <div class="entry-header"><span>📋 ${escapeHtml(tr("รายการงาน"))}</span></div>
          <div class="entry-body"><ul class="todos-list">${tasks}</ul></div>
        </div>
      `;
    }
    return '';
  }).filter(Boolean).join('\n');

  const locale = getLocale();
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - SuperAi &amp; RAKKYXD</title>
  <style>${HTML_STYLE}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <span class="badge">SuperAi &amp; RAKKYXD</span>
        <span>${escapeHtml(tr("ส่งออกเมื่อ"))}: ${escapeHtml(new Date().toLocaleString(locale))}</span>
      </div>
    </header>
    <main>${content}</main>
  </div>
</body>
</html>`;
}

export function teamHtml(title: string, runs: TeamRun[]): string {
  const content = runs.map((run, idx) => {
    const answers = (run.panel || []).map(a => `
      <div style="margin: 8px 0; padding: 10px; background: rgba(255,255,255,0.02); border: 1px solid #30363d; border-radius: 6px;">
        <div style="font-weight: 600; font-size: 12px; color: #a5d6ff; margin-bottom: 4px;">${escapeHtml(a.seat.name)} (${escapeHtml(a.seat.provider)})</div>
        <div style="white-space: pre-wrap; font-size: 13px;">${escapeHtml(a.output || a.error || '')}</div>
      </div>
    `).join('');

    const tasks = (run.tasks || []).map(t => `
      <div style="margin: 6px 0; font-size: 13px;">
        <b>${escapeHtml(t.title)}:</b> ${escapeHtml(t.output || t.error || '')}
      </div>
    `).join('');

    return `
      <div class="entry" style="margin-bottom: 28px;">
        <div class="entry-header"><span>${escapeHtml(tr`รอบที่ ${idx + 1} (${run.mode})`)}</span></div>
        <div class="entry-body">
          <div style="font-weight: 600; margin-bottom: 6px; color: #58a6ff;">${escapeHtml(tr("คำสั่งของผู้ใช้:"))}</div>
          <div style="margin-bottom: 14px;">${escapeHtml(run.prompt)}</div>
          ${answers ? `<div style="font-weight: 600; margin-bottom: 6px;">${escapeHtml(tr("คำตอบจากแต่ละ AI:"))}</div>${answers}` : ''}
          ${tasks ? `<div style="font-weight: 600; margin: 12px 0 6px 0;">${escapeHtml(tr("ผลงาน Sub-agents:"))}</div>${tasks}` : ''}
          ${run.output ? `<div style="margin-top: 14px; padding: 12px; background: rgba(56, 139, 253, 0.1); border: 1px solid rgba(56, 139, 253, 0.4); border-radius: 6px;"><div style="font-weight: 600; color: #58a6ff; margin-bottom: 4px;">${escapeHtml(tr("สรุปผลลัพธ์:"))}</div>${escapeHtml(run.output)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('\n');

  const locale = getLocale();
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - SuperAi & RAKKYXD Team Report</title>
  <style>${HTML_STYLE}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">
        <span class="badge">Team Report</span>
        <span>${escapeHtml(tr("ส่งออกเมื่อ"))}: ${escapeHtml(new Date().toLocaleString(locale))}</span>
      </div>
    </header>
    <main>${content}</main>
  </div>
</body>
</html>`;
}
