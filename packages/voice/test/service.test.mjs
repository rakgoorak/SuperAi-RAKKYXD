import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAudio, VoiceService } from '../service.mjs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
function fakeWorker() {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new PassThrough(); child.kill = () => { queueMicrotask(() => child.emit('close', 1)); return true; };
  return child;
}
for (const failure of ['json error', 'premature close', 'startup timeout', 'cancel']) {
  test(`voice daemon rejects ${failure} without hanging`, async () => {
    let child;
    const service = new VoiceService(() => {}, { startupTimeout: 100, spawnProcess: () => {
      child = fakeWorker();
      if (failure === 'json error') setImmediate(() => child.stdout.write('{"error":"missing model"}\n'));
      if (failure === 'premature close') setImmediate(() => child.emit('close', 1));
      if (failure === 'cancel') setImmediate(() => service.cancel());
      return child;
    }});
    await assert.rejects(service.ensureDaemon());
    assert.equal(service.daemonStarting, null); assert.equal(service.daemon, null);
  });
}
test('voice rejects missing, empty and oversized audio',()=>{for(const input of [undefined,'audio',new Uint8Array(0),new Uint8Array(26*1024*1024)])assert.throws(()=>validateAudio(input));assert.equal(validateAudio(new Uint8Array(200)).length,200);});
test('voice rejects unknown models before starting any download',async()=>{const s=new VoiceService();await assert.rejects(s.prepare('../model'),/โมเดล/);assert.equal(s.child,null);});
