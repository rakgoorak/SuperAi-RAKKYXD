// Ship the ONNX runtime with the app instead of loading it from a CDN at run time.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve('@huggingface/transformers'));
const target = path.resolve('public', 'ort');
await fs.mkdir(target, { recursive: true });
for (const name of await fs.readdir(dist)) {
  if (/^ort-wasm.*\.(mjs|wasm)$/.test(name)) {
    const dest = path.join(target, name);
    try {
      const { existsSync } = await import('node:fs');
      if (existsSync(dest)) continue;
    } catch {}
    await fs.copyFile(path.join(dist, name), dest);
  }
}
