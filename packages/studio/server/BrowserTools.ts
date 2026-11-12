import { randomBytes } from "node:crypto";
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
export type BrowserHandler = (tool: string, args: Record<string, unknown>) => Promise<BrowserToolResult>;

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const tool = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) =>
  ({ name, description, inputSchema: { type: "object", properties, required, additionalProperties: false } });

/** Tools as the MCP server lists them. `readOnly` ones are allowed even in read-only chats. */
export const BROWSER_TOOLS = [
  tool("browser_open", "Open a web page in the SuperAi browser panel the user can see (a new tab when asked, otherwise the current tab). Returns the page snapshot.",
    { url: str("http(s) address, or localhost:3000"), newTab: { type: "boolean", description: "Open in a new tab" } }, ["url"]),
  tool("browser_snapshot", "Read the current page: title, address, visible text and the clickable/typable elements, each with a ref to use in other tools."),
  tool("browser_click", "Click an element by its ref from the latest snapshot (or by its visible text).", { ref: str("ref from browser_snapshot"), text: str("visible text, when there is no ref") }),
  tool("browser_type", "Type into an input by ref. Replaces its current value unless append is true; submit presses Enter afterwards.",
    { ref: str("ref from browser_snapshot"), text: str("text to type"), submit: { type: "boolean" }, append: { type: "boolean" } }, ["ref", "text"]),
  tool("browser_press", "Press a key in the page, e.g. Enter, Tab, Escape, ArrowDown, PageDown.", { key: str("key name") }, ["key"]),
  tool("browser_select", "Choose an option of a <select> by ref.", { ref: str("ref of the select"), value: str("option value or visible label") }, ["ref", "value"]),
  tool("browser_scroll", "Scroll the page.", { direction: { type: "string", enum: ["up", "down", "top", "bottom"] }, amount: num("pixels, default one screen") }, ["direction"]),
  tool("browser_screenshot", "Take a screenshot of what the page shows now."),
  tool("browser_back", "Go back in the current tab."),
  tool("browser_forward", "Go forward in the current tab."),
  tool("browser_tabs", "List the open tabs, or switch to one.", { select: str("tab id to switch to") }),
  tool("browser_wait", "Wait for the page: until a text appears, or a number of seconds (max 20).", { text: str("text to wait for"), seconds: num("seconds") }),
];
export const READ_ONLY_BROWSER_TOOLS = ["browser_open", "browser_snapshot", "browser_screenshot", "browser_scroll", "browser_back", "browser_forward", "browser_tabs", "browser_wait"];

let handler: BrowserHandler | undefined;
let base = "";
const token = randomBytes(24).toString("hex");

export function registerBrowserHandler(fn: BrowserHandler | undefined) { handler = fn; }
export const browserHandler = () => handler;
export const browserToken = () => token;
export function setBrowserBase(url: string) { base = url; }

/** How a CLI starts the MCP server; null when there is no browser to drive (not the desktop app). */
export function browserMcpLaunch(): { command: string; args: string[]; env: Record<string, string> } | null {
  if (!handler || !base) return null;
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "BrowserMcp.js");
  // The desktop app's own executable runs the script as plain Node, so no separate Node is needed.
  const env: Record<string, string> = { SUPERAI_BROWSER_URL: base, SUPERAI_BROWSER_TOKEN: token };
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = "1";
  return { command: process.execPath, args: [script], env };
}

/** Claude Code: --mcp-config takes the JSON itself. */
export function claudeBrowserArgs(): string[] {
  const launch = browserMcpLaunch();
  return launch ? ["--mcp-config", JSON.stringify({ mcpServers: { [BROWSER_MCP]: { type: "stdio", ...launch } } })] : [];
}

/** Codex: config overrides on the command line. Values are TOML, and JSON strings are valid TOML strings. */
export function codexBrowserArgs(): string[] {
  const launch = browserMcpLaunch();
  if (!launch) return [];
  const key = `mcp_servers.${BROWSER_MCP}`;
  const env = Object.entries(launch.env).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join(", ");
  return ["-c", `${key}.command=${JSON.stringify(launch.command)}`, "-c", `${key}.args=${JSON.stringify(launch.args)}`, "-c", `${key}.env={ ${env} }`,
    // The panel is visible to the user and holds no project files, so its tools need no approval.
    "-c", `${key}.default_tools_approval_mode="approve"`];
}

/** OpenCode: merged into OPENCODE_CONFIG_CONTENT. */
export function withOpenCodeBrowser(config: string | undefined): string | undefined {
  const launch = browserMcpLaunch();
  if (!launch) return config;
  let data: Record<string, any> = {};
  if (config?.trim()) {
    try { data = JSON.parse(config); } catch { return config; }
    if (!data || typeof data !== "object" || Array.isArray(data)) return config;
  }
  const mcp = data.mcp && typeof data.mcp === "object" && !Array.isArray(data.mcp) ? data.mcp : {};
  return JSON.stringify({ ...data, mcp: { ...mcp, [BROWSER_MCP]: { type: "local", command: [launch.command, ...launch.args], environment: launch.env, enabled: true } } });
}
