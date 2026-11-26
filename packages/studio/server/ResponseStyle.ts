// Shared with the window (which bundles this file), so it must not import the server's i18n.
export const RESPONSE_STYLES = ['normal', 'concise', 'explanatory'] as const;
export type ResponseStyle = typeof RESPONSE_STYLES[number];
export const RESPONSE_STYLE_LABEL: Record<ResponseStyle, string> = { normal: 'ปกติ', concise: 'สั้นและตรงประเด็น', explanatory: 'อธิบายพร้อมตัวอย่าง' };
export function responseStyle(value: unknown): ResponseStyle {
  if (value === undefined) return 'normal';
  if (!RESPONSE_STYLES.includes(value as ResponseStyle)) throw new Error("Invalid response style");
  return value as ResponseStyle;
}
export function styleGuidance(style: ResponseStyle = 'normal'): string {
  return style === 'concise' ? 'Answer style: short and to the point. Keep the key facts and necessary caveats; never trade accuracy for brevity.'
    : style === 'explanatory' ? 'Answer style: explain step by step in plain language, give examples where they help, and note important limits.' : '';
}
