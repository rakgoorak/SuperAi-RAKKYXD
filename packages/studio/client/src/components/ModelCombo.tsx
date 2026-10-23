import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

interface Props {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

/**
 * A model name field with the full list of models one click away. A plain <datalist> only
 * shows names that match what is already typed, so a filled-in field looked like it offered a
 * single model. Here the arrow (or an untouched field) shows every model; typing narrows it.
 */
export function ModelCombo({ value, options, onChange, label, placeholder, maxLength = 200, disabled }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const query = value.trim().toLowerCase();
  const shown = typed && query ? options.filter((m) => m.toLowerCase().includes(query)) : options;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const show = () => {
    setTyped(false);
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  };
  const pick = (model: string) => {
    onChange(model);
    setOpen(false);
  };

  return (
    <div className="model-combo" ref={root}>
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && shown[active] ? `${id}-${active}` : undefined}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => { onChange(e.target.value); setTyped(true); setActive(-1); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return show();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (shown.length ? (i + step + shown.length) % shown.length : -1));
          } else if (e.key === "Enter" && open && shown[active]) {
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === "Escape" && open) {
            // Close only the list, not the dialog the field sits in.
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
        }}
        onBlur={(e) => !root.current?.contains(e.relatedTarget as Node) && setOpen(false)}
      />
      <button type="button" className="model-combo-toggle" tabIndex={-1} aria-label={`ดูรายชื่อ ${label} ทั้งหมด`} disabled={disabled || !options.length}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          root.current?.querySelector('input')?.focus({ preventScroll: true });
          if (open) setOpen(false);
          else show();
        }}>
        <ChevronDown size={14} />
      </button>
      {open && shown.length > 0 && (
        <ul className="model-combo-list" role="listbox" id={`${id}-list`} aria-label={label}>
          {shown.map((model, i) => (
            <li key={model} id={`${id}-${i}`} role="option" aria-selected={model === value}
              className={i === active ? "active" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(model)}>
              <span>{model}</span>
              {model === value && <Check size={13} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
