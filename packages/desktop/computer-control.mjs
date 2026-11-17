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
import { app, BrowserWindow, clipboard, ClipboardItem, desktopCapturer, globalShortcut, screen, shell, systemPreferences } from "electron";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
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
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, WindowsBase, System.Drawing
$refs = [AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { @('UIAutomationClient', 'UIAutomationTypes', 'WindowsBase', 'System.Drawing') -contains $_.GetName().Name } | ForEach-Object { $_.Location }
Add-Type -ReferencedAssemblies $refs -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
using System.Drawing; using System.Drawing.Drawing2D; using System.Drawing.Imaging;
public static class SuperAiInput {
  // One screen (or part of it) in physical pixels, scaled to at most outWidth, saved as JPEG.
  // About 10x faster than Electron's desktopCapturer, which grabs every screen at full size.
  static ImageCodecInfo jpeg;
  public static string Shot(int x, int y, int w, int h, int outWidth, int quality, string path) {
    using (var full = new Bitmap(w, h, PixelFormat.Format24bppRgb)) {
      using (var g = Graphics.FromImage(full)) g.CopyFromScreen(x, y, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);
      Bitmap image = full;
      if (outWidth > 0 && outWidth < w) {
        int oh = Math.Max(1, (int)Math.Round((double)h * outWidth / w));
        image = new Bitmap(outWidth, oh, PixelFormat.Format24bppRgb);
        using (var g = Graphics.FromImage(image)) { g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality; g.DrawImage(full, 0, 0, outWidth, oh); }
      }
      try {
        if (jpeg == null) foreach (var e in ImageCodecInfo.GetImageEncoders()) if (e.MimeType == "image/jpeg") jpeg = e;
        var ps = new EncoderParameters(1); ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, (long)quality);
        image.Save(path, jpeg, ps);
        return image.Width + " " + image.Height;
      } finally { if (image != full) image.Dispose(); }
    }
  }
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
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
  // Per-monitor aware (v2, Windows 10 1703+), so coordinates are real pixels on every screen even
  // when they use different scaling; older Windows: system aware.
  public static void Init() { try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch (EntryPointNotFoundException) {} SetProcessDPIAware(); }
  public static void Move(int x, int y) { SetCursorPos(x, y); INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = 0x0001; Send(new INPUT[] { i }); }
  public static string Pos() { POINT p; GetCursorPos(out p); return p.X + " " + p.Y; }
  public static void Mouse(uint flags) { INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = flags; Send(new INPUT[] { i }); }
  public static void Wheel(int amount, bool horizontal) { INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = horizontal ? 0x1000u : 0x0800u; i.u.mi.mouseData = unchecked((uint)amount); Send(new INPUT[] { i }); }
  // Arrows, Home/End, PageUp/Down, Insert/Delete and the Windows keys are "extended" keys.
  static bool Extended(ushort vk) { return (vk >= 0x21 && vk <= 0x28) || vk == 0x2d || vk == 0x2e || vk == 0x5b || vk == 0x5c || vk == 0x5d || vk == 0xa3 || vk == 0xa5 || vk == 0x90 || vk == 0x2c; }
  public static void Key(ushort vk, bool up) { Send(new INPUT[] { KeyInput(vk, 0, (up ? 2u : 0u) | (Extended(vk) ? 1u : 0u)) }); }
  // Virtual key and shift state that type this character on the current keyboard layout (-1 = none).
  public static int Scan(char c) { return VkKeyScanW(c); }
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  // "pid<TAB>title" of a top-level window (the title names the app of a UWP window, whose process is ApplicationFrameHost).
  static string Owner(IntPtr h) {
    if (h == IntPtr.Zero) return "0\t";
    uint pid; GetWindowThreadProcessId(h, out pid);
    StringBuilder s = new StringBuilder(256); GetWindowTextW(h, s, 256);
    return pid + "\t" + s.ToString().Replace("\t", " ");
  }
  // Click-through windows (the status bar's glow) are skipped by WindowFromPoint.
  public static string At(int x, int y) { POINT p; p.X = x; p.Y = y; IntPtr h = WindowFromPoint(p); return Owner(h == IntPtr.Zero ? h : GetAncestor(h, 2)); }
  public static string Front() { return Owner(GetForegroundWindow()); }
  // Is the keyboard focus in a password field? (The AI never types passwords.)
  public static string Secret() {
    try { var f = System.Windows.Automation.AutomationElement.FocusedElement; return f != null && f.Current.IsPassword ? "1" : "0"; } catch { return "0"; }
  }
  [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] static extern bool PostMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  // Windows that ignore clicks posted to them (Chromium, UWP, WPF, games): those need the real mouse.
  static readonly string[] NoPost = { "Chrome_", "Windows.UI.Core.CoreWindow", "ApplicationFrame", "HwndWrapper", "Intermediate D3D", "UnityWndClass", "SDL_app", "GLFW", "Qt5", "Qt6", "MozillaWindowClass" };
  // Runs an accessibility action on its own thread: Invoke can block while the app shows a modal dialog.
  static void Run(Action a) { var t = new System.Threading.Thread(() => { try { a(); } catch {} }); t.IsBackground = true; t.Start(); t.Join(1500); }
  // A left click as an accessibility action on the element at the point (or a parent of it), in the
  // app that owns the window there. "mouse" = a text field (it needs real focus), null = no action.
  static string Uia(int x, int y, uint pid) {
    System.Windows.Automation.AutomationElement el;
    try { el = System.Windows.Automation.AutomationElement.FromPoint(new System.Windows.Point(x, y)); } catch { return null; }
    if (el == null) return null;
    try { if ((uint)el.Current.ProcessId != pid) return null; } catch { return null; }
    for (int i = 0; el != null && i < 4; i++) {
      var ct = el.Current.ControlType;
      if (ct == System.Windows.Automation.ControlType.Edit || ct == System.Windows.Automation.ControlType.Document) return "mouse";
      if (ct == System.Windows.Automation.ControlType.Window) return null;
      object p;
      if (el.TryGetCurrentPattern(System.Windows.Automation.InvokePattern.Pattern, out p)) { var q = (System.Windows.Automation.InvokePattern)p; Run(() => q.Invoke()); return "invoke"; }
      if (el.TryGetCurrentPattern(System.Windows.Automation.TogglePattern.Pattern, out p)) { var q = (System.Windows.Automation.TogglePattern)p; Run(() => q.Toggle()); return "toggle"; }
      if (el.TryGetCurrentPattern(System.Windows.Automation.SelectionItemPattern.Pattern, out p)) { var q = (System.Windows.Automation.SelectionItemPattern)p; Run(() => q.Select()); return "select"; }
      if (el.TryGetCurrentPattern(System.Windows.Automation.ExpandCollapsePattern.Pattern, out p)) {
        var q = (System.Windows.Automation.ExpandCollapsePattern)p;
        Run(() => { if (q.Current.ExpandCollapseState == System.Windows.Automation.ExpandCollapseState.Collapsed) q.Expand(); else q.Collapse(); });
        return "expand";
      }
      try { el = System.Windows.Automation.TreeWalker.ControlViewWalker.GetParent(el); } catch { return null; }
    }
    return null;
  }
  // Clicks without moving the user's mouse: an accessibility action for a plain left click, else
  // mouse messages posted to the window under the point. "mouse" = this window needs the real mouse.
  public static string Quiet(int x, int y, int button, int clicks) {
    POINT p; p.X = x; p.Y = y;
    IntPtr h = WindowFromPoint(p);
    if (h == IntPtr.Zero) return "mouse";
    uint pid; GetWindowThreadProcessId(GetAncestor(h, 2), out pid);
    if (button == 0 && clicks == 1) { string a = Uia(x, y, pid); if (a != null) return a; }
    StringBuilder s = new StringBuilder(256); GetClassNameW(h, s, 256);
    string cls = s.ToString();
    foreach (string n in NoPost) if (cls.StartsWith(n)) return "mouse";
    ScreenToClient(h, ref p);
    IntPtr l = (IntPtr)((p.Y << 16) | (p.X & 0xFFFF));
    uint down = button == 1 ? 0x204u : button == 2 ? 0x207u : 0x201u;
    IntPtr keys = (IntPtr)(button == 1 ? 2 : button == 2 ? 0x10 : 1);
    PostMessageW(h, 0x200, IntPtr.Zero, l);
    for (int i = 0; i < clicks; i++) { PostMessageW(h, i == 1 ? down + 2 : down, keys, l); PostMessageW(h, down + 1, IntPtr.Zero, l); }
    return "posted";
  }
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
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$tab = [char]9
# "pid<TAB>title<TAB>process name<TAB>description" of the app that owns a window.
function Describe([string]$owner) {
  $f = $owner.Split([char[]]@($tab), 2)
  $procId = [int]$f[0]
  $title = ''
  if ($f.Length -gt 1) { $title = $f[1] }
  if ($procId -eq 0) { return '0' }
  $name = '?'; $desc = ''
  try { $pr = Get-Process -Id $procId -ErrorAction Stop; $name = $pr.ProcessName; try { $desc = $pr.MainModule.FileVersionInfo.FileDescription } catch {} } catch {}
  return "$procId$tab$title$tab$name$tab$desc"
}
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
      'at' { $out = Describe ([SuperAiInput]::At([int]$p[1], [int]$p[2])) }
      'front' { $out = Describe ([SuperAiInput]::Front()) }
      'secret' { $out = [SuperAiInput]::Secret() }
      'shot' { $out = [SuperAiInput]::Shot([int]$p[1], [int]$p[2], [int]$p[3], [int]$p[4], [int]$p[5], [int]$p[6], [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p[7]))) }
      'quiet' { $out = [SuperAiInput]::Quiet([int]$p[1], [int]$p[2], [int]$p[3], [int]$p[4]) }
      'apps' { $out = (Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object { $d = ''; if ($_.ProcessName -eq 'ApplicationFrameHost') { $d = $_.MainWindowTitle } else { try { $d = $_.MainModule.FileVersionInfo.FileDescription } catch {} }; if ($d) { $d } else { $_.ProcessName } } | Sort-Object -Unique) -join $tab }
    }
    [Console]::Out.WriteLine(('ok ' + $out).Trim())
  } catch { [Console]::Out.WriteLine('error ' + $_.Exception.Message) }
}
`;

// ---------------------------------------------------------------------------------------------
// macOS input helper: CoreGraphics events (needs only the Accessibility permission, no Apple
// Events), one osascript process for the whole session, same line protocol as on Windows.
const MAC_HELPER = String.raw`
ObjC.import('Foundation'); ObjC.import('CoreGraphics'); ObjC.import('AppKit');
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
// "pid<TAB><TAB>name<TAB><TAB>bundle id", like the Windows helper (no title, no description).
function appInfo(pid) {
  const a = $.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
  if (!a || (a.isNil && a.isNil())) return pid + "\t\t?\t\t";
  return pid + "\t\t" + ObjC.unwrap(a.localizedName) + "\t\t" + (ObjC.unwrap(a.bundleIdentifier) || "");
}
function front() { return appInfo($.NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier); }
// The topmost window under the point, front to back, including the Dock and floating panels (higher
// layers). Skipped: SuperAi's own overlays (the bar, the glow and the AI cursor float above layer 0 and
// let clicks through) and invisible windows. The menu bar and the desktop count as the front app.
function at(x, y, owner) {
  try {
    const list = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1 | 16, 0))) || [];
    for (const w of list) {
      const layer = w.kCGWindowLayer, pid = w.kCGWindowOwnerPID;
      if (w.kCGWindowAlpha === 0) continue;
      if (layer !== 0 && pid === owner) continue;
      const b = w.kCGWindowBounds;
      if (!(x >= b.X && x < b.X + b.Width && y >= b.Y && y < b.Y + b.Height)) continue;
      if (layer < 0 || w.kCGWindowOwnerName === "Window Server") break; // desktop, menu bar
      return appInfo(pid);
    }
  } catch (e) {}
  return front();
}
function apps() { return ObjC.unwrap($.NSWorkspace.sharedWorkspace.runningApplications).filter((a) => a.activationPolicy == 0).map((a) => ObjC.unwrap(a.localizedName)).join("\t"); }
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
      else if (p[0] === "at") result = at(n[1], n[2], n[3]);
      else if (p[0] === "front") result = front();
      else if (p[0] === "apps") result = apps();
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
  // warm: start it ahead of the first command (compiling the Windows helper takes a second or two).
  return { send, warm: () => { try { ensure(); } catch {} }, kill: () => proc?.kill() };
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
const TEST_OS_ACCESS = process.env.SUPERAI_TEST_MODE ? process.env.SUPERAI_TEST_OS_ACCESS : undefined;
export function osAccess(prompt = false) {
  // Tests on Windows can stand in for a Mac that has not granted access yet (a JSON file they edit).
  if (TEST_OS_ACCESS) try { return { accessibility: "granted", screen: "granted", ...JSON.parse(fs.readFileSync(TEST_OS_ACCESS, "utf8")) }; } catch { return { accessibility: "denied", screen: "denied" }; }
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
// macOS remembers these permissions by the app's code signature. A build signed ad hoc gets a new
// signature with every update, so the switch can show "on" while macOS no longer counts it. Resetting
// SuperAi's own entry (no admin password needed) lets the user turn it on again for this build.
const TCC_SERVICE = { accessibility: "Accessibility", screen: "ScreenCapture" };
function bundleId() {
  try {
    const plist = fs.readFileSync(path.resolve(path.dirname(process.execPath), "..", "Info.plist"), "utf8");
    const m = /<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);
    if (m) return m[1];
  } catch {}
  return "com.rakgoorak.superai";
}
export function resetOsAccess(kind) {
  if (!TCC_SERVICE[kind]) return Promise.resolve(false);
  if (TEST_OS_ACCESS) return Promise.resolve(!process.env.SUPERAI_TEST_TCC_FAIL);
  if (process.platform !== "darwin") return Promise.resolve(false);
  return new Promise((resolve) => execFile("/usr/bin/tccutil", ["reset", TCC_SERVICE[kind], bundleId()], { timeout: 10000 }, (error) => resolve(!error)));
}
export function openOsSettings(kind) {
  if (TEST_OS_ACCESS && MAC_SETTINGS[kind]) return true;
  if (process.platform !== "darwin" || !MAC_SETTINGS[kind]) return false;
  // Asking once also adds SuperAi to the list, so the user only has to tick it.
  if (kind === "accessibility") osAccess(true);
  if (kind === "screen") desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {});
  shell.openExternal(MAC_SETTINGS[kind]).catch(() => {});
  return true;
}

// ---------------------------------------------------------------------------------------------
// Apps. Like Claude Desktop, the user allows the AI app by app (computer_request_access); clicks and
// typing reach only the allowed apps. Web browsers are view-only (the browser_ tools are for web
// pages) and terminals / code editors take left-clicks and scrolling only, never typing.
const norm = (s) => String(s || "").toLowerCase().replace(/\.(exe|app)$/, "").replace(/[^\p{L}\p{N}]+/gu, "");
const VIEW_ONLY = new Set(["chrome", "googlechrome", "msedge", "edge", "microsoftedge", "firefox", "mozillafirefox", "brave", "bravebrowser", "opera", "operagx",
  "vivaldi", "arc", "safari", "iexplore", "internetexplorer", "chromium", "waterfox", "librewolf", "torbrowser", "zenbrowser", "floorp"]);
const CLICK_ONLY = new Set(["windowsterminal", "terminal", "wt", "cmd", "windowscommandprocessor", "commandprompt", "powershell", "windowspowershell", "pwsh",
  "conhost", "consolewindowhost", "openconsole", "wsl", "bash", "mintty", "gitbash", "code", "codeinsiders", "vscode", "visualstudiocode", "cursor", "windsurf",
  "antigravity", "devenv", "visualstudio", "microsoftvisualstudio", "idea", "idea64", "intellijidea", "pycharm", "pycharm64", "webstorm", "webstorm64", "rider",
  "rider64", "clion", "clion64", "goland", "goland64", "phpstorm", "phpstorm64", "rubymine", "rubymine64", "studio64", "androidstudio", "sublimetext", "iterm",
  "iterm2", "warp", "wezterm", "weztermgui", "alacritty", "kitty", "hyper", "tabby", "xcode", "zed", "fleet", "ghostty"]);
const VIEW_BUNDLES = /(google\.chrome|microsoft\.edgemac|mozilla\.firefox|apple\.safari|brave\.browser|thebrowsercompany|operasoftware|vivaldi|chromium)/i;
const CLICK_BUNDLES = /(apple\.terminal|googlecode\.iterm2|microsoft\.vscode|dev\.warp|todesktop|jetbrains|apple\.dt\.xcode|wezterm|alacritty|kovidgoyal\.kitty|dev\.zed|ghostty|windsurf)/i;
const RANK = { read: 0, click: 1, full: 2 };
// Password managers, wallets and banking apps hold passwords or money: the AI may only look at them.
const SENSITIVE = new Set(["1password", "bitwarden", "keepass", "keepassxc", "lastpass", "dashlane", "enpass", "nordpass", "protonpass", "roboform", "keeper",
  "keychainaccess", "passwords", "credentialmanager", "exodus", "ledgerlive", "trezorsuite", "electrum", "atomicwallet", "metamask", "trustwallet", "coinbase", "binance", "bitkub"]);
const SENSITIVE_BUNDLES = /(1password|agilebits|bitwarden|keepassxc|lastpass|dashlane|apple\.keychainaccess|apple\.passwords|exodus|ledger|trezor)/i;
function isSensitive(names, bundle = "") {
  const keys = names.map(norm).filter(Boolean);
  return SENSITIVE_BUNDLES.test(bundle) || keys.some((k) => SENSITIVE.has(k) || /bank|wallet|password/.test(k));
}
/** "read" (look only), "click" (left-click and scroll) or "full". */
function appTier(names, bundle = "") {
  const keys = names.map(norm).filter(Boolean);
  if (isSensitive(names, bundle)) return "read";
  if (VIEW_BUNDLES.test(bundle) || keys.some((k) => VIEW_ONLY.has(k))) return "read";
  if (CLICK_BUNDLES.test(bundle) || keys.some((k) => CLICK_ONLY.has(k))) return "click";
  return "full";
}
/** Other names the user may know an app by (exact matches only). */
const ALIASES = { msedge: ["microsoftedge"], explorer: ["fileexplorer", "desktop", "taskbar", "startmenu"], windowsexplorer: ["fileexplorer", "desktop", "taskbar", "startmenu"], finder: ["desktop"], dock: ["finder"] }; // macOS: clicking the Dock is covered by a Finder grant (like the taskbar by Explorer)
const isFrame = (app) => /^applicationframehost$/i.test(app.name || "");
const appNames = (app) => [app.name, app.desc, app.bundle, String(app.bundle || "").split(".").pop(), isFrame(app) ? app.title : ""];
const appLabel = (app) => (isFrame(app) && app.title) || app.desc || app.name || "an unknown window";
function parseApp(line) {
  const [pid = "0", title = "", name = "", desc = "", bundle = ""] = String(line || "").split("\t");
  return { pid: Number(pid) || 0, title, name, desc, bundle };
}
/** Does an allowed name (normalized) mean this app? */
function appMatches(app, key) {
  const keys = appNames(app).map(norm).filter(Boolean);
  if (keys.some((k) => k === key || (Math.min(k.length, key.length) >= 4 && (k.includes(key) || key.includes(k))))) return true;
  return keys.some((k) => (ALIASES[k] || []).includes(key));
}
const ownName = (name) => /superai|rakkyxd/.test(norm(name));

const TOOLS = ["computer_request_access", "computer_ui_snapshot", "computer_ui_action", "computer_screenshot", "computer_click", "computer_move", "computer_type", "computer_key", "computer_scroll", "computer_drag", "computer_cursor", "computer_wait", "computer_zoom"];
/** What a tool does, in the window's language (literal tr() calls, so the dictionaries pick them up). */
const toolLabel = (tool) => ({
  computer_request_access: tr("ขอสิทธิ์ใช้แอป"), computer_ui_snapshot: tr("อ่านหน้าต่างแอป"), computer_ui_action: tr("กดหรือกรอกในแอป"), computer_screenshot: tr("ดูหน้าจอ"), computer_click: tr("คลิก"), computer_move: tr("ขยับเมาส์"), computer_type: tr("พิมพ์ข้อความ"), computer_key: tr("กดปุ่มคีย์บอร์ด"),
  computer_scroll: tr("เลื่อนหน้าจอ"), computer_drag: tr("ลากเมาส์"), computer_cursor: tr("ดูตำแหน่งเมาส์"), computer_wait: tr("รอแล้วดูหน้าจอ"), computer_zoom: tr("ซูมดูหน้าจอ"),
}[tool] || tool);

// ---------------------------------------------------------------------------------------------
export function createComputerControl({ settingsFile, onStop, onChange }) {
  const read = () => { try { return JSON.parse(fs.readFileSync(settingsFile, "utf8")).enabled === true; } catch { return false; } };
  let enabled = read();
  // Already turned on: have the input helper ready before the AI first needs it (after start-up settles).
  if (enabled) setTimeout(() => { if (enabled) input().warm(); }, 4000).unref?.();
  let scale = 1; // screen pixels per screenshot pixel, from the last screenshot
  let hideTimer, prompt;
  /** chatId → { chat: true } (whole chat) or { until } ("this task", extended on every call), with the allowed apps (normalized name → { name, tier }). */
  const grants = new Map();
  /** chatId → time until which a Deny still stands. */
  const denied = new Map();
  let queue = Promise.resolve();

  const state = () => ({ enabled, stopKey: stopKey?.[1] || "", platform: process.platform, os: osAccess(false), allowed: [...grants.entries()].filter(([, g]) => g.chat || g.until > Date.now()).map(([id, g]) => ({ chatId: id, chatName: g.name, scope: g.chat ? "chat" : "task", apps: [...g.apps.values()].map((a) => a.name) })) });
  const changed = () => onChange?.(state());

  const revoke = () => { grants.clear(); denied.clear(); prompt?.answer("deny"); changed(); return state(); };
  const setEnabled = (value) => {
    enabled = value === true;
    try { fs.mkdirSync(path.dirname(settingsFile), { recursive: true }); fs.writeFileSync(settingsFile, JSON.stringify({ enabled })); } catch {}
    if (!enabled) { hideBar(); grants.clear(); denied.clear(); prompt?.answer("deny"); }
    else input().warm();
    // Turning it on on macOS: ask for what is still missing right away, while the user is in Settings.
    if (enabled && process.platform === "darwin") {
      const access = osAccess(false);
      if (access.accessibility !== "granted") osAccess(true);
      if (access.screen === "not-determined") desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } }).catch(() => {});
    }
    changed();
    return state();
  };

  // While the AI acts, on every screen: a status bar at the top (what it does, for which chat,
  // on which screen, and Stop) and a glow along the edges. The glow is four thin strips rather than
  // one window over the whole screen, so nothing but the edges is ever covered. Content protection
  // asks the OS to keep them out of screenshots (Windows ignores it for transparent windows), and
  // any of them under a point the AI clicks steps aside meanwhile.
  /** display id → { bar, glows } */
  const ui = new Map();
  const GLOW = 18;
  const PULSE = 2600; // ms; every strip on every screen breathes in step
  const barSize = { width: 460, height: 64 };
  const overlays = () => [...ui.values()].flatMap(({ bar, glows }) => [bar, ...glows]).filter((w) => w && !w.isDestroyed());
  // Stop from anywhere: while the AI has control, this key combination turns it off at once
  // (like the Stop button), even when the bar is covered or the AI is mid-action.
  // The first combination no other app holds (another app, e.g. a launcher, may own one already).
  const STOP_KEYS = process.platform === "darwin"
    ? [["Command+Shift+Escape", "⌘⇧Esc"], ["Control+Option+Escape", "⌃⌥Esc"], ["Command+Option+Shift+S", "⌘⌥⇧S"]]
    : [["Control+Alt+Escape", "Ctrl+Alt+Esc"], ["Control+Alt+End", "Ctrl+Alt+End"], ["Control+Shift+Alt+S", "Ctrl+Shift+Alt+S"]];
  let stopKey; // [accelerator, label] while held
  const stopNow = () => { setEnabled(false); onStop?.(); };
  const holdStopKey = (on) => {
    if (on === !!stopKey) return;
    if (!on) { try { globalShortcut.unregister(stopKey[0]); } catch {} stopKey = undefined; return; }
    for (const key of STOP_KEYS) { try { if (globalShortcut.register(key[0], stopNow)) { stopKey = key; return; } } catch {} }
  };
  const hideBar = () => {
    holdStopKey(false); for (const w of overlays()) w.hide(); if (aiCursor && !aiCursor.isDestroyed()) aiCursor.hide(); };
  // The AI's own pointer: an arrow with an "AI" tag that glides to where the AI acts, so the user
  // sees it while keeping the real mouse. Click-through, just off the point it shows.
  // The window leaves CURSOR_PAD of room around the arrow tip, so the click ring and the shadow
  // are never cut off at the window's edge (they were: the tip sat in the window's corner).
  let aiCursor;
  const CURSOR_PAD = 22, CURSOR_W = 300, CURSOR_H = 84;
  const cursorHtml = () => `<!doctype html><meta charset="utf-8"><style>
      html, body { margin: 0; background: transparent; overflow: hidden; }
      .c { position: absolute; left: ${CURSOR_PAD}px; top: ${CURSOR_PAD}px; width: ${CURSOR_W - CURSOR_PAD}px; height: ${CURSOR_H - CURSOR_PAD}px; }
      .c svg { position: absolute; left: 0; top: 0; overflow: visible; filter: drop-shadow(0 2px 3px rgba(0,0,0,.5)); }
      .tag { position: absolute; left: 18px; top: 22px; box-shadow: 0 2px 6px rgba(0,0,0,.4); padding: 2px 8px; border-radius: 99px; font: 700 11px "Segoe UI", system-ui, sans-serif; color: #05110b;
        background: linear-gradient(135deg, #3ddc84, #38bdf8); white-space: nowrap; max-width: 230px; overflow: hidden; text-overflow: ellipsis; }
      #say:not(:empty)::before { content: " · "; }
      /* Thinking: the words shimmer and three dots bounce, like the AI is working on its next step. */
      .tag.think #say { background: linear-gradient(90deg, #05110b 0 35%, #f2fff8 50%, #05110b 65% 100%); background-size: 250% 100%;
        -webkit-background-clip: text; background-clip: text; color: transparent; animation: shine 1.6s linear infinite; }
      @keyframes shine { from { background-position: 100% 0; } to { background-position: -150% 0; } }
      .dots { display: none; } .tag.think .dots { display: inline-flex; gap: 2px; margin-left: 4px; vertical-align: middle; }
      .dots i { width: 3px; height: 3px; border-radius: 50%; background: #05110b; animation: hop 1s ease-in-out infinite; }
      .dots i:nth-child(2) { animation-delay: .15s; } .dots i:nth-child(3) { animation-delay: .3s; }
      @keyframes hop { 50% { transform: translateY(-3px); opacity: .5; } }
      .ring { position: absolute; left: -10px; top: -10px; width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; border: 2px solid #3ddc84; opacity: 0; }
      .ring.go { animation: ring .5s ease-out; } @keyframes ring { from { opacity: 1; transform: scale(.4); } to { opacity: 0; transform: scale(1.8); } }
    </style><div class="c"><span class="ring" id="ring"></span>
      <svg width="22" height="26" viewBox="0 0 22 26"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ddc84"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>
        <path d="M1.5 1.5 L1.5 21 L7 16 L10.5 24 L14 22.5 L10.5 15 L18 15 Z" fill="url(#g)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
      <span class="tag" id="tag"><b>AI</b><span id="say"></span><span class="dots"><i></i><i></i><i></i></span></span></div>
    <script>window.pulse = () => { const r = document.getElementById('ring'); r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); };
      window.say = (text, thinking) => { document.getElementById('say').textContent = text || ''; document.getElementById('tag').classList.toggle('think', !!thinking); };</script>`;
  function cursorWindow() {
    if (aiCursor && !aiCursor.isDestroyed()) return aiCursor;
    aiCursor = overlayWindow({ x: 0, y: 0, width: CURSOR_W, height: CURSOR_H }, { movable: false });
    aiCursor.setIgnoreMouseEvents(true);
    aiCursor.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(cursorHtml()));
    return aiCursor;
  }
  let saying = ["", false];
  /** What the label next to the AI cursor says: the action, or "thinking" between actions. */
  function cursorSay(text, thinking = false) {
    saying = [text, thinking];
    if (!aiCursor || aiCursor.isDestroyed()) return;
    const run = () => aiCursor.webContents.executeJavaScript(`window.say && window.say(${JSON.stringify(text)}, ${thinking})`).catch(() => {});
    if (aiCursor.webContents.isLoading()) aiCursor.webContents.once("did-finish-load", run); else run();
  }
  /** Glides the AI cursor to a screen point (pixels on Windows, points on macOS). */
  async function pointAt(sx, sy) {
    try {
      const p = process.platform === "win32" && screen.screenToDipPoint ? screen.screenToDipPoint({ x: sx, y: sy }) : { x: sx, y: sy };
      const w = cursorWindow();
      // Window position = the tip (just off the point, so the real target stays visible) minus the padding.
      const to = { x: Math.round(p.x) + 1 - CURSOR_PAD, y: Math.round(p.y) + 1 - CURSOR_PAD };
      const from = w.isVisible() ? w.getBounds() : { x: to.x - 90, y: to.y - 60 };
      w.showInactive(); w.setAlwaysOnTop(true, "screen-saver"); w.moveTop();
      // A smooth glide at about 60 fps; longer moves take a little longer (140-340 ms), easing out.
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const duration = Math.min(340, Math.max(140, distance * 0.45)), start = Date.now();
      for (;;) {
        const k = Math.min(1, (Date.now() - start) / duration), t = 1 - Math.pow(1 - k, 3);
        w.setPosition(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t));
        if (k >= 1) break;
        await wait(16);
      }
      w.webContents.executeJavaScript("window.pulse && window.pulse()").catch(() => {});
      cursorSay(...saying);
    } catch {}
  }
  const dropOverlays = () => { for (const w of overlays()) w.destroy(); ui.clear(); };
  // Screens plugged in, removed or rearranged: build the overlays again on the next action.
  for (const event of ["display-added", "display-removed", "display-metrics-changed"]) screen.on(event, () => {
    dropOverlays();
    if (target !== undefined && !screen.getAllDisplays().some((d) => d.id === target)) target = undefined;
  });
  const barHtml = () => `<!doctype html><html><head><meta charset="utf-8"><style>
      @property --a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
      * { box-sizing: border-box; }
      body { margin: 0; overflow: hidden; background: transparent; font: 13px "Segoe UI", system-ui, -apple-system, sans-serif; -webkit-app-region: drag; user-select: none; }
      .pill { position: relative; margin: 8px; height: 48px; border-radius: 24px; padding: 0 6px 0 16px; display: flex; align-items: center; gap: 12px;
        color: #eafff3; background: linear-gradient(135deg, rgba(14,22,19,.94), rgba(10,16,22,.94)); box-shadow: 0 10px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
        animation: rise .35s cubic-bezier(.2,.9,.3,1.2); transition: opacity .25s; }
      .pill::before { content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px;
        background: conic-gradient(from var(--a), #3ddc84, #38bdf8, #a78bfa, #3ddc84);
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
        animation: spin 3s linear infinite; pointer-events: none; }
      body.idle .pill { opacity: .78; } body.idle .pill::before { animation-duration: 9s; }
      @keyframes spin { to { --a: 360deg; } }
      @keyframes rise { from { transform: translateY(-14px) scale(.96); opacity: 0; } }
      .orb { position: relative; flex: none; width: 10px; height: 10px; border-radius: 50%; background: #3ddc84; box-shadow: 0 0 12px #3ddc84; }
      .orb::after { content: ""; position: absolute; inset: -7px; border-radius: 50%; border: 2px solid #3ddc84; animation: ping 1.6s ease-out infinite; }
      body.idle .orb::after { animation: none; opacity: 0; }
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
      <a class="stop" href="superai-stop:"><i></i>${escapeHtml(tr("หยุด"))} <small id="key"></small></a></div>
      <script>window.setStatus = (action, who, here) => { const s = document.getElementById('sub'); s.textContent = ''; const b = document.createElement('b'); b.textContent = action; s.append(b); if (who) s.append(' · ' + who); document.body.classList.toggle('idle', !here); };</script>
    </body></html>`;
  const glowHtml = (to) => `<!doctype html><meta charset="utf-8"><style>
      html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; }
      .edge { position: fixed; inset: 0; background: linear-gradient(to ${to}, rgba(61,220,132,1) 0 4px, rgba(56,189,248,.6) 4px, rgba(56,189,248,.22) 55%, rgba(167,139,250,0));
        animation: breathe ${PULSE}ms ease-in-out infinite; }
      @keyframes breathe { 50% { opacity: .6; filter: hue-rotate(40deg); } }
    </style><div class="edge"></div>
    <script>document.querySelector('.edge').style.animationDelay = -(Date.now() % ${PULSE}) + 'ms';</script>`;
  const overlayWindow = (rect, extra = {}) => {
    const w = new BrowserWindow({ ...rect, frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, focusable: false, show: false,
      transparent: true, hasShadow: false, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }, ...extra });
    w.setAlwaysOnTop(true, "screen-saver");
    w.setVisibleOnAllWorkspaces?.(true);
    w.setContentProtection(true);
    return w;
  };
  const makeOverlays = (d) => {
    const { workArea: a, bounds: b } = d;
    const bar = overlayWindow({ ...barSize, x: Math.round(a.x + (a.width - barSize.width) / 2), y: a.y + 6 }, { movable: true });
    bar.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      if (url.startsWith("superai-stop:")) stopNow();
    });
    bar.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(barHtml()));
    // Each strip fades from the screen edge inwards; "to" is the direction of the fade. Every strip
    // runs the whole length of its edge, so the line is unbroken at the corners (where they overlap).
    // The sides come in two halves: Windows cuts a window taller than the space above the taskbar.
    const half = Math.ceil(b.height / 2);
    const strips = [
      { x: b.x, y: b.y, width: b.width, height: GLOW, to: "bottom" },
      { x: b.x, y: b.y + b.height - GLOW, width: b.width, height: GLOW, to: "top" },
      ...[b.y, b.y + b.height - half].flatMap((y) => [
        { x: b.x, y, width: GLOW, height: half, to: "right" },
        { x: b.x + b.width - GLOW, y, width: GLOW, height: half, to: "left" },
      ]),
    ];
    const glows = strips.map(({ to, ...rect }) => {
      const w = overlayWindow(rect, { movable: false });
      w.setIgnoreMouseEvents(true);
      w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(glowHtml(to)));
      return w;
    });
    return { bar, glows };
  };
  /** Shows (or refreshes) the bar and the glow on every screen; they go away after a while without computer_ calls. */
  const showBar = (tool, caller) => {
    holdStopKey(true);
    const list = displays(), active = display();
    for (const d of list) {
      let set = ui.get(d.id);
      if (!set || [set.bar, ...set.glows].some((w) => w.isDestroyed())) { if (set) for (const w of [set.bar, ...set.glows]) if (!w.isDestroyed()) w.destroy(); set = makeOverlays(d); ui.set(d.id, set); }
      const who = [caller?.chatName ? tr`แชต "${caller.chatName}"` : "", list.length > 1 ? tr`จอ ${list.findIndex((x) => x.id === active.id) + 1}` : ""].filter(Boolean).join(" · ");
      // The screen the AI works on shows the bar fully lit; the others show it calmer.
      const status = `window.setStatus && window.setStatus(${JSON.stringify(toolLabel(tool))}, ${JSON.stringify(who)}, ${d.id === active.id}); document.getElementById('key').textContent = ${JSON.stringify(stopKey?.[1] || "")};`;
      const { bar } = set;
      const apply = () => bar.webContents.executeJavaScript(status).catch(() => {});
      if (bar.webContents.isLoading()) bar.webContents.once("did-finish-load", apply); else apply();
      // The taskbar is always-on-top too: raise the strips over it again on every call.
      for (const w of set.glows) { w.showInactive(); w.setAlwaysOnTop(true, "screen-saver"); w.moveTop(); }
      bar.showInactive(); bar.moveTop();
    }
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideBar, BAR_IDLE);
  };
  /** Is this screen point (pixels on Windows, points on macOS) on the window? */
  const covers = (w, sx, sy) => {
    if (!w.isVisible()) return false;
    const { x, y } = process.platform === "win32" && screen.screenToDipPoint ? screen.screenToDipPoint({ x: sx, y: sy }) : { x: sx, y: sy };
    const b = w.getBounds();
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
  const TIER_TEXT = () => ({ full: tr("ควบคุมได้เต็มที่"), click: tr("คลิกและเลื่อนได้เท่านั้น"), read: tr("ดูได้อย่างเดียว"), secret: tr("ข้อมูลสำคัญ · ดูได้อย่างเดียว") });
  function ask(caller, apps, reason) {
    return new Promise((resolve) => {
      const access = osAccess(false);
      const missing = process.platform === "darwin" || TEST_OS_ACCESS ? ["accessibility", "screen"].filter((k) => access[k] !== "granted") : [];
      const who = caller.chatName ? tr`แชต "${caller.chatName}"` : tr("AI ในแชต");
      // macOS lets only the user turn these on, in System Settings (an app cannot grant them, even with
      // the admin password). Walk them through it: SuperAi is already in the list, they flip its switch,
      // and the row turns green by itself. Screen Recording only takes effect after SuperAi reopens.
      const osRows = missing.length ? `<div class="setup"><b>${escapeHtml(tr("ตั้งค่าครั้งแรกบน Mac (ทำครั้งเดียว)"))}</b>
        <span class="steps">${escapeHtml(tr("กด \"เปิด System Settings\" → เปิดสวิตช์ข้าง SuperAi → ใส่รหัสผ่านหรือ Touch ID"))}</span>
        ${missing.map((kind) => `<div class="os" id="os-${kind}"><span class="dot"></span><span class="what">${escapeHtml(kind === "accessibility"
          ? tr("Accessibility (ใช้เมาส์และคีย์บอร์ด)") : tr("Screen Recording (ดูหน้าจอ)"))}</span><span class="state">${escapeHtml(tr("ยังไม่อนุญาต"))}</span>
          <a class="btn ghost open" href="superai-perm:os-${kind}">${escapeHtml(tr("เปิด System Settings"))}</a>
          ${kind === "screen" ? `<a class="btn ghost reopen" href="superai-perm:relaunch">${escapeHtml(tr("เปิด SuperAi ใหม่"))}</a>` : ""}
          <a class="btn ghost reset" href="superai-perm:reset-${kind}" title="${escapeHtml(tr("ลบสิทธิ์เดิมของ SuperAi แล้วขอใหม่"))}">${escapeHtml(tr("รีเซ็ต"))}</a></div>`).join("")}
        <span class="hint">${escapeHtml(tr("สวิตช์เปิดอยู่แล้วแต่ยังเป็นสีแดง (มักเกิดหลังอัปเดต)? กด \"รีเซ็ต\" แล้วเปิดสวิตช์ใหม่อีกครั้ง"))}</span>
        <span class="note" id="reopen-note">${escapeHtml(tr("เปิดสวิตช์ Screen Recording แล้ว กด \"เปิด SuperAi ใหม่\" ให้มีผล แล้วสั่งงานเดิมอีกครั้ง"))}</span>
        <span class="fail" id="reset-fail">${escapeHtml(tr("รีเซ็ตเองไม่ได้: ใน System Settings เลือก SuperAi แล้วกดปุ่ม − เพื่อลบ จากนั้นกด \"เปิด System Settings\" ที่นี่อีกครั้ง"))}</span></div>` : "";
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
        .setup{display:flex;flex-direction:column;gap:6px;font-size:12px} .setup b{color:#e8ece9} .steps{color:#8fa79c}
        .os{display:flex;align-items:center;gap:8px;background:rgba(229,72,77,.1);border:1px solid rgba(229,72,77,.4);border-radius:10px;padding:7px 10px;color:#f8c9cd;transition:background .3s,border-color .3s}
        .os .what{flex:1} .os .state{color:#ffb4b9} .dot{flex:none;width:8px;height:8px;border-radius:50%;background:#e5484d}
        .os .reopen,.note,.fail{display:none} .note{color:#f6cf8a} .hint{color:#8fa79c;font-size:11px}
        .os .reset{color:#8fa79c} .setup.failed .fail{display:block;color:#ffb4b9} .setup.failed .hint{display:none}
        .os.opened{background:rgba(245,165,36,.08);border-color:rgba(245,165,36,.4);color:#f3dcb3} .os.opened .dot{background:#f5a524;animation:blink 1s infinite} .os.opened .state{color:#f6cf8a}
        .os.restart .reopen{display:inline-block} .os.restart .open{display:none} .setup.restart .note{display:block}
        .os.granted{background:rgba(61,220,132,.08);border-color:rgba(61,220,132,.4);color:#c9f7dd} .os.granted .dot{background:#3ddc84} .os.granted .state{color:#9ff0c4} .os.granted .btn{display:none}
        @keyframes blink{50%{opacity:.3}}
        .row{display:flex;gap:8px;justify-content:flex-end;margin-top:auto;flex-wrap:wrap}
        .btn{display:inline-block;padding:9px 15px;border-radius:10px;text-decoration:none;color:#e8ece9;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);white-space:nowrap;transition:transform .12s,filter .12s}
        .btn:hover{filter:brightness(1.2);transform:translateY(-1px)} .btn:active{transform:scale(.97)} .btn:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}
        .deny{color:#ffc9ce;border-color:rgba(229,72,77,.45)} .allow{background:linear-gradient(135deg,#3ddc84,#38bdf8);color:#05110b;border-color:transparent;font-weight:700;box-shadow:0 6px 18px rgba(61,220,132,.3)}
        .ghost{padding:4px 10px;font-size:12px}
        .apps{display:flex;flex-direction:column;gap:6px;max-height:212px;overflow:auto}
        .app{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:7px 10px}
        .app i{flex:none;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-style:normal;font-weight:700;background:rgba(56,189,248,.15);color:#9be7ff}
        .app b{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tier{flex:none;font-size:11px;padding:2px 9px;border-radius:99px;background:rgba(61,220,132,.14);color:#9ff0c4}
        .tier.click{background:rgba(245,165,36,.14);color:#f6cf8a} .tier.read{background:rgba(56,189,248,.14);color:#9be7ff} .tier.secret{background:rgba(229,72,77,.16);color:#ffb4b9}
        .why{color:#8fa79c;font-size:12px}
      </style></head><body><div class="wrap">
        <h1><span class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#05110b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8 20.5h8M12 16.5v4"/><path d="M10 7.5l4.5 3-2 .5-1 2z" fill="#05110b"/></svg></span>${escapeHtml(tr("อนุญาตให้ AI ใช้แอปเหล่านี้?"))}</h1>
        <p>${escapeHtml(tr`${who} ต้องการดูหน้าจอ และใช้เมาส์กับคีย์บอร์ดในแอปต่อไปนี้`)}</p>
        <div class="apps">${apps.map((a) => `<div class="app"><i>${escapeHtml([...a.name.trim()][0]?.toUpperCase() || "?")}</i><b>${escapeHtml(a.name)}</b><span class="tier ${a.sensitive ? "secret" : a.tier}">${escapeHtml(TIER_TEXT()[a.sensitive ? "secret" : a.tier])}</span></div>`).join("")}</div>
        ${reason ? `<p class="why">${escapeHtml(tr`เหตุผล: ${reason}`)}</p>` : ""}
        <div class="warn">${escapeHtml(tr("AI เห็นทั้งหน้าจอ แต่คลิกและพิมพ์ได้เฉพาะในแอปที่อนุญาต อนุญาตเฉพาะแชตที่คุณไว้ใจ และกด \"หยุด\" ที่แถบด้านบนของจอเพื่อยกเลิกได้ทุกเมื่อ"))}</div>
        ${osRows}
        <div class="row">
          <a id="deny" class="btn deny" href="superai-perm:deny">${escapeHtml(tr("ปฏิเสธ"))}</a>
          <a id="allow-task" class="btn" href="superai-perm:task">${escapeHtml(tr("อนุญาตงานนี้"))}</a>
          <a id="allow-chat" class="btn allow" href="superai-perm:chat">${escapeHtml(tr("อนุญาตตลอดแชตนี้"))}</a>
        </div></div>
        <script>addEventListener('keydown', (e) => { if (e.key === 'Escape') location.href = 'superai-perm:deny'; });
          const OS_TEXT = ${JSON.stringify({ opened: tr("รอคุณเปิดสวิตช์…"), restart: tr("เปิด SuperAi ใหม่ให้มีผล"), granted: tr("อนุญาตแล้ว") })};
          window.setOs = (kind, state) => { const row = document.getElementById('os-' + kind); if (!row) return;
            row.className = 'os ' + state; row.querySelector('.state').textContent = OS_TEXT[state] || row.querySelector('.state').textContent;
            document.querySelector('.setup').classList.toggle('restart', !!document.querySelector('.os.restart')); };
          window.resetFailed = (failed) => document.querySelector('.setup').classList.toggle('failed', failed);</script>
      </body></html>`;
      const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const width = missing.length ? 560 : 480, height = 262 + Math.min(apps.length, 5) * 44 + (missing.length ? 120 + missing.length * 44 : 0) + (reason ? 26 : 0);
      const win = new BrowserWindow({ width, height, x: Math.round(workArea.x + (workArea.width - width) / 2), y: Math.round(workArea.y + (workArea.height - height) / 3),
        frame: false, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: false, show: false,
        title: tr("SuperAi ขออนุญาต"), transparent: true, hasShadow: true, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
      win.setAlwaysOnTop(true, "screen-saver");
      // Hidden from screenshots, so the AI cannot see (and aim at) its own permission buttons.
      win.setContentProtection(true);
      let done = false;
      const timer = setTimeout(() => finish("deny"), ASK_TIMEOUT);
      // Watch System Settings: each row turns green as soon as macOS reports the switch on.
      const opened = new Set(), shown = {};
      const watch = missing.length ? setInterval(() => {
        if (win.isDestroyed()) return;
        const now = osAccess(false);
        let pending = 0;
        for (const kind of missing) {
          const state = now[kind] === "granted" ? "granted" : !opened.has(kind) ? "" : kind === "screen" ? "restart" : "opened";
          if (state !== "granted") pending++;
          if (state && shown[kind] !== state) { shown[kind] = state; win.webContents.executeJavaScript(`setOs(${JSON.stringify(kind)}, ${JSON.stringify(state)})`).catch(() => {}); }
        }
        // Everything granted after a trip to System Settings: bring the question back on top.
        if (!pending && opened.size) { opened.clear(); win.setAlwaysOnTop(true, "screen-saver"); if (process.platform === "darwin") app.focus({ steal: true }); win.show(); win.focus(); }
      }, 1000) : undefined;
      const finish = (answer) => {
        if (done) return;
        done = true; clearTimeout(timer); clearInterval(watch); prompt = undefined;
        if (!win.isDestroyed()) win.destroy();
        resolve(answer);
      };
      prompt = { answer: finish, window: win };
      win.webContents.on("will-navigate", (event, url) => {
        event.preventDefault();
        const answer = url.replace(/^superai-perm:/, "");
        if (answer.startsWith("reset-")) {
          // Forget SuperAi's stale entry, then ask again: macOS adds this build to the list, switch off.
          const kind = answer.slice(6);
          void resetOsAccess(kind).then((ok) => {
            if (win.isDestroyed()) return;
            win.webContents.executeJavaScript(`resetFailed(${!ok})`).catch(() => {});
            if (!ok) return;
            delete shown[kind];
            if (openOsSettings(kind)) { opened.add(kind); win.setAlwaysOnTop(false); }
          });
          return;
        }
        if (answer.startsWith("os-")) {
          const kind = answer.slice(3);
          if (!openOsSettings(kind)) return;
          opened.add(kind);
          // Let System Settings come in front of this window while the user flips the switch.
          win.setAlwaysOnTop(false);
          return;
        }
        if (answer === "relaunch") { finish("deny"); app.relaunch(); app.quit(); return; }
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

  const DENIED = "The user denied computer control for this chat a moment ago. Do not retry; tell the user what you wanted to do and let them decide.";
  /** The chat's live grant ("this task" grants are extended on every call). */
  function grantFor(caller) {
    const g = grants.get(caller.chatId || "");
    if (!g) return undefined;
    if (g.chat) return g;
    if (g.until > Date.now()) { g.until = Date.now() + TASK_IDLE; return g; }
    return undefined;
  }
  function authorize(caller) {
    const g = grantFor(caller);
    if (g?.apps.size) return g;
    if ((denied.get(caller.chatId || "") || 0) > Date.now()) throw new Error(DENIED);
    throw new Error('First ask the user which apps you may use: call computer_request_access with their names (for example ["Notepad", "File Explorer"]). The user answers in an Allow / Deny window.');
  }
  async function openApps() {
    try { return (await send("apps")).split("\t").filter(Boolean); } catch { return []; }
  }
  const tierNote = (tier, sensitive) => sensitive ? "view only: it holds passwords or money, so the user does those steps" : tier === "read" ? "view only: no clicks or typing; use the browser_ tools for web pages" : tier === "click" ? "left-click and scroll only, no typing" : "full control";
  async function requestAccess(caller, args) {
    const id = caller.chatId || "";
    const list = Array.isArray(args.apps) ? args.apps : typeof args.apps === "string" ? [args.apps] : [];
    const names = list.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
    if (!names.length) throw new Error('apps must list the applications you need, e.g. ["Notepad", "File Explorer"]');
    const self = process.env.SUPERAI_COMPUTER_ALLOW_SELF !== "1" && names.some(ownName);
    let grant = grantFor(caller);
    const fresh = [];
    for (const name of names) {
      const key = norm(name);
      if (!key || (self && ownName(name)) || grant?.apps.has(key) || fresh.some((f) => f.key === key)) continue;
      fresh.push({ key, name, tier: appTier([name]), sensitive: isSensitive([name]) });
    }
    if (fresh.length) {
      if ((denied.get(id) || 0) > Date.now()) throw new Error(DENIED);
      const answer = await ask(caller, fresh, String(args.reason || "").trim().slice(0, 300));
      if (answer === "deny") {
        denied.set(id, Date.now() + DENY_QUIET);
        throw new Error("The user denied access to those apps. Do not retry; tell the user what you wanted to do and let them decide.");
      }
      denied.delete(id);
      grant = grantFor(caller);
      if (!grant) grants.set(id, grant = answer === "chat" ? { chat: true, name: caller.chatName, apps: new Map() } : { until: Date.now() + TASK_IDLE, name: caller.chatName, apps: new Map() });
      else if (answer === "chat") grant.chat = true;
      for (const f of fresh) grant.apps.set(f.key, { name: f.name, tier: f.tier, sensitive: f.sensitive });
      changed();
    }
    const allowed = grant ? [...grant.apps.values()].map((a) => `${a.name} (${tierNote(a.tier, a.sensitive)})`).join(", ") : "none";
    const open = await openApps();
    return { text: `Allowed apps for this chat: ${allowed}.${self ? " SuperAi itself cannot be controlled by the AI." : ""}${open.length ? ` Open apps: ${open.join(", ")}.` : ""} Take a computer_screenshot to start.` };
  }
  /** Clicks and typing reach only an allowed app, at its tier; never SuperAi itself. */
  function permit(app, need, caller) {
    if (app.pid && app.pid === process.pid) {
      if (process.env.SUPERAI_COMPUTER_ALLOW_SELF !== "1") throw new Error("That is SuperAi's own window. The AI cannot control SuperAi itself; ask the user to do it, or click the app you want first.");
      app = { ...app, name: "SuperAi", desc: "SuperAi" };
    }
    const g = authorize(caller);
    const label = appLabel(app);
    const hit = [...g.apps.entries()].find(([key]) => appMatches(app, key));
    if (!hit) throw new Error(`${label} is not among the apps the user allowed for this chat (${[...g.apps.values()].map((a) => a.name).join(", ")}). If you need it, call computer_request_access with ["${label}"].`);
    const actual = appTier(appNames(app), app.bundle);
    const tier = RANK[actual] < RANK[hit[1].tier] ? actual : hit[1].tier;
    if (RANK[tier] < RANK[need]) throw new Error(hit[1].sensitive || isSensitive(appNames(app), app.bundle)
      ? `${label} holds passwords or money, so the AI may only look at it. Ask the user to do this step themselves.`
      : tier === "read"
      ? `${label} is a web browser, allowed for viewing only: clicks and typing in it are blocked. Use the browser_ tools for web pages.`
      : `${label} is a terminal or code editor, allowed for left-click and scroll only: typing, keys, right-click and drag are blocked there.`);
  }
  let current = { chatId: "", chatName: "" }; // the caller of the running tool
  // macOS also gets SuperAi's process id, to look past its click-through overlays (Windows ignores it).
  const appAt = async (sx, sy) => parseApp(await send(`at ${Math.round(sx)} ${Math.round(sy)} ${process.pid}`));
  const frontApp = async () => parseApp(await send("front"));

  /** On macOS input silently does nothing without Accessibility: say so instead. */
  function requireOs(kind) {
    if (process.platform !== "darwin") return;
    const access = osAccess(false);
    if (kind === "input" && access.accessibility !== "granted") {
      osAccess(true);
      throw new Error("macOS has not allowed SuperAi to use the mouse and keyboard. Ask the user to allow SuperAi in System Settings > Privacy & Security > Accessibility (a window to do so was opened), then try again. If the switch already shows on (common after an update), they press Reset in SuperAi Settings > AI control and turn it on again.");
    }
    if (kind === "screen" && (access.screen === "denied" || access.screen === "restricted"))
      throw new Error("macOS has not allowed SuperAi to see the screen. Ask the user to allow SuperAi in System Settings > Privacy & Security > Screen Recording and restart SuperAi, then try again. If the switch already shows on (common after an update), they press Reset in SuperAi Settings > AI control, turn it on again and restart SuperAi.");
  }

  // ------------------------------------------------------------------------------------------
  // Screens: 1 is the main one, then the others from left to right. Every computer_ tool works on
  // the screen of the latest computer_screenshot (main until one is chosen).
  let target; // display id
  const displays = () => {
    const primary = screen.getPrimaryDisplay();
    return [primary, ...screen.getAllDisplays().filter((d) => d.id !== primary.id).sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)];
  };
  const display = () => displays().find((d) => d.id === target) || screen.getPrimaryDisplay();
  /** Where the screen is in input coordinates: physical pixels on Windows, points on macOS. */
  const inputRect = (d) => process.platform === "win32" && screen.dipToScreenRect ? screen.dipToScreenRect(null, d.bounds) : d.bounds;
  /** The screen's width in captured pixels. */
  const pixelWidth = (d) => process.platform === "win32" && screen.dipToScreenRect ? inputRect(d).width : Math.round(d.size.width * d.scaleFactor);
  const num = (v, name) => { const n = Number(v); if (v === undefined || v === null || v === "" || !Number.isFinite(n)) throw new Error(`${name} must be a number from the latest screenshot`); return n; };
  // Screenshot coordinates → input coordinates on the current screen, and back.
  const toScreen = (x, y) => {
    const d = display(), r = inputRect(d);
    const px = num(x, "x") * scale, py = num(y, "y") * scale;
    if (process.platform === "darwin") return [r.x + px / d.scaleFactor, r.y + py / d.scaleFactor];
    return [Math.round(r.x + px), Math.round(r.y + py)];
  };
  const fromScreen = (sx, sy) => {
    const d = display(), r = inputRect(d);
    if (process.platform === "darwin") return [Math.round((sx - r.x) * d.scaleFactor / scale), Math.round((sy - r.y) * d.scaleFactor / scale)];
    return [Math.round((sx - r.x) / scale), Math.round((sy - r.y) / scale)];
  };
  const describeScreens = () => {
    const list = displays(), active = display();
    if (list.length < 2) return "";
    return `\nScreens (choose with computer_screenshot display=N): ${list.map((d, i) => `${i + 1}${i === 0 ? " main" : ""} ${d.size.width}x${d.size.height}${d.id === active.id ? " ← this one" : ""}`).join(", ")}.`;
  };

  // Screenshots go to the AI as JPEG: about 4x smaller than PNG (fewer tokens, faster replies) and text stays readable.
  const JPEG_QUALITY = 80;
  const shotFile = path.join(os.tmpdir(), `superai-shot-${process.pid}.jpg`);
  /** Windows ignores content protection for transparent windows (in every capture API): hide the bar,
   *  the glow and the AI cursor on that screen for the moment of the capture, so the AI sees only the user's screen. */
  async function withoutOverlays(d, grab) {
    const b = d.bounds;
    const over = (r) => r.x < b.x + b.width && r.x + r.width > b.x && r.y < b.y + b.height && r.y + r.height > b.y;
    const hidden = process.platform === "win32" ? [...overlays(), aiCursor].filter((w) => w && !w.isDestroyed() && w.isVisible() && over(w.getBounds())) : [];
    for (const w of hidden) w.hide();
    if (hidden.length) await wait(80);
    try { return await grab(); } finally { for (const w of hidden) if (!w.isDestroyed()) w.showInactive(); }
  }
  /** Windows: the helper grabs just this rectangle (input = physical pixels) straight to JPEG. */
  async function fastShot(d, rect, outWidth) {
    const r = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) };
    const size = await withoutOverlays(d, () => send(`shot ${r.x} ${r.y} ${r.width} ${r.height} ${Math.round(outWidth)} ${JPEG_QUALITY} ${Buffer.from(shotFile).toString("base64")}`));
    const [width, height] = String(size).split(" ").map(Number);
    if (!(width > 0 && height > 0)) throw new Error("no image");
    return { width, height, data: (await fs.promises.readFile(shotFile)).toString("base64") };
  }
  const asJpeg = (image) => ({ ...image.getSize(), data: image.toJPEG(JPEG_QUALITY).toString("base64") });

  async function capture(d = display()) {
    requireOs("screen");
    const width = Math.round(d.size.width * d.scaleFactor), height = Math.round(d.size.height * d.scaleFactor);
    const sources = await withoutOverlays(d, () => desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width, height } }));
    // display_id is empty on some systems with one screen: fall back to the only source then.
    const source = sources.find((s) => String(s.display_id) === String(d.id)) || (sources.length === 1 ? sources[0] : undefined);
    if (!source || source.thumbnail.isEmpty()) throw new Error(process.platform === "darwin"
      ? "Could not capture the screen. Ask the user to allow SuperAi in System Settings > Privacy & Security > Screen Recording, then restart SuperAi." : "Could not capture that screen.");
    return source.thumbnail;
  }
  /** computer_screenshot display=N: switch screens (before the bar is updated, so it names the new one). */
  function choose(args = {}) {
    if (args.display === undefined || args.display === null || args.display === "") return;
    const list = displays(), n = Number(args.display);
    if (!Number.isInteger(n) || n < 1 || n > list.length) throw new Error(`display must be 1${list.length > 1 ? `-${list.length}` : ""} (this computer has ${list.length} screen${list.length > 1 ? "s" : ""})`);
    target = list[n - 1].id;
  }
  async function screenshot() {
    const d = display();
    let shot;
    if (process.platform === "win32") {
      requireOs("screen");
      const r = inputRect(d);
      shot = await fastShot(d, r, Math.min(MAX_WIDTH, r.width)).catch(() => undefined);
    }
    if (!shot) {
      let image = await capture(d);
      if (image.getSize().width > MAX_WIDTH) image = image.resize({ width: MAX_WIDTH, quality: "good" });
      shot = asJpeg(image);
    }
    const shown = { width: shot.width, height: shot.height };
    scale = pixelWidth(d) / shown.width;
    const list = displays(), n = list.findIndex((x) => x.id === d.id) + 1;
    let front = "";
    try { const app = await frontApp(); front = ` App in front: ${app.pid === process.pid ? "SuperAi" : appLabel(app)}.`; } catch {}
    const g = grantFor(current);
    const allowed = g ? ` Allowed apps: ${[...g.apps.values()].map((a) => a.name).join(", ")}.` : "";
    return { text: `Screen ${shown.width}x${shown.height}${list.length > 1 ? ` (screen ${n} of ${list.length})` : ""} (coordinates for computer_click etc. are in this image).${front}${allowed}${describeScreens()}`,
      image: { data: shot.data, mimeType: "image/jpeg" } };
  }
  async function zoom(args) {
    const x = num(args.x, "x"), y = num(args.y, "y"), w = num(args.width, "width"), h = num(args.height, "height");
    if (w <= 0 || h <= 0) throw new Error("width and height must be positive");
    const d = display();
    const region = (size, k) => {
      const rect = { x: Math.max(0, Math.round(x * k)), y: Math.max(0, Math.round(y * k)) };
      rect.width = Math.max(1, Math.min(size.width - rect.x, Math.round(w * k)));
      rect.height = Math.max(1, Math.min(size.height - rect.y, Math.round(h * k)));
      return rect;
    };
    let shot;
    if (process.platform === "win32") {
      requireOs("screen");
      const r = inputRect(d), rect = region(r, scale); // screenshot pixels → physical pixels
      shot = await fastShot(d, { ...rect, x: r.x + rect.x, y: r.y + rect.y }, Math.min(MAX_WIDTH, rect.width)).catch(() => undefined);
    }
    if (!shot) {
      const full = await capture(d);
      const size = full.getSize();
      let image = full.crop(region(size, scale * size.width / pixelWidth(d))); // screenshot pixels → captured pixels
      if (image.getSize().width > MAX_WIDTH) image = image.resize({ width: MAX_WIDTH, quality: "good" });
      shot = asJpeg(image);
    }
    return { text: `Zoomed view of the region x=${x} y=${y} ${w}x${h} at full resolution. Keep using the coordinates of the latest computer_screenshot (not of this image) in other tools.`,
      image: { data: shot.data, mimeType: "image/jpeg" } };
  }

  const send = (command) => input().send(command);
  const MAC_BUTTON = { left: [0, 1, 2, 6], right: [1, 3, 4, 7], middle: [2, 25, 26, 27] }; // button, down, up, dragged
  async function moveTo(sx, sy) {
    if (process.platform === "darwin") await send(`mouse 5 ${sx} ${sy} 0 0`); else await send(`move ${sx} ${sy}`);
  }
  async function click(x, y, button, clicks, force) {
    const [sx, sy] = toScreen(x, y);
    await pointAt(sx, sy);
    return aside([[sx, sy]], async () => { permit(await appAt(sx, sy), button === "left" ? "click" : "full", current); return clickAt(sx, sy, button, clicks, force); });
  }
  /** Windows: an accessibility action or a click posted to the window, so the user keeps the mouse.
   *  Text fields, windows that ignore posted clicks, macOS, or mouse=true: the real mouse, put back after. */
  async function clickAt(sx, sy, button, clicks, force) {
    if (!force && process.platform === "win32") {
      const how = await send(`quiet ${sx} ${sy} ${button === "right" ? 1 : button === "middle" ? 2 : 0} ${clicks}`).catch(() => "mouse");
      if (how && how !== "mouse") return how;
    }
    await withMouse(() => mouseClick(sx, sy, button, clicks));
    return "mouse";
  }
  /** Uses the real mouse, then puts it back where the user had it. */
  async function withMouse(action) {
    const saved = await send("pos").catch(() => "");
    try { return await action(); } finally {
      const [x, y] = saved.split(" ").map(Number);
      if (saved && Number.isFinite(x) && Number.isFinite(y)) await moveTo(x, y).catch(() => {});
    }
  }
  async function mouseClick(sx, sy, button, clicks) {
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
    return aside([[fx, fy], [tx, ty]], async () => {
      permit(await appAt(fx, fy), "full", current); permit(await appAt(tx, ty), "full", current);
      await pointAt(fx, fy);
      await withMouse(() => dragBetween(fx, fy, tx, ty));
      await pointAt(tx, ty);
    });
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
    // Which screen is it on? (inputRect is in the same coordinates as the helper's answer.)
    const list = displays();
    const on = list.findIndex((d) => { const r = inputRect(d); return sx >= r.x && sx < r.x + r.width && sy >= r.y && sy < r.y + r.height; });
    if (on >= 0 && list[on].id !== display().id) return { text: `The mouse is on screen ${on + 1}, not on the screen of the latest screenshot. Use computer_screenshot display=${on + 1} to see it.` };
    const [x, y] = fromScreen(sx, sy);
    return { text: `The mouse is at x=${x} y=${y} of the latest screenshot.` };
  }

  async function clipboardPng() {
    try {
      const item = (await clipboard.read()).find((i) => i.types.includes("image/png"));
      return item ? await item.getType("image/png") : null;
    } catch { return null; }
  }

  async function typeText(text) {
    if (process.platform === "darwin") {
      // Any language: paste through the clipboard, then put back what the user had there.
      // The target app reads the clipboard after it handles ⌘V, which can take a few hundred ms on a busy
      // or older Mac: restoring too soon made it paste the user's old clipboard instead (seen on macOS 12 Intel).
      // Electron 44+: clipboard reads/writes are async; an image is kept as its PNG Blob.
      const saved = { text: await clipboard.readText().catch(() => ""), image: await clipboardPng() };
      let last = "";
      try {
        for (const [i, part] of String(text).split("\n").entries()) {
          if (i) await pressKeys("enter");
          if (!part) continue;
          await clipboard.writeText(part);
          last = part;
          await wait(40); // let the pasteboard settle before the keystroke
          await pressKeys("cmd+v");
          await wait(250);
        }
      } finally {
        await wait(500);
        // Put back what the user had, unless they copied something new meanwhile.
        if (!last || (await clipboard.readText().catch(() => "")) === last) {
          if (saved.image) await clipboard.write([new ClipboardItem({ "image/png": saved.image })]);
          else await clipboard.writeText(saved.text);
        }
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
    if (!["up", "down", "left", "right"].includes(direction)) throw new Error("direction must be up, down, left or right");
    const [sx, sy] = x !== undefined && y !== undefined ? toScreen(x, y) : (await send("pos")).split(" ").map(Number);
    await aside([[sx, sy]], async () => permit(await appAt(sx, sy), "click", current));
    await pointAt(sx, sy);
    // The wheel goes to the window under the mouse: borrow it for a moment.
    await withMouse(async () => {
      await moveTo(sx, sy);
      if (process.platform === "darwin") {
        const dy = direction === "up" ? steps : direction === "down" ? -steps : 0, dx = direction === "left" ? steps : direction === "right" ? -steps : 0;
        await send(`scroll ${dy} ${dx}`);
        return;
      }
      const horizontal = direction === "left" || direction === "right";
      const sign = direction === "up" || direction === "right" ? 1 : -1;
      await send(`wheel ${sign * 120 * steps} ${horizontal ? "h" : "v"}`);
      await wait(60);
    });
  }

  // ------------------------------------------------------------------------------------------
  // Apps through their accessibility tree (agent-desktop): the AI reads an app as a short list of
  // elements with refs and acts on a ref, without screenshots and without moving the mouse.
  // Same per-app permission as the rest; refs are short ("e12") and belong to the latest ui snapshot.
  let last; // { id, app, args } of the latest computer_ui_snapshot
  const UI_LINES = 400;
  function agentDesktop(args, input) {
    let exe;
    try {
      const dir = path.join(path.dirname(createRequire(import.meta.url).resolve("agent-desktop/package.json")), "bin");
      const arch = process.arch === "arm64" ? "arm64" : "x64";
      exe = path.join(dir, process.platform === "win32" ? `agent-desktop-win32-${arch}.exe` : `agent-desktop-${process.platform}-${arch}`);
    } catch { throw new Error("The accessibility tools are not installed in this build. Use computer_screenshot and computer_click instead."); }
    return new Promise((resolve, reject) => {
      const child = execFile(exe, ["--session", "superai", ...args], { encoding: "utf8", timeout: 30000, windowsHide: true, maxBuffer: 64 << 20 }, (error, stdout) => {
        let out;
        try { out = JSON.parse(stdout); } catch { return reject(new Error(`agent-desktop failed: ${String(stdout || error?.message || "").slice(0, 300)}`)); }
        if (!out.ok) return reject(new Error(`${out.error?.code || "ERROR"}: ${out.error?.message || ""}${out.error?.suggestion ? ` ${out.error.suggestion}` : ""}`));
        resolve(out.data);
      });
      child.stdin?.end(input ?? "");
    });
  }
  const UI_ACTIONS = { Click: "click", SetValue: "set_value", Select: "select", Toggle: "toggle", Expand: "expand", Collapse: "collapse", ScrollTo: "scroll_to" };
  const UI_STATES = ["focused", "selected", "checked", "disabled", "expanded", "collapsed", "secure"];
  /** One line per element: "e12 button "Save" = value (focused) [click]", indented by nesting. */
  function terse(tree) {
    const lines = [];
    let more = 0;
    (function walk(n, depth) {
      if (!n) return;
      let next = depth;
      if (n.ref_id) {
        if (lines.length >= UI_LINES) more++;
        else {
          const value = n.value === undefined || n.value === null || n.value === "" ? "" : ` = "${String(n.value).replace(/\s+/g, " ").slice(0, 120)}"`;
          const states = (n.states || []).filter((s) => UI_STATES.includes(s)).map((s) => (s === "secure" ? "password" : s));
          const acts = [...new Set((n.available_actions || []).map((a) => UI_ACTIONS[a]).filter(Boolean))];
          lines.push(`${"  ".repeat(depth)}${n.ref_id.split(":").pop()} ${n.role || "element"}${n.name ? ` "${String(n.name).slice(0, 100)}"` : ""}${value}${states.length ? ` (${states.join(", ")})` : ""}${acts.length ? ` [${acts.join(", ")}]` : ""}`);
        }
        next = depth + 1;
      }
      for (const c of n.children || []) walk(c, next);
    })(tree, 0);
    if (more) lines.push(`… ${more} more elements: look inside one part with computer_ui_snapshot root=<ref>.`);
    return lines;
  }
  async function uiApp(name) {
    const wanted = norm(name);
    if (!wanted) throw new Error("app is required, e.g. \"Notepad\"");
    const { apps = [] } = await agentDesktop(["list-apps"]);
    const found = apps.map((a) => ({ pid: a.pid, name: String(a.name || "").replace(/\.(exe|app)$/i, ""), raw: a.name }))
      .filter((a) => appMatches(a, wanted) || norm(a.name) === wanted);
    if (!found.length) throw new Error(`No open app called "${name}". Open apps: ${apps.map((a) => String(a.name).replace(/\.exe$/i, "")).join(", ")}.`);
    return found.find((a) => a.pid !== process.pid) || found[0];
  }
  /** known: the app of the previous snapshot, re-read after an action without looking it up again. */
  async function uiSnapshot(args, known) {
    const target = known || await uiApp(String(args.app || ""));
    permit(target, "read", current);
    const scope = args.window ? ["--window-id", String(args.window)] : ["--app", target.raw];
    const rootRef = args.root && last?.app.pid === target.pid ? (String(args.root).startsWith("@") ? String(args.root) : `@${last.id}:${args.root}`) : "";
    const data = await agentDesktop(["snapshot", ...scope, "-i", "--compact", ...(rootRef ? ["--root", rootRef] : [])]);
    const nodes = new Map();
    (function index(n) { if (!n) return; if (n.ref_id) nodes.set(n.ref_id.split(":").pop(), n); for (const c of n.children || []) index(c); })(data.tree);
    last = { id: data.snapshot_id, app: target, scope, nodes };
    const lines = terse(data.tree);
    return { text: `${target.name}${data.tree?.name ? ` · window "${data.tree.name}"` : ""} · ${lines.length} elements. Act on one with computer_ui_action ref=<e…>; refs are valid until the next computer_ui_snapshot.\n${lines.join("\n")}` };
  }
  async function uiAction(args) {
    if (!last) throw new Error("Take a computer_ui_snapshot of the app first.");
    const action = String(args.action || "click");
    const raw = String(args.ref || "").trim();
    if (!raw) throw new Error("ref is required (e.g. e12 from the latest computer_ui_snapshot)");
    const ref = raw.startsWith("@") ? raw : `@${last.id}:${raw}`;
    const text = args.text === undefined || args.text === null ? "" : String(args.text);
    const commands = {
      click: ["click", ref], double_click: ["double-click", ref], right_click: ["right-click", ref], focus: ["focus", ref],
      toggle: ["toggle", ref], expand: ["expand", ref], collapse: ["collapse", ref], scroll_to: ["scroll-to", ref],
      select: ["select", ref, text], clear: ["clear", ref], set_value: ["set-value", ref, "--stdin"], type: ["type", ref, "--stdin"],
    };
    if (!commands[action]) throw new Error(`action must be one of: ${Object.keys(commands).join(", ")}`);
    if (action === "select" && !text) throw new Error("select needs text: the option to choose");
    permit(last.app, ["set_value", "type", "clear", "right_click"].includes(action) ? "full" : "click", current);
    const node = last.nodes?.get(raw.split(":").pop());
    if (["set_value", "type"].includes(action) && node && /password|protected|secure/i.test([node.role, node.role_description, node.subrole, ...(node.states || [])].join(" ")))
      throw new Error("That is a password field. The AI does not type passwords: ask the user to type it themselves.");
    await agentDesktop(commands[action], ["set_value", "type"].includes(action) ? text : undefined);
    await wait(150);
    const after = await uiSnapshot({ app: last.app.raw, window: last.scope[0] === "--window-id" ? last.scope[1] : undefined }, last.app);
    return { text: `Done: ${action} ${raw}.\n${after.text}` };
  }

  async function act(tool, args) {
    const pause = () => wait(450);
    if (tool === "computer_ui_snapshot") return uiSnapshot(args);
    if (tool === "computer_ui_action") return uiAction(args);
    if (tool === "computer_screenshot") return screenshot();
    if (tool === "computer_zoom") return zoom(args);
    if (tool === "computer_wait") { await wait(Math.min(10, Math.max(0, Number(args.seconds) || 1)) * 1000); return screenshot(); }
    requireOs("input");
    if (tool === "computer_cursor") return cursor();
    if (tool === "computer_click") {
      const how = await click(args.x, args.y, String(args.button || "left"), args.double ? 2 : Math.max(1, Math.min(3, Number(args.clicks) || 1)), args.mouse === true);
      await pause();
      const shot = await screenshot();
      const note = how === "mouse" ? "Clicked with the mouse (put back where the user had it)."
        : how === "posted" ? "Clicked by sending the click to the window; the user's mouse did not move. If nothing changed, click again with mouse: true."
        : `Clicked through accessibility (${how}); the user's mouse did not move.`;
      return { ...shot, text: `${note} ${shot.text}` };
    }
    if (tool === "computer_move") { const [sx, sy] = toScreen(args.x, args.y); await pointAt(sx, sy); return { text: "The AI cursor points there now (the user's mouse did not move)." }; }
    if (tool === "computer_drag") { await drag(args); await pause(); return screenshot(); }
    if (tool === "computer_type" || tool === "computer_key") permit(await frontApp(), "full", current);
    if (tool === "computer_type" && process.platform === "win32" && (await send("secret").catch(() => "0")) === "1")
      throw new Error("The keyboard focus is in a password field. The AI does not type passwords: ask the user to type it themselves.");
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
      const given = args && typeof args === "object" ? args : {};
      current = caller;
      if (tool === "computer_request_access") return requestAccess(caller, given);
      authorize(caller);
      if (tool === "computer_screenshot") choose(given);
      showBar(tool, caller);
      cursorSay(toolLabel(tool));
      try { return await act(tool, given); } finally { cursorSay(tr("กำลังคิด…"), true); }
    });
    queue = next.catch(() => {});
    return next;
  }

  return {
    run, state, setEnabled, revoke, openOsSettings,
    /** Settings > AI control "Reset": forget SuperAi's stale macOS entry and ask again. */
    resetOsAccess: async (kind) => { const ok = await resetOsAccess(kind); if (ok) openOsSettings(kind); return { ...state(), resetFailed: !ok }; },
    dispose: () => { windowsInput.kill(); macInput.kill(); prompt?.answer("deny"); for (const w of overlays()) w.destroy(); if (aiCursor && !aiCursor.isDestroyed()) aiCursor.destroy(); },
  };
}
