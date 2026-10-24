import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { AtSign, FileCode, FileText, FileImage, File, X } from 'lucide-react';
import { api } from '../api';

export interface MentionMenuHandle {
  keyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

interface Props {
  draft: string;
  workspaceId?: string;
  onDraft: (text: string) => void;
}

export function extractMentionQuery(text: string): { query: string; mentionIndex: number } | null {
  const match = /(?:^|\s)@([^\s]*)$/.exec(text);
  if (!match) return null;
  const mentionIndex = match.index + (/^\s/.test(match[0]) ? 1 : 0);
  return { query: (match[1] || '').toLowerCase(), mentionIndex };
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'json':
    case 'html':
    case 'css':
    case 'py':
    case 'rs':
    case 'go':
    case 'sh':
    case 'cmd':
      return <FileCode size={15} />;
    case 'md':
    case 'txt':
    case 'pdf':
    case 'log':
      return <FileText size={15} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return <FileImage size={15} />;
    default:
      return <File size={15} />;
  }
}

export const MentionMenu = forwardRef<MentionMenuHandle, Props>(function MentionMenu(
  { draft, workspaceId, onDraft },
  ref
) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const mentionInfo = extractMentionQuery(draft);
  const searching = !!workspaceId && mentionInfo !== null;
  const open = searching && dismissed !== draft;

  useLayoutEffect(() => {
    if (!open) return;
    const field = anchor.current?.parentElement;
    if (!field) return;
    const place = () => {
      const rect = field.getBoundingClientRect();
      const width = Math.min(520, rect.width, window.innerWidth - 24);
      setPosition({
        width,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        bottom: window.innerHeight - rect.top + 8,
        maxHeight: Math.max(64, Math.min(320, rect.top - 20)),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(field);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && !field.contains(event.target)) {
        setDismissed(draft);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, [open, draft]);

  useEffect(() => {
    setDismissed(null);
    setActive(0);
  }, [draft, workspaceId]);

  const query = mentionInfo?.query || '';

  useEffect(() => {
    if (!searching || !workspaceId) return;
    let disposed = false;
    setLoading(true);
    setError('');

    const timer = setTimeout(() => {
      api<{ files: string[] }>(`/api/workspaces/${workspaceId}/files?query=${encodeURIComponent(query)}`)
        .then((res) => {
          if (!disposed) setFiles(res.files || []);
        })
        .catch(() => {
          if (!disposed) setError('ค้นหาไฟล์ในโปรเจกต์ไม่สำเร็จ');
        })
        .finally(() => {
          if (!disposed) setLoading(false);
        });
    }, 80);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [searching, workspaceId, query]);

  const pick = (filePath: string) => {
    const current = extractMentionQuery(draft);
    if (current) {
      const prefix = draft.slice(0, current.mentionIndex);
      const next = `${prefix}@${filePath} `;
      onDraft(next);
      setDismissed(next);
    } else {
      onDraft(`@${filePath} `);
      setDismissed(`@${filePath} `);
    }
  };

  useImperativeHandle(ref, () => ({
    keyDown(event) {
      if (!open || event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return false;
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissed(draft);
        return true;
      }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        setActive((index) =>
          files.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + files.length) % files.length : 0
        );
        return true;
      }
      if (event.key === 'Tab') {
        if (files[active]) {
          event.preventDefault();
          pick(files[active]);
          return true;
        }
        setDismissed(draft);
        return false;
      }
      if (event.key === 'Enter' && !event.shiftKey && files[active]) {
        event.preventDefault();
        pick(files[active]);
        return true;
      }
      return false;
    },
  }));

  useEffect(() => {
    document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, id]);

  return (
    <>
      <span ref={anchor} hidden />
      {open &&
        createPortal(
          <div ref={popup} className="slash-menu mention-menu" aria-label="อ้างอิงไฟล์" style={position}>
            <header>
              <strong>
                <AtSign size={14} /> อ้างอิงไฟล์ในโปรเจกต์ <small>{files.length}</small>
              </strong>
              <button type="button" aria-label="ปิดรายการไฟล์" onClick={() => setDismissed(draft)}>
                <X size={15} />
              </button>
            </header>
            <div role="listbox" id={`${id}-list`} aria-label="เลือกไฟล์">
              {files.map((file, index) => {
                const parts = file.split('/');
                const fileName = parts.pop() || file;
                const dirPath = parts.join('/');
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={active === index}
                    id={`${id}-${index}`}
                    key={file}
                    className={active === index ? 'active' : ''}
                    title={file}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => pick(file)}
                  >
                    <span className="slash-symbol" style={{ color: 'var(--accent)' }}>
                      {getFileIcon(fileName)}
                    </span>
                    <span className="slash-choice">
                      <strong>{fileName}</strong>
                      {dirPath && <small>{dirPath}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
            {loading && <p role="status">กำลังค้นหาไฟล์…</p>}
            {error && <p role="alert">{error}</p>}
            {!loading && !error && !files.length && <p>ไม่พบไฟล์ที่ตรงกับคำค้นหา</p>}
            <footer>
              <span>↑ ↓ หรือ Tab เลือก · Enter เติม · Esc ปิด</span>
              <span>อ้างอิงบริบทเข้าพร้อมคำสั่ง</span>
            </footer>
          </div>,
          document.body
        )}
    </>
  );
});
