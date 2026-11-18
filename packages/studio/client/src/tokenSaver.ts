import { useEffect, useState } from 'react';
import type { ResponseStyle } from './responseStyle';

/**
 * Token saver: one switch, shared by every chat, that spends fewer of the user's tokens.
 * - answers come in the short style (whatever style is picked),
 * - no AI call after each answer to guess the next message,
 * - Agent team and multi-AI send less earlier history (the server shortens it).
 * The model and effort stay as chosen: those are the user's call.
 */
const KEY = 'superai-token-saver';
const EVENT = 'superai:token-saver';

export function loadTokenSaver(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
export function saveTokenSaver(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  window.dispatchEvent(new CustomEvent(EVENT));
}
/** The answer style actually sent: short while the token saver is on. */
export const styleToSend = (style: ResponseStyle | undefined): ResponseStyle | undefined => loadTokenSaver() ? 'concise' : style;

export function useTokenSaver() {
  const [on, setOn] = useState(loadTokenSaver);
  useEffect(() => {
    const sync = () => setOn(loadTokenSaver());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return [on, saveTokenSaver] as const;
}
