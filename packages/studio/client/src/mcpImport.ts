/**
 * MCP servers pasted as JSON, the way Claude Desktop, Cursor, VS Code and most READMEs show them:
 *   { "mcpServers": { "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] } } }
 * Also accepted: { "servers": { … } } (VS Code), a bare { "name": { … } } map, or one server
 * object with a "name". Each entry becomes the body the app's add-server route expects.
 */
export interface ImportedMcpServer {
  name: string;
  type: 'stdio' | 'http' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const looksLikeServer = (value: unknown) => isObject(value) && (typeof value.command === 'string' || typeof value.url === 'string' || typeof value.serverUrl === 'string');

/** Turns pasted text into servers; throws a short reason the person can act on. */
export function parseMcpJson(text: string): ImportedMcpServer[] {
  let data: unknown;
  // People often copy just the inner part ("playwright": { … }) without the outer braces.
  const trimmed = text.trim().replace(/,\s*$/, '');
  try { data = JSON.parse(trimmed); }
  catch {
    try { data = JSON.parse(`{${trimmed}}`); }
    catch { throw new Error('JSON'); }
  }
  if (!isObject(data)) throw new Error('JSON');
  let map: Record<string, unknown>;
  if (isObject(data.mcpServers)) map = data.mcpServers;
  else if (isObject(data.servers)) map = data.servers;
  else if (isObject(data.mcp) && isObject((data.mcp as Record<string, unknown>).servers)) map = (data.mcp as Record<string, Record<string, unknown>>).servers;
  else if (looksLikeServer(data) && typeof data.name === 'string') map = { [data.name]: data };
  else map = data;
  const servers: ImportedMcpServer[] = [];
  for (const [rawName, entry] of Object.entries(map)) {
    if (!looksLikeServer(entry)) continue;
    const value = entry as Record<string, unknown>;
    const name = rawName.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!name) continue;
    const env = isObject(value.env) ? Object.fromEntries(Object.entries(value.env).map(([k, v]) => [k, String(v)])) : undefined;
    const url = typeof value.url === 'string' ? value.url : typeof value.serverUrl === 'string' ? value.serverUrl : undefined;
    if (url) {
      const declared = String(value.type || value.transport || '').toLowerCase();
      servers.push({ name, type: declared === 'sse' ? 'sse' : 'http', url, ...(env && Object.keys(env).length ? { env } : {}) });
    } else {
      const args = Array.isArray(value.args) ? value.args.map(String) : [];
      servers.push({ name, type: 'stdio', command: String(value.command), args, ...(env && Object.keys(env).length ? { env } : {}) });
    }
  }
  if (!servers.length) throw new Error('EMPTY');
  return servers;
}
