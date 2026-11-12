import { useCallback, useEffect, useState } from 'react';
import { RESPONSE_STYLES, type ResponseStyle } from '../../server/ResponseStyle';
export { RESPONSE_STYLES } from '../../server/ResponseStyle';
import { tr } from './i18n';
export const RESPONSE_STYLE_LABEL: Record<ResponseStyle, string> = { normal: tr('ปกติ'), concise: tr('สั้นและตรงประเด็น'), explanatory: tr('อธิบายพร้อมตัวอย่าง') };
export type { ResponseStyle } from '../../server/ResponseStyle';
export function loadResponseStyle(scope: string): ResponseStyle {
  try { const saved = localStorage.getItem(`superai-response-style:${scope}`); return RESPONSE_STYLES.includes(saved as ResponseStyle) ? saved as ResponseStyle : 'normal'; }
  catch { return 'normal'; }
}
export function useResponseStyle(scope: string) {
  const [state, setState] = useState(() => ({ scope, value: loadResponseStyle(scope) }));
  useEffect(() => setState({ scope, value: loadResponseStyle(scope) }), [scope]);
  const change = useCallback((value: ResponseStyle) => {
    localStorage.setItem(`superai-response-style:${scope}`, value);
    setState({ scope, value });
  }, [scope]);
  return [state.scope === scope ? state.value : loadResponseStyle(scope), change] as const;
}
