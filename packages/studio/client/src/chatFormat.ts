// Labels shared by the chat view and its message actions.

/** "เมื่อสักครู่", "5 นาทีที่แล้ว", "14:32" or "23 ต.ค. 14:32", like Claude's message times. */
export function timeLabel(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'เมื่อสักครู่';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  const date = new Date(at), today = new Date(now);
  const clock = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === today.toDateString() ? clock : `${date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${clock}`;
}

/** 950 → "950", 1234 → "1.2k", like Claude's live token count. */
export function tokenLabel(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}
