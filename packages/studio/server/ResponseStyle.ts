// Shared with the window (which bundles this file), so it must not import the server's i18n.
export const RESPONSE_STYLES = ['normal', 'concise', 'explanatory'] as const;
export type ResponseStyle = typeof RESPONSE_STYLES[number];
export const RESPONSE_STYLE_LABEL: Record<ResponseStyle, string> = { normal: 'ปกติ', concise: 'สั้นและตรงประเด็น', explanatory: 'อธิบายพร้อมตัวอย่าง' };
export function responseStyle(value: unknown): ResponseStyle {
  if (value === undefined) return 'normal';
  if (!RESPONSE_STYLES.includes(value as ResponseStyle)) throw new Error("รูปแบบคำตอบไม่ถูกต้อง");
  return value as ResponseStyle;
}
export function styleGuidance(style: ResponseStyle = 'normal'): string {
  return style === 'concise' ? 'รูปแบบคำตอบ: ตอบสั้นและตรงประเด็น เก็บข้อเท็จจริงสำคัญและข้อจำกัดที่จำเป็น ไม่ลดความถูกต้องเพื่อให้สั้น'
    : style === 'explanatory' ? 'รูปแบบคำตอบ: อธิบายเป็นลำดับด้วยภาษาที่เข้าใจง่าย ยกตัวอย่างเมื่อช่วยให้เข้าใจ และระบุข้อจำกัดที่สำคัญ' : '';
}
