// Starts the real app and keeps the browser-tools module reachable, so the smoke test can start the
// MCP server exactly as a chat CLI would.
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.superaiBrowserTools = await import(pathToFileURL(path.resolve(here, '../../studio/dist/BrowserTools.js')).href);
await import('../app.mjs');
