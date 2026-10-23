import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { projectChanges, projectFile } from '../server/ProjectChanges.js';
import { recoveryHint } from '../client/src/recovery.js';
test('changes include staged, unstaged, untracked and deleted files; contents stay within project', async () => {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'superai-changes-'));
 const outside=await fs.mkdtemp(path.join(os.tmpdir(),'superai-outside-'));
 const git=(...args:string[])=>execFileSync('git',args,{cwd:root,windowsHide:true});
 try {
  git('init');await fs.writeFile(path.join(root,'tracked.txt'),'before\n');await fs.mkdir(path.join(root,'nested'));await fs.writeFile(path.join(root,'nested','deleted.txt'),'gone\n');git('add','.');git('-c','user.name=Test','-c','user.email=test@example.com','commit','-m','fixture');
  await fs.writeFile(path.join(root,'tracked.txt'),'after\n');await fs.rm(path.join(root,'nested'),{recursive:true});await fs.writeFile(path.join(root,'new.txt'),'new');await fs.writeFile(path.join(root,'staged.txt'),'stage');git('add','staged.txt');
  const changes=await projectChanges(root);assert.deepEqual(changes.files.sort(),['nested/deleted.txt','new.txt','staged.txt','tracked.txt']);
  const file=await projectFile(root,'tracked.txt');assert.equal(file.content,'after\n');assert.match(file.diff,/\+after/);
  assert.equal((await projectFile(root,'nested/deleted.txt')).deleted,true);
  assert.equal((await projectFile(root,'new.txt')).content,'new');
  await assert.rejects(projectFile(root,'../escape'),/โปรเจกต์/);
  await fs.writeFile(path.join(outside,'secret.txt'),'outside');await fs.symlink(outside,path.join(root,'link'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(projectFile(root,'link/secret.txt'),/โปรเจกต์/);
  await assert.rejects(projectFile(root,'link/deleted.txt'),/โปรเจกต์/);
  await fs.writeFile(path.join(root,'binary'),Buffer.from([0,1]));await assert.rejects(projectFile(root,'binary'),/ไบนารี/);
  await fs.writeFile(path.join(root,'large'),'x'.repeat(256*1024+1));await assert.rejects(projectFile(root,'large'),/256/);
 }finally{await fs.rm(root,{recursive:true,force:true});await fs.rm(outside,{recursive:true,force:true});}
});
test('recovery guidance distinguishes quota, account and network failures',()=>{
 assert.match(recoveryHint('429 rate limit'),/โควตา/);assert.match(recoveryHint('401 login required'),/บัญชี/);assert.match(recoveryHint('ECONNRESET timeout'),/เชื่อมต่อ/);
});
