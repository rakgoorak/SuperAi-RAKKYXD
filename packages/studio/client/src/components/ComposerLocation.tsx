import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder, GitBranch, ChevronDown, ChevronLeft, ChevronRight, Check, Plus, X, GitFork } from 'lucide-react';
import { api, post, type Session, type Workspace } from '../api';
import { WorktreeModal } from './WorktreeModal';
import '../composer-location.css';
import { tr } from '../i18n';

interface Context { cwd: string; git: string; branch: string | null; commit: string | null }
export function ComposerLocation({ workspace, recipients, workspaces = [], onSelectWorkspace, onOpenFolder, onSelectWorktree }: { workspace?: Workspace; recipients?: Session[]; workspaces?: Workspace[]; onSelectWorkspace?: (id: string) => void; onOpenFolder?: () => void; onSelectWorktree?: (path: string) => void }) {
  const paths = [...new Set((recipients || []).map(session => session.cwd || workspace?.rootPath || '').filter(Boolean))];
  const multiple = paths.length > 1;
  const cwd = paths[0] || workspace?.rootPath || '';
  const sessionId = recipients?.[0]?.id;
  const endpoint = multiple || !workspace ? '' : sessionId ? `/api/terminals/${encodeURIComponent(sessionId)}/context` : `/api/workspaces/${encodeURIComponent(workspace.id)}/context`;
  const [result, setResult] = useState<{ key: string; value?: Context; error?: boolean }>();
  const [open, setOpen] = useState<'folder' | 'branches' | null>(null);
  const [query, setQuery] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [listing, setListing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [problem, setProblem] = useState('');
  const [revision, setRevision] = useState(0);
  const [worktreesOpen, setWorktreesOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), popup = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const close = (restore = false) => { setOpen(null); if (restore) trigger.current?.focus(); };
  const show = (view: 'folder' | 'branches', element?: HTMLButtonElement) => {
    if (element) trigger.current = element;
    setQuery(''); setProblem(''); setOpen(view);
  };
  useEffect(() => { setOpen(null); setWorktreesOpen(false); }, [endpoint, workspace?.id]);
  useEffect(() => {
    if (open !== 'branches' || !endpoint) return;
    let disposed = false;
    setListing(true); setProblem(''); setBranches([]);
    api<Context & { branches: string[] }>(endpoint.replace(/context$/, 'branches'))
      .then(data => { if (!disposed) { setBranches(Array.isArray(data.branches) ? data.branches : []); setResult({ key: endpoint, value: data }); } })
      .catch(error => { if (!disposed) setProblem(error.message); })
      .finally(() => { if (!disposed) setListing(false); });
    return () => { disposed = true; };
  }, [open, endpoint, revision]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect(), box = popup.current?.getBoundingClientRect();
      if (!rect || !box) return;
      const left = Math.max(12, Math.min(rect.left, innerWidth - box.width - 12));
      const top = Math.max(12, Math.min(rect.top - box.height - 8, innerHeight - box.height - 12));
      setPosition(old => old.left === left && old.top === top ? old : { left, top });
    };
    place();
    const observer = new ResizeObserver(place);
    if (popup.current) observer.observe(popup.current);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    (popup.current?.querySelector<HTMLElement>('input') || popup.current?.querySelector<HTMLElement>('button'))?.focus();
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!popup.current?.contains(event.target as Node) && !root.current?.contains(event.target as Node) && !switching) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !switching) { event.preventDefault(); event.stopPropagation(); close(true); } };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape, true);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape, true); };
  }, [open, switching]);
  const changeBranch = async (name: string) => {
    if (switching) return;
    if (value?.branch === name) { close(true); return; }
    setSwitching(true); setProblem('');
    try {
      const data = await post<Context>(endpoint.replace(/context$/, 'branches'), { branch: name, cwd });
      setResult({ key: endpoint, value: data }); setRevision(old => old + 1); close(true);
    } catch (error) { setProblem((error as Error).message); }
    finally { setSwitching(false); }
  };
  useEffect(() => {
    if (!endpoint) return;
    let disposed = false, loading = false;
    const controller = new AbortController();
    const load = async () => {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error('context unavailable');
        const value = await response.json() as Context;
        if (!value || typeof value.cwd !== 'string' || typeof value.git !== 'string') throw new Error('invalid context');
        if (!disposed) setResult({ key: endpoint, value });
      } catch { if (!disposed) setResult({ key: endpoint, error: true }); }
      finally { loading = false; }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    window.addEventListener('focus', load);
    return () => { disposed = true; controller.abort(); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [endpoint, cwd, revision]);
  const value = result?.key === endpoint ? result.value : undefined;
  const branch = value?.git === 'ready' ? value.branch || (value.commit ? `Detached HEAD · ${value.commit}` : tr("อ่าน branch ไม่ได้")) : value?.git === 'none' ? tr("ไม่ได้ใช้ Git") : result?.key === endpoint ? tr("อ่าน Git ไม่ได้") : tr("กำลังอ่าน branch…");
  return <><div ref={root} className="composer-location" aria-label={tr("พื้นที่ทำงานของข้อความนี้")}>
    <button className="composer-folder" aria-label={tr("เลือกโฟลเดอร์ทำงาน")} aria-haspopup="dialog" aria-expanded={open === 'folder'} title={multiple ? paths.join('\n') : cwd} onClick={event => open ? close() : show('folder', event.currentTarget)}><Folder size={13} /><span>{multiple ? tr`หลายโฟลเดอร์ (${paths.length})` : cwd.split(/[\\/]/).filter(Boolean).pop() || tr("เลือกโฟลเดอร์")}</span><ChevronDown size={11} /></button>
    {cwd && !multiple && <button className="composer-branch" aria-label={tr("เลือก Git branch")} aria-haspopup="dialog" aria-expanded={open === 'branches'} title={branch} onClick={event => open ? close() : show('branches', event.currentTarget)}><GitBranch size={13} /><span>{branch}</span><ChevronDown size={11} /></button>}
    {multiple && <span className="composer-branch">{tr("ส่งตามโฟลเดอร์ของแต่ละ session")}</span>}
  </div>
  {open && createPortal(<div ref={popup} className="composer-context-popover" role="dialog" aria-label={open === 'folder' ? tr("เลือกโฟลเดอร์") : tr("เลือก branch")} style={position} onKeyDown={event => {
    if (event.key === 'Escape' && !switching) { event.stopPropagation(); close(true); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; const index = items.indexOf(document.activeElement as HTMLButtonElement); const next = items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; event.preventDefault(); next?.focus(); }
  }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && !root.current?.contains(event.relatedTarget as Node) && !switching) close(); }}>
    <header>{open === 'branches' && <button aria-label={tr("กลับไปเลือกโฟลเดอร์")} disabled={switching} onClick={() => show('folder')}><ChevronLeft size={15} /></button>}<strong>{open === 'folder' ? tr("โฟลเดอร์ทำงาน") : 'Git branch'}</strong><button aria-label={tr("ปิดเมนูพื้นที่ทำงาน")} disabled={switching} onClick={() => close(true)}><X size={15} /></button></header>
    <div className="context-menu-scroll">
      {open === 'folder' ? <>
        <p className="context-menu-caption">{tr("โปรเจกต์ของคุณ")}</p>
        {workspaces.map(item => <button className="context-menu-choice" key={item.id} title={item.rootPath} onClick={() => { onSelectWorkspace?.(item.id); close(true); }}><Folder size={15} /><span><strong>{item.name}</strong><small>{item.rootPath}</small></span>{item.id === workspace?.id && <Check size={15} />}</button>)}
        {!workspaces.length && <p className="context-menu-caption">{tr("ยังไม่มีโปรเจกต์ เลือกโฟลเดอร์เพื่อเริ่มงาน")}</p>}
        <div className="context-menu-divider" />
        <button className="context-menu-choice" onClick={() => { close(); onOpenFolder?.(); }}><Plus size={15} /><span>{tr("เพิ่มหรือเปิดโฟลเดอร์…")}</span></button>
        {cwd && <small className="context-current-path">{tr("โฟลเดอร์ของข้อความนี้")}<br />{multiple ? paths.join('\n') : cwd}</small>}
        <div className="context-menu-divider" />
        <button className="context-menu-choice" disabled={!endpoint} title={multiple ? tr("เลือก session เดียวก่อนสลับ branch") : branch} onClick={() => show('branches')}><GitBranch size={15} /><span>Branch</span><small>{multiple ? tr("หลายโฟลเดอร์") : branch}</small><ChevronRight size={14} /></button>
        <button className="context-menu-choice" disabled={!workspace} onClick={() => { close(); setWorktreesOpen(true); }}><GitFork size={15} /><span>{tr("จัดการ Worktree")}</span><ChevronRight size={14} /></button>
      </> : <>
        <input autoFocus aria-label={tr("ค้นหา branch")} placeholder={tr("ค้นหา branch…")} value={query} disabled={switching} onChange={event => setQuery(event.target.value)} />
        {listing && <p role="status" className="context-menu-caption">{tr("กำลังอ่าน branch…")}</p>}
        {switching && <p role="status" className="context-menu-caption">{tr("กำลังสลับ branch…")}</p>}
        {branches.filter(name => name.toLowerCase().includes(query.toLowerCase())).map(name => <button className="context-menu-choice" key={name} disabled={switching} onClick={() => void changeBranch(name)}><GitBranch size={15} /><span>{name}</span>{value?.branch === name && <Check size={15} />}</button>)}
        {!listing && !problem && !branches.filter(name => name.toLowerCase().includes(query.toLowerCase())).length && <p className="context-menu-caption">{tr("ไม่พบ branch ที่ค้นหา")}</p>}
        <p className="context-menu-caption">{tr("สลับเฉพาะ branch ในเครื่อง โฟลเดอร์นี้ต้องไม่มีงานค้าง")}</p>
      </>}
      {problem && <div className="context-menu-error" role="alert">{problem}<button disabled={switching} onClick={() => setRevision(old => old + 1)}>{tr("โหลดรายการใหม่")}</button></div>}
    </div>
  </div>, document.body)}
  {workspace && <WorktreeModal open={worktreesOpen} wsId={workspace.id} onClose={() => setWorktreesOpen(false)} onSelectWorktree={onSelectWorktree ? tree => onSelectWorktree(tree.path) : undefined} />}
  </>;
}
