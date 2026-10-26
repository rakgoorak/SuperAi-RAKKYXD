type Item = { kind?: string; text?: string; title?: string; output?: string; status?: string; attachments?: string[]; tool?: string; at?: number; todos?: { text: string; status: string }[]; };
type TeamRun = { mode: string; prompt: string; output?: string; panel?: { seat: { name: string; provider: string }; output: string; error?: string }[]; tasks?: { title: string; output: string; error?: string }[]; error?: string; };
export function exportFilename(title: string, format: 'md' | 'json') {
  let name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').slice(0, 100) || 'conversation';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `conversation-${name}`;
  return `${name}.${format}`;
}
const fence = (value: string) => {
  const ticks = '`'.repeat(Math.max(3, ...Array.from(value.matchAll(/`+/g), item => item[0].length + 1)));
  return `${ticks}text\n${value}\n${ticks}`;
};
export function conversationMarkdown(title: string, items: Item[]) {
  return `# ${title}\n\n${items.map(item => {
    if (item.kind === 'user') return `## ผู้ใช้\n\n${item.text || ''}${item.attachments?.length ? `\n\nไฟล์แนบ: ${item.attachments.join(', ')}` : ''}`;
    if (item.kind === 'assistant') return `## AI\n\n${item.text || ''}`;
    if (item.kind === 'tool') return `### เครื่องมือ: ${item.title || item.tool || ''} (${item.status || ''})\n\n${fence(item.output || '')}`;
    if (item.kind === 'todos') return `### รายการงาน\n\n${(item.todos || []).map(todo => `- [${todo.status === 'completed' ? 'x' : ' '}] ${todo.text}`).join('\n')}`;
    return item.text ? `> ${item.text.split('\n').join('\n> ')}` : '';
  }).filter(Boolean).join('\n\n')}\n`;
}
export function teamMarkdown(title: string, runs: TeamRun[]) {
  return `# ${title}\n\n${runs.map(run => [
    `## ผู้ใช้\n\n${run.prompt}`,
    ...(run.panel || []).map(answer => `### ${answer.seat.name} (${answer.seat.provider})\n\n${answer.output || answer.error || ''}`),
    ...(run.tasks || []).map(task => `### ${task.title}\n\n${task.output || task.error || ''}`),
    run.output ? `## คำตอบสรุป\n\n${run.output}` : '',
    run.error ? `> ข้อผิดพลาด: ${run.error}` : '',
  ].filter(Boolean).join('\n\n')).join('\n\n---\n\n')}\n`;
}
