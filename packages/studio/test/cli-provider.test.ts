import test from 'node:test';
import assert from 'node:assert/strict';
import { promptArguments, CliProvider } from '../server/CliProvider.js';
import fs from 'node:fs/promises';
test('CLI chat uses read-only agents by default and requires explicit tool permission',()=>{
 const prompt="คำถาม ' quoted $value `token`";
 assert.ok(promptArguments('claude-code',false).includes('plan'));
 assert.ok(promptArguments('codex',false).includes('read-only'));
 assert.ok(promptArguments('opencode',false,'C:/request.txt').includes('plan'));
 assert.ok(promptArguments('opencode',true,'C:/request.txt').includes('build'));
 assert.ok(!promptArguments('opencode',false,'C:/request.txt').includes(prompt));
 assert.equal(promptArguments('codex',false).at(-1),'-');
 assert.throws(()=>promptArguments('freebuff',false),/terminal/);
});
test('cancelled CLI requests never spawn a new process',async()=>{const controller=new AbortController();controller.abort();const provider=new CliProvider('cli:opencode',process.cwd(),controller.signal);await assert.rejects(provider.generate([{role:'user',content:'ไม่ควรรัน'}]),/ยกเลิก/);});

test('cancelling while preparing an OpenCode attachment prevents execution',async t=>{
 const controller=new AbortController();const write=fs.writeFile.bind(fs);
 t.mock.method(fs,'writeFile',async(...args:Parameters<typeof fs.writeFile>)=>{await write(...args);controller.abort();});
 const provider=new CliProvider('cli:opencode',process.cwd(),controller.signal);
 await assert.rejects(provider.generate([{role:'user',content:'ไม่ควรรันหลังยกเลิก'}]),/ยกเลิก/);
});

test('Claude team reviewer can read files without write or shell tools',()=>{
 const args=promptArguments('claude-code',false,undefined,'sonnet',true);
 assert.equal(args[args.indexOf('--tools')+1],'Read,Grep,Glob');
 assert.ok(args.includes('plan'));
 assert.equal(args[args.indexOf('--model')+1],'sonnet');
 assert.ok(!args.includes('Bash'));
});

test('model and effort flags follow each CLI', async () => {
 const { modelEffortArgs } = await import('../server/Providers.js');
 const claude = promptArguments('claude-code', false, undefined, 'opus', false, [], { effort: 'high' });
 assert.equal(claude[claude.indexOf('--effort') + 1], 'high');
 const codex = promptArguments('codex', false, undefined, 'gpt-6.1-sol', false, [], { effort: 'xhigh' });
 assert.equal(codex[codex.indexOf('-c') + 1], 'model_reasoning_effort="xhigh"');
 assert.equal(codex.at(-1), '-');
 const oc = promptArguments('opencode', false, 'C:/r.txt', 'opencode/x', false, [], { effort: 'max' });
 assert.equal(oc[oc.indexOf('--variant') + 1], 'max');
 assert.ok(!modelEffortArgs('opencode', 'opencode/x', 'max', true).includes('--variant'));
 assert.deepEqual(modelEffortArgs('freebuff', 'x', 'high'), []);
});

test('Antigravity runs headless with the prompt attached to --print and plan mode unless tools are allowed', () => {
 const args = promptArguments('antigravity', false, undefined, 'gemini-4-argon-high', false, [], { effort: 'low', prompt: 'สวัสดี --mode auto' });
 assert.equal(args.at(-1), '--print=สวัสดี --mode auto');
 assert.equal(args[args.indexOf('--mode') + 1], 'plan');
 assert.ok(!args.includes('--dangerously-skip-permissions'));
 assert.ok(promptArguments('antigravity', true, undefined, '', false, [], { prompt: 'x' }).includes('--sandbox'));
 assert.throws(() => promptArguments('antigravity', false), /คำขอ/);
});

test('CLI failures surface the provider message and a model hint instead of raw logs', async () => {
 const { cliFailure } = await import('../server/CliProvider.js');
 const log = 'WARN noise\nERROR: {"type":"error","status":400,"error":{"message":"The \'gpt-x\' model is not supported when using Codex with a ChatGPT account."}}';
 const text = cliFailure('cli:codex', 'gpt-x', log, '', 1);
 assert.match(text, /^cli:codex: The 'gpt-x' model is not supported/);
 assert.match(text, /ลองเลือก model อื่น/);
 assert.ok(!text.includes('WARN noise'));
 assert.equal(cliFailure('cli:claude-code', '', '', '', 2), 'cli:claude-code: exit 2');
});
