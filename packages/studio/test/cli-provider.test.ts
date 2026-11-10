import test from 'node:test';
import assert from 'node:assert/strict';
import { promptArguments, CliProvider } from '../server/CliProvider.js';
import fs from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { cliAuth } from '../server/CliAuth.js';
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

test('Antigravity never gets a model and effort pair that agy refuses', async () => {
 const { modelEffortArgs } = await import('../server/Providers.js');
 // `agy --model gemini-4-argon-high --effort low` fails with "conflicts with --effort=low".
 assert.deepEqual(modelEffortArgs('antigravity', 'gemini-4-argon-high', 'low'), ['--model', 'gemini-4-argon-high']);
 assert.deepEqual(modelEffortArgs('antigravity', 'gemini-4-argon', 'low'), ['--model', 'gemini-4-argon', '--effort', 'low']);
 // No agy model has xhigh/max: an older saved choice falls back to the highest level there is.
 assert.deepEqual(modelEffortArgs('antigravity', '', 'max'), ['--effort', 'high']);
 assert.deepEqual(modelEffortArgs('antigravity', '', ''), []);
 assert.deepEqual(modelEffortArgs('claude-code', 'opus', 'max'), ['--model', 'opus', '--effort', 'max']);
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

test('team CLI parses split JSON events and reports provider usage without leaking event JSON into output', async t => {
 t.mock.method(cliAuth, 'requireReady', async () => {});
 const chunks: string[] = [], usage: any[] = [];
 let args: string[] = [];
 const dependencies: any = {
   launch: (_id: string, argv: string[]) => ({ command: 'fixture', args: argv }),
   spawn: (_command: string, argv: string[]) => {
     args = argv;
     const proc: any = new EventEmitter();
     proc.stdin = new PassThrough(); proc.stdout = new PassThrough(); proc.stderr = new PassThrough();
     process.nextTick(() => {
       const events = [
         { type: 'item.completed', item: { id: 'a', type: 'agent_message', text: 'answer' } },
         { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 40, output_tokens: 5 } },
       ].map(e => JSON.stringify(e)).join('\n');
       proc.stdout.write(events.slice(0, 17)); proc.stdout.write(events.slice(17));
       proc.stdout.end(); proc.stderr.end(); proc.emit('close', 0);
     });
     return proc;
   },
 };
 const provider = new CliProvider('cli:codex', process.cwd(), new AbortController().signal, false, '', false, [], '', value => usage.push(value), dependencies);
 const result = await provider.stream([{ role: 'user', content: 'test' }], chunk => chunks.push(chunk));
 assert.ok(args.includes('--json'));
 assert.equal(result.text, 'answer');
 assert.deepEqual(chunks, ['answer']);
 assert.deepEqual(usage, [{ input: 100, cachedInput: 40, output: 5, inputIncludesCache: true }]);
});
