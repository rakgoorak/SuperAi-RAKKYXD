import { useCallback, useEffect, useState, type SetStateAction } from 'react';

const STORAGE_KEY = 'superai-drafts-v1';

export function composerDraftKey(workspaceId: string, mode: 'code' | 'agent' | 'chat', sessionId: string, target: 'active' | 'all') {
  return JSON.stringify([workspaceId, mode, ...(mode === 'code' ? [target, target === 'active' ? sessionId : ''] : [])]);
}

/** Setters capture their destination, so a pending send cannot clear another draft. */
export function useComposerDrafts(scopeKey: string) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        return Object.fromEntries(Object.entries(stored).filter(([, value]) => typeof value === 'string'));
      }
      const legacy = localStorage.getItem('superai-draft');
      return legacy ? { [scopeKey]: legacy } : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
      localStorage.removeItem('superai-draft');
    } catch { /* Drafts remain available in memory if storage is unavailable. */ }
  }, [drafts]);
  const setDraftFor = useCallback((key: string, value: SetStateAction<string>) => {
    setDrafts(current => {
      const next = typeof value === 'function' ? value(current[key] || '') : value;
      const updated = { ...current };
      if (next) updated[key] = next;
      else delete updated[key];
      return updated;
    });
  }, []);
  const setDraft = useCallback((value: SetStateAction<string>) => setDraftFor(scopeKey, value), [scopeKey, setDraftFor]);
  return { draft: drafts[scopeKey] || '', setDraft, setDraftFor };
}
