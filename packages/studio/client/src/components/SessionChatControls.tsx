import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, loginProvider } from '../api';
import { useAccounts } from '../accounts';
import { useModels, EFFORT_LABEL } from '../providers';
import { isCloud } from '../providers';
import { ModelCombo } from './ModelCombo';
import { useProviderAccess } from './ProviderAccess';
import { chatPrefs, hasChatPrefs, onChatCommand, permissionChoices, setChatPrefs, type ChatPermission } from '../chatControls';
import { ProviderBadge } from './ProviderBadge';
import { ComposerOptions } from './ComposerOptions';
import { ResponseStyleSelect } from './ResponseStyleSelect';
import type { ResponseStyle } from '../responseStyle';

/**
 * Account, Model and Effort of the chat session the bottom composer sends to.
 * Choices are kept per session (chatControls) and go with the next message.
 */
export function SessionChatControls({ sessionId, name, disabled }: { sessionId: string; name: string; disabled: boolean; onDraft?: (text: string) => void }) {
  const [accountId, setAccountId] = useState("system");
  const [accountName, setAccountName] = useState("");
  const { providers: accountProviders } = useAccounts();
  const [agent, setAgent] = useState('');
  const [model, setModel] = useState(chatPrefs(sessionId).model);
  const [effort, setEffort] = useState(chatPrefs(sessionId).effort);
  const [permission, setPermission] = useState<ChatPermission>(chatPrefs(sessionId).permission);
  const [style, setStyle] = useState<ResponseStyle>(chatPrefs(sessionId).responseStyle);
  const [includeProjectContext, setIncludeProjectContext] = useState(chatPrefs(sessionId).includeProjectContext);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState<{ rules: string; files: string[] } | null>(null);
  const { list, error: modelError, refresh: refreshModels } = useModels(agent, accountId);
  const { auth, checking, error: authError, check } = useProviderAccess(agent, accountId);
  const profileName = accountProviders.find(p => p.provider === agent)?.profiles.find(p => p.id === accountId)?.name || accountName;
  const efforts = (model && list?.modelEfforts?.[model]) || list?.efforts || [];
  const choices = permissionChoices(agent);
  const profiles = accountProviders.find(p => p.provider === agent)?.profiles.length || 0;
  // A mode this AI no longer offers (saved by an older version) falls back to the default.
  useEffect(() => {
    if (!agent || choices.some(choice => choice.value === permission)) return;
    setPermission('auto'); setChatPrefs(sessionId, { permission: 'auto' });
  }, [agent, permission, sessionId]);

  useEffect(() => { setIncludeProjectContext(chatPrefs(sessionId).includeProjectContext); }, [sessionId]);

  useEffect(() => {
    api<{ rules: string; files: string[] }>(`/api/terminals/${sessionId}/rules`)
      .then(setRules)
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    let disposed = false;
    api<{ agent: string; accountId: string; accountName: string; model: string; effort: string }>(`/api/terminals/${sessionId}/chat/settings`)
      .then((settings) => {
        if (disposed) return;
        setAgent(settings.agent); setAccountId(settings.accountId); setAccountName(settings.accountName);
        // A choice made here earlier wins over the session's saved default.
        const saved = chatPrefs(sessionId);
        setModel(hasChatPrefs(sessionId) ? saved.model : settings.model);
        setEffort(hasChatPrefs(sessionId) ? saved.effort : settings.effort);
        setReady(true);
      })
      .catch((e) => !disposed && setProblem((e as Error).message));
    return () => { disposed = true; };
  }, [sessionId]);

  useEffect(() => { if (ready) setChatPrefs(sessionId, { model, effort }); }, [sessionId, model, effort, ready]);
  useEffect(() => {
    const blocked = auth?.status === 'login-required' && agent !== 'opencode' || auth?.status === 'not-installed';
    setChatPrefs(sessionId, { blocked, note: auth?.note || '' });
  }, [sessionId, auth, agent]);

  const login = async () => {
    setBusy(true); setProblem('');
    try { await loginProvider(agent, { sessionId }); }
    catch (e) { setProblem((e as Error).message); }
    finally { setBusy(false); }
  };

  // "/login" typed in the composer lands here.
  useEffect(() => onChatCommand((id, command) => {
    if (id !== sessionId) return;
    if (command === 'login') void login();
  }), [sessionId, agent]);

  return (
    <div className="session-chat-controls" aria-label={`การตั้งค่าแชท ${name}`}>
      {/* What the AI may do on the left; which AI, model and effort on the right. */}
      <select className="chat-permission-select" aria-label={`สิทธิ์ของ ${name} ในข้อความถัดไป`} value={permission} disabled={disabled}
        title={choices.find(choice => choice.value === permission)?.hint || 'สิ่งที่ AI ทำได้เองในข้อความถัดไป'}
        onChange={(e) => { const value = e.target.value as ChatPermission; setPermission(value); setChatPrefs(sessionId, { permission: value }); }}>
        {choices.map(choice => <option key={choice.value} value={choice.value} title={choice.hint}>{choice.label}</option>)}
      </select>
      {problem && <div className="chat-composer-problem" role="alert">{problem}<button type="button" onClick={() => setProblem('')} aria-label="ปิดข้อความ"><X size={12} /></button></div>}
      {agent && <ProviderBadge provider={agent} />}
      {ready && profiles > 1 && <span className="session-account-name" title="บัญชีที่ห้องนี้ใช้">{profileName}</span>}
      <div className="chat-model-controls">
        <label>Model<ModelCombo label={`Model ในแชท ${name}`} value={model} options={list?.models || []} onOpen={refreshModels} placeholder="ค่าเริ่มต้นของ CLI" disabled={disabled || !ready}
          onChange={(value) => { setModel(value); setEffort(''); }} /></label>
        {efforts.length > 0 && <select className="chat-effort-select" aria-label={`Effort ในแชท ${name}`} title="ระดับการคิด" value={effort} disabled={disabled} onChange={(e) => setEffort(e.target.value)}>
          <option value="">Effort เริ่มต้น</option>{efforts.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e] || e}</option>)}
        </select>}
      </div>
      <ComposerOptions label="ตัวเลือก AI" attention={!!authError || auth?.status === 'login-required' || auth?.status === 'not-installed'}>
        <ResponseStyleSelect value={style} disabled={disabled || !ready} onChange={value => { setStyle(value); setChatPrefs(sessionId, { responseStyle: value }); }} />
        <label title="ปิดเพื่อลดข้อความที่ SuperAi แนบไปกับข้อความถัดไป"><input type="checkbox" checked={includeProjectContext} disabled={disabled} onChange={e => { setIncludeProjectContext(e.target.checked); setChatPrefs(sessionId, { includeProjectContext: e.target.checked }); }} /> แนบบริบทโปรเจกต์{rules?.files?.length ? ` และกฎ (${rules.files.join(', ')})` : ''}</label>
        <section className={`composer-option-account ${auth?.status || ''}`} aria-label="บัญชีของ session">
          <strong>{isCloud(agent) ? 'API Key' : profileName || 'บัญชี AI'}</strong>
          <p>{authError || auth?.note || (agent ? 'กำลังตรวจบัญชี…' : 'กำลังโหลดการตั้งค่า…')}</p>
          <button type="button" className="text-button" disabled={checking || busy || !agent} onClick={() => void check(true)}>ตรวจบัญชีอีกครั้ง</button>
          {!isCloud(agent) && auth?.status !== 'authenticated' && auth?.status !== 'not-installed' && <button type="button" className="text-button" disabled={!agent || busy || disabled} onClick={() => void login()}>เข้าสู่ระบบใน Terminal</button>}
        </section>
      </ComposerOptions>
      {modelError && <small className="muted">{modelError} · พิมพ์ชื่อ Model เองได้</small>}
    </div>
  );
}
