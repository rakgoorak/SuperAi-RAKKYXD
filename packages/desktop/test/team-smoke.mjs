import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
const require=createRequire(import.meta.url);
await fs.mkdir('output',{recursive:true});
const data=await fs.mkdtemp(path.resolve('output','team-check-'));
const calls=[];
const service=http.createServer(async(req,res)=>{
 if(req.url==='/api/tags'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({models:['leader-fixture','coder-fixture','reviewer-fixture'].map(name=>({name}))}));return;}
 let input='';for await(const chunk of req)input+=chunk;
 const body=JSON.parse(input), prompt=body.messages.map(m=>m.content).join('\n');calls.push({model:body.model,prompt});
 // Answer by role so parallel Sub-agents can arrive in any order.
 const content=prompt.includes('ผู้สรุปความเห็น')?'CHAT_SUMMARY จาก Main 1 และ Main 2'
  :prompt.includes('Sub-agent ที่มี')?JSON.stringify({note:'แบ่งงานทดสอบ',tasks:[{id:'a',title:'สร้างงานจริง',assignee:1,instructions:'implement'},{id:'b',title:'ตรวจผลจริง',assignee:2,instructions:'review',dependsOn:['a']}]})
  :body.model==='coder-fixture'?'CODER_RESULT_ACTUAL':body.model==='reviewer-fixture'?'REVIEW_RESULT_ACTUAL':'สรุปผลจากหัวหน้า TEAM_COMPLETE';
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content}}]}));
});
await new Promise(resolve=>service.listen(0,'127.0.0.1',resolve));
const app=await electron.launch({executablePath:require('electron'),args:['packages/desktop'],env:{...process.env,SUPERAI_DATA_DIR:data,SUPERAI_OLLAMA_URL:`http://127.0.0.1:${service.address().port}`,SUPERAI_TEST_MODE:'1'},timeout:60000});
const passed=[],errors=[];
try{
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.app-shell'); // Setup guide is covered by smoke.mjs.
  await page.waitForSelector('.app-shell'); await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1')); await page.reload(); await page.waitForSelector('.app-shell');
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1100,760);});
 const request=(route,body)=>page.evaluate(async({route,body})=>{const res=await fetch(route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);if(!res.ok)throw new Error(await res.text());return res.json();},{route,body});
 await request('/api/workspaces',{name:'Team fixture',rootPath:data});
 await page.getByRole('button',{name:'Team fixture',exact:true}).click();
 // Exercise installer UI only with controlled HTTP fixtures. No packages are installed.
 const catalog=await request('/api/clis');let installed=false,jobs=[],attempt=0;
 await page.route('**/api/clis',route=>route.fulfill({json:catalog.map(c=>c.id==='codex'?{...c,available:installed,installerReady:true}:c)}));
 await page.route('**/api/cli-installs',route=>route.fulfill({json:jobs}));
 await page.route('**/api/clis/codex/install',route=>{attempt++;jobs=[{id:`fixture-${attempt}`,cliId:'codex',status:'running',log:'Fixture npm install'}];return route.fulfill({json:jobs[0]});});
 await page.route('**/api/cli-installs/*/cancel',route=>{jobs[0].status='cancelled';return route.fulfill({json:{success:true}});});
 await page.getByRole('button',{name:'สร้าง session',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'ตรวจสอบอีกครั้ง',exact:true}).click();
 await dialog.getByRole('button',{name:'ติดตั้ง Codex',exact:true}).click();
 await dialog.getByRole('button',{name:'ยกเลิกการติดตั้ง',exact:true}).click();
 await dialog.getByRole('button',{name:'ติดตั้ง Codex',exact:true}).click();
 installed=true;jobs[0].status='completed';
 await dialog.getByText('Codex · ติดตั้งสำเร็จ',{exact:true}).waitFor();
 assert.equal(attempt,2);passed.push('install, cancel, retry and refresh UI');
 await dialog.getByRole('button',{name:'ยกเลิก',exact:true}).click();
 await page.getByRole('navigation', { name: 'โหมดทำงาน' }).getByRole('button', { name: 'Agent', exact: true }).click();
 const seats=[['Main','leader-fixture'],['Sub-agent 1','coder-fixture'],['Sub-agent 2','reviewer-fixture']];
 for(const [label,model] of seats){
  await page.getByLabel(`ผู้ให้บริการของ${label}`,{exact:true}).selectOption('ollama');
  await page.getByLabel(`model ของ${label}`,{exact:true}).fill(model);
 }
 await page.reload();await page.getByRole('navigation', { name: 'โหมดทำงาน' }).getByRole('button', { name: 'Agent', exact: true }).click();await page.getByLabel('model ของMain',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('model ของSub-agent 1',{exact:true}).inputValue(),'coder-fixture');passed.push('per-project Agent team persisted');
 await page.getByLabel('คำสั่ง',{exact:true}).fill('สร้างและตรวจงานทดสอบ');await page.getByTitle('ส่งคำสั่ง (Enter)',{exact:true}).click();
 await page.getByText('สรุปผลจากหัวหน้า TEAM_COMPLETE',{exact:true}).waitFor({timeout:30000});
 assert.deepEqual(calls.map(c=>c.model),['leader-fixture','coder-fixture','reviewer-fixture','leader-fixture']);
 assert.ok(calls[2].prompt.includes('CODER_RESULT_ACTUAL'));
 assert.ok(calls[3].prompt.includes('CODER_RESULT_ACTUAL')&&calls[3].prompt.includes('REVIEW_RESULT_ACTUAL'));
 assert.equal(await page.locator('.task-board li').count(),2);
 assert.equal(await page.locator('.agent-card').count(),3);passed.push('Main plans, Sub-agents work, Main reports through HTTP');
 await page.locator('.conversation-scroll').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:path.join(data,'agent-desktop.png')});
 // Chat: one prompt to two Mains, then a summarizer that credits both.
 await page.getByRole('navigation', { name: 'โหมดทำงาน' }).getByRole('button', { name: 'Chat', exact: true }).click();
 const chatSeats=[['Main 1','coder-fixture'],['Main 2','reviewer-fixture'],['ผู้สรุป','leader-fixture']];
 while(await page.getByTitle('เอาMain 3ออก',{exact:true}).count())await page.getByTitle('เอาMain 3ออก',{exact:true}).click();
 if(!await page.getByLabel('model ของMain 2',{exact:true}).count())await page.getByRole('button',{name:/เพิ่ม Main/}).click();
 if(!await page.getByLabel('model ของผู้สรุป',{exact:true}).count())await page.getByLabel('ให้ AI สรุปผลรวม').check();
 for(const [label,model] of chatSeats){
  await page.getByLabel(`ผู้ให้บริการของ${label}`,{exact:true}).selectOption('ollama');
  await page.getByLabel(`model ของ${label}`,{exact:true}).fill(model);
 }
 calls.length=0;
 await page.getByLabel('คำสั่ง',{exact:true}).fill('ควรใช้ภาษาอะไรดี');await page.getByTitle('ส่งคำสั่ง (Enter)',{exact:true}).click();
 await page.getByText('CHAT_SUMMARY จาก Main 1 และ Main 2',{exact:true}).waitFor({timeout:30000});
 assert.equal(await page.locator('.answer-card').count(),2);
 assert.ok(calls.at(-1).prompt.includes('CODER_RESULT_ACTUAL')&&calls.at(-1).prompt.includes('REVIEW_RESULT_ACTUAL'));
 passed.push('Chat asks several AIs and summarizes with attribution');
 await page.screenshot({path:path.join(data,'chat-desktop.png')});
 assert.deepEqual(errors,[]);passed.push('no renderer errors');console.log(JSON.stringify({passed,screenshots:data}));
}finally{await app.close();await new Promise(resolve=>service.close(resolve));}
