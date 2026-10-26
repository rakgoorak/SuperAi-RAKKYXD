import { useCallback, useEffect, useState } from 'react';
import { RESPONSE_STYLES, type ResponseStyle } from '../../server/ResponseStyle';
export { RESPONSE_STYLES, RESPONSE_STYLE_LABEL } from '../../server/ResponseStyle';
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
