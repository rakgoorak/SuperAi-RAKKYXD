import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The built-in browser the AI can drive: the browser panel at the side of the app. The desktop app
 * registers the code that acts on that panel; every chat CLI then gets a small MCP server
 * (BrowserMcp.js) whose tools call back into this app over localhost with a per-run token.
 * Nothing is written to the CLIs' own config files.
 */
export const BROWSER_MCP = "superai-browser";

export interface BrowserToolResult { text: string; image?: { data: string; mimeType: string } }
/** Who asked: the chat whose CLI started the MCP server (empty when unknown, e.g. a test). */
export interface BrowserCaller { chatId: string; chatName: string }
export type BrowserHandler = (tool: string, args: Record<string, unknown>, caller: BrowserCaller) => Promise<BrowserToolResult>;

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
// Which browser: the panel inside SuperAi (default), or Chrome / Edge on this computer in their own window.
const BROWSER = { type: "string", enum: ["app", "chrome", "edge"],
  description: "app = the visible SuperAi browser panel (default); chrome / edge = a SuperAi profile running in the background by default, unless the user configured an existing browser connection. For an existing connection, list and select the tab with browser_tabs first and pass browser explicitly on later calls." };
const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) =>
  ({ name, description, inputSchema: { type: "object", properties: { ...properties, browser: BROWSER }, required, additionalProperties: false } });

/** Tools as the MCP server lists them. `readOnly` ones are allowed even in read-only chats. */
export const BROWSER_TOOLS = [
  tool("browser_open", "Open a web page in the SuperAi panel or the selected Chrome / Edge browser (a new tab when asked, otherwise the current tab). Returns the page snapshot.",
    { url: str("http(s) address, or localhost:3000"), newTab: { type: "boolean", description: "Open in a new tab" } }, ["url"]),
  tool("browser_snapshot", "Read the current page: title, address, visible text and the clickable/typable elements, each with a ref to use in other tools."),
  tool("browser_click", "Click an element by its ref from the latest snapshot, by visible text, or by viewport coordinates (x, y) when targeting canvas/visual UI.",
    { ref: str("ref from browser_snapshot"), text: str("visible text, when there is no ref"), x: num("x viewport coordinate when clicking a visual/canvas point without a ref"), y: num("y viewport coordinate when clicking a visual/canvas point without a ref"), button: { type: "string", enum: ["left", "right"], description: "default: left" }, double: { type: "boolean", description: "double-click" } }),
  tool("browser_hover", "Hover the AI pointer over an element (reveals hover menus/tooltips) by ref or visible text.", { ref: str("ref from browser_snapshot"), text: str("visible text, when there is no ref") }),
  tool("browser_type", "Type into an input by ref (or label/placeholder). Replaces its current value unless append is true; submit presses Enter afterwards.",
    { ref: str("ref from browser_snapshot"), label: str("visible label or placeholder if ref is omitted"), text: str("text to type"), submit: { type: "boolean" }, append: { type: "boolean" } }, ["text"]),
  tool("browser_press", "Press a key in the page, e.g. Enter, Tab, Escape, ArrowDown, PageDown, ctrl+a.", { key: str("key name or combo") }, ["key"]),
  tool("browser_select", "Choose an option of a <select> by ref.", { ref: str("ref of the select"), value: str("option value or visible label") }, ["ref", "value"]),
  tool("browser_upload", "Attach local files directly to a visible or hidden file input by ref, without opening the native file picker.", { ref: str("ref of the file input from browser_snapshot"), files: { type: "array", items: str("absolute file path"), description: "local file paths to upload" } }, ["ref", "files"]),
  tool("browser_scroll", "Scroll the page.", { direction: { type: "string", enum: ["up", "down", "top", "bottom"] }, amount: num("pixels, default one screen") }, ["direction"]),
  tool("browser_screenshot", "Take a screenshot of what the page shows now."),
  tool("browser_console", "Inspect recent console errors, uncaught JS exceptions, and failed HTTP requests (4xx/5xx) in the active tab.", { clear: { type: "boolean", description: "clear stored errors after reading" } }),
  tool("browser_eval", "Evaluate a JavaScript expression inside the active page and return its JSON result (useful to inspect state or computed layout).", { expression: str("JavaScript expression") }, ["expression"]),
  tool("browser_back", "Go back in the current tab."),
  tool("browser_forward", "Go forward in the current tab."),
  tool("browser_tabs", "List the open tabs, or switch to one.", { select: str("tab id or number from the list") }),
  tool("browser_close_tab", "Close the current tab, or a specific tab by id or number.", { select: str("tab id or number from browser_tabs") }),
  tool("browser_dialog", "Say how to answer the page's next confirm() / prompt() (they are cancelled by default and reported in the snapshot), then repeat the action that shows it.",
    { accept: { type: "boolean", description: "true = OK, false = Cancel" }, text: str("text for a prompt()") }, ["accept"]),
  tool("browser_wait", "Wait for the page: until a text appears, or a number of seconds (max 20).", { text: str("text to wait for"), seconds: num("seconds") }),
];
// Computer use: the whole screen, mouse and keyboard. Off until the user turns it on in Settings.
const computerTool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) =>
  ({ name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } });
export const COMPUTER_TOOLS = [
  computerTool("computer_request_access", "Optional check/request before using desktop apps. Once Computer Control is turned on in Settings > AI control, regular apps (including browsers, terminals, and code editors) work directly without per-app prompts. Sensitive apps or pages (password managers, wallets, banking) still ask the user in an Allow / Deny window before acting.",
    { apps: { type: "array", items: { type: "string" }, description: "application names, as shown on screen" }, reason: str("one short sentence on what you will do, shown to the user") }, ["apps"]),
  computerTool("computer_list_windows", "List visible windows (window id, app name, title, bounds, minimized/focused) so you can focus an allowed app or see what is behind SuperAi. Needs computer_request_access first.",
    { app: str("optional app name to filter") }),
  computerTool("computer_focus_window", "Bring an allowed app's window to the front (restoring it if minimized, or launching it if action='launch') so SuperAi does not cover it, then return a fresh screenshot.",
    { app: str("allowed app name, e.g. \"Notepad\""), window: str("optional window id from computer_list_windows"), action: { type: "string", enum: ["focus", "restore", "maximize", "minimize", "launch"], description: "default: focus" } }, ["app"]),
  computerTool("computer_ui_snapshot", "Read an allowed app as a short list of its buttons, fields, menus and tabs, each with a ref (e12), its value and what it can do. Prefer this over screenshots: it is faster, cheaper and does not move the user's mouse. Fall back to computer_screenshot for apps that list nothing useful (games, canvases, remote desktops).",
    { app: str("app name, as allowed with computer_request_access"), root: str("ref of one part to look inside, when the list is cut short"), window: str("window id, when the app has several windows") }, ["app"]),
  computerTool("computer_ui_find", "Search an allowed app's accessibility tree by text/name or control role (useful when computer_ui_snapshot truncates large windows).",
    { app: str("allowed app name"), query: str("text to match in element name or value"), role: str("optional role, e.g. button, textfield, menuitem, tab") }, ["app"]),
  computerTool("computer_ui_action", "Act on a ref from the latest computer_ui_snapshot / computer_ui_find without moving the mouse: click, double_click, right_click, focus, toggle, check, uncheck, expand, collapse, scroll_to, select (text = the option), clear, set_value (replace the text, any language) or type. Returns the app's new element list.",
    { ref: str("ref from the latest computer_ui_snapshot / computer_ui_find, e.g. e12"), action: { type: "string", enum: ["click", "double_click", "right_click", "focus", "toggle", "check", "uncheck", "expand", "collapse", "scroll_to", "select", "clear", "set_value", "type"] }, text: str("text for set_value / type, or the option for select") }, ["ref", "action"]),
  computerTool("computer_screenshot", "See one of the user's screens (the main one unless display is given; the reply lists every screen when there are several). The other computer_ tools act on the screen of the latest screenshot, in its pixel coordinates. Prefer the browser_ tools for web pages. Needs computer_request_access first.",
    { display: num("screen number: 1 = main, 2, 3 … as listed in an earlier screenshot") }),
  computerTool("computer_click", "Click at a point of the latest computer_screenshot. The AI's own cursor shows the user where; on Windows the click usually goes to the app without moving the user's mouse (the reply says how it was done). Returns a new screenshot.",
    { x: num("x in the screenshot"), y: num("y in the screenshot"), button: { type: "string", enum: ["left", "right", "middle"] }, double: { type: "boolean" }, clicks: num("1-3, e.g. 3 selects a line"),
      mouse: { type: "boolean", description: "true = use the real mouse (put back afterwards), for an app that ignored a click sent without it" } }, ["x", "y"]),
  computerTool("computer_drag", "Press the left button at one point, move to another and release (drag and drop, select text, move a slider). Returns a new screenshot.",
    { fromX: num("start x"), fromY: num("start y"), toX: num("end x"), toY: num("end y") }, ["fromX", "fromY", "toX", "toY"]),
  computerTool("computer_zoom", "See a region of the screen at full resolution, to read small text. Coordinates stay those of the latest computer_screenshot.",
    { x: num("left"), y: num("top"), width: num("width"), height: num("height") }, ["x", "y", "width", "height"]),
  computerTool("computer_cursor", "Where the mouse is now, in coordinates of the latest screenshot."),
  computerTool("computer_wait", "Wait (max 10 s) for something to load, then return a new screenshot.", { seconds: num("seconds, default 1") }),
  computerTool("computer_move", "Point the AI's own cursor at a point of the latest screenshot, to show the user something (the user's mouse does not move).", { x: num("x"), y: num("y") }, ["x", "y"]),
  computerTool("computer_type", "Type text where the keyboard focus is (any language). A newline presses Enter.", { text: str("text to type") }, ["text"]),
  computerTool("computer_key", "Press a key or a combination, e.g. Enter, Escape, Tab, F5, ctrl+c, ctrl+shift+t, ctrl+/, alt+f4, win, cmd+space. Use cmd on macOS where Windows uses ctrl.", { key: str("key or combination") }, ["key"]),
  computerTool("computer_scroll", "Scroll at a point of the screen.", { x: num("x"), y: num("y"), direction: { type: "string", enum: ["up", "down", "left", "right"] }, amount: num("notches, default 3") }, ["direction"]),
];

export const READ_ONLY_BROWSER_TOOLS = ["browser_open", "browser_snapshot", "browser_hover", "browser_screenshot", "browser_console", "browser_scroll", "browser_back", "browser_forward", "browser_tabs", "browser_wait"];

let handler: BrowserHandler | undefined;
let base = "";
const token = randomBytes(24).toString("hex");

export function registerBrowserHandler(fn: BrowserHandler | undefined) { handler = fn; }
export const browserHandler = () => handler;
export const browserToken = () => token;
export function setBrowserBase(url: string) { base = url; }

/** How a CLI starts the MCP server; null when there is no browser to drive (not the desktop app). */
export function browserMcpLaunch(chatId = ""): { command: string; args: string[]; env: Record<string, string> } | null {
  // Chrome / Edge work without the desktop app; the panel needs it (its tools then say so).
  if (!base) return null;
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "BrowserMcp.js");
  // The desktop app's own executable runs the script as plain Node, so no separate Node is needed.
  const env: Record<string, string> = { SUPERAI_BROWSER_URL: base, SUPERAI_BROWSER_TOKEN: token };
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = "1";
  // The chat id lets the app ask "chat X wants to control the computer" and remember the answer per chat.
  return { command: process.execPath, args: chatId ? [script, "--chat", chatId] : [script], env };
}

/** Claude Code: --mcp-config takes the JSON itself. */
export function claudeBrowserArgs(chatId = ""): string[] {
  const launch = browserMcpLaunch(chatId);
  return launch ? ["--mcp-config", JSON.stringify({ mcpServers: { [BROWSER_MCP]: { type: "stdio", ...launch } } })] : [];
}

/** Codex: config overrides on the command line. Values are TOML, and JSON strings are valid TOML strings. */
export function codexBrowserArgs(chatId = ""): string[] {
  const launch = browserMcpLaunch(chatId);
  if (!launch) return [];
  const key = `mcp_servers.${BROWSER_MCP}`;
  const env = Object.entries(launch.env).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ");
  return ["-c", `${key}.command=${JSON.stringify(launch.command)}`, "-c", `${key}.args=${JSON.stringify(launch.args)}`, "-c", `${key}.env={ ${env} }`,
    // The panel is visible to the user and holds no project files, so its tools need no approval here;
    // computer_ tools are approved in the app's own Allow / Deny window instead (desktop/computer-control.mjs).
    "-c", `${key}.default_tools_approval_mode="approve"`];
}

/** OpenCode: merged into OPENCODE_CONFIG_CONTENT. */
export function withOpenCodeBrowser(config: string | undefined, chatId = ""): string | undefined {
  const launch = browserMcpLaunch(chatId);
  if (!launch) return config;
  let data: Record<string, any> = {};
  if (config?.trim()) {
    try { data = JSON.parse(config); } catch { return config; }
    if (!data || typeof data !== "object" || Array.isArray(data)) return config;
  }
  const mcp = data.mcp && typeof data.mcp === "object" && !Array.isArray(data.mcp) ? data.mcp : {};
  return JSON.stringify({ ...data, mcp: { ...mcp, [BROWSER_MCP]: { type: "local", command: [launch.command, ...launch.args], environment: launch.env, enabled: true } } });
}

const agyDirs = new Map<string, string>();
let cleanupRegistered = false;

const AGY_BROWSER_RULES = `# SuperAi Live Browser & Desktop Tools (MCP: ${BROWSER_MCP})

You have access to the \`${BROWSER_MCP}\` MCP server (via \`mcp_config.json\`) to control the user's live browser and desktop apps inside SuperAi & RAKKYXD:

- **Browser Use**: \`browser_open\`, \`browser_snapshot\`, \`browser_click\`, \`browser_hover\`, \`browser_type\`, \`browser_press\`, \`browser_select\`, \`browser_upload\`, \`browser_scroll\`, \`browser_screenshot\`, \`browser_console\`, \`browser_eval\`, \`browser_tabs\`, \`browser_close_tab\`, \`browser_wait\`, \`browser_dialog\`, \`browser_back\`, \`browser_forward\`.
  - Always use \`browser_snapshot\` first to obtain element refs (\`e12\`) before clicking, typing, hovering, selecting, or uploading. Use \`browser_screenshot\` when visual inspection is needed, and \`browser_console\` to inspect runtime errors or failed HTTP requests.
- **Computer Use**: \`computer_request_access\`, \`computer_list_windows\`, \`computer_focus_window\`, \`computer_ui_snapshot\`, \`computer_ui_find\`, \`computer_ui_action\`, \`computer_screenshot\`, \`computer_click\`, \`computer_drag\`, \`computer_zoom\`, \`computer_cursor\`, \`computer_wait\`, \`computer_move\`, \`computer_type\`, \`computer_key\`, \`computer_scroll\`.
  - Start with \`computer_request_access\`, then bring the target app forward with \`computer_focus_window\` and prefer \`computer_ui_snapshot\` / \`computer_ui_find\` / \`computer_ui_action\` (accessibility tree, no mouse hijack) before falling back to \`computer_screenshot\` / \`computer_click\`.
`;

/** Remove a per-session Antigravity temporary plugin directory created by `antigravityBrowserArgs`. */
export function cleanupAntigravityBrowserConfig(chatId = "") {
  const key = chatId || "default";
  const dir = agyDirs.get(key);
  if (!dir) return;
  agyDirs.delete(key);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/** Remove all temporary Antigravity plugin directories created in this process. */
export function cleanupAntigravityBrowserConfigs() {
  for (const key of [...agyDirs.keys()]) cleanupAntigravityBrowserConfig(key);
}

/**
 * Antigravity CLI (\`agy\`): per-session temporary workspace plugin mounted via \`--add-dir\` so
 * Antigravity receives \`superai-browser\` without modifying \`~/.gemini/config/\`.
 */
export function antigravityBrowserArgs(chatId = ""): string[] {
  const launch = browserMcpLaunch(chatId);
  if (!launch) return [];
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    process.once("exit", cleanupAntigravityBrowserConfigs);
  }
  const key = chatId || "default";
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "default";
  const dir = agyDirs.get(key) || path.join(os.tmpdir(), `superai-agy-mcp-${process.pid}-${safeKey}`);
  const pluginDir = path.join(dir, ".agents", "plugins", BROWSER_MCP);
  const rulesDir = path.join(pluginDir, "rules");
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, "plugin.json"), JSON.stringify({ name: BROWSER_MCP }, null, 2));
  fs.writeFileSync(path.join(pluginDir, "mcp_config.json"), JSON.stringify({
    mcpServers: {
      [BROWSER_MCP]: { command: launch.command, args: launch.args, env: launch.env },
    },
  }, null, 2));
  fs.writeFileSync(path.join(rulesDir, "AGENTS.md"), AGY_BROWSER_RULES);
  agyDirs.set(key, dir);
  return ["--add-dir", dir];
}
