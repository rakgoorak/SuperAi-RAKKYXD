import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api, loginProvider, type ChatSkill } from '../api';
import { useModels, EFFORT_LABEL } from '../providers';
import { ModelCombo } from './ModelCombo';
import { useProviderAccess } from './ProviderAccess';
import { chatPrefs, hasChatPrefs, subscribeChatPrefs, onChatCommand, setChatPrefs } from '../chatControls';

/**
 * Account, Model, Effort and /skills of the chat session the bottom composer sends to.
 * Choices are kept per session (chatControls) and go with the next message.
 */
export function SessionChatControls({ sessionId, name, disabled, onDraft }: { sessionId: string; name: string; disabled: boolean; onDraft: (text: string) => void }) {
  const [agent, setAgent] = useState('');
  const [model, setModel] = useState(chatPrefs(sessionId).model);
  const [effort, setEffort] = useState(chatPrefs(sessionId).effort);
  const [skills, setSkills] = useState<ChatSkill[]>([]);
  const [skillId, setSkillId] = useState(chatPrefs(sessionId).skillId);
  const [showSkills, setShowSkills] = useState(false);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const { list, error: modelError } = useModels(agent);
  const { auth, checking, error: authError, check } = useProviderAccess(agent);
  const efforts = (model && list?.modelEfforts?.[model]) || list?.efforts || [];

  useEffect(() => {
    let disposed = false;
    api<{ agent: string; model: string; effort: string; skills: ChatSkill[] }>(`/api/terminals/${sessionId}/chat/settings`)
      .then((settings) => {
        if (disposed) return;
        setAgent(settings.agent);
        setSkills(settings.skills);
        // A choice made here earlier wins over the session's saved default.
        const saved = chatPrefs(sessionId);
        setModel(hasChatPrefs(sessionId) ? saved.model : settings.model);
        setEffort(hasChatPrefs(sessionId) ? saved.effort : settings.effort);
        setReady(true);
      })
      .catch((e) => !disposed && setProblem((e as Error).message));
    return () => { disposed = true; };
  }, [sessionId]);

  useEffect(() => { if (ready) setChatPrefs(sessionId, { model, effort, skillId }); }, [sessionId, model, effort, skillId, ready]);
  useEffect(() => subscribeChatPrefs(sessionId, () => setSkillId(chatPrefs(sessionId).skillId)), [sessionId]);
  useEffect(() => {
    const blocked = auth?.status === 'login-required' && agent !== 'opencode' || auth?.status === 'not-installed';
    setChatPrefs(sessionId, { blocked, note: auth?.note || '' });
  }, [sessionId, auth, agent]);

  const browseSkills = async () => {
    setShowSkills(true);
    try {
      const settings = await api<{ skills: ChatSkill[] }>(`/api/terminals/${sessionId}/chat/settings`);
      setSkills(settings.skills);
    } catch (e) { setProblem((e as Error).message); }
  };
  const login = async () => {
    setBusy(true); setProblem('');
    try { await loginProvider(agent, { sessionId }); }
    catch (e) { setProblem((e as Error).message); }
    finally { setBusy(false); }
  };

  // "/skills" and "/login" typed in the composer land here.
  useEffect(() => onChatCommand((id, command) => {
    if (id !== sessionId) return;
    if (command === 'skills') void browseSkills();
    else void login();
  }), [sessionId, agent]);

  return (
    <div className="session-chat-controls" aria-label={`การตั้งค่าแชท ${name}`}>
      <div className={`chat-account ${auth?.status || ''}`}>
        <small>{authError || auth?.note || (agent ? 'กำลังตรวจบัญชี…' : 'กำลังโหลดการตั้งค่า…')}</small>
        <button type="button" className="text-button" disabled={checking || busy || !agent} onClick={() => void check(true)}>ตรวจบัญชีอีกครั้ง</button>
        {auth?.status !== 'authenticated' && auth?.status !== 'not-installed' && <button type="button" className="text-button" disabled={!agent || busy || disabled} onClick={() => void login()}>เข้าสู่ระบบใน Terminal</button>}
      </div>
      {problem && <div className="chat-composer-problem" role="alert">{problem}<button type="button" onClick={() => setProblem('')} aria-label="ปิดข้อความ"><X size={12} /></button></div>}
      {showSkills && <div className="chat-skill-menu" aria-label="Skills ที่เรียกใช้ได้">
        <div><strong>Skills ของ {name}</strong><button type="button" className="text-button" onClick={() => setShowSkills(false)}>ปิด</button></div>
        {!skills.length && <p>ยังไม่พบ skill ในโปรเจกต์หรือโฟลเดอร์ของผู้ให้บริการ ติดตั้งได้จากหน้า Skills · คำสั่งที่มีเฉพาะใน CLI ให้ใช้หน้า Terminal</p>}
        {skills.map((skill) => <button type="button" key={skill.id} title={skill.path} onClick={() => {
          setSkillId(skill.id); onDraft(`/skill ${skill.name} `); setShowSkills(false);
        }}><strong>/{skill.name}</strong><small>{skill.source} · {skill.description || 'ใช้ skill นี้'}</small></button>)}
      </div>}
      <div className="chat-model-controls">
        <label>Model<ModelCombo label={`Model ในแชท ${name}`} value={model} options={list?.models || []} placeholder="ค่าเริ่มต้นของ CLI" disabled={disabled || !ready}
          onChange={(value) => { setModel(value); setEffort(''); }} /></label>
        <label>Effort<select aria-label={`Effort ในแชท ${name}`} value={effort} disabled={disabled || !efforts.length} onChange={(e) => setEffort(e.target.value)}>
          <option value="">ค่าเริ่มต้น</option>{efforts.map((e) => <option key={e} value={e}>{EFFORT_LABEL[e] || e}</option>)}
        </select></label>
        <button type="button" className="text-button" disabled={disabled} onClick={() => void browseSkills()}>/skills</button>
        {skillId && <button type="button" className="text-button" onClick={() => setSkillId('')}>ยกเลิก skill</button>}
      </div>
      {modelError && <small className="muted">{modelError} · พิมพ์ชื่อ Model เองได้</small>}
    </div>
  );
}
