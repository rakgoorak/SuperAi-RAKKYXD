import { isCloud, PROVIDER_LABEL } from './providers';
import { tr } from './i18n';

type ProviderIdentity = { label: string; short: string; connection: string; attachments: string };

const IDENTITIES: Record<string, () => ProviderIdentity> = {
  'claude-code': () => ({ label: 'Claude', short: 'Claude', connection: tr("เชื่อมผ่าน Claude Code CLI"), attachments: tr("แนบไฟล์ให้ CLI อ่านจากโฟลเดอร์ทำงานได้") }),
  codex: () => ({ label: 'ChatGPT (Codex)', short: 'ChatGPT', connection: tr("เชื่อมผ่าน Codex CLI ด้วยบัญชี ChatGPT"), attachments: tr("ส่งรูปภาพให้ Codex โดยตรง ส่วนเอกสารให้ CLI อ่านจากไฟล์") }),
  antigravity: () => ({ label: 'Antigravity', short: 'Antigravity', connection: tr("เชื่อมผ่าน Antigravity CLI"), attachments: tr("แนบไฟล์ให้ CLI อ่านจากโฟลเดอร์ทำงานได้") }),
  opencode: () => ({ label: 'OpenCode', short: 'OpenCode', connection: tr("เชื่อมผ่าน OpenCode CLI"), attachments: tr("ส่งไฟล์แนบให้ OpenCode โดยตรง") }),
  freebuff: () => ({ label: 'Freebuff', short: 'Freebuff', connection: tr("ใช้งานผ่าน Terminal · เปิดได้ครั้งละ 1 ห้อง"), attachments: tr("ยังไม่มีมุมมองแชตและไม่รองรับโหมดทีม") }),
  terminal: () => ({ label: 'Terminal', short: 'Terminal', connection: tr("หน้าต่างคำสั่งในเครื่อง"), attachments: tr("ส่งข้อความและที่อยู่ไฟล์ให้โปรแกรมที่กำลังทำงาน") }),
};

export function providerIdentity(id: string) {
  const key = id.replace(/^cli:/, '');
  if (isCloud(key)) return { label: PROVIDER_LABEL[key] || key, short: PROVIDER_LABEL[key] || 'API', connection: tr("เชื่อมด้วย API Key ที่บันทึกใน SuperAi"), attachments: tr("ใช้เครื่องมืออ่านไฟล์ข้อความในโปรเจกต์ได้ ยังไม่รองรับรูป/PDF แนบในห้อง API") };
  return IDENTITIES[key]?.() || { label: key, short: key, connection: tr`เชื่อมผ่าน ${id.startsWith('cli:') ? 'CLI' : 'Ollama'}`, attachments: tr("ความสามารถขึ้นอยู่กับรุ่นที่เลือก") };
}
