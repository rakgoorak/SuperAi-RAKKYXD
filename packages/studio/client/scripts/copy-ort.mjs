// Ship the ONNX runtime with the app instead of loading it from a CDN at run time.
// transformers.js 4 imports onnxruntime-web/webgpu, which loads the "asyncify" build from
// wasmPaths (/ort/). Both files come from the onnxruntime-web that transformers.js uses,
// and are always overwritten so an older runtime never stays behind after an upgrade.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const transformers = path.dirname(path.dirname(require.resolve('@huggingface/transformers')));
// Neither package exports package.json, so resolve the main entry (in dist/).
let dist = path.dirname(createRequire(path.join(transformers, 'package.json')).resolve('onnxruntime-web'));
while (path.basename(dist) !== 'dist') dist = path.dirname(dist);
const target = path.resolve('public', 'ort');
await fs.mkdir(target, { recursive: true });
for (const name of await fs.readdir(target)) {
  if (/^ort-wasm.*\.(mjs|wasm)$/.test(name)) await fs.rm(path.join(target, name));
}
for (const name of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  await fs.copyFile(path.join(dist, name), path.join(target, name));
}
