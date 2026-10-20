import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {AgentRunManager} from '../server/AgentRunManager.js';

test('conversation runs persist Thai output, preserve context and enforce one active job per project',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-chat-'));const file=path.join(dir,'history.json');let captured:any[]=[];
 t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>{const body=JSON.parse(options.body);captured=body.messages;return new Response(JSON.stringify({choices:[{message:{content:'คำตอบภาษาไทย'}}]}),{status:200,headers:{'Content-Type':'application/json'}});});
 try{
  const manager=new AgentRunManager(file);const first=manager.start('project','สวัสดี','test-model',dir,'chat');
  assert.throws(()=>manager.start('project','อีกงาน','test-model',dir,'chat'),/กำลังทำ/);
  for(let i=0;i<50&&first.status==='running';i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(first.status,'completed');assert.equal(first.output,'คำตอบภาษาไทย');
  const next=manager.start('project','คำถามต่อไป','test-model',dir,'chat');
  for(let i=0;i<50&&next.status==='running';i++)await new Promise(r=>setTimeout(r,10));
  assert.ok(captured.some(m=>m.content.includes('คำตอบภาษาไทย')));
  assert.equal(new AgentRunManager(file).list('project').length,2);
  manager.clear('project');assert.equal(new AgentRunManager(file).list('project').length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('cancel aborts provider requests and reports cancelled rather than success',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-cancel-'));
 t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})));
 try{const manager=new AgentRunManager(path.join(dir,'history.json'));const run=manager.start('project','รอก่อน','test',dir,'chat');assert.equal(manager.cancel(run.id),true);for(let i=0;i<50&&run.status==='running';i++)await new Promise(r=>setTimeout(r,10));assert.equal(run.status,'cancelled');assert.equal(run.error,'ยกเลิกงานแล้ว');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('assistant executes a real supervisor plan and records each subagent',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-team-'));let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:calls===1?JSON.stringify([{id:'one',title:'วิเคราะห์',assignedAgent:'coder',instructions:'อธิบาย'},{id:'two',title:'ตรวจทาน',assignedAgent:'reviewer',instructions:'ตรวจ'}]):'ผลลัพธ์ทดสอบ'}}]}));});
 try{const manager=new AgentRunManager(path.join(dir,'history.json'));const run=manager.start('project','วิเคราะห์ระบบ','test',dir,'assistant');for(let i=0;i<100&&run.status==='running';i++)await new Promise(r=>setTimeout(r,10));assert.equal(run.status,'completed');assert.equal(calls,4);assert.ok(run.events.some(e=>e.includes('subagent_start')));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
