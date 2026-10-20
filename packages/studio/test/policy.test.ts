import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalSessionManager } from '../server/TerminalSessionManager.js';
import { WorkspaceRegistry } from '../server/WorkspaceRegistry.js';
import { getCliDefinition } from '../server/CliCatalog.js';

test('Freebuff allows one running session across workspaces, then releases on confirmed kill', async () => {
  const manager = new TerminalSessionManager();
  try {
    const first = manager.spawnSession({ agentType: 'freebuff', wsId: 'one', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], forcePipe: true });
    assert.equal(first.status, 'running');
    assert.throws(() => manager.spawnSession({ agentType: 'freebuff', wsId: 'two' }), /1 session/);
    assert.equal(manager.killSession(first.id), true);
    assert.throws(() => manager.spawnSession({ agentType: 'freebuff', wsId: 'two' }), /1 session/);
    for(let i=0;i<100&&manager.getSession(first.id);i++)await new Promise(r=>setTimeout(r,30));
    assert.equal(manager.getSession(first.id),undefined);
    const next = manager.spawnSession({ agentType: 'freebuff', command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], forcePipe: true });
    assert.equal(next.status, 'running');
  } finally { manager.killAll(); }
});

test('Freebuff releases its slot after natural process exit', async () => {
  const manager = new TerminalSessionManager();
  try {
    const first = manager.spawnSession({ agentType: 'freebuff', command: process.execPath, args: ['-e', 'process.exit(0)'], forcePipe: true });
    for (let i=0; i<60 && first.status === 'running'; i++) await new Promise(r=>setTimeout(r,50));
    assert.equal(first.status, 'exited');
    assert.doesNotThrow(()=>manager.spawnSession({ agentType: 'freebuff', command: process.execPath, args: ['-e', 'process.exit(0)'], forcePipe: true }));
  } finally { manager.killAll(); }
});

test('CLI definitions include OpenCode and Freebuff and reject unknown IDs', () => {
  assert.equal(getCliDefinition('opencode').command, 'opencode');
  assert.equal(getCliDefinition('freebuff').maxSessions, 1);
  assert.throws(()=>getCliDefinition('invalid'), /ไม่รู้จัก/);
});

test('Workspace rename and delete persist and thread updates cannot overwrite identity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-policy-'));
  try {
    const file = path.join(dir,'workspaces.json');
    const registry = new WorkspaceRegistry(file);
    const ws = registry.createWorkspace('ก่อนแก้', dir);
    const thread = registry.addThread(ws.id, {title:'งานใหม่',type:'terminal'});
    registry.updateThread(ws.id,thread.id,{id:'overwrite',title:'แก้ชื่อ'});
    assert.equal(thread.id.startsWith('th-'),true);
    assert.equal(registry.updateWorkspace(ws.id,{name:'ชื่อใหม่'})?.name,'ชื่อใหม่');
    assert.equal(new WorkspaceRegistry(file).getWorkspace(ws.id)?.name,'ชื่อใหม่');
    assert.equal(registry.deleteWorkspace(ws.id),true);
    assert.equal(new WorkspaceRegistry(file).getWorkspace(ws.id),undefined);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('corrupt project storage is preserved instead of silently overwritten',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-corrupt-'));const file=path.join(dir,'projects.json');
 try{fs.writeFileSync(file,'{ damaged');assert.throws(()=>new WorkspaceRegistry(file),/อ่านข้อมูล/);assert.equal(fs.readFileSync(file,'utf8'),'{ damaged');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('failed project saves report an error and roll back in-memory changes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-save-'));const file=path.join(dir,'projects.json');
 try{const registry=new WorkspaceRegistry(file);const before=registry.getWorkspaces().length;fs.unlinkSync(file);fs.mkdirSync(file);assert.throws(()=>registry.createWorkspace('ไม่ควรเพิ่ม',dir),/บันทึก/);assert.equal(registry.getWorkspaces().length,before);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
