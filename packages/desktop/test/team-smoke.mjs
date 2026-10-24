import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { stepper, withTimeout, watchPage, closeApp, watchdog, snapshot } from './smoke-harness.mjs';
const require=createRequire(import.meta.url);
await fs.mkdir('output',{recursive:true});
const data=await fs.mkdtemp(path.resolve('output','team-check-'));
const git=(...args)=>execFileSync('git',args,{cwd:data,windowsHide:true});
await fs.writeFile(path.join(data,'.gitignore'),'*\n!sample.txt\n!.gitignore\n');
await fs.writeFile(path.join(data,'sample.txt'),'before\n');git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.com','commit','-m','fixture');await fs.writeFile(path.join(data,'sample.txt'),'after\n');
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
const steps=stepper('team');let page,failure=null;
watchdog(150000,steps,()=>page&&snapshot(page,path.join(data,'watchdog.png'),steps));
steps.step('launch app');
const app=await electron.launch({executablePath:require('electron'),args:['packages/desktop'],env:{...process.env,SUPERAI_DATA_DIR:data,SUPERAI_OLLAMA_URL:`http://127.0.0.1:${service.address().port}`,SUPERAI_TEST_MODE:'1'},timeout:60000});
const passed=[],errors=[];
try{
 steps.step('first window');page=await app.firstWindow();page.on('pageerror',e=>{errors.push(e.message);steps.log(`pageerror: ${e.message}`);});watchPage(page,steps);
  // Hold the first font so the reload below always lands before the first load finishes (as Ctrl+R
  // on a slow first start does). That aborts the main process's loadURL, which must not quit the app.
  let releaseFont;const fontHeld=new Promise(r=>releaseFont=r);let heldFont=false;
  await page.route('**/*.woff2',async route=>{if(!heldFont){heldFont=true;await fontHeld;}await route.continue();});
  await page.waitForSelector('.app-shell'); // Setup guide is covered by smoke.mjs.
  await page.evaluate(() => localStorage.setItem('superai-setup-dismissed', '1'));
  const reloaded=page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });releaseFont();await reloaded;await page.unroute('**/*.woff2');await page.waitForSelector('.app-shell');
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.unmaximize();w.setContentSize(1100,760);});
 // page.evaluate has no timeout of its own; a stuck server must fail the step, not hang the job.
 const request=(route,body)=>withTimeout(page.evaluate(async({route,body})=>{const res=await fetch(route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);if(!res.ok)throw new Error(await res.text());return res.json();},{route,body}),20000,`request ${route}`);
 steps.step('installer UI');
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
 steps.step('Agent team setup');
 await page.getByRole('navigation', { name: 'โหมดทำงาน' }).getByRole('button', { name: 'Agent', exact: true }).click();
 await page.getByRole('button', { name: 'ตั้งค่าทีม Agent', exact: true }).click();
 const seats=[['Main','leader-fixture'],['Sub-agent 1','coder-fixture'],['Sub-agent 2','reviewer-fixture']];
 for(const [label,model] of seats){
  await page.getByLabel(`ผู้ให้บริการของ${label}`,{exact:true}).selectOption('ollama');
  await page.getByLabel(`model ของ${label}`,{exact:true}).fill(model);
 }
 await page.getByRole('button', { name: 'บันทึกทีม', exact: true }).click();
 await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });await page.getByRole('navigation', { name: 'โหมดทำงาน' }).getByRole('button', { name: 'Agent', exact: true }).click();await page.getByRole('button', { name: 'ตั้งค่าทีม Agent', exact: true }).click();await page.getByLabel('model ของMain',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('model ของSub-agent 1',{exact:true}).inputValue(),'coder-fixture');passed.push('per-project Agent team persisted');await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
 steps.step('Agent run');
 await page.getByLabel('คำสั่ง',{exact:true}).fill('สร้างและตรวจงานทดสอบ');await page.getByTitle('ส่งคำสั่ง (Enter)',{exact:true}).click();
 await page.getByText('สรุปผลจากหัวหน้า TEAM_COMPLETE',{exact:true}).waitFor({timeout:30000});
 assert.deepEqual(calls.map(c=>c.model),['leader-fixture','coder-fixture','reviewer-fixture','leader-fixture']);
 assert.ok(calls[2].prompt.includes('CODER_RESULT_ACTUAL'));
 assert.ok(calls[3].prompt.includes('CODER_RESULT_ACTUAL')&&calls[3].prompt.includes('REVIEW_RESULT_ACTUAL'));
 assert.equal(await page.locator('.task-board li').count(),2);
 assert.equal(await page.locator('.agent-card').count(),3);passed.push('Main plans, Sub-agents work, Main reports through HTTP');
 await page.locator('.conversation-scroll').evaluate(el=>el.scrollTop=0);
 const teamVisible = await page.locator('.conversation-scroll').evaluate(el => {
   const bottom = el.getBoundingClientRect().bottom;
   return [...el.querySelectorAll('.inspect-agent')].every(button => button.getBoundingClientRect().bottom <= bottom);
 });
 assert.ok(teamVisible, 'all three team detail buttons must fit above the composer at 1100x760');
 assert.equal(await page.locator('.composer-suggestions').count(),0,'generic suggestions must not return to the composer');
 await page.getByRole('button', {name: 'ดูรายละเอียด Sub-agent 1', exact:true}).click();
 await page.getByRole('complementary',{name:'รายละเอียด Sub-agent 1'}).getByText('CODER_RESULT_ACTUAL',{exact:true}).waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.mission-inspector').count(),0);
 await page.locator('.conversation-scroll').evaluate(el=>el.scrollTop=0);
 passed.push('team details visible on laptop, quiet composer and inspector close');
 await page.screenshot({path:path.join(data,'agent-desktop.png')});
 const firstRun=page.locator('.conversation-run').first();
 await firstRun.getByRole('button',{name:'สร้างคำตอบใหม่',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.conversation-run').length===2);
 await page.waitForFunction(()=>[...document.querySelectorAll('.run-stage')].filter(el=>el.textContent.includes('ทีมทำงานเสร็จแล้ว')).length===2);
 await page.locator('.conversation-run').last().getByRole('button',{name:'ตัวเลือกคำตอบ',exact:true}).click();
 await page.locator('.conversation-run').last().getByRole('button',{name:'แก้ไขข้อความต้นฉบับ',exact:true}).click();
 assert.equal(await page.getByLabel('คำสั่ง',{exact:true}).inputValue(),'สร้างและตรวจงานทดสอบ');
 await page.getByRole('button',{name:'ค้นหาประวัติ',exact:true}).click();
 const history=page.getByRole('dialog',{name:'ค้นหาประวัติบทสนทนา'});
 await history.getByLabel('ค้นหาประวัติบทสนทนา').fill('TEAM_COMPLETE');
 await history.locator('.history-results button').first().waitFor();
 await page.screenshot({path:path.join(data,'history.png')});
 await history.locator('.history-results button').first().click();
 await history.waitFor({state:'hidden'});
 // This read-only team did not edit files. Inspect the fixture's own project changes separately.
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('superai:show-changes')));
 const changes=page.getByRole('dialog',{name:'ไฟล์ที่เปลี่ยนและผลงาน'});
 await changes.getByRole('button',{name:'sample.txt',exact:true}).click();
 await changes.getByText('+after',{exact:false}).waitFor();
 await page.screenshot({path:path.join(data,'changes.png')});
 await changes.getByRole('button',{name:'เปิดไฟล์',exact:true}).click();
 assert.equal(await changes.locator('pre').textContent(),'after\n');
 await changes.getByRole('button',{name:'เปิด Preview',exact:true}).click();
 await changes.waitFor({state:'hidden'});
 passed.push('retry original run, edit draft, search saved history, actual Git diff/file and Preview');
 steps.step('Chat run');
 // Chat: one prompt to two Mains, then a summarizer that credits both.
 await page.getByRole('navigation', { name: 'โหมดทำงาน' }).getByRole('button', { name: 'Chat', exact: true }).click();
 await page.getByRole('button', { name: 'ตั้งค่าทีม Chat', exact: true }).click();
 const chatSeats=[['Main 1','coder-fixture'],['Main 2','reviewer-fixture'],['ผู้สรุป','leader-fixture']];
 while(await page.getByTitle('เอาMain 3ออก',{exact:true}).count())await page.getByTitle('เอาMain 3ออก',{exact:true}).click();
 if(!await page.getByLabel('model ของMain 2',{exact:true}).count())await page.getByRole('button',{name:/เพิ่ม Main/}).click();
 if(!await page.getByLabel('model ของผู้สรุป',{exact:true}).count())await page.getByLabel('ให้ AI สรุปผลรวม').check();
 for(const [label,model] of chatSeats){
  await page.getByLabel(`ผู้ให้บริการของ${label}`,{exact:true}).selectOption('ollama');
  await page.getByLabel(`model ของ${label}`,{exact:true}).fill(model);
 }
 await page.getByRole('button', { name: 'บันทึกทีม', exact: true }).click();
 calls.length=0;
 await page.getByLabel('คำสั่ง',{exact:true}).fill('ควรใช้ภาษาอะไรดี');await page.getByTitle('ส่งคำสั่ง (Enter)',{exact:true}).click();
 await page.getByText('CHAT_SUMMARY จาก Main 1 และ Main 2',{exact:true}).waitFor({timeout:30000});
 assert.equal(await page.locator('.answer-card').count(),2);
 assert.ok(calls.at(-1).prompt.includes('CODER_RESULT_ACTUAL')&&calls.at(-1).prompt.includes('REVIEW_RESULT_ACTUAL'));
 passed.push('Chat asks several AIs and summarizes with attribution');
 await page.screenshot({path:path.join(data,'chat-desktop.png')});
 assert.deepEqual(errors,[]);passed.push('no renderer errors');console.log(JSON.stringify({passed,screenshots:data}));
}catch(error){
 // Report before cleanup: if closing the app hangs, the cause is already in the log.
 failure=error;steps.log(`FAILED at step "${steps.current}": ${error?.stack||error}`);
 if(page)await snapshot(page,path.join(data,'failure.png'),steps);
}finally{
 steps.step('close app');await closeApp(app,steps);await new Promise(resolve=>service.close(()=>resolve()));
 process.exit(failure?1:0);
}
