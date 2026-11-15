// Computer use: the AI sees the screen and moves the mouse and keyboard, the way a person would.
//
// Three gates, in order:
//  1. The switch in Settings > AI control (off by default). Off = every computer_ tool refuses.
//  2. An Allow / Deny window, always on top, the first time a chat wants control (like Claude
//     Desktop). "Allow this task" lasts until the chat stops using the computer for a while,
//     "Allow this chat" until the app quits or the user presses Stop. The window is kept out of
//     screenshots, and no input is sent while it is open, so the AI can never click it itself.
//  3. The operating system: macOS needs Accessibility (input) and Screen Recording (screenshots);
//     the window and Settings show what is missing and open the right System Settings page.
//
// While the AI acts, a small always-on-top bar says so and has a Stop button. Windows sends real
// input through user32 (a long-lived PowerShell helper); macOS posts CoreGraphics events through a
// long-lived JavaScript-for-Automation helper. Only the main screen is used.
import { app, BrowserWindow, clipboard, desktopCapturer, screen, shell, systemPreferences } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tr } from "./i18n.mjs";

const MAX_WIDTH = 1366;
const TASK_IDLE = 10 * 60_000; // "Allow this task" ends after this long without a computer_ call
const DENY_QUIET = 60_000; // after Deny, the same chat is refused without asking again for this long
const ASK_TIMEOUT = 3 * 60_000; // no answer = Deny
const BAR_IDLE = 20_000;

// ---------------------------------------------------------------------------------------------
// Windows input helper: one PowerShell process for the whole session, one line per command,
// answered "ok [data]" or "error message".
const HELPER = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class SuperAiInput {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] static extern short VkKeyScanW(char c);
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public U u; }
  [StructLayout(LayoutKind.Explicit)] struct U { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; }
  // Windows refuses input to a window of higher integrity (run as Administrator) or a locked screen: say so.
  static void Send(INPUT[] i) {
    if (i.Length == 0) return;
    uint sent = SendInput((uint)i.Length, i, Marshal.SizeOf(typeof(INPUT)));
    if (sent != i.Length) throw new Exception("Windows accepted " + sent + " of " + i.Length + " input events (error " + Marshal.GetLastWin32Error() + ")");
  }
  static INPUT KeyInput(ushort vk, ushort scan, uint flags) { INPUT i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; return i; }
  public static void Init() { SetProcessDPIAware(); }
  public static void Move(int x, int y) { SetCursorPos(x, y); INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = 0x0001; Send(new INPUT[] { i }); }
  public static string Pos() { POINT p; GetCursorPos(out p); return p.X + " " + p.Y; }
  public static void Mouse(uint flags) { INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = flags; Send(new INPUT[] { i }); }
  public static void Wheel(int amount, bool horizontal) { INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = horizontal ? 0x1000u : 0x0800u; i.u.mi.mouseData = unchecked((uint)amount); Send(new INPUT[] { i }); }
  // Arrows, Home/End, PageUp/Down, Insert/Delete and the Windows keys are "extended" keys.
  static bool Extended(ushort vk) { return (vk >= 0x21 && vk <= 0x28) || vk == 0x2d || vk == 0x2e || vk == 0x5b || vk == 0x5c || vk == 0x5d || vk == 0xa3 || vk == 0xa5 || vk == 0x90 || vk == 0x2c; }
  public static void Key(ushort vk, bool up) { Send(new INPUT[] { KeyInput(vk, 0, (up ? 2u : 0u) | (Extended(vk) ? 1u : 0u)) }); }
  // Virtual key and shift state that type this character on the current keyboard layout (-1 = none).
  public static int Scan(char c) { return VkKeyScanW(c); }
  // Types any Unicode text; newline = Enter, tab = Tab. One character (a surrogate pair stays
  // together) per SendInput with a short pause: a single burst of many events is sometimes dropped.
  public static void Text(string s) {
    for (int k = 0; k < s.Length; k++) {
      char c = s[k];
      if (c == '\r') continue;
      if (c == '\n' || c == '\t') { ushort vk = c == '\n' ? (ushort)0x0d : (ushort)0x09; Send(new INPUT[] { KeyInput(vk, 0, 0), KeyInput(vk, 0, 2) }); }
      else if (char.IsHighSurrogate(c) && k + 1 < s.Length) { char d = s[++k]; Send(new INPUT[] { KeyInput(0, c, 4), KeyInput(0, d, 4), KeyInput(0, c, 6), KeyInput(0, d, 6) }); }
      else Send(new INPUT[] { KeyInput(0, c, 4), KeyInput(0, c, 6) });
      System.Threading.Thread.Sleep(4);
    }
  }
}
'@
[SuperAiInput]::Init()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $p = $line.Split(' ')
  try {
    $out = ''
    switch ($p[0]) {
      'move' { [SuperAiInput]::Move([int]$p[1], [int]$p[2]) }
      'pos' { $out = [SuperAiInput]::Pos() }
      'mouse' { [SuperAiInput]::Mouse([uint32]$p[1]) }
      'wheel' { [SuperAiInput]::Wheel([int]$p[1], $p[2] -eq 'h') }
      'key' { [SuperAiInput]::Key([uint16]$p[1], $p[2] -eq 'up') }
      'scan' { $out = [string][SuperAiInput]::Scan([char][int]$p[1]) }
      'text' { [SuperAiInput]::Text([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[1]))) }
    }
    [Console]::Out.WriteLine(('ok ' + $out).Trim())
  } catch { [Console]::Out.WriteLine('error ' + $_.Exception.Message) }
}
`;

// ---------------------------------------------------------------------------------------------
// macOS input helper: CoreGraphics events (needs only the Accessibility permission, no Apple
// Events), one osascript process for the whole session, same line protocol as on Windows.
const MAC_HELPER = String.raw`
ObjC.import('Foundation'); ObjC.import('CoreGraphics');
const out = $.NSFileHandle.fileHandleWithStandardOutput;
const input = $.NSFileHandle.fileHandleWithStandardInput;
const reply = (s) => out.writeData($(s + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
const post = (e) => $.CGEventPost(0, e); // kCGHIDEventTap
function mouse(type, x, y, button, clicks) {
  const e = $.CGEventCreateMouseEvent(null, type, $.CGPointMake(x, y), button);
  if (clicks) $.CGEventSetIntegerValueField(e, 1, clicks); // kCGMouseEventClickState
  post(e);
}
function key(code, down, flags) { const e = $.CGEventCreateKeyboardEvent(null, code, down); $.CGEventSetFlags(e, flags); post(e); }
function pos() { const p = $.CGEventGetLocation($.CGEventCreate(null)); return Math.round(p.x) + " " + Math.round(p.y); }
let buffer = "";
for (;;) {
  const data = input.availableData;
  if (!data || data.length == 0) break;
  buffer += $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1);
    if (!line) continue;
    const p = line.split(" "), n = p.map(Number);
    try {
      let result = "";
      if (p[0] === "mouse") mouse(n[1], n[2], n[3], n[4], n[5]);
      else if (p[0] === "key") key(n[1], p[2] === "down", n[3]);
      else if (p[0] === "scroll") post($.CGEventCreateScrollWheelEvent(null, 1, 2, n[1], n[2]));
      else if (p[0] === "pos") result = pos();
      else throw new Error("unknown command " + p[0]);
      reply(("ok " + result).trim());
    } catch (e) { reply("error " + e); }
  }
}
`;

function lineHelper(start) {
  let proc;
  const ensure = () => {
    if (proc && proc.exitCode === null && !proc.killed) return proc;
    proc = start();
    proc.waiting = [];
    let buffer = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => {
      buffer += chunk;
      for (let i; (i = buffer.indexOf("\n")) >= 0;) { const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1); proc.waiting.shift()?.(line); }
    });
    let err = "";
    proc.stderr?.on("data", (d) => { err = (err + d).slice(-2000); });
    const current = proc;
    current.on("exit", () => { for (const done of current.waiting.splice(0)) done(`error the input helper stopped ${err.trim()}`.trim()); });
    current.on("error", (error) => { for (const done of current.waiting.splice(0)) done(`error ${error.message}`); });
    return proc;
  };
  const send = (command) => {
    const p = ensure();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The input helper did not answer")), 20000);
      p.waiting.push((line) => { clearTimeout(timer); line.startsWith("error") ? reject(new Error(line.slice(6))) : resolve(line.slice(3)); });
      p.stdin.write(command + "\n");
    });
  };
  return { send, kill: () => proc?.kill() };
}

const windowsInput = lineHelper(() => {
  const file = path.join(os.tmpdir(), "superai-input-helper.ps1");
  fs.writeFileSync(file, HELPER);
  return spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
});
const macInput = lineHelper(() => {
  const file = path.join(os.tmpdir(), "superai-input-helper.js");
  fs.writeFileSync(file, MAC_HELPER);
  return spawn("osascript", ["-l", "JavaScript", file], { stdio: ["pipe", "pipe", "pipe"] });
});
const input = () => (process.platform === "darwin" ? macInput : windowsInput);

// Windows virtual keys by name.
const VK = { enter: 0x0d, return: 0x0d, tab: 0x09, escape: 0x1b, esc: 0x1b, backspace: 0x08, delete: 0x2e, del: 0x2e, space: 0x20, insert: 0x2d,
  left: 0x25, up: 0x26, right: 0x27, down: 0x28, arrowleft: 0x25, arrowup: 0x26, arrowright: 0x27, arrowdown: 0x28,
  home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22, ctrl: 0x11, control: 0x11, shift: 0x10, alt: 0x12, option: 0x12,
  win: 0x5b, windows: 0x5b, super: 0x5b, meta: 0x5b, cmd: 0x5b, command: 0x5b, menu: 0x5d, apps: 0x5d,
  capslock: 0x14, numlock: 0x90, scrolllock: 0x91, pause: 0x13, printscreen: 0x2c, prtsc: 0x2c, plus: 0xbb, minus: 0xbd };
// macOS key codes (ANSI layout) by name or character, and modifier flags.
const MAC_KEYS = { enter: 36, return: 36, tab: 48, space: 49, delete: 117, del: 117, backspace: 51, escape: 53, esc: 53,
  left: 123, right: 124, down: 125, up: 126, arrowleft: 123, arrowright: 124, arrowdown: 125, arrowup: 126,
  home: 115, end: 119, pageup: 116, pagedown: 121, capslock: 57,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
  a: 0, s: 1, d: 2, f: 3, h: 4, g: 5, z: 6, x: 7, c: 8, v: 9, b: 11, q: 12, w: 13, e: 14, r: 15, y: 16, t: 17,
  1: 18, 2: 19, 3: 20, 4: 21, 6: 22, 5: 23, "=": 24, 9: 25, 7: 26, "-": 27, 8: 28, 0: 29, "]": 30, o: 31, u: 32, "[": 33, i: 34, p: 35,
  l: 37, j: 38, "'": 39, k: 40, ";": 41, "\\": 42, ",": 43, "/": 44, n: 45, m: 46, ".": 47, "`": 50, plus: 24, minus: 27 };
const MAC_MODS = { cmd: [55, 1 << 20], command: [55, 1 << 20], meta: [55, 1 << 20], win: [55, 1 << 20], super: [55, 1 << 20],
  shift: [56, 1 << 17], ctrl: [59, 1 << 18], control: [59, 1 << 18], alt: [58, 1 << 19], option: [58, 1 << 19] };

/** Splits "ctrl+shift+t" (also "ctrl++") into key names. */
function comboParts(combo) {
  const text = String(combo).trim();
  if (!text) throw new Error("key is empty");
  const parts = text.split("+").map((p) => p.trim());
  // A trailing "+" key: "ctrl++" splits into [..., "", ""].
  if (parts.at(-1) === "" && parts.at(-2) === "") { parts.splice(-2, 2, "+"); }
  return parts.filter(Boolean);
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------
// What the operating system allows. Windows has no such permissions for this.
export function osAccess(prompt = false) {
  if (process.platform !== "darwin") return { accessibility: "granted", screen: "granted" };
  let accessibility = "unknown", screenAccess = "unknown";
  try { accessibility = systemPreferences.isTrustedAccessibilityClient(prompt) ? "granted" : "denied"; } catch {}
  try { screenAccess = systemPreferences.getMediaAccessStatus("screen"); } catch {}
  return { accessibility, screen: screenAccess };
}
const MAC_SETTINGS = {
  accessibility: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  screen: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
};
export function openOsSettings(kind) {
  if (process.platform !== "darwin" || !MAC_SETTINGS[kind]) return false;
  // Asking once also adds SuperAi to the list, so the user only has to tick it.
  if (kind === "accessibility") osAccess(true);
  if (kind === "screen") desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {});
  shell.openExternal(MAC_SETTINGS[kind]).catch(() => {});
  return true;
}

const TOOLS = ["computer_screenshot", "computer_click", "computer_move", "computer_type", "computer_key", "computer_scroll", "computer_drag", "computer_cursor", "computer_wait", "computer_zoom"];
/** What a tool does, in the window's language (literal tr() calls, so the dictionaries pick them up). */
const toolLabel = (tool) => ({
  computer_screenshot: tr("ดูหน้าจอ"), computer_click: tr("คลิก"), computer_move: tr("ขยับเมาส์"), computer_type: tr("พิมพ์ข้อความ"), computer_key: tr("กดปุ่มคีย์บอร์ด"),
  computer_scroll: tr("เลื่อนหน้าจอ"), computer_drag: tr("ลากเมาส์"), computer_cursor: tr("ดูตำแหน่งเมาส์"), computer_wait: tr("รอแล้วดูหน้าจอ"), computer_zoom: tr("ซูมดูหน้าจอ"),
}[tool] || tool);

// ---------------------------------------------------------------------------------------------
export function createComputerControl({ settingsFile, onStop, onChange }) {
  const read = () => { try { return JSON.parse(fs.readFileSync(settingsFile, "utf8")).enabled === true; } catch { return false; } };
  let enabled = read();
  let scale = 1; // screen pixels per screenshot pixel, from the last screenshot
  let bar, hideTimer, prompt;
  /** chatId → { chat: true } (whole chat) or { until } ("this task", extended on every call). */
  const grants = new Map();
  /** chatId → time until which a Deny still stands. */
  const denied = new Map();
  let queue = Promise.resolve();

  const state = () => ({ enabled, platform: process.platform, os: osAccess(false), allowed: [...grants.entries()].filter(([, g]) => g.chat || g.until > Date.now()).map(([id, g]) => ({ chatId: id, chatName: g.name, scope: g.chat ? "chat" : "task" })) });
  const changed = () => onChange?.(state());

  const revoke = () => { grants.clear(); denied.clear(); prompt?.answer("deny"); changed(); return state(); };
  const setEnabled = (value) => {
    enabled = value === true;
    try { fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify({ enabled })); } catch {}
    if (!enabled) { hideBar(); grants.clear(); denied.clear(); prompt?.answer("deny"); }
    // Turning it on on macOS: ask for what is still missing right away, while the user is in Settings.
    if (enabled && process.platform === "darwin") {
      const access = osAccess(false);
      if (access.accessibility !== "granted") osAccess(true);
      if (access.screen === "not-determined") desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {});
    }
    changed();
    return state();
  };

  // While the AI acts: a status bar at the top (what it does, for which chat, and Stop) and a glow
  // along the edges of the screen. The glow is four thin strips rather than one window over the
  // whole screen, so nothing but the edges is ever covered. Content protection asks the OS to keep
  // them out of screenshots (Windows ignores it for transparent windows), and any of them under a
  // point the AI clicks steps aside meanwhile.
  let glows = [];
  const GLOW = 14;
  const barSize = { width: 440, height: 64 };
  const overlays = () => [bar, ...glows].filter((w) => w && !w.isDestroyed());
  const hideBar = () => { for (const w of overlays()) w.hide(); };
  const makeBar = () => {
    const { workArea } = screen.getPrimaryDisplay();
    bar = new BrowserWindow({ ...barSize, x: Math.round(workArea.x + (workArea.width - barSize.width) / 2), y: workArea.y + 6, frame: false, resizable: false,
      movable: true, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false, transparent: true, hasShadow: false,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
    bar.setAlwaysOnTop(true, "screen-saver");
    bar.setVisibleOnAllWorkspaces?.(true);
    bar.setContentProtection(true);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @property --a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
      * { box-sizing: border-box; }
      body { margin: 0; overflow: hidden; background: transparent; font: 13px "Segoe UI", system-ui, -apple-system, sans-serif; -webkit-app-region: drag; user-select: none; }
      .pill { position: relative; margin: 8px; height: 48px; border-radius: 24px; padding: 0 6px 0 16px; display: flex; align-items: center; gap: 12px;
        color: #eafff3; background: linear-gradient(135deg, rgba(14,22,19,.94), rgba(10,16,22,.94)); box-shadow: 0 10px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
        animation: rise .35s cubic-bezier(.2,.9,.3,1.2); }
      .pill::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px;
        background: conic-gradient(from var(--a), #3ddc84, #38bdf8, #a78bfa, #3ddc84);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
        animation: spin 3s linear infinite; pointer-events: none; }
      @keyframes spin { to { --a: 360deg; } }
      @keyframes rise { from { transform: translateY(-14px) scale(.96); opacity: 0; } }
      .orb { position: relative; flex: none; width: 10px; height: 10px; border-radius: 50%; background: #3ddc84; box-shadow: 0 0 12px #3ddc84; }
      .orb::after { content: ""; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid #3ddc84; animation: ping 1.6s ease-out infinite; }
      @keyframes ping { from { transform: scale(.35); opacity: .9; } to { transform: scale(1.35); opacity: 0; } }
      .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .title { font-weight: 600; letter-spacing: .2px; background: linear-gradient(90deg, #eafff3, #9be7ff); -webkit-background-clip: text; color: transparent; }
      .sub { font-size: 11.5px; color: #9fb8ad; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub b { color: #c9f7dd; font-weight: 600; }
      .stop { -webkit-app-region: no-drag; flex: none; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 16px; border-radius: 18px;
        background: linear-gradient(180deg, #ff6b70, #e5484d); color: #fff; text-decoration: none; font-weight: 600; box-shadow: 0 4px 14px rgba(229,72,77,.45); transition: transform .12s, filter .12s; }
      .stop:hover { filter: brightness(1.08); transform: translateY(-1px); } .stop:active { transform: scale(.97); }
      .stop i { width: 9px; height: 9px; border-radius: 2px; background: #fff; }
    </style></head><body><div class="pill"><span class="orb"></span>
      <div class="text"><span class="title">${escapeHtml(tr("AI กำลังควบคุมคอมพิวเตอร์"))}</span><span class="sub" id="sub"></span></div>
      <a class="stop" href="superai-stop:"><i></i>${escapeHtml(tr("หยุด"))}</a></div>
      <script>window.setStatus = (action, who) => { const s = document.getElementById('sub'); s.textContent = ''; const b = document.createElement('b'); b.textContent = action; s.append(b); if (who) s.append(' · ' + who); };</script>
    </body></html>`;
    bar.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      if (url.startsWith("superai-stop:")) { setEnabled(false); onStop?.(); }
    });
    bar.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  };
  const makeGlow = () => {
    const { bounds: b } = screen.getPrimaryDisplay();
    // Each strip fades from the screen edge inwards; "to" is the direction of the fade.
    const strips = [
      { x: b.x, y: b.y, width: b.width, height: GLOW, to: "bottom" },
      { x: b.x, y: b.y + b.height - GLOW, width: b.width, height: GLOW, to: "top" },
      { x: b.x, y: b.y + GLOW, width: GLOW, height: b.height - 2 * GLOW, to: "right" },
      { x: b.x + b.width - GLOW, y: b.y + GLOW, width: GLOW, height: b.height - 2 * GLOW, to: "left" },
    ];
    glows = strips.map(({ to, ...rect }) => {
      const w = new BrowserWindow({ ...rect, frame: false, resizable: false, movable: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
        transparent: true, hasShadow: false, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
      w.setAlwaysOnTop(true, "screen-saver");
      w.setVisibleOnAllWorkspaces?.(true);
      w.setIgnoreMouseEvents(true);
      w.setContentProtection(true);
      const html = `<!doctype html><meta charset="utf-8"><style>
        html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
        .edge { position: fixed; inset: 0; background: linear-gradient(to ${to}, rgba(61,220,132,.95) 0 3px, rgba(56,189,248,.45) 3px, rgba(167,139,250,0));
          animation: breathe 2.6s ease-in-out infinite, in .4s ease-out; }
        @keyframes breathe { 50% { opacity: .55; filter: hue-rotate(40deg); } }
        @keyframes in { from { opacity: 0; } }
      </style><div class="edge"></div>`;
      w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
      return w;
    });
  };
  /** Shows (or refreshes) the bar and the glow; they go away after a while without computer_ calls. */
  const showBar = (tool, caller) => {
    if (!bar || bar.isDestroyed()) makeBar();
    if (!glows.length || glows.some((w) => w.isDestroyed())) { for (const w of glows) if (!w.isDestroyed()) w.destroy(); makeGlow(); }
    const who = caller?.chatName ? tr`แชต "${caller.chatName}"` : "";
    const status = `window.setStatus && window.setStatus(${JSON.stringify(toolLabel(tool))}, ${JSON.stringify(who)})`;
    const apply = () => bar.webContents.executeJavaScript(status).catch(() => {});
    if (bar.webContents.isLoading()) bar.webContents.once("did-finish-load", apply); else apply();
    for (const w of glows) w.showInactive();
    bar.showInactive();
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBar, BAR_IDLE);
  };
  /** Is this screen point (pixels on Windows, points on macOS) on the window? */
  const covers = (w, sx, sy) => {
    if (!w.isVisible()) return false;
    const b = w.getBounds(), f = process.platform === "darwin" ? 1 : display().scaleFactor;
    const x = sx / f, y = sy / f;
    return x >= b.x - 4 && x <= b.x + b.width + 4 && y >= b.y - 4 && y <= b.y + b.height + 4;
  };
  /** The bar takes clicks (for Stop) and the glow sits on the edges: step aside while the AI clicks there. */
  async function aside(points, action) {
    const moved = overlays().filter((w) => points.some(([x, y]) => covers(w, x, y)));
    for (const w of moved) w.hide();
    try { return await action(); } finally { if (enabled) for (const w of moved) if (!w.isDestroyed()) w.showInactive(); }
  }

  // ------------------------------------------------------------------------------------------
  // The Allow / Deny window.
  function ask(caller, tool) {
    return new Promise((resolve) => {
      const access = osAccess(false);
      const missing = process.platform === "darwin" ? ["accessibility", "screen"].filter((k) => access[k] !== "granted") : [];
      const who = caller.chatName ? tr`แชต "${caller.chatName}"` : tr("AI ในแชต");
      const osRows = missing.map((kind) => `<div class="os"><span>${escapeHtml(kind === "accessibility"
        ? tr("macOS ยังไม่อนุญาต Accessibility (ใช้เมาส์และคีย์บอร์ด)") : tr("macOS ยังไม่อนุญาต Screen Recording (ดูหน้าจอ)"))}</span>
        <a class="btn ghost" href="superai-perm:os-${kind}">${escapeHtml(tr("เปิด System Settings"))}</a></div>`).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>SuperAi permission</title><style>
        @property --a{syntax:'<angle>';initial-value:0deg;inherits:false}
        *{box-sizing:border-box} html,body{height:100%} body{margin:0;font:13px "Segoe UI",system-ui,-apple-system,sans-serif;background:transparent;color:#e8ece9;user-select:none;overflow:hidden}
        .wrap{position:relative;padding:20px 22px 18px;border-radius:14px;height:100%;display:flex;flex-direction:column;gap:12px;
          background:radial-gradient(120% 70% at 0% 0%,rgba(61,220,132,.14),transparent 60%),radial-gradient(90% 60% at 100% 0%,rgba(56,189,248,.12),transparent 60%),#111816;animation:pop .3s cubic-bezier(.2,.9,.3,1.2)}
        .wrap::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;background:conic-gradient(from var(--a),#3ddc84,#38bdf8,#a78bfa,#3ddc84);
          -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:spin 4s linear infinite;pointer-events:none}
        @keyframes spin{to{--a:360deg}} @keyframes pop{from{transform:scale(.96);opacity:0}}
        h1{margin:0;font-size:17px;display:flex;align-items:center;gap:12px;-webkit-app-region:drag}
        .icon{flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#3ddc84,#38bdf8);box-shadow:0 6px 18px rgba(56,189,248,.35)}
        p{margin:0;line-height:1.5;color:#c9d1cc} .first{color:#8fa79c;font-size:12px} .first b{color:#c9f7dd}
        .warn{background:rgba(245,165,36,.08);border:1px solid rgba(245,165,36,.35);border-radius:10px;padding:9px 11px;color:#f3dcb3;font-size:12px;line-height:1.45}
        .os{display:flex;align-items:center;gap:8px;justify-content:space-between;background:rgba(229,72,77,.1);border:1px solid rgba(229,72,77,.4);border-radius:10px;padding:8px 10px;font-size:12px;color:#f8c9cd}
        .row{display:flex;gap:8px;justify-content:flex-end;margin-top:auto;flex-wrap:wrap}
        .btn{display:inline-block;padding:9px 15px;border-radius:10px;text-decoration:none;color:#e8ece9;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);white-space:nowrap;transition:transform .12s,filter .12s}
        .btn:hover{filter:brightness(1.2);transform:translateY(-1px)} .btn:active{transform:scale(.97)} .btn:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
        .deny{color:#ffc9ce;border-color:rgba(229,72,77,.45)} .allow{background:linear-gradient(135deg,#3ddc84,#38bdf8);color:#05110b;border-color:transparent;font-weight:700;box-shadow:0 6px 18px rgba(61,220,132,.3)}
        .ghost{padding:4px 10px;font-size:12px}
      </style></head><body><div class="wrap">
        <h1><span class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#05110b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 20.5h8M12 16.5v4"/><path d="M10 7.5l4.5 3-2 .5-1 2z" fill="#05110b"/></svg></span>${escapeHtml(tr("อนุญาตให้ AI ควบคุมคอมพิวเตอร์?"))}</h1>
        <p>${escapeHtml(tr`${who} ต้องการดูหน้าจอ ขยับเมาส์ คลิก และพิมพ์บนเครื่องนี้`)}</p>
        <p class="first">${escapeHtml(tr`คำสั่งแรก: ${toolLabel(tool)}`)}</p>
        <div class="warn">${escapeHtml(tr("AI จะทำได้ทุกอย่างที่คุณทำได้ อนุญาตเฉพาะแชตที่คุณไว้ใจ และกด \"หยุด\" ที่แถบด้านบนของจอเพื่อยกเลิกได้ทุกเมื่อ"))}</div>
        ${osRows}
        <div class="row">
          <a id="deny" class="btn deny" href="superai-perm:deny">${escapeHtml(tr("ปฏิเสธ"))}</a>
          <a id="allow-task" class="btn" href="superai-perm:task">${escapeHtml(tr("อนุญาตงานนี้"))}</a>
          <a id="allow-chat" class="btn allow" href="superai-perm:chat">${escapeHtml(tr("อนุญาตตลอดแชตนี้"))}</a>
        </div></div>
        <script>addEventListener('keydown', (e) => { if (e.key === 'Escape') location.href = 'superai-perm:deny'; });</script>
      </body></html>`;
      const { workArea } = screen.getPrimaryDisplay();
      const width = 480, height = 296 + missing.length * 52;
      const win = new BrowserWindow({ width, height, x: Math.round(workArea.x + (workArea.width - width) / 2), y: Math.round(workArea.y + (workArea.height - height) / 3),
        frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: false, show: false,
        title: tr("SuperAi ขออนุญาต"), transparent: true, hasShadow: true, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
      win.setAlwaysOnTop(true, "screen-saver");
      // Hidden from screenshots, so the AI cannot see (and aim at) its own permission buttons.
      win.setContentProtection(true);
      let done = false;
      const timer = setTimeout(() => finish("deny"), ASK_TIMEOUT);
      const finish = (answer) => {
        if (done) return;
        done = true; clearTimeout(timer); prompt = undefined;
        if (!win.isDestroyed()) win.destroy();
        resolve(answer);
      };
      prompt = { answer: finish, window: win };
      win.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
        const answer = url.replace(/^superai-perm:/, "");
        if (answer.startsWith("os-")) return void openOsSettings(answer.slice(3));
        if (["deny", "task", "chat"].includes(answer)) finish(answer);
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.on("closed", () => finish("deny"));
      win.once("ready-to-show", () => {
        // macOS only raises a window of the app in front: bring SuperAi forward for the question.
        if (process.platform === "darwin") app.focus({ steal: true });
        win.show(); win.focus(); win.moveTop();
      });
      win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    });
  }

  async function authorize(caller, tool) {
    const id = caller.chatId || "";
    const now = Date.now();
    const grant = grants.get(id);
    if (grant && (grant.chat || grant.until > now)) { if (!grant.chat) grant.until = now + TASK_IDLE; return; }
    if ((denied.get(id) || 0) > now)
      throw new Error("The user denied computer control for this chat a moment ago. Do not retry; tell the user what you wanted to do and let them decide.");
    const answer = await ask(caller, tool);
    if (answer === "deny") {
      denied.set(id, Date.now() + DENY_QUIET);
      throw new Error("The user denied computer control. Do not retry computer_ tools; tell the user what you wanted to do and let them decide.");
    }
    denied.delete(id);
    grants.set(id, answer === "chat" ? { chat: true, name: caller.chatName } : { until: Date.now() + TASK_IDLE, name: caller.chatName });
    changed();
  }

  /** On macOS input silently does nothing without Accessibility: say so instead. */
  function requireOs(kind) {
    if (process.platform !== "darwin") return;
    const access = osAccess(false);
    if (kind === "input" && access.accessibility !== "granted") {
      osAccess(true);
      throw new Error("macOS has not allowed SuperAi to use the mouse and keyboard. Ask the user to allow SuperAi in System Settings > Privacy & Security > Accessibility (a window to do so was opened), then try again.");
    }
    if (kind === "screen" && (access.screen === "denied" || access.screen === "restricted"))
      throw new Error("macOS has not allowed SuperAi to see the screen. Ask the user to allow SuperAi in System Settings > Privacy & Security > Screen Recording and restart SuperAi, then try again.");
  }

  // ------------------------------------------------------------------------------------------
  const display = () => screen.getPrimaryDisplay();
  const num = (v, name) => { const n = Number(v); if (v === undefined || v === null || v === "" || !Number.isFinite(n)) throw new Error(`${name} must be a number from the latest screenshot`); return n; };
  // Screenshot coordinates → screen pixels (Windows, DPI aware) or points (macOS).
  const toScreen = (x, y) => {
    const px = Math.round(num(x, "x") * scale), py = Math.round(num(y, "y") * scale);
    if (process.platform === "darwin") { const { bounds, scaleFactor } = display(); return [bounds.x + px / scaleFactor, bounds.y + py / scaleFactor]; }
    return [px, py];
  };
  const fromScreen = (sx, sy) => {
    if (process.platform === "darwin") { const { bounds, scaleFactor } = display(); return [Math.round((sx - bounds.x) * scaleFactor / scale), Math.round((sy - bounds.y) * scaleFactor / scale)]; }
    return [Math.round(sx / scale), Math.round(sy / scale)];
  };

  async function capture() {
    requireOs("screen");
    const { size, scaleFactor, id } = display();
    const width = Math.round(size.width * scaleFactor), height = Math.round(size.height * scaleFactor);
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width, height } });
    const source = sources.find((s) => String(s.display_id) === String(id)) || sources[0];
    if (!source || source.thumbnail.isEmpty()) throw new Error(process.platform === "darwin"
      ? "Could not capture the screen. Ask the user to allow SuperAi in System Settings > Privacy & Security > Screen Recording, then restart SuperAi." : "Could not capture the screen.");
    return source.thumbnail;
  }
  async function screenshot() {
    let image = await capture();
    const full = image.getSize();
    if (full.width > MAX_WIDTH) image = image.resize({ width: MAX_WIDTH, quality: "good" });
    scale = full.width / image.getSize().width;
    const shown = image.getSize();
    return { text: `Screen ${shown.width}x${shown.height} (coordinates for computer_click etc. are in this image).`, image: { data: image.toPNG().toString("base64"), mimeType: "image/png" } };
  }
  async function zoom(args) {
    const x = num(args.x, "x"), y = num(args.y, "y"), w = num(args.width, "width"), h = num(args.height, "height");
    if (w <= 0 || h <= 0) throw new Error("width and height must be positive");
    const full = await capture();
    const size = full.getSize();
    const rect = { x: Math.max(0, Math.round(x * scale)), y: Math.max(0, Math.round(y * scale)) };
    rect.width = Math.max(1, Math.min(size.width - rect.x, Math.round(w * scale)));
    rect.height = Math.max(1, Math.min(size.height - rect.y, Math.round(h * scale)));
    let image = full.crop(rect);
    if (image.getSize().width > MAX_WIDTH) image = image.resize({ width: MAX_WIDTH, quality: "good" });
    return { text: `Zoomed view of the region x=${x} y=${y} ${w}x${h} at full resolution. Keep using the coordinates of the latest computer_screenshot (not of this image) in other tools.`,
      image: { data: image.toPNG().toString("base64"), mimeType: "image/png" } };
  }

  const send = (command) => input().send(command);
  const MAC_BUTTON = { left: [0, 1, 2, 6], right: [1, 3, 4, 7], middle: [2, 25, 26, 27] }; // button, down, up, dragged
  async function moveTo(sx, sy) {
    if (process.platform === "darwin") await send(`mouse 5 ${sx} ${sy} 0 0`); else await send(`move ${sx} ${sy}`);
  }
  async function click(x, y, button, clicks) {
    const [sx, sy] = toScreen(x, y);
    return aside([[sx, sy]], () => clickAt(sx, sy, button, clicks));
  }
  async function clickAt(sx, sy, button, clicks) {
    if (process.platform === "darwin") {
      const [b, down, up] = MAC_BUTTON[button] || MAC_BUTTON.left;
      await moveTo(sx, sy);
      for (let i = 1; i <= clicks; i++) { await send(`mouse ${down} ${sx} ${sy} ${b} ${i}`); await send(`mouse ${up} ${sx} ${sy} ${b} ${i}`); }
      return;
    }
    const [down, up] = button === "right" ? [0x08, 0x10] : button === "middle" ? [0x20, 0x40] : [0x02, 0x04];
    await moveTo(sx, sy);
    for (let i = 0; i < clicks; i++) { await send(`mouse ${down}`); await send(`mouse ${up}`); }
  }
  async function drag(args) {
    const [fx, fy] = toScreen(args.fromX, args.fromY), [tx, ty] = toScreen(args.toX, args.toY);
    return aside([[fx, fy], [tx, ty]], () => dragBetween(fx, fy, tx, ty));
  }
  async function dragBetween(fx, fy, tx, ty) {
    const steps = 12;
    if (process.platform === "darwin") {
      const [b, down, up, dragged] = MAC_BUTTON.left;
      await moveTo(fx, fy); await send(`mouse ${down} ${fx} ${fy} ${b} 1`);
      for (let i = 1; i <= steps; i++) { await send(`mouse ${dragged} ${fx + (tx - fx) * i / steps} ${fy + (ty - fy) * i / steps} ${b} 0`); await wait(15); }
      await send(`mouse ${up} ${tx} ${ty} ${b} 1`);
      return;
    }
    await moveTo(fx, fy); await send("mouse 2");
    for (let i = 1; i <= steps; i++) { await moveTo(Math.round(fx + (tx - fx) * i / steps), Math.round(fy + (ty - fy) * i / steps)); await wait(15); }
    await send("mouse 4");
  }
  async function cursor() {
    const [sx, sy] = (await send("pos")).split(" ").map(Number);
    const [x, y] = fromScreen(sx, sy);
    return { text: `The mouse is at x=${x} y=${y} of the latest screenshot.` };
  }

  async function typeText(text) {
    if (process.platform === "darwin") {
      // Any language: paste through the clipboard, then put back what the user had there.
      const saved = { text: clipboard.readText(), image: clipboard.readImage() };
      try {
        for (const [i, part] of String(text).split("\n").entries()) {
          if (i) await pressKeys("enter");
          if (!part) continue;
          clipboard.writeText(part);
          await pressKeys("cmd+v");
          await wait(120);
        }
      } finally {
        await wait(150);
        if (!saved.image.isEmpty()) clipboard.writeImage(saved.image); else clipboard.writeText(saved.text);
      }
      return;
    }
    const value = String(text);
    // Long text goes in chunks so one command line stays small.
    for (let i = 0; i < value.length; i += 400) await send(`text ${Buffer.from(value.slice(i, i + 400), "utf8").toString("base64")}`);
  }

  async function pressKeys(combo) {
    const parts = comboParts(combo);
    if (process.platform === "darwin") {
      const mods = parts.slice(0, -1).map((m) => MAC_MODS[m.toLowerCase()]).filter(Boolean);
      const last = parts.at(-1), lower = last.toLowerCase();
      // A modifier on its own ("cmd") is pressed as itself.
      const code = MAC_MODS[lower] ? MAC_MODS[lower][0] : MAC_KEYS[lower] ?? MAC_KEYS[last];
      if (code === undefined) throw new Error(`Unknown key on macOS: ${last}`);
      let flags = 0;
      for (const [modCode, flag] of mods) { flags |= flag; await send(`key ${modCode} down ${flags}`); }
      const own = MAC_MODS[lower] ? MAC_MODS[lower][1] : 0;
      await send(`key ${code} down ${flags | own}`); await send(`key ${code} up ${flags}`);
      for (const [modCode, flag] of [...mods].reverse()) { flags &= ~flag; await send(`key ${modCode} up ${flags}`); }
      return;
    }
    const codes = [];
    for (const part of parts) {
      const key = part.toLowerCase();
      if (VK[key] !== undefined) { codes.push(VK[key]); continue; }
      if (/^f([1-9]|1[0-9]|2[0-4])$/.test(key)) { codes.push(0x6f + Number(key.slice(1))); continue; }
      if (/^[a-z0-9]$/.test(key)) { codes.push(key.toUpperCase().charCodeAt(0)); continue; }
      if ([...part].length === 1) {
        // Punctuation: whichever key types it on the current layout, with Shift if that layout needs it.
        const scan = Number(await send(`scan ${part.charCodeAt(0)}`));
        if (scan < 0 || !Number.isFinite(scan)) throw new Error(`No key types "${part}" on this keyboard layout`);
        if (scan & 0x100 && !codes.includes(0x10)) codes.push(0x10);
        codes.push(scan & 0xff);
        continue;
      }
      throw new Error(`Unknown key: ${part}`);
    }
    for (const code of codes) await send(`key ${code} down`);
    for (const code of [...codes].reverse()) await send(`key ${code} up`);
  }

  async function scroll(x, y, direction, amount) {
    const steps = Math.max(1, Math.min(20, Number(amount) || 3));
    if (x !== undefined && y !== undefined) { const [sx, sy] = toScreen(x, y); await moveTo(sx, sy); }
    if (!["up", "down", "left", "right"].includes(direction)) throw new Error("direction must be up, down, left or right");
    if (process.platform === "darwin") {
      const dy = direction === "up" ? steps : direction === "down" ? -steps : 0, dx = direction === "left" ? steps : direction === "right" ? -steps : 0;
      await send(`scroll ${dy} ${dx}`);
      return;
    }
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "up" || direction === "right" ? 1 : -1;
    await send(`wheel ${sign * 120 * steps} ${horizontal ? "h" : "v"}`);
  }

  async function act(tool, args) {
    const pause = () => wait(450);
    if (tool === "computer_screenshot") return screenshot();
    if (tool === "computer_zoom") return zoom(args);
    if (tool === "computer_wait") { await wait(Math.min(10, Math.max(0, Number(args.seconds) || 1)) * 1000); return screenshot(); }
    requireOs("input");
    if (tool === "computer_cursor") return cursor();
    if (tool === "computer_click") { await click(args.x, args.y, String(args.button || "left"), args.double ? 2 : Math.max(1, Math.min(3, Number(args.clicks) || 1))); await pause(); return screenshot(); }
    if (tool === "computer_move") { const [sx, sy] = toScreen(args.x, args.y); await moveTo(sx, sy); return { text: "Moved" }; }
    if (tool === "computer_drag") { await drag(args); await pause(); return screenshot(); }
    if (tool === "computer_type") { await typeText(String(args.text ?? "")); await pause(); return screenshot(); }
    if (tool === "computer_key") { await pressKeys(String(args.key || "")); await pause(); return screenshot(); }
    if (tool === "computer_scroll") { await scroll(args.x, args.y, String(args.direction || "down"), args.amount); await pause(); return screenshot(); }
    throw new Error(`Unknown computer tool: ${tool}`);
  }

  /** One call at a time, from any chat: input from two chats never interleaves, and nothing runs while the Allow window is open. */
  function run(tool, args = {}, caller = { chatId: "", chatName: "" }) {
    const next = queue.then(async () => {
      if (!enabled) throw new Error("Computer control is turned off. Ask the user to turn on \"Let the AI control this computer\" in SuperAi Settings > AI control, then try again.");
      if (!TOOLS.includes(tool)) throw new Error(`Unknown computer tool: ${tool}`);
      await authorize(caller, tool);
      if (!enabled) throw new Error("Computer control was turned off.");
      showBar(tool, caller);
      return act(tool, args && typeof args === "object" ? args : {});
    });
    queue = next.catch(() => {});
    return next;
  }

  return {
    run, state, setEnabled, revoke, openOsSettings,
    dispose: () => { windowsInput.kill(); macInput.kill(); prompt?.answer("deny"); for (const w of overlays()) w.destroy(); },
  };
}
