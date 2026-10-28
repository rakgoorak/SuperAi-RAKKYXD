import type { ChatPermission } from './chatControls';

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
  return IDENTITIES[key] || { label: key, short: key, connection: `เชื่อมผ่าน ${id.startsWith('cli:') ? 'CLI' : 'Ollama'}`, attachments: 'ความสามารถขึ้นอยู่กับรุ่นที่เลือก' };
}

export function permissionDescription(provider: string, permission: ChatPermission) {
  if (permission === 'ask') return provider === 'codex' ? 'Codex ขออนุญาตรันคำสั่งและแก้ไฟล์ในแชท โดยใช้ sandbox และกฎสิทธิ์ของ Codex' : provider === 'opencode' ? 'แสดงคำขออนุญาตที่ OpenCode ส่งมา โดยยังใช้กฎสิทธิ์ของ OpenCode' : 'Claude ขออนุญาตสำหรับเครื่องมือที่ต้องอนุมัติในแชตก่อนทำงาน โดยยังใช้กฎสิทธิ์ที่ตั้งค่าไว้';
  if (permission === 'approve_all') return provider === 'opencode' ? 'OpenCode อนุมัติคำขออัตโนมัติ แต่กฎที่ตั้งเป็น deny ยังมีผล ต้องใช้ CLI รุ่นที่รองรับ --auto' : 'Antigravity อนุมัติเครื่องมืออัตโนมัติ ขอบเขตไฟล์และ sandbox ยังขึ้นอยู่กับการตั้งค่าของ CLI';
  if (permission === 'review') return 'Codex ตรวจคำขออนุมัติที่รองรับโดยอัตโนมัติภายใน sandbox ของโปรเจกต์ ขึ้นอยู่กับการรองรับของบัญชีและ CLI';
  if (permission === 'full') return provider === 'claude-code' ? 'Claude ข้ามการขออนุญาตเครื่องมือ ภายใต้ข้อจำกัดของระบบและการตั้งค่าที่บังคับใช้' : 'Codex รันโดยไม่มี sandbox และไม่ขออนุมัติ เข้าถึงไฟล์และเครือข่ายตามสิทธิ์ของโปรเซส';
  if (provider === 'claude-code') return permission === 'read' ? 'อ่าน ค้นเว็บ และวางแผน โดยไม่ให้แก้ไฟล์'
    : permission === 'edit' ? 'แก้ไฟล์และค้นเว็บได้ทันที การรันคำสั่งหรือเครื่องมืออื่นจะขออนุญาตในแชทก่อน'
      : 'แก้ไฟล์ รันคำสั่ง และค้นเว็บได้เอง เครื่องมืออื่น (เช่น MCP) จะขออนุญาตในแชทก่อน';
  if (permission === 'read') return 'อ่านและวางแผน โดยไม่ให้แก้ไฟล์';
  if (provider === 'codex') return 'Codex อนุญาตทั้งแก้ไฟล์และรันคำสั่งในพื้นที่โปรเจกต์ ตัวเลือกนี้ไม่ได้แยกสิทธิ์สองอย่างออกจากกัน';
  if (provider === 'opencode') return 'OpenCode ใช้ agent ที่ตั้งค่าไว้ สิทธิ์แก้ไฟล์และรันคำสั่งขึ้นอยู่กับการตั้งค่าของ agent นั้น';
  return permission === 'edit' ? 'ให้แก้ไฟล์ได้ การรันคำสั่งยังขึ้นอยู่กับสิทธิ์ของ CLI' : 'ให้แก้ไฟล์และรันคำสั่งได้เองตามสิทธิ์ของ CLI';
}

export function permissionLabel(provider: string, permission: ChatPermission) {
  if (permission === 'ask') return 'Ask for approval';
  if (permission === 'approve_all') return 'อนุมัติเครื่องมืออัตโนมัติ';
  if (permission === 'review') return 'Approve for me';
  if (permission === 'full') return 'Full access';
  if (provider === 'codex' && permission !== 'read') return permission === 'edit' ? 'แก้ไฟล์และรันคำสั่ง' : 'อัตโนมัติในโปรเจกต์';
  if (provider === 'opencode' && permission !== 'read') return permission === 'edit' ? 'ตามสิทธิ์ agent' : 'อัตโนมัติตาม agent';
  return { read: 'อ่านอย่างเดียว', edit: 'แก้ไฟล์ได้', auto: 'อัตโนมัติ' }[permission];
}
