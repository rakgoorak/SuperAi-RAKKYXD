import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Collapsible settings card: open while there is no work to show; folds to a one-line summary
 * whenever a new run starts so its progress is visible.
 */
export function ConfigShell({ label, title, description, summary, runCount, children }: {
  label: string; title: ReactNode; description: string; summary: string; runCount: number; children: ReactNode;
}) {
  const [open, setOpen] = useState(runCount === 0);
  const seen = useRef(runCount);
  useEffect(() => {
    if (runCount > seen.current) setOpen(false);
    seen.current = runCount;
  }, [runCount]);
  return (
    <details className="mode-config" aria-label={label} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <div>
          <h2>{title}</h2>
          <p>{open ? description : summary}</p>
        </div>
        <span className="text-button">{open ? "ย่อการตั้งค่า" : "ตั้งค่าทีม"} <ChevronDown size={13} className={open ? "flip" : ""} /></span>
      </summary>
      {children}
    </details>
  );
}
