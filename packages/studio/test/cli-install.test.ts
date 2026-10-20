import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CliInstallManager } from '../server/CliInstallManager.js';
function fixture(timeout=10000) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-installer-'));
  const npm=path.join(dir,'npm.cmd'), entry=path.join(dir,'node_modules/npm/bin/npm-cli.js');
  fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(npm,'fixture');fs.writeFileSync(entry,'fixture');
  let installed=false;const children:any[]=[],calls:any[]=[];
  const manager=new CliInstallManager({prefix:path.join(dir,'tools'),timeout,version:()=> '22.0.0',find:(name:string)=>name==='node'?process.execPath:name==='npm'?npm:installed?path.join(dir,name):null,
    spawn:((command:string,args:string[])=>{calls.push({command,args});const c:any=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.kill=()=>true;children.push(c);return c;}) as any});
  return {manager,calls,children,installed:()=>installed=true,dispose:()=>{children.forEach(c=>c.emit('close',1));fs.rmSync(dir,{recursive:true,force:true});}};
}
test('installer rejects unknown IDs and Terminal before executing any command',()=>{
  const f=fixture();try{assert.throws(()=>f.manager.start('arbitrary;package'));assert.throws(()=>f.manager.start('terminal'),/ไม่ต้องติดตั้ง/);assert.equal(f.calls.length,0);}finally{f.dispose();}
});
test('installer uses fixed official package, private prefix and requires executable discovery',()=>{
  const f=fixture();try{const job=f.manager.start('codex');assert.ok(f.calls[0].args.includes('@openai/codex@latest'));assert.ok(f.calls[0].args.includes('--prefix'));assert.throws(()=>f.manager.start('gemini'),/กำลังติดตั้ง/);f.children[0].stdout.write('download complete');f.installed();f.children[0].emit('close',0);assert.equal(job.status,'completed');assert.match(job.log,/download complete/);}finally{f.dispose();}
});
test('installer does not report success when npm exits zero without an executable',()=>{
  const f=fixture();try{const job=f.manager.start('codex');f.children[0].emit('close',0);assert.equal(job.status,'failed');assert.match(job.error!,/executable/);}finally{f.dispose();}
});
test('installer cancellation keeps slot until child confirms close',()=>{
  const f=fixture();try{const job=f.manager.start('codex');assert.equal(f.manager.cancel(job.id),true);assert.equal(job.status,'cancelled');assert.throws(()=>f.manager.start('gemini'),/กำลังติดตั้ง/);f.children[0].emit('close',1);assert.equal(f.manager.start('gemini').status,'running');}finally{f.dispose();}
});
test('installer timeout fails after process close and records a recovery message',async()=>{
  const f=fixture(10);try{const job=f.manager.start('codex');await new Promise(r=>setTimeout(r,30));f.children[0].emit('close',1);assert.equal(job.status,'failed');assert.match(job.error!,/เกินเวลา/);}finally{f.dispose();}
});

test('installer explains missing Node and refuses old runtime before spawning',()=>{
 const dependencies={find:()=>null,spawn:(()=>{throw new Error('must not spawn');}) as any,prefix:'unused',timeout:10,version:()=> '20.0.0'};
 assert.throws(()=>new CliInstallManager(dependencies).start('codex'),/Node.js 22/);
 assert.throws(()=>new CliInstallManager({...dependencies,find:(name:string)=>['node','npm'].includes(name)?process.execPath:null}).start('codex'),/22/);
});
