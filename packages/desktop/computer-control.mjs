// Computer use: the AI sees the screen and moves the mouse and keyboard, the way a person would.
// Off until the user turns it on in Settings; while the AI acts, a small always-on-top bar says so
// and has a Stop button that turns it off again. Windows sends real input through user32
// (a long-lived PowerShell helper); macOS goes through CoreGraphics / System Events (it needs the
// Accessibility permission). Only the main screen is used.
import { BrowserWindow, desktopCapturer, screen } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tr } from "./i18n.mjs";

const MAX_WIDTH = 1366;

// ---------------------------------------------------------------------------------------------
// Windows input helper.
const HELPER = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class SuperAiInput {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public U u; }
  [StructLayout(LayoutKind.Explicit)] struct U { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; }
  static void Send(INPUT i) { SendInput(1, new INPUT[] { i }, Marshal.SizeOf(typeof(INPUT))); }
  public static void Init() { SetProcessDPIAware(); }
  public static void Move(int x, int y) { SetCursorPos(x, y); }
  public static void Mouse(uint flags) { INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = flags; Send(i); }
  public static void Wheel(int amount, bool horizontal) { INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = horizontal ? 0x1000u : 0x0800u; i.u.mi.mouseData = unchecked((uint)amount); Send(i); }
  public static void Key(ushort vk, bool up) { INPUT i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.dwFlags = up ? 2u : 0u; Send(i); }
  public static void Char(ushort c) { INPUT i = new INPUT(); i.type = 1; i.u.ki.wScan = c; i.u.ki.dwFlags = 4; Send(i); i.u.ki.dwFlags = 6; Send(i); }
}
'@
[SuperAiInput]::Init()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $p = $line.Split(' ')
  try {
    switch ($p[0]) {
      'move' { [SuperAiInput]::Move([int]$p[1], [int]$p[2]) }
      'mouse' { [SuperAiInput]::Mouse([uint32]$p[1]) }
      'wheel' { [SuperAiInput]::Wheel([int]$p[1], $p[2] -eq 'h') }
      'key' { [SuperAiInput]::Key([uint16]$p[1], $p[2] -eq 'up') }
      'char' { [SuperAiInput]::Char([uint16]$p[1]) }
    }
    [Console]::Out.WriteLine('ok')
  } catch { [Console]::Out.WriteLine('error ' + $_.Exception.Message) }
}
`;

let helper;
function windowsHelper() {
  if (helper && helper.exitCode === null && !helper.killed) return helper;
  const file = path.join(os.tmpdir(), "superai-input-helper.ps1");
  fs.writeFileSync(file, HELPER);
  helper = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  helper.waiting = [];
  let buffer = "";
  helper.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (let i; (i = buffer.indexOf("\n")) >= 0;) { const line = buffer.slice(0, i).trim(); buffer = buffer.slice(i + 1); helper.waiting.shift()?.(line); }
  });
  helper.on("exit", () => { for (const done of helper.waiting.splice(0)) done("error the input helper stopped"); });
  return helper;
}
function send(command) {
  const proc = windowsHelper();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The input helper did not answer")), 15000);
    proc.waiting.push((line) => { clearTimeout(timer); line.startsWith("error") ? reject(new Error(line.slice(6))) : resolve(); });
    proc.stdin.write(command + "\n");
  });
}

const VK = { enter: 0x0d, return: 0x0d, tab: 0x09, escape: 0x1b, esc: 0x1b, backspace: 0x08, delete: 0x2e, del: 0x2e, space: 0x20, insert: 0x2d,
  left: 0x25, up: 0x26, right: 0x27, down: 0x28, arrowleft: 0x25, arrowup: 0x26, arrowright: 0x27, arrowdown: 0x28,
  home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22, ctrl: 0x11, control: 0x11, shift: 0x10, alt: 0x12, win: 0x5b, windows: 0x5b, meta: 0x5b, cmd: 0x5b,
  capslock: 0x14, printscreen: 0x2c };
function vk(name) {
  const key = String(name).trim().toLowerCase();
  if (VK[key] !== undefined) return VK[key];
  if (/^f([1-9]|1[0-2])$/.test(key)) return 0x6f + Number(key.slice(1));
  if (/^[a-z0-9]$/.test(key)) return key.toUpperCase().charCodeAt(0);
  throw new Error(`Unknown key: ${name}`);
}

// ---------------------------------------------------------------------------------------------
// macOS: CoreGraphics through JavaScript for Automation.
function jxa(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn("osascript", ["-l", "JavaScript", "-e", script]);
    let err = "";
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err.trim() || `osascript ${code}`))));
  });
}
const macMouse = (x, y, kinds, button = "left", clicks = 1) => jxa(`ObjC.import('CoreGraphics');
  const p = $.CGPointMake(${x}, ${y});
  for (const kind of ${JSON.stringify(kinds)}) { const e = $.CGEventCreateMouseEvent(null, $[kind], p, ${button === "right" ? "$.kCGMouseButtonRight" : "$.kCGMouseButtonLeft"});
    $.CGEventSetIntegerValueField(e, $.kCGMouseEventClickState, ${clicks}); $.CGEventPost($.kCGHIDEventTap, e); }`);
const MAC_KEYS = { enter: 36, return: 36, tab: 48, space: 49, delete: 117, backspace: 51, escape: 53, esc: 53, left: 123, right: 124, down: 125, up: 126,
  arrowleft: 123, arrowright: 124, arrowdown: 125, arrowup: 126, home: 115, end: 119, pageup: 116, pagedown: 121 };

// ---------------------------------------------------------------------------------------------
export function createComputerControl({ settingsFile, onStop }) {
  const read = () => { try { return JSON.parse(fs.readFileSync(settingsFile, "utf8")).enabled === true; } catch { return false; } };
  let enabled = read();
  let scale = 1; // screen pixels per screenshot pixel, from the last screenshot
  let bar, hideTimer;

  const setEnabled = (value) => {
    enabled = value === true;
    try { fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify({ enabled })); } catch {}
    if (!enabled) bar?.hide();
    return { enabled };
  };

  // The "AI is controlling the computer" bar. Content protection keeps it out of screenshots.
  const showBar = () => {
    if (!bar || bar.isDestroyed()) {
      const { workArea } = screen.getPrimaryDisplay();
      bar = new BrowserWindow({ width: 330, height: 44, x: Math.round(workArea.x + workArea.width / 2 - 165), y: workArea.y + 8, frame: false, resizable: false,
        movable: true, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false, transparent: true, hasShadow: false,
        webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
      bar.setAlwaysOnTop(true, "screen-saver");
      bar.setContentProtection(true);
      bar.setIgnoreMouseEvents(false);
      const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;overflow:hidden;background:transparent;font:13px Segoe UI,system-ui,sans-serif;-webkit-app-region:drag">
        <div style="display:flex;align-items:center;gap:10px;height:36px;margin:4px;padding:0 6px 0 12px;border-radius:18px;background:#1f2a24ee;color:#e9f3ec;border:1px solid #3ddc84">
        <span style="width:8px;height:8px;border-radius:50%;background:#3ddc84"></span><span style="flex:1">${tr("AI กำลังควบคุมคอมพิวเตอร์")}</span>
        <a href="superai-stop:" style="-webkit-app-region:no-drag;padding:4px 12px;border-radius:12px;background:#e5484d;color:#fff;text-decoration:none">${tr("หยุด")}</a></div></body>`;
      bar.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
        if (url.startsWith("superai-stop:")) { setEnabled(false); onStop?.(); }
      });
      bar.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    }
    bar.showInactive();
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => bar?.isDestroyed() || bar.hide(), 6000);
  };

  const display = () => screen.getPrimaryDisplay();
  // Screenshot coordinates → screen pixels (Windows, DPI aware) or points (macOS).
  const toScreen = (x, y) => {
    const px = Math.round(Number(x) * scale), py = Math.round(Number(y) * scale);
    if (!Number.isFinite(px) || !Number.isFinite(py)) throw new Error("x and y must be numbers from the latest screenshot");
    if (process.platform === "darwin") { const { bounds, scaleFactor } = display(); return [bounds.x + px / scaleFactor, bounds.y + py / scaleFactor]; }
    return [px, py];
  };

  async function screenshot() {
    const { size, scaleFactor, id } = display();
    const width = Math.round(size.width * scaleFactor), height = Math.round(size.height * scaleFactor);
    const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width, height } });
    const source = sources.find((s) => String(s.display_id) === String(id)) || sources[0];
    if (!source || source.thumbnail.isEmpty()) throw new Error(process.platform === "darwin"
      ? "Could not capture the screen. Allow SuperAi in System Settings > Privacy & Security > Screen Recording." : "Could not capture the screen.");
    let image = source.thumbnail;
    const full = image.getSize();
    if (full.width > MAX_WIDTH) image = image.resize({ width: MAX_WIDTH });
    scale = full.width / image.getSize().width;
    const shown = image.getSize();
    return { text: `Screen ${shown.width}x${shown.height} (coordinates for computer_click etc. are in this image).`, image: { data: image.toPNG().toString("base64"), mimeType: "image/png" } };
  }

  async function click(x, y, button, clicks) {
    const [sx, sy] = toScreen(x, y);
    if (process.platform === "darwin") {
      const down = button === "right" ? "kCGEventRightMouseDown" : "kCGEventLeftMouseDown", up = button === "right" ? "kCGEventRightMouseUp" : "kCGEventLeftMouseUp";
      for (let i = 1; i <= clicks; i++) await macMouse(sx, sy, ["kCGEventMouseMoved", down, up], button, i);
      return;
    }
    const [down, up] = button === "right" ? [0x08, 0x10] : button === "middle" ? [0x20, 0x40] : [0x02, 0x04];
    await send(`move ${sx} ${sy}`);
    for (let i = 0; i < clicks; i++) { await send(`mouse ${down}`); await send(`mouse ${up}`); }
  }

  async function typeText(text) {
    if (process.platform === "darwin") {
      for (const [i, part] of String(text).split("\n").entries()) {
        if (i) await jxa(`Application('System Events').keyCode(36)`);
        if (part) await jxa(`Application('System Events').keystroke(${JSON.stringify(part)})`);
      }
      return;
    }
    for (const ch of String(text)) {
      if (ch === "\n") { await send(`key ${VK.enter} down`); await send(`key ${VK.enter} up`); continue; }
      for (let i = 0; i < ch.length; i++) await send(`char ${ch.charCodeAt(i)}`);
    }
  }

  async function pressKeys(combo) {
    const parts = String(combo).split("+").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) throw new Error("key is empty");
    if (process.platform === "darwin") {
      const mods = parts.slice(0, -1).map((m) => ({ ctrl: "control down", control: "control down", shift: "shift down", alt: "option down", option: "option down", cmd: "command down", meta: "command down" }[m.toLowerCase()])).filter(Boolean);
      const last = parts.at(-1), code = MAC_KEYS[last.toLowerCase()];
      const using = mods.length ? `, { using: ${JSON.stringify(mods)} }` : "";
      await jxa(code !== undefined ? `Application('System Events').keyCode(${code}${using})` : `Application('System Events').keystroke(${JSON.stringify(last.toLowerCase())}${using})`);
      return;
    }
    const codes = parts.map(vk);
    for (const code of codes) await send(`key ${code} down`);
    for (const code of [...codes].reverse()) await send(`key ${code} up`);
  }

  async function scroll(x, y, direction, amount) {
    const steps = Math.max(1, Math.min(20, Number(amount) || 3));
    if (x !== undefined && y !== undefined) {
      const [sx, sy] = toScreen(x, y);
      if (process.platform === "darwin") await macMouse(sx, sy, ["kCGEventMouseMoved"]); else await send(`move ${sx} ${sy}`);
    }
    if (process.platform === "darwin") {
      const dy = direction === "up" ? steps : direction === "down" ? -steps : 0, dx = direction === "left" ? steps : direction === "right" ? -steps : 0;
      // Units are lines (kCGScrollEventUnitLine = 1), two axes: vertical then horizontal.
      await jxa(`ObjC.import('CoreGraphics'); $.CGEventPost($.kCGHIDEventTap, $.CGEventCreateScrollWheelEvent(null, 1, 2, ${dy}, ${dx}));`);
      return;
    }
    const horizontal = direction === "left" || direction === "right";
    const sign = direction === "up" || direction === "right" ? 1 : -1;
    await send(`wheel ${sign * 120 * steps} ${horizontal ? "h" : "v"}`);
  }

  async function run(tool, args = {}) {
    if (!enabled) throw new Error("Computer control is turned off. Ask the user to turn on \"Let the AI control this computer\" in SuperAi Settings > AI control, then try again.");
    showBar();
    const pause = () => new Promise((r) => setTimeout(r, 450));
    if (tool === "computer_screenshot") return screenshot();
    if (tool === "computer_click") { await click(args.x, args.y, String(args.button || "left"), args.double ? 2 : 1); await pause(); return screenshot(); }
    if (tool === "computer_move") { const [sx, sy] = toScreen(args.x, args.y); if (process.platform === "darwin") await macMouse(sx, sy, ["kCGEventMouseMoved"]); else await send(`move ${sx} ${sy}`); return { text: "Moved" }; }
    if (tool === "computer_type") { await typeText(String(args.text ?? "")); await pause(); return screenshot(); }
    if (tool === "computer_key") { await pressKeys(String(args.key || "")); await pause(); return screenshot(); }
    if (tool === "computer_scroll") { await scroll(args.x, args.y, String(args.direction || "down"), args.amount); await pause(); return screenshot(); }
    throw new Error(`Unknown computer tool: ${tool}`);
  }

  return { run, state: () => ({ enabled, platform: process.platform }), setEnabled, dispose: () => { helper?.kill(); if (bar && !bar.isDestroyed()) bar.destroy(); } };
}
