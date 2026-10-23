import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, loginProvider } from '../api';
import { useModels, EFFORT_LABEL } from '../providers';
import { ModelCombo } from './ModelCombo';
import { useProviderAccess } from './ProviderAccess';
import { chatPrefs, hasChatPrefs, onChatCommand, setChatPrefs } from '../chatControls';

/**
 * Account, Model and Effort of the chat session the bottom composer sends to.
 * Choices are kept per session (chatControls) and go with the next message.
 */
export function SessionChatControls({ sessionId, name, disabled }: { sessionId: string; name: string; disabled: boolean; onDraft?: (text: string) => void }) {
  const [agent, setAgent] = useState('');
  const [model, setModel] = useState(chatPrefs(sessionId).model);
  const [effort, setEffort] = useState(chatPrefs(sessionId).effort);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const { list, error: modelError } = useModels(agent);
  const { auth, checking, error: authError, check } = useProviderAccess(agent);
  const efforts = (model && list?.modelEfforts?.[model]) || list?.efforts || [];

  useEffect(() => {
    let disposed = false;
    api<{ agent: string; model: string; effort: string }>(`/api/terminals/${sessionId}/chat/settings`)
      .then((settings) => {
        if (disposed) return;
        setAgent(settings.agent);
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
      <details className={`account-menu ${auth?.status || ""}`} onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); event.stopPropagation(); } }}><summary aria-label="บัญชีของ session">{auth?.status === "authenticated" ? "เชื่อมต่อแล้ว" : "บัญชี AI"}</summary><div className={`chat-account ${auth?.status || ''}`}>
        <small>{authError || auth?.note || (agent ? 'กำลังตรวจบัญชี…' : 'กำลังโหลดการตั้งค่า…')}</small>
        <button type="button" className="text-button" disabled={checking || busy || !agent} onClick={() => void check(true)}>ตรวจบัญชีอีกครั้ง</button>
        {auth?.status !== 'authenticated' && auth?.status !== 'not-installed' && <button type="button" className="text-button" disabled={!agent || busy || disabled} onClick={() => void login()}>เข้าสู่ระบบใน Terminal</button>}
      </div>
      </details>
      {problem && <div className="chat-composer-problem" role="alert">{problem}<button type="button" onClick={() => setProblem('')} aria-label="ปิดข้อความ"><X size={12} /></button></div>}
      <div className="chat-model-controls">
        <label>Model<ModelCombo label={`Model ในแชท ${name}`} value={model} options={list?.models || []} placeholder="ค่าเริ่มต้นของ CLI" disabled={disabled || !ready}
          onChange={(value) => { setModel(value); setEffort(''); }} /></label>
        <label>Effort<select aria-label={`Effort ในแชท ${name}`} value={effort} disabled={disabled || !efforts.length} onChange={(e) => setEffort(e.target.value)}>
          <option value="">ค่าเริ่มต้น</option>{efforts.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e] || e}</option>)}
        </select></label>
      </div>
      {modelError && <small className="muted">{modelError} · พิมพ์ชื่อ Model เองได้</small>}
    </div>
  );
}
