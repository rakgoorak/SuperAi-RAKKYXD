import { useEffect, useState, type SetStateAction } from "react";

/** Keep the active workspace team unchanged while editing a pending copy. */
export function useTeamDraft<T>(key: string, load: () => T, onChange: (config: T) => void) {
  const [saved, setSaved] = useState<T>(load);
  const [pending, setPending] = useState<T | null>(null);
  const config = pending ?? saved;
  useEffect(() => { onChange(saved); }, [saved, onChange]);
  const edit = (change: SetStateAction<T>) => setPending(current => {
    const previous = current ?? saved;
    return typeof change === "function" ? (change as (value: T) => T)(previous) : change;
  });
  return {
    saved, config, edit,
    begin: () => setPending(saved),
    cancel: () => setPending(null),
    save: () => {
      // Storage failure leaves both the active team and pending edits intact.
      localStorage.setItem(key, JSON.stringify(config));
      setSaved(config);
      setPending(null);
    },
  };
}
