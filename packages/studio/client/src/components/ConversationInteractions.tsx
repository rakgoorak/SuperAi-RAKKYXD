import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Search, X, Bookmark, Trash2 } from 'lucide-react';
import { post, type Session } from '../api';
import { messageContexts, saveMessageContexts } from '../conversationContext';
import { prepareMessage } from '../recovery';
import '../conversation-interactions.css';
import { tr } from '../i18n';

interface Message { id: string; kind: string; text?: string; }
interface Chapter { id: string; label: string; }
interface MenuState { x: number; y: number; id: string; selection: string; plain: string; code?: string; }
type Highlights = { set(name: string, value: unknown): void; delete(name: string): void };
const highlights = () => (CSS as typeof CSS & { highlights?: Highlights }).highlights;
const HighlightClass = () => (window as typeof window & { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;

function bodyText(body: HTMLElement) {
  const copy = body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('button,.md-code-header,[data-copy-exclude]').forEach(node => node.remove());
  copy.style.cssText = 'position:fixed;left:-100000px;top:0;white-space:pre-wrap;opacity:0;pointer-events:none;';
  copy.setAttribute('aria-hidden', 'true');
  document.body.append(copy);
  const text = copy.innerText;
  copy.remove();
  return text.trim();
}

/** A finder never replaces React's text nodes: native selection and streaming remain intact. */
export function ConversationInteractions({ sessionId, active, messages, revision, onSearch, children }: {
  sessionId: string; active: boolean; messages: Message[]; revision: unknown; onSearch: (value: string) => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const menuElement = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const ranges = useRef<Range[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [domVersion, setDomVersion] = useState(0);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [selection, setSelection] = useState<MenuState | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const chapterKey = `superai-chapters:${sessionId}`;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const matchName = `matches-${sessionId.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const activeName = `${matchName}-active`;
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(chapterKey) || '[]');
      setChapters(Array.isArray(saved) ? saved.filter((item): item is Chapter => !!item && typeof item.id === 'string' && typeof item.label === 'string') : []);
    } catch { setChapters([]); }
  }, [chapterKey]);
  useEffect(() => {
    const content = root.current?.querySelector('.chat-view');
    if (!open || !content) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setDomVersion(value => value + 1));
    });
    observer.observe(content, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['open', 'hidden'] });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [open]);

  useLayoutEffect(() => {
    const found: Range[] = [];
    const needle = open ? query.toLowerCase() : '';
    if (needle && root.current) {
      root.current.querySelectorAll<HTMLElement>('[data-message-body],[data-search-body]').forEach(body => {
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: node =>
          node.parentElement?.closest('button,.md-code-header,[hidden]') || !node.parentElement?.getClientRects().length ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
        const nodes: { node: Text; start: number; end: number }[] = [];
        let text = '', previousBlock: Element | null = null;
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const block = node.parentElement?.closest('p,h1,h2,h3,h4,li,pre,td,th,blockquote') || null;
          if (nodes.length && block !== previousBlock) text += '\n';
          const start = text.length;
          text += (node as Text).data.toLowerCase();
          nodes.push({ node: node as Text, start, end: text.length }); previousBlock = block;
        }
        let offset = 0;
        while ((offset = text.indexOf(needle, offset)) >= 0) {
          const range = document.createRange();
          const end = offset + needle.length;
          for (const item of nodes) {
            if (offset >= item.start && offset < item.end) range.setStart(item.node, Math.min(item.node.length, offset - item.start));
            if (end > item.start && end <= item.end) { range.setEnd(item.node, Math.min(item.node.length, end - item.start)); break; }
          }
          found.push(range); offset = end;
        }
      });
    }
    ranges.current = found;
    setCount(found.length);
    setIndex(current => Math.min(current, Math.max(0, found.length - 1)));
    const Highlight = HighlightClass();
    if (Highlight && found.length) highlights()?.set(matchName, new Highlight(...found));
    else highlights()?.delete(matchName);
    return () => { highlights()?.delete(matchName); highlights()?.delete(activeName); };
  }, [query, open, revision, domVersion, matchName, activeName]);

  useLayoutEffect(() => {
    const range = ranges.current[index];
    const Highlight = HighlightClass();
    if (range && open) {
      if (Highlight) highlights()?.set(activeName, new Highlight(range));
      const element = range.startContainer.parentElement;
      element?.scrollIntoView({ block: 'center', inline: 'nearest' });
      // scrollIntoView alone cannot reach an occurrence deep inside one tall paragraph.
      const scroller = element?.closest<HTMLElement>('.chat-scroll');
      if (scroller) {
        const rect = range.getBoundingClientRect(), bounds = scroller.getBoundingClientRect();
        scroller.scrollTop += rect.top - bounds.top - bounds.height / 2;
      }
    } else highlights()?.delete(activeName);
  }, [index, count, query, open, revision, domVersion, activeName]);

  const closeFinder = () => { setOpen(false); setQuery(''); onSearch(''); returnFocus.current?.focus({ preventScroll: true }); };
  const move = (delta: number) => { if (count) setIndex(current => (current + delta + count) % count); };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!active) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (!open) returnFocus.current = document.activeElement as HTMLElement;
        setOpen(true); requestAnimationFrame(() => { input.current?.focus(); input.current?.select(); });
      }
      if (event.key === 'Escape' && open && !menu) { event.preventDefault(); closeFinder(); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [active, open, menu]);

  useEffect(() => {
    const update = () => {
      if (menu) return;
      const selected = window.getSelection();
      if (!active || !selected || selected.isCollapsed || !selected.rangeCount) { setSelection(null); return; }
      const range = selected.getRangeAt(0);
      const start = (range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as HTMLElement)?.closest<HTMLElement>('[data-message-body]');
      const end = (range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentElement : range.endContainer as HTMLElement)?.closest('[data-message-body]');
      if (!start || start !== end || !root.current?.contains(start) || !selected.toString().trim()) { setSelection(null); return; }
      const rect = range.getBoundingClientRect();
      setSelection({ x: Math.max(8, Math.min(innerWidth - 230, rect.left + rect.width / 2 - 110)), y: Math.max(8, Math.min(innerHeight - 42, rect.top - 40)), id: start.dataset.messageBody!, selection: selected.toString(), plain: '' });
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('pointerup', update);
    const hideOnScroll = () => { if (!menu) setSelection(null); };
    root.current?.addEventListener('scroll', hideOnScroll, true);
    return () => {
      document.removeEventListener('selectionchange', update); document.removeEventListener('pointerup', update);
      root.current?.removeEventListener('scroll', hideOnScroll, true);
    };
  }, [active, menu]);

  useEffect(() => {
    if (!active) { setMenu(null); setSelection(null); setOpen(false); setQuery(''); onSearch(''); }
  }, [active, onSearch]);

  const closeMenu = () => { setMenu(null); returnFocus.current?.focus({ preventScroll: true }); };
  useLayoutEffect(() => {
    if (!menu || !menuElement.current) return;
    const element = menuElement.current, rect = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(menu.x, innerWidth - rect.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(menu.y, innerHeight - rect.height - 8))}px`;
    element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!element.contains(event.target as Node)) setMenu(null); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); }
    };
    const dismiss = () => setMenu(null);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    window.addEventListener('resize', dismiss); root.current?.addEventListener('scroll', dismiss, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); window.removeEventListener('resize', dismiss); root.current?.removeEventListener('scroll', dismiss, true); };
  }, [menu]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setProblem(''); closeMenu(); }
    catch { setProblem(tr("คัดลอกไม่ได้ กรุณาลองอีกครั้งหรือกด Ctrl+C")); }
  };
  const attach = (target: MenuState) => {
    try {
      const text = target.selection || target.plain || messages.find(item => item.id === target.id)?.text || '';
      const items = messageContexts(sessionId);
      if (!items.some(item => item.messageId === target.id && item.text === text)) saveMessageContexts(sessionId, [...items, { id: crypto.randomUUID(), messageId: target.id, text }]);
      setMenu(null); setSelection(null); setProblem('');
      prepareMessage('', sessionId, { append: true });
    } catch { setProblem(tr("บันทึกข้อความอ้างอิงไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ")); }
  };
  const reply = (target: MenuState) => {
    const quote = (target.selection || target.plain).split('\n').map(line => `> ${line}`).join('\n');
    setMenu(null); setSelection(null); window.getSelection()?.removeAllRanges();
    prepareMessage(`${quote}\n\n`, sessionId, { append: true });
  };
  const saveChapters = (next: Chapter[]) => {
    try { localStorage.setItem(chapterKey, JSON.stringify(next)); setChapters(next); setProblem(''); return true; }
    catch { setProblem(tr("บันทึกหมุดไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ")); return false; }
  };
  const fork = async (target: MenuState, side = false) => {
    if (busy) return;
    setBusy(true); setProblem('');
    try {
      const session = await post<Session>(`/api/terminals/${encodeURIComponent(sessionId)}/chat/fork`, { messageId: target.id, ...(side ? { selection: target.selection || target.plain } : {}) });
      window.dispatchEvent(new CustomEvent('superai:fork-created', { detail: { session, sourceId: sessionId, side } }));
      setMenu(null); setSelection(null); window.getSelection()?.removeAllRanges();
    } catch (error) { setProblem((error as Error).message); }
    finally { setBusy(false); }
  };
  const message = menu && messages.find(item => item.id === menu.id);
  useEffect(() => {
    if (!active) return;
    const keyboard = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey && event.key.toLowerCase() === 'l' && (selection || menu)) {
        event.preventDefault(); attach((menu || selection)!);
      }
      if (!event.shiftKey && event.key.toLowerCase() === 'c' && menu?.selection) { event.preventDefault(); void copy(menu.selection); }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [active, menu, selection, sessionId]);
  return <div ref={root} className="conversation-interactions" tabIndex={-1} onContextMenu={event => {
    const body = (event.target as HTMLElement).closest<HTMLElement>('[data-message-body]');
    if (!body || !root.current?.contains(body)) return;
    event.preventDefault();
    returnFocus.current = document.activeElement as HTMLElement;
    const selected = window.getSelection();
    const text = selection?.id === body.dataset.messageBody && selected?.toString() ? selected.toString() : '';
    const pre = (event.target as HTMLElement).closest('pre');
    setMenu({ id: body.dataset.messageBody!, x: event.clientX, y: event.clientY, selection: text, plain: bodyText(body), ...(pre ? { code: pre.querySelector('code')?.textContent || pre.textContent || '' } : {}) });
    setSelection(null);
  }}>
    <style>{`::highlight(${matchName}){background:#806c28;color:#fff}::highlight(${activeName}){background:#edaa42;color:#171715}`}</style>
    {children}
    <button className="conversation-find-trigger" type="button" aria-label={tr("ค้นหาในบทสนทนา")} title={tr("ค้นหาในบทสนทนา (Ctrl+F)")} onClick={event => { returnFocus.current = event.currentTarget; setOpen(true); requestAnimationFrame(() => input.current?.focus()); }}><Search size={14} /></button>
    {open && <div className="conversation-find" role="search" aria-label={tr("ค้นหาในบทสนทนานี้")}>
      <input ref={input} aria-label={tr("คำค้นหาในบทสนทนา")} placeholder={tr("ค้นหา…")} value={query} onChange={event => { setQuery(event.target.value); onSearch(event.target.value); setIndex(0); }} onKeyDown={event => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); move(event.shiftKey ? -1 : 1); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeFinder(); }
      }} />
      <span role="status" aria-live="polite">{query ? `${count ? index + 1 : 0}/${count}` : '0/0'}</span>
      <button type="button" aria-label={tr("ผลก่อนหน้า")} disabled={!count} onClick={() => move(-1)}><ArrowUp size={14} /></button>
      <button type="button" aria-label={tr("ผลถัดไป")} disabled={!count} onClick={() => move(1)}><ArrowDown size={14} /></button>
      <button type="button" aria-label={tr("ปิดค้นหา")} onClick={closeFinder}><X size={14} /></button>
    </div>}
    {selection && !menu && createPortal(<div className="conversation-selection" role="toolbar" aria-label={tr("จัดการข้อความที่เลือก")} style={{ left: selection.x, top: selection.y }} onPointerDown={event => event.preventDefault()}>
      <button type="button" disabled={busy} onClick={() => void fork(selection, true)}>Start a side chat</button><button type="button" onClick={() => reply(selection)}>Reply</button>
    </div>, document.body)}
    {menu && createPortal(<div ref={menuElement} className="conversation-message-menu" role="menu" aria-label={tr("ตัวเลือกข้อความ")} style={{ left: menu.x, top: menu.y }} onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
      if (event.key === 'Tab') setMenu(null);
    }}>
      {menu.selection ? <button role="menuitem" onClick={() => void copy(menu.selection)}>Copy <kbd>Ctrl+C</kbd></button> : menu.code !== undefined && <button role="menuitem" onClick={() => void copy(menu.code!)}>Copy code</button>}
      <button role="menuitem" onClick={() => void copy(menu.plain)}>Copy message</button>
      <button role="menuitem" onClick={() => void copy(message?.text || '')}>Copy message as Markdown</button>
      <hr />
      <button role="menuitem" onClick={() => attach(menu)}>Attach {menu.selection ? 'selection' : 'message'} as context</button>
      <button role="menuitem" onClick={() => { if (saveChapters([...chapters.filter(chapter => chapter.id !== menu.id), { id: menu.id, label: (menu.selection || menu.plain).slice(0, 90) }])) setMenu(null); }}>Pin as chapter</button>
      <hr />
      <button role="menuitem" disabled={busy} onClick={() => void fork(menu)}>Fork from here<small>Starts a new session, keeps this one</small></button>
    </div>, document.body)}
    {!!chapters.length && <div className="conversation-chapters">
      <button type="button" aria-label={tr("หมุดบทสนทนา")} aria-expanded={chaptersOpen} onClick={() => setChaptersOpen(value => !value)}><Bookmark size={14} /><span>{chapters.length}</span></button>
      {chaptersOpen && <div className="conversation-chapter-list" aria-label={tr("รายการหมุด")}>{chapters.map(chapter => <div key={chapter.id}>
        <button type="button" onClick={() => {
          const body = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-message-body]') || []).find(item => item.dataset.messageBody === chapter.id);
          if (!body) { setProblem(tr("ข้อความนี้ไม่ได้อยู่ในประวัติที่โหลดแล้ว")); return; }
          body.scrollIntoView({ block: 'center' }); setChaptersOpen(false);
        }}>{chapter.label}</button><button type="button" aria-label={tr("เอาหมุดออก")} onClick={() => saveChapters(chapters.filter(item => item.id !== chapter.id))}><Trash2 size={13} /></button>
      </div>)}</div>}
    </div>}
    {problem && <div className="conversation-interaction-error" role="alert">{problem}<button type="button" aria-label={tr("ปิดข้อความแจ้งเตือน")} onClick={() => setProblem('')}><X size={13} /></button></div>}
  </div>;
}
