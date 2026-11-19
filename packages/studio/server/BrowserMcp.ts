/**
 * Stdio MCP server started by a chat CLI. It lists the browser tools and forwards each call to the
 * SuperAi app, which acts on the browser panel the user is looking at. Plain newline-delimited
 * JSON-RPC, so no MCP library is bundled.
 */
import { createInterface } from "node:readline";
import { BROWSER_MCP, BROWSER_TOOLS, COMPUTER_TOOLS } from "./BrowserTools.js";

const base = process.env.SUPERAI_BROWSER_URL || "";
const token = process.env.SUPERAI_BROWSER_TOKEN || "";
const chatAt = process.argv.indexOf("--chat");
const chat = chatAt >= 0 ? String(process.argv[chatAt + 1] || "") : "";
const send = (message: unknown) => process.stdout.write(JSON.stringify(message) + "\n");

async function call(name: string, args: unknown) {
  try {
    const res = await fetch(`${base}/api/browser-tool`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SuperAi-Browser-Token": token, ...(chat ? { "X-SuperAi-Chat": chat } : {}) },
      body: JSON.stringify({ tool: name, args: args && typeof args === "object" ? args : {} }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { content: [{ type: "text", text: String(data.error || `HTTP ${res.status}`) }], isError: true };
    const content: unknown[] = [{ type: "text", text: String(data.text || "") }];
    if (data.image?.data) content.push({ type: "image", data: data.image.data, mimeType: data.image.mimeType || "image/png" });
    return { content };
  } catch (error) {
    return { content: [{ type: "text", text: `SuperAi browser is not reachable: ${(error as Error).message}. Is the SuperAi app open?` }], isError: true };
  }
}

createInterface({ input: process.stdin }).on("line", async (line) => {
  let message: any;
  try { message = JSON.parse(line); } catch { return; }
  const { id, method, params } = message || {};
  if (id === undefined || id === null) return; // notifications need no reply
  if (method === "initialize")
    return send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: BROWSER_MCP, version: "1.0.0" },
      instructions: "browser_ tools control a live browser the user watches (SuperAi panel, or Chrome / Edge). Use browser_snapshot first to get element refs (e12) before clicking/typing/hovering/uploading, browser_screenshot when visual layout matters, and browser_console if a page fails or behaves unexpectedly. computer_ tools see and control the desktop once turned on in Settings; regular apps (including browsers, terminals, and editors) work directly without per-app prompts while sensitive apps (password managers, wallets, banking) ask the user first. Use computer_focus_window to bring an app in front of SuperAi (or launch it), and prefer computer_ui_snapshot / computer_ui_find / computer_ui_action (accessibility tree, no mouse) before falling back to computer_screenshot / computer_click. If the user denies access to a sensitive app, stop and tell them instead of retrying." } });
  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: [...BROWSER_TOOLS, ...COMPUTER_TOOLS] } });
  if (method === "tools/call") return send({ jsonrpc: "2.0", id, result: await call(String(params?.name || ""), params?.arguments) });
  send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
});
