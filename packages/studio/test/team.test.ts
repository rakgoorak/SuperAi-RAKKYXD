import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentRunManager } from '../server/AgentRunManager.js';
import { validateTeam } from '../server/AgentTeam.js';
test('invalid teams cannot enable unsupported CLI or duplicate/empty member roles',()=>{
  const seat={name:'คน',provider:'cli:codex',model:''};
  assert.throws(()=>validateTeam({leader:seat,members:[]}));
  assert.throws(()=>validateTeam({leader:seat,members:[{...seat,role:'coder'},{...seat,role:'coder'}]}));
  assert.throws(()=>validateTeam({leader:{...seat,provider:'cli:freebuff'},members:[{...seat,role:'coder'}]}),/ยังไม่รองรับ/);
});
test('leader cannot assign tasks to a disabled role',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-disabled-role-'));let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify([{assignedAgent:'coder',instructions:'แก้ไฟล์'}])}}]}));});
  try{const manager=new AgentRunManager(path.join(dir,'r.json'));const seat={name:'คน',provider:'test-model',model:''};const run=manager.start('p','ตรวจ','test-model',dir,'assistant',false,'',{leader:seat,members:[{...seat,role:'reviewer'}]});for(let i=0;i<100&&run.status==='running';i++)await new Promise(r=>setTimeout(r,10));assert.equal(run.status,'failed');assert.match(run.error!,/แผน/);assert.equal(calls,1);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('leader and two teammates use distinct models and send complete results back to leader', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-custom-team-'));
  const calls: { model: string; prompt: string }[] = [];
  const detail = 'รายละเอียดสำคัญที่ต้องส่งคืนหัวหน้า'.repeat(900);
  t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    const body = JSON.parse(options.body); const prompt = body.messages.map((m: any) => m.content).join('\n');
    calls.push({ model: body.model, prompt });
    const content = calls.length === 1 ? JSON.stringify([{id:'a',title:'เขียน',assignedAgent:'coder',instructions:'ทำงาน'}, {id:'b',title:'ตรวจ',assignedAgent:'reviewer',instructions:'ตรวจผล'}]) : body.model === 'coder-model' ? detail : body.model === 'reviewer-model' ? 'ตรวจแล้ว' : 'สรุปจากทีมจริง';
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  try {
    const manager = new AgentRunManager(path.join(dir, 'runs.json'));
    const team = { leader:{ name:'หัวหน้า', provider:'leader-model', model:'' }, members:[{role:'coder',name:'ผู้เขียน',provider:'coder-model',model:''},{role:'reviewer',name:'ผู้ตรวจ',provider:'reviewer-model',model:''}] };
    const run = (manager.start as any)('p','สร้างงาน','leader-model',dir,'assistant',false,'',team);
    for(let i=0;i<100 && run.status==='running';i++) await new Promise(r=>setTimeout(r,10));
    assert.equal(run.status,'completed');
    assert.deepEqual(calls.map(c=>c.model),['leader-model','coder-model','reviewer-model','leader-model']);
    assert.ok(calls.at(-1)!.prompt.includes(detail));
    assert.equal(run.team.leader.name,'หัวหน้า');
    assert.equal(run.tasks[1].status,'completed');
    assert.ok(calls[2].prompt.includes(detail));
    assert.deepEqual(new AgentRunManager(path.join(dir,'runs.json')).list('p')[0].team,team);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('failed worker preserves the leader diagnosis and full task results',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-team-failure-')); let calls=0;let synthesis='';
 t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>{calls++; if(calls===3)synthesis=options.body; if(calls===2)throw new Error('worker unavailable'); return new Response(JSON.stringify({choices:[{message:{content:calls===1?JSON.stringify([{assignedAgent:'coder',instructions:'implement'}]):'หัวหน้าสรุป: ลูกทีมล้มเหลว ต้องลองใหม่'}}]}));});
 try{
  const m=new AgentRunManager(path.join(dir,'r.json')); const seat={name:'คน',provider:'fixture',model:''};
  const r=m.start('p','ทำงาน','fixture',dir,'assistant',false,'',{leader:seat,members:[{...seat,role:'coder'}]});
  for(let i=0;i<100&&r.status==='running';i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(r.status,'failed'); assert.match(r.output,/ลูกทีมล้มเหลว/); assert.equal(r.tasks![0].status,'failed'); assert.equal(calls,3); assert.match(r.tasks![0].result,/worker unavailable/); assert.match(synthesis,/worker unavailable/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('cancelled team never starts the next member or leader synthesis',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'superai-team-cancel-')); let calls=0; let release!:()=>void;
 const entered=new Promise<void>(resolve=>release=resolve);
 t.mock.method(globalThis,'fetch',async(_url:any,options:any)=>{
  calls++; if(calls===1)return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify([{assignedAgent:'coder',instructions:'implement'},{assignedAgent:'reviewer',instructions:'review'}])}}]}));
  release(); await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true})); throw new Error('unreachable');
 });
 try{
  const m=new AgentRunManager(path.join(dir,'r.json'));const seat={name:'คน',provider:'fixture',model:''};
  const r=m.start('p','ทำงาน','fixture',dir,'assistant',false,'',{leader:seat,members:[{...seat,role:'coder'},{...seat,role:'reviewer'}]});
  await entered; assert.equal(m.cancel(r.id),true);
  for(let i=0;i<100&&r.status==='running';i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(r.status,'cancelled');assert.equal(calls,2);assert.equal(r.tasks![1].status,'cancelled');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
