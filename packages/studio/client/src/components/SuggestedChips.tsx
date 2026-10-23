import React from "react";
import { Sparkles, GitBranch, Play, HelpCircle, FileText, RotateCcw } from "lucide-react";
import type { SuggestionItem } from "../suggestions";

const ICON_MAP: Record<string, React.ReactNode> = {
  git: <GitBranch size={12} />,
  play: <Play size={12} />,
  help: <HelpCircle size={12} />,
  file: <FileText size={12} />,
  refresh: <RotateCcw size={12} />,
  sparkles: <Sparkles size={12} />,
};

export function SuggestedChips({
  items,
  disabled = false,
  onSelect,
}: {
  items: SuggestionItem[];
  disabled?: boolean;
  onSelect: (promptText: string) => void;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="suggested-chips-bar" role="group" aria-label="ตัวเลือกแนะนำด่วน">
      <span className="chips-label"><Sparkles size={12} /> แนะนำ:</span>
      <div className="chips-scroll">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip-action-btn"
            disabled={disabled}
            onClick={() => onSelect(item.promptText)}
            title={`คลิกเพื่อใส่คำสั่ง: ${item.promptText}`}
          >
            {item.icon && ICON_MAP[item.icon] ? ICON_MAP[item.icon] : <Sparkles size={11} />}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
