import { useEffect, useState } from 'react';
import { api } from './api';

export interface AccountProfile { id: string; provider: string; name: string; isDefault: boolean; system?: boolean }
export interface AccountProvider { provider: string; supported: boolean; note: string; profiles: AccountProfile[] }
let request: Promise<AccountProvider[]> | undefined;
export function loadAccounts(refresh = false) {
  if (refresh || !request) {
    request = api<AccountProvider[]>('/api/accounts');
    request.catch(() => { request = undefined; });
  }
  return request;
}
export async function accountsChanged() {
  await loadAccounts(true);
  window.dispatchEvent(new Event('superai:accounts-changed'));
}
export function useAccounts() {
  const [providers, setProviders] = useState<AccountProvider[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const update = () => { void loadAccounts().then(data => { if (active) { setProviders(data); setError(''); } }, e => { if (active) setError((e as Error).message); }); };
    update(); window.addEventListener('superai:accounts-changed', update);
    return () => { active = false; window.removeEventListener('superai:accounts-changed', update); };
  }, []);
  return { providers, error };
}
