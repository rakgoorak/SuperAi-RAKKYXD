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
