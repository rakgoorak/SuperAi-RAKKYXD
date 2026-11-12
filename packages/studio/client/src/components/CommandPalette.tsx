import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Folder,
  Terminal,
  MessageSquare,
  Plus,
  Settings,
  History,
  GitBranch,
  Globe,
  BookOpen,
  Compass,
  X,
} from 'lucide-react';
import type { Session, Workspace } from '../api';
import { tr } from '../i18n';

interface CommandItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  activeWs: string;
  onSelectWorkspace: (id: string) => void;
  sessions: Session[];
  selectedSession: string;
  onSelectSession: (id: string) => void;
  onAction: (actionName: string) => void;
}

export function CommandPalette({
  open,
  onClose,
  workspaces,
  activeWs,
  onSelectWorkspace,
  sessions,
  selectedSession,
  onSelectSession,
  onAction,
}: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const items: CommandItem[] = [
    // Quick Actions
    {
      id: 'act-new-session',
      category: tr("คำสั่งด่วน"),
      title: tr("เปิด Session ใหม่"),
      subtitle: tr("เลือก CLI, Model และจำนวนแท็บ"),
      icon: <Plus size={15} style={{ color: 'var(--accent)' }} />,
      action: () => {
        onAction('session');
        onClose();
      },
    },
    {
      id: 'act-new-project',
      category: tr("คำสั่งด่วน"),
      title: tr("เพิ่มโปรเจกต์ใหม่"),
      subtitle: tr("เชื่อมต่อโฟลเดอร์บนเครื่อง"),
      icon: <Folder size={15} style={{ color: 'var(--accent)' }} />,
      action: () => {
        onAction('project');
        onClose();
      },
    },
    {
      id: 'act-settings',
      category: tr("คำสั่งด่วน"),
      title: tr("การตั้งค่าระบบ (Settings)"),
      subtitle: tr("จัดการ Model, Effort และเครื่องมือ"),
      icon: <Settings size={15} />,
      action: () => {
        onAction('settings');
        onClose();
      },
    },
    {
      id: 'act-tour',
      category: tr("คำสั่งด่วน"),
      title: tr("ทัวร์แนะนำโปรแกรม (Interactive Tour)"),
      subtitle: tr("เรียนรู้เครื่องมือหลัก 5 ขั้นตอน"),
      icon: <Compass size={15} style={{ color: 'var(--accent)' }} />,
      action: () => {
        onAction('tour');
        onClose();
      },
    },
    {
      id: 'act-history',
      category: tr("คำสั่งด่วน"),
      title: tr("ประวัติการสนทนา (History)"),
      subtitle: tr("ค้นหาข้อความและผลงานเก่า"),
      icon: <History size={15} />,
      action: () => {
        onAction('history');
        onClose();
      },
    },
    {
      id: 'act-changes',
      category: tr("คำสั่งด่วน"),
      title: tr("ตรวจการแก้ไขโค้ด (Git Changes)"),
      subtitle: tr("ดูไฟล์ที่เปลี่ยนแปลงและ Diff"),
      icon: <GitBranch size={15} />,
      action: () => {
        onAction('changes');
        onClose();
      },
    },
    {
      id: 'act-preview',
      category: tr("คำสั่งด่วน"),
      title: tr("เปิดหน้าต่าง Preview"),
      subtitle: tr("ดูตัวอย่างหน้าเว็บ localhost:3000"),
      icon: <Globe size={15} />,
      action: () => {
        onAction('preview');
        onClose();
      },
    },
    {
      id: 'act-setup',
      category: tr("คำสั่งด่วน"),
      title: tr("คู่มือการติดตั้ง (Setup Guide)"),
      subtitle: tr("ตรวจความพร้อมของ Node, Git และ CLIs"),
      icon: <BookOpen size={15} />,
      action: () => {
        onAction('setup');
        onClose();
      },
    },

    // Sessions
    ...sessions.map((s) => ({
      id: `session-${s.id}`,
      category: tr("เซสชัน"),
      title: s.name,
      subtitle: `${s.agentType || 'Terminal'} · ${s.id === selectedSession ? tr("แท็บปัจจุบัน") : s.status === 'running' ? tr("กำลังทำงาน") : tr("หยุดแล้ว")}`,
      icon: s.agentType ? <MessageSquare size={15} /> : <Terminal size={15} />,
      action: () => {
        onSelectSession(s.id);
        onClose();
      },
    })),

    // Projects
    ...workspaces.map((w) => ({
      id: `ws-${w.id}`,
      category: tr("โปรเจกต์"),
      title: w.name,
      subtitle: w.rootPath,
      icon: <Folder size={15} style={{ color: activeWs === w.id ? 'var(--accent)' : 'inherit' }} />,
      action: () => {
        onSelectWorkspace(w.id);
        onClose();
      },
    })),
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q)
      )
    : items;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((idx) => (filtered.length ? (idx + 1) % filtered.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((idx) => (filtered.length ? (idx - 1 + filtered.length) % filtered.length : 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) {
        filtered[activeIndex].action();
      }
    }
  };

  return createPortal(
    <div
      className="modal-backdrop command-palette-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="command-palette-dialog" role="dialog" aria-modal="true" aria-label={tr("ค้นหาคำสั่งด่วน")}>
        <div className="command-palette-search">
          <Search size={16} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={tr("ค้นหาเซสชัน, โปรเจกต์ หรือคำสั่งด่วน...")}
            aria-label={tr("ค้นหาคำสั่งด่วน")}
          />
          <button type="button" className="icon-button" onClick={onClose} title={tr("ปิด (Esc)")}>
            <X size={15} />
          </button>
        </div>

        <div className="command-palette-list" role="listbox" id={`${id}-list`}>
          {filtered.length === 0 ? (
            <div className="command-palette-empty">{tr("ไม่พบผลลัพธ์ที่ตรงกับ \"")}{query}"</div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`command-item ${activeIndex === index ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => item.action()}
              >
                <span className="command-item-icon">{item.icon}</span>
                <span className="command-item-content">
                  <strong className="command-item-title">{item.title}</strong>
                  {item.subtitle && <small className="command-item-subtitle">{item.subtitle}</small>}
                </span>
                <span className="command-item-cat">{item.category}</span>
              </button>
            ))
          )}
        </div>

        <footer className="command-palette-footer">
          <span>{tr("↑ ↓ นำทาง · Enter เลือก · Esc ปิด")}</span>
          <span>
            {tr("คีย์ลัด")} <kbd>Ctrl</kbd> + <kbd>K</kbd>
          </span>
        </footer>
      </div>
    </div>,
    document.body
  );
}
