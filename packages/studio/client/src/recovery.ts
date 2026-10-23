export function recoveryHint(message: string) {
  if (/quota|rate.?limit|429|usage.?limit|โควตา|วงเงิน/i.test(message)) return 'โควตาหรืออัตราการใช้งานเต็ม รอรอบรีเซ็ตหรือเลือกผู้ให้บริการอื่นก่อนลองใหม่';
  if (/auth|login|sign.?in|401|403|credential|เข้าสู่ระบบ/i.test(message)) return 'ตรวจบัญชีและเข้าสู่ระบบผู้ให้บริการ แล้วลองใหม่';
  if (/network|fetch|connect|timeout|timed.?out|ECONN|เชื่อมต่อ/i.test(message)) return 'การเชื่อมต่อขัดข้อง ตรวจเครือข่ายและผู้ให้บริการ แล้วลองใหม่';
  return 'ตรวจรายละเอียดข้อผิดพลาดด้านล่าง แก้ข้อความหรือเครื่องมือก่อนลองใหม่';
}
export function prepareMessage(text: string, sessionId?: string) {
  window.dispatchEvent(new CustomEvent('superai:prepare-message', { detail: { text, sessionId } }));
}
export function showChanges(sessionId?: string) {
  window.dispatchEvent(new CustomEvent('superai:show-changes', { detail: { sessionId } }));
}
