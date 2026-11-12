/**
 * Stdio MCP server started by a chat CLI. It lists the browser tools and forwards each call to the
 * SuperAi app, which acts on the browser panel the user is looking at. Plain newline-delimited
 * JSON-RPC, so no MCP library is bundled.
 */
import { createInterface } from "node:readline";
import { BROWSER_MCP, BROWSER_TOOLS } from "./BrowserTools.js";

const base = process.env.SUPERAI_BROWSER_URL || "";
const token = process.env.SUPERAI_BROWSER_TOKEN || "";
const send = (message: unknown) => process.stdout.write(JSON.stringify(message) + "\n");

async function call(name: string, args: unknown) {
  try {
    const res = await fetch(`${base}/api/browser-tool`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SuperAi-Browser-Token": token },
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
      instructions: "Controls the browser panel inside the SuperAi app, which the user watches live. Use browser_snapshot to read a page and get element refs before clicking or typing." } });
  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: BROWSER_TOOLS } });
  if (method === "tools/call") return send({ jsonrpc: "2.0", id, result: await call(String(params?.name || ""), params?.arguments) });
  send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
});
