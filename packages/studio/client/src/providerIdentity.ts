import { isCloud, PROVIDER_LABEL } from './providers';

const IDENTITIES: Record<string, { label: string; short: string; connection: string; attachments: string }> = {
  'claude-code': { label: 'Claude', short: 'Claude', connection: 'เชื่อมผ่าน Claude Code CLI', attachments: 'แนบไฟล์ให้ CLI อ่านจากโฟลเดอร์ทำงานได้' },
  codex: { label: 'ChatGPT (Codex)', short: 'ChatGPT', connection: 'เชื่อมผ่าน Codex CLI ด้วยบัญชี ChatGPT', attachments: 'ส่งรูปภาพให้ Codex โดยตรง ส่วนเอกสารให้ CLI อ่านจากไฟล์' },
  antigravity: { label: 'Antigravity', short: 'Antigravity', connection: 'เชื่อมผ่าน Antigravity CLI', attachments: 'แนบไฟล์ให้ CLI อ่านจากโฟลเดอร์ทำงานได้' },
  opencode: { label: 'OpenCode', short: 'OpenCode', connection: 'เชื่อมผ่าน OpenCode CLI', attachments: 'ส่งไฟล์แนบให้ OpenCode โดยตรง' },
  freebuff: { label: 'Freebuff', short: 'Freebuff', connection: 'ใช้งานผ่าน Terminal · เปิดได้ครั้งละ 1 ห้อง', attachments: 'ยังไม่มีมุมมองแชตและไม่รองรับโหมดทีม' },
  terminal: { label: 'Terminal', short: 'Terminal', connection: 'หน้าต่างคำสั่งในเครื่อง', attachments: 'ส่งข้อความและที่อยู่ไฟล์ให้โปรแกรมที่กำลังทำงาน' },
};

export function providerIdentity(id: string) {
  const key = id.replace(/^cli:/, '');
  if (isCloud(key)) return { label: PROVIDER_LABEL[key] || key, short: PROVIDER_LABEL[key] || 'API', connection: 'เชื่อมด้วย API Key ที่บันทึกใน SuperAi', attachments: 'ใช้เครื่องมืออ่านไฟล์ข้อความในโปรเจกต์ได้ ยังไม่รองรับรูป/PDF แนบในห้อง API' };
  return IDENTITIES[key] || { label: key, short: key, connection: `เชื่อมผ่าน ${id.startsWith('cli:') ? 'CLI' : 'Ollama'}`, attachments: 'ความสามารถขึ้นอยู่กับรุ่นที่เลือก' };
}
