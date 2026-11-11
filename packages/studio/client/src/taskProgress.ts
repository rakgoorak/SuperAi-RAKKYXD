/** Activity is evidence of work, never evidence that a checklist entry is complete. */
export function taskProgressNote(items: { kind: string; at: number }[], index: number, updatedAt = items[index]?.at ?? 0, completed = false): string {
  let count = 0;
  for (const item of items.slice(index + 1)) {
    if (item.kind === 'user') break;
    if (item.kind === 'tool' && item.at > updatedAt) count++;
  }
  if (count) return `มีกิจกรรม ${count} ครั้งหลังอัปเดตรายการ · ยังไม่ยืนยันความคืบหน้าของแต่ละข้อ`;
  return completed ? 'AI รายงานว่ารายการงานเสร็จแล้ว' : 'สถานะล่าสุดที่ AI รายงาน';
}
