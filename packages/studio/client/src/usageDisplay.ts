export interface UsageWindow {
  label: string; group?: string; remainingPercent: number | null;
  resetsAt?: string; resetsText?: string; note?: string;
}

/** Presentation order is independent of the order a provider prints its limits. */
export function orderUsageWindows(windows: UsageWindow[]): UsageWindow[] {
  const rank = (label: string) => /5\s*ชั่วโมง/.test(label) ? 0 : /รายสัปดาห์/.test(label) ? 1 : 2;
  return [...windows].sort((a, b) => rank(a.label) - rank(b.label));
}

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function usageResetLabel(w: UsageWindow, now = Date.now(), zone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  if (w.resetsAt && Number.isFinite(Date.parse(w.resetsAt))) {
    const at = new Date(w.resetsAt);
    if (at.getTime() <= now) return 'รีเซ็ตแล้ว';
    const parts = new Intl.DateTimeFormat('th-TH', {
      timeZone: zone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
    return `รีเซ็ต: ${part('day')} ${part('month')} ${part('hour')}:${part('minute')} (${zone})`;
  }
  // Claude supplies a display date without a year. Translate it without guessing a year
  // or interpreting its explicit timezone as the browser's timezone.
  const text = w.resetsText?.trim();
  if (!text) return '';
  const match = /^([a-z]{3})\s+(\d{1,2}),\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\(([^)]+)\)$/i.exec(text);
  if (match) {
    const month = EN_MONTHS.indexOf(match[1].toLowerCase());
    const day = Number(match[2]), hour = Number(match[3]), minute = Number(match[4] || 0);
    if (month >= 0 && day >= 1 && day <= 31 && hour >= 1 && hour <= 12 && minute < 60) {
      const hh = hour % 12 + (match[5].toLowerCase() === 'pm' ? 12 : 0);
      return `รีเซ็ต: ${day} ${MONTHS[month]} ${String(hh).padStart(2, '0')}:${String(minute).padStart(2, '0')} (${match[6]})`;
    }
  }
  return `รีเซ็ต: ${text}`;
}
