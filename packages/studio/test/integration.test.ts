import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StudioServer } from '../server/StudioServer.js';

test('API: project CRUD, real CLI catalog, Freebuff conflict, dictation and origin isolation',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-api-'));
 const server=new StudioServer({port:0,customWorkspacePath:path.join(dir,'projects.json')});
 await server.start();const base=`http://127.0.0.1:${server.getPort()}`;
 const request=(route:string,method='GET',body?:any,headers={})=>fetch(base+route,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
 try {
  const clis=await request('/api/clis').then(r=>r.json());assert.ok(clis.some((c:any)=>c.id==='opencode'));assert.equal(clis.find((c:any)=>c.id==='freebuff').maxSessions,1);
  assert.equal((await request('/api/health','GET',undefined,{Origin:'https://untrusted.example'})).status,403);
  assert.equal((await request('/api/missing')).status,404);
  assert.equal((await request('/api/workspaces','POST',{name:'bad',rootPath:'Z:/not-a-real-folder'})).status,400);
  const ws=await request('/api/workspaces','POST',{name:'โปรเจกต์ทดสอบ',rootPath:dir}).then(r=>r.json());assert.ok(ws.id);
  await request(`/api/workspaces/${ws.id}`,'PATCH',{name:'เปลี่ยนชื่อ'});
  const projects=await request('/api/workspaces').then(r=>r.json());assert.equal(projects.find((w:any)=>w.id===ws.id).name,'เปลี่ยนชื่อ');
  const first=await request('/api/terminals/spawn','POST',{wsId:ws.id,agentType:'freebuff',command:process.execPath,args:['-e','setInterval(()=>{},1000)']}).then(r=>r.json());assert.equal(first.status,'running');
  const conflict=await request('/api/terminals/spawn','POST',{wsId:ws.id,agentType:'freebuff'});assert.equal(conflict.status,409);assert.match((await conflict.json()).error,/1 session/);
  assert.equal((await request('/api/terminals/spawn','POST',{wsId:ws.id,agentType:'unknown'})).status,400);
  await request('/api/dictation','POST',{text:'สร้างเว็บไซต์ภาษาไทย'});
  const dictations=await request('/api/dictation?after=0').then(r=>r.json());assert.equal(dictations.at(-1).text,'สร้างเว็บไซต์ภาษาไทย');
  assert.equal((await request('/api/dictation','POST',{text:''})).status,400);
  await request(`/api/workspaces/${ws.id}`,'DELETE');
  let sessions:any[]=[];
  for(let i=0;i<100;i++){sessions=await request('/api/terminals').then(r=>r.json());if(!sessions.some((s:any)=>s.wsId===ws.id))break;await new Promise(r=>setTimeout(r,30));}
  assert.equal(sessions.some((s:any)=>s.wsId===ws.id),false);
 } finally {await server.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
