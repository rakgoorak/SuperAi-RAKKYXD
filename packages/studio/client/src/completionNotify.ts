// Tells the user an Agent/Chat run or a CLI chat turn finished while they were in another window:
// an OS notification, a taskbar flash (desktop) and an optional short chime.
import type { Run } from "./api";

export interface NotifySettings { enabled: boolean; sound: boolean }
export type NoticeTarget =
  | { kind: "run"; id: string; wsId: string; mode: Run["mode"] }
  | { kind: "session"; id: string };
export interface DoneNotice { tag: string; title: string; body: string; failed: boolean; target: NoticeTarget }

const KEY = "superai-notify";
const DEFAULTS: NotifySettings = { enabled: true, sound: true };
const OPEN_EVENT = "superai:open-notice";

export function loadNotifySettings(): NotifySettings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return DEFAULTS; }
}
export function saveNotifySettings(settings: NotifySettings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
}

/** Runs that were running last time and are now completed/failed. Cancelled runs are the user's own doing.
 *  Updates `seen` with the current statuses. */
export function finishedRuns<T extends Pick<Run, "id" | "status">>(seen: Map<string, Run["status"]>, runs: T[]): T[] {
  const done = runs.filter(run => seen.get(run.id) === "running" && (run.status === "completed" || run.status === "failed"));
  for (const run of runs) seen.set(run.id, run.status);
  return done;
}

export const runNotice = (run: Pick<Run, "id" | "wsId" | "mode" | "status" | "prompt">, project?: string): DoneNotice => {
  const failed = run.status === "failed";
  const what = run.mode === "agent" ? "Agent" : "Chat";
  return {
    tag: `run:${run.id}`, failed,
    title: `${what} ${failed ? "ทำงานไม่สำเร็จ" : "ทำงานเสร็จแล้ว"}${project ? ` · ${project}` : ""}`,
    body: run.prompt.replace(/\s+/g, " ").trim().slice(0, 140),
    target: { kind: "run", id: run.id, wsId: run.wsId, mode: run.mode },
  };
};

export const sessionNotice = (id: string, name: string, at = Date.now()): DoneNotice => ({
  tag: `session:${id}:${at}`, failed: false, title: `${name} ตอบเสร็จแล้ว`, body: "กดเพื่อเปิดบทสนทนา",
  target: { kind: "session", id },
});

const appFocused = () => !document.hidden && document.hasFocus();

let audio: AudioContext | undefined;
function chime(failed: boolean) {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    (failed ? [440, 330] : [660, 880]).forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + i * 0.13;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.24);
    });
  } catch {}
}

const open = (target: NoticeTarget) => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: target }));

/** Shows the notice only when the app is not in front (or `force`, for the settings test button). */
export function notifyDone(notice: DoneNotice, { force = false, inactiveSession = false } = {}) {
  const settings = loadNotifySettings();
  if (!force && (!settings.enabled || (appFocused() && !inactiveSession))) return;
  if (settings.sound) chime(notice.failed);
  if (window.superai?.notify) { void window.superai.notify(notice).catch(() => {}); return; }
  if (!("Notification" in window) || Notification.permission === "denied") return;
  const show = () => {
    const shown = new Notification(notice.title, { body: notice.body, tag: notice.tag });
    shown.onclick = () => { window.focus(); open(notice.target); shown.close(); };
  };
  if (Notification.permission === "granted") show();
  else void Notification.requestPermission().then(p => { if (p === "granted") show(); });
}

/** Called when the user clicks a notification (OS toast on desktop, Web Notification in a browser). */
export function onNoticeOpen(callback: (target: NoticeTarget) => void) {
  const handler = (event: Event) => callback((event as CustomEvent<NoticeTarget>).detail);
  window.addEventListener(OPEN_EVENT, handler);
  const off = window.superai?.onNotifyOpen?.(target => callback(target as NoticeTarget));
  return () => { window.removeEventListener(OPEN_EVENT, handler); off?.(); };
}
