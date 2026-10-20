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


test('installer auto-installs Node 22 when runtime is missing or < 22, then completes CLI install', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-autonode-'));
  const npm = path.join(dir, 'npm.cmd'), entry = path.join(dir, 'node_modules/npm/bin/npm-cli.js');
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.writeFileSync(npm, 'fixture');
  fs.writeFileSync(entry, 'fixture');

  let nodeInstalled = false;
  let cliInstalled = false;
  const calls: any[] = [];
  const children: any[] = [];

  const manager = new CliInstallManager({
    prefix: path.join(dir, 'tools'),
    timeout: 10000,
    find: (name: string) => {
      if (name === 'node') return nodeInstalled ? process.execPath : null;
      if (name === 'npm') return nodeInstalled ? npm : null;
      if (name === 'codex') return cliInstalled ? path.join(dir, name) : null;
      return null;
    },
    version: () => (nodeInstalled ? '22.23.0' : '18.0.0'),
    installNode: async (opts) => {
      opts?.onLog?.('downloading node 22...');
      nodeInstalled = true;
      return { node: process.execPath, npm, version: 'v22.23.0' };
    },
    spawn: ((command: string, args: string[]) => {
      calls.push({ command, args });
      const c: any = new EventEmitter();
      c.stdout = new PassThrough();
      c.stderr = new PassThrough();
      c.kill = () => true;
      children.push(c);
      return c;
    }) as any,
  });

  try {
    const job = manager.start('codex');
    assert.equal(job.status, 'running');
    assert.match(job.log, /ตรวจพบ Node.js ต่ำกว่า 22/);

    for (let i = 0; i < 30; i++) {
      if (children.length > 0) break;
      await new Promise((r) => setTimeout(r, 20));
    }

    assert.equal(nodeInstalled, true);
    assert.equal(children.length, 1);
    assert.ok(calls[0].args.includes('@openai/codex@latest'));

    cliInstalled = true;
    children[0].emit('close', 0);
    assert.equal(job.status, 'completed');
    assert.match(job.log, /ติดตั้งสำเร็จ/);
  } finally {
    children.forEach((c) => c.emit('close', 1));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('installer supports start("node") for standalone Node 22 setup and responds to cancel', async () => {
  let installDone = false;
  let receivedSignal: AbortSignal | undefined;

  const manager = new CliInstallManager({
    prefix: 'unused',
    timeout: 10000,
    find: () => null,
    version: () => '20.0.0',
    installNode: async (opts) => {
      receivedSignal = opts?.signal;
      opts?.onLog?.('starting node download');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 200);
        opts?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('abort'));
        });
      });
      installDone = true;
      return { node: 'node.exe', npm: 'npm.cmd', version: 'v22.23.0' };
    },
  });

  const job = manager.start('node');
  assert.equal(job.status, 'running');
  assert.equal(manager.cancel(job.id), true);
  assert.equal(job.status, 'cancelled');
  assert.ok(receivedSignal?.aborted);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(installDone, false);
});
