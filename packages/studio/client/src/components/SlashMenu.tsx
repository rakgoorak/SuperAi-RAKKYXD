import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Command, X } from 'lucide-react';
import { api, type ChatSkill } from '../api';
import { setChatPrefs } from '../chatControls';

export interface SlashMenuHandle { keyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean; }
interface Props { draft: string; sessionId?: string; workspaceId?: string; providers: string[]; onDraft: (text: string) => void; }
interface Choice { id: string; label: string; description: string; text: string; skillId?: string; }

/** Matches a trailing slash command anywhere in draft: e.g. "/", "/rev", "ทำงานดีมาก /", "คำสั่ง /skill foo" */
export function extractSlashQuery(text: string): { query: string; slashIndex: number } | null {
  const match = /(?:^|\s)\/(?:(?:skills?|skill)\s+)?([^\s]*)$/.exec(text);
  if (!match) return null;
  const slashIndex = match.index + (/^\s/.test(match[0]) ? 1 : 0);
  return { query: (match[1] || '').toLowerCase(), slashIndex };
}

/** Offers only commands implemented by this composer and skills reported by its provider. */
export const SlashMenu = forwardRef<SlashMenuHandle, Props>(function SlashMenu({ draft, sessionId, workspaceId, providers, onDraft }, ref) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const [skills, setSkills] = useState<ChatSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const signature = providers.join(',');
  const eligible = !!(sessionId || (workspaceId && providers.length));
  const slashInfo = extractSlashQuery(draft);
  const searching = eligible && slashInfo !== null;
  const open = searching && dismissed !== draft;

  useLayoutEffect(() => {
    if (!open) return;
    const field = anchor.current?.parentElement;
    if (!field) return;
    const place = () => {
      const rect = field.getBoundingClientRect();
      const width = Math.min(520, rect.width, window.innerWidth - 24);
      setPosition({ width, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), bottom: window.innerHeight - rect.top + 8, maxHeight: Math.max(64, Math.min(320, rect.top - 20)) });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(field);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && !field.contains(event.target)) setDismissed(draft);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', dismiss); document.removeEventListener('focusin', dismiss); };
  }, [open, draft]);

  useEffect(() => { setDismissed(null); setActive(0); }, [draft, sessionId, workspaceId, signature]);

  useEffect(() => {
    if (!searching) return;
    let disposed = false;
    setLoading(true); setError(''); setSkills([]);
    const request = sessionId
      ? api<{ skills: ChatSkill[] }>(`/api/terminals/${sessionId}/chat/settings`).then(s => s.skills)
      : Promise.all(providers.map(key => { const [provider, accountId] = key.split(":"); return api<ChatSkill[]>(`/api/workspaces/${workspaceId}/chat-skills/${provider}${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`); })).then(lists => lists.flat());
    request.then(list => { if (!disposed) setSkills(list.filter((skill, index, all) => all.findIndex(s => s.name === skill.name) === index)); })
      .catch(() => { if (!disposed) setError('โหลดรายการ skill ไม่สำเร็จ ลองพิมพ์ / ใหม่อีกครั้ง'); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [searching, sessionId, workspaceId, signature]);

  const query = slashInfo?.query || '';
  const choices: Choice[] = [
    ...skills.map(skill => ({
      id: skill.id,
      label: skill.name,
      description: skill.description || `Skill จาก ${skill.source}`,
      text: `/${skill.name} `,
      skillId: skill.id,
    })),
    ...(sessionId ? [{ id: 'command-login', label: 'login', description: 'เปิดขั้นตอนเข้าสู่ระบบของ session นี้', text: '/login ' }] : []),
    { id: 'command-skills', label: 'skills', description: 'เปิดหน้ารายการ Skills ของระบบเพื่อค้นหาหรือติดตั้งเพิ่ม', text: '/skills ' },
  ].filter(choice => {
    if (!query) return true;
    return `${choice.label} ${choice.description}`.toLowerCase().includes(query);
  });

  const pick = (choice: Choice) => {
    if (sessionId) setChatPrefs(sessionId, { skillId: choice.skillId || '' });
    const current = extractSlashQuery(draft);
    if (current) {
      const prefix = draft.slice(0, current.slashIndex);
      const next = prefix + choice.text;
      onDraft(next);
      setDismissed(next);
    } else {
      onDraft(choice.text);
      setDismissed(choice.text);
    }
  };

  useImperativeHandle(ref, () => ({ keyDown(event) {
    if (!open || event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (event.key === 'Escape') { event.preventDefault(); setDismissed(draft); return true; }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      setActive(index => choices.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length : 0);
      return true;
    }
    if (event.key === 'Tab') { setDismissed(draft); return false; }
    if (event.key === 'Enter' && !event.shiftKey && choices[active]) {
      event.preventDefault();
      pick(choices[active]);
      return true;
    }
    return false;
  }}));

  useEffect(() => { document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, id]);
  useEffect(() => {
    const input = anchor.current?.parentElement?.querySelector('textarea');
    if (!input) return;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', String(open));
    if (open) input.setAttribute('aria-controls', `${id}-list`);
    if (open && choices[active]) input.setAttribute('aria-activedescendant', `${id}-${active}`);
    return () => { for (const attr of ['role', 'aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant']) input.removeAttribute(attr); };
  }, [open, active, id, choices.length]);

  return <><span ref={anchor} hidden />{open && createPortal(<div ref={popup} className="slash-menu" aria-label="คำสั่งและ Skills" style={position}>
    <header><strong><Command size={14} /> Skills และคำสั่ง <small>{choices.length}</small></strong><button type="button" aria-label="ปิดรายการคำสั่ง" onClick={() => setDismissed(draft)}><X size={15} /></button></header>
    <div role="listbox" id={`${id}-list`} aria-label="เลือก skill หรือคำสั่ง">
      {choices.map((choice, index) => <button type="button" role="option" aria-selected={active === index} id={`${id}-${index}`} key={choice.id} className={active === index ? 'active' : ''}
        title={choice.description} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(choice)}><span className="slash-symbol">/</span><span className="slash-choice"><strong>{choice.label}</strong><small>{choice.description}</small></span></button>)}
    </div>
    {loading && <p role="status">กำลังค้นหา skill ที่ใช้ได้…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !choices.length && <p>ไม่พบ skill ที่ตรงกัน · ติดตั้งเพิ่มได้จากหน้า Skills</p>}
    <footer><span>↑ ↓ เลือก · Enter เติม · Esc ปิด</span><span>ยังไม่ส่งข้อความ</span></footer>
  </div>, document.body)}</>;
});
