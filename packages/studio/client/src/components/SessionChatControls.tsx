import { useEffect, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { api, loginProvider } from '../api';
import { useModels, EFFORT_LABEL } from '../providers';
import { ModelCombo } from './ModelCombo';
import { useProviderAccess } from './ProviderAccess';
import { chatPrefs, hasChatPrefs, onChatCommand, setChatPrefs, PERMISSION_LABEL, type ChatPermission } from '../chatControls';
import { permissionDescription, permissionLabel, providerIdentity } from '../providerIdentity';
import { ProviderBadge } from './ProviderBadge';
import { ComposerOptions } from './ComposerOptions';
import { ResponseStyleSelect } from './ResponseStyleSelect';
import type { ResponseStyle } from '../responseStyle';

/**
 * Account, Model and Effort of the chat session the bottom composer sends to.
 * Choices are kept per session (chatControls) and go with the next message.
 */
export function SessionChatControls({ sessionId, name, disabled }: { sessionId: string; name: string; disabled: boolean; onDraft?: (text: string) => void }) {
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
  const { list, error: modelError, refresh: refreshModels } = useModels(agent);
  const { auth, checking, error: authError, check } = useProviderAccess(agent);
  const efforts = (model && list?.modelEfforts?.[model]) || list?.efforts || [];

  useEffect(() => { setIncludeProjectContext(chatPrefs(sessionId).includeProjectContext); }, [sessionId]);

  useEffect(() => {
    api<{ rules: string; files: string[] }>(`/api/terminals/${sessionId}/rules`)
      .then(setRules)
      .catch(() => {});
  }, [sessionId]);

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
      {/* Claude-style footer: what the AI may do on the left; which AI, model and effort on the right. */}
      <select className="chat-permission-select" aria-label={`สิทธิ์ของ ${name} ในข้อความถัดไป`} value={permission} disabled={disabled}
        title={agent ? permissionDescription(agent, permission) : 'CLI ที่ทำงานเบื้องหลังถามก่อนไม่ได้ จึงเลือกไว้ล่วงหน้า'}
        onChange={(e) => { const value = e.target.value as ChatPermission; setPermission(value); setChatPrefs(sessionId, { permission: value }); }}>
        {(Object.keys(PERMISSION_LABEL) as ChatPermission[]).filter(p => agent === 'codex' || (p !== 'review' && p !== 'full')).map((p) => <option key={p} value={p}>{p === 'auto' ? 'Auto' : permissionLabel(agent, p)}</option>)}
        {agent === 'codex' && <option value="ask-unavailable" disabled>Ask for approval (ใช้ใน Terminal)</option>}
      </select>
      {problem && <div className="chat-composer-problem" role="alert">{problem}<button type="button" onClick={() => setProblem('')} aria-label="ปิดข้อความ"><X size={12} /></button></div>}
      {agent && <ProviderBadge provider={agent} />}
      <div className="chat-model-controls">
        <label>Model<ModelCombo label={`Model ในแชท ${name}`} value={model} options={list?.models || []} onOpen={refreshModels} placeholder="ค่าเริ่มต้นของ CLI" disabled={disabled || !ready}
          onChange={(value) => { setModel(value); setEffort(''); }} /></label>
        {efforts.length > 0 && <select className="chat-effort-select" aria-label={`Effort ในแชท ${name}`} title="ระดับการคิด" value={effort} disabled={disabled} onChange={(e) => setEffort(e.target.value)}>
          <option value="">Effort เริ่มต้น</option>{efforts.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e] || e}</option>)}
        </select>}
      </div>
      <ComposerOptions label="ตัวเลือก AI" attention={!!authError || auth?.status === 'login-required' || auth?.status === 'not-installed'}>
        <ResponseStyleSelect value={style} disabled={disabled || !ready} onChange={value => { setStyle(value); setChatPrefs(sessionId, { responseStyle: value }); }} />
        <label><input type="checkbox" checked={includeProjectContext} disabled={disabled} onChange={e => { setIncludeProjectContext(e.target.checked); setChatPrefs(sessionId, { includeProjectContext: e.target.checked }); }} /> แนบบริบทโปรเจกต์จาก SuperAi</label>
        <small>ปิดเพื่อลดบริบทที่ SuperAi เพิ่มในการส่งครั้งถัดไป CLI อาจอ่านกฎของตัวเองและเก็บบริบทที่ส่งไปแล้วในประวัติ</small>
        {agent && <p className="permission-description">{permissionLabel(agent, permission)} · {permissionDescription(agent, permission)}</p>}
        <section className={`composer-option-account ${auth?.status || ''}`} aria-label="บัญชีของ session">
          <strong>{auth?.status === 'authenticated' ? 'บัญชีเชื่อมต่อแล้ว' : 'บัญชี AI'}</strong>
          <p>{authError || auth?.note || (agent ? 'กำลังตรวจบัญชี…' : 'กำลังโหลดการตั้งค่า…')}</p>
          <button type="button" className="text-button" disabled={checking || busy || !agent} onClick={() => void check(true)}>ตรวจบัญชีอีกครั้ง</button>
          {auth?.status !== 'authenticated' && auth?.status !== 'not-installed' && <button type="button" className="text-button" disabled={!agent || busy || disabled} onClick={() => void login()}>เข้าสู่ระบบใน Terminal</button>}
        </section>
        {rules?.files && rules.files.length > 0 && (
          <section className="composer-option-rules" aria-label="กฎประจำโปรเจกต์" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, margin: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)' }}>
              <FileText size={13} />
              <strong>กฎโปรเจกต์: {rules.files.join(', ')}</strong>
            </div>
            <small style={{ color: 'var(--dim)', fontSize: 11, display: 'block', marginTop: 2 }}>
              ส่งคำสั่งและแนวทางจากไฟล์ให้ AI อัตโนมัติ
            </small>
          </section>
        )}
        {agent && <section className="composer-option-capabilities"><p>{providerIdentity(agent).connection}</p><p>{providerIdentity(agent).attachments}</p><small>{agent === 'claude-code' ? 'เครื่องมือที่เกินสิทธิ์ที่เลือก Claude จะขออนุญาตในแชทก่อน' : agent === 'codex' ? 'Ask for approval แบบกดอนุมัติรายครั้งยังไม่รองรับในมุมมองแชต ใช้ Terminal ของ Codex หากต้องการอนุมัติใน CLI' : 'ตั้งสิทธิ์ไว้ล่วงหน้า · ยังไม่ถามอนุมัติเป็นรายเครื่องมือ'}</small></section>}
      </ComposerOptions>
      {modelError && <small className="muted">{modelError} · พิมพ์ชื่อ Model เองได้</small>}
    </div>
  );
}
