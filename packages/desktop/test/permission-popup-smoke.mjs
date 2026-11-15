// Exercise the real Electron UI and server against a deterministic Claude-compatible process.
import { _electron as electron } from 'playwright-core';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
// CliCatalog gives managed/user CLI directories priority over PATH. Never run this fixture
// if a real Claude in one of those directories would intercept the test prompts.
const userDirectory = os.homedir();
const earlyDirs = [path.join(userDirectory, '.opencode-multi', 'cli-tools', ...(process.platform === 'win32' ? [] : ['bin'])), path.join(userDirectory, '.opencode-multi', 'node-v22', ...(process.platform === 'win32' ? [] : ['bin'])), path.join(userDirectory, '.local', 'bin'), path.join(userDirectory, '.claude', 'local'), path.join(userDirectory, '.config', 'manicode'), path.join(userDirectory, '.opencode', 'bin')];
if (process.platform === 'win32') earlyDirs.push(path.join(process.env.LOCALAPPDATA || path.join(userDirectory, 'AppData', 'Local'), 'agy', 'bin'));
for (const dir of earlyDirs) for (const suffix of process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']) {
  try { if ((await fs.stat(path.join(dir, `claude${suffix}`))).isFile()) throw new Error(`Smoke test requires the fixture to be the first Claude CLI; found ${path.join(dir, `claude${suffix}`)}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'superai-permission-smoke-'));
const bin = path.join(root, 'bin'); await fs.mkdir(bin);
const record = path.join(root, 'answer.json');
const fake = `#!${process.execPath}\nconst fs=require('fs'),readline=require('readline');\nif(process.argv[2]==='auth'){console.log(JSON.stringify({loggedIn:true}));process.exit()}\nif(process.argv.includes('--version')){console.log('2.0.0');process.exit()}\nlet count=0;readline.createInterface({input:process.stdin}).on('line',line=>{let m;try{m=JSON.parse(line)}catch{return}if(m.type==='user'){count++;console.log(JSON.stringify({type:'control_request',request_id:'test-request-'+count,request:{subtype:'can_use_tool',tool_name:'Bash',input:{command:'echo PERMISSION_TEST'}}}))}else if(m.type==='control_response'){fs.writeFileSync(${JSON.stringify(record)},JSON.stringify(m));console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,result:'เรียบร้อย'}))}});\n`;
if (process.platform === 'win32') {
  await fs.writeFile(path.join(bin, 'fake-claude.cjs'), fake);
  await fs.writeFile(path.join(bin, 'claude.cmd'), `@"${process.execPath}" "%~dp0fake-claude.cjs" %*\r\n`);
} else await fs.writeFile(path.join(bin, 'claude'), fake, { mode: 0o755 });
const data = path.join(root, 'data');
const launch = () => electron.launch({executablePath: require('electron'), args:['packages/desktop'], env:{SUPERAI_LANG: 'th', ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, SUPERAI_DATA_DIR:data, SUPERAI_TEST_MODE:'1'}, timeout:60000});
const ready = async app => {const page=await app.firstWindow();await page.waitForSelector('.app-shell');await page.evaluate(()=>localStorage.setItem('superai-setup-dismissed','1'));return page};
const post = (page, route, body) => page.evaluate(async ({route,body})=>{const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json()}, {route,body});
let app;
try {
 app=await launch();let page=await ready(app);
 const ws=await post(page,'/api/workspaces',{name:'Permission test',rootPath:root});
 const session=await post(page,'/api/terminals/spawn',{wsId:ws.id,agentType:'claude-code',name:'Permission test',view:'chat',trustFolder:false});
 await page.evaluate(id=>{localStorage.setItem('superai-workspace',id);localStorage.setItem('superai-mode','code')},ws.id);
 await app.close(); app=await launch(); page=await ready(app);
 await page.waitForSelector('.chat-view');
 await post(page,`/api/terminals/${session.id}/chat`,{text:'ขอทดสอบ',permission:'ask',includeProjectContext:false});
 const popup=page.getByRole('dialog',{name:'Permission test ขออนุญาต'});
 await popup.waitFor({state:'visible',timeout:30000});
 assert.match(await popup.innerText(),/echo PERMISSION_TEST/);
 await popup.getByRole('button',{name:'อนุญาต',exact:true}).click();
 await popup.waitFor({state:'hidden',timeout:10000});
 let answer;for(let i=0;i<100;i++){try{answer=JSON.parse(await fs.readFile(record,'utf8'));break}catch{await new Promise(r=>setTimeout(r,100))}}
 assert.equal(answer.response.request_id,'test-request-1');assert.equal(answer.response.response.behavior,'allow');
 assert.equal(answer.response.response.updatedInput.command,'echo PERMISSION_TEST');
 await page.waitForFunction(async id=>{const r=await fetch(`/api/terminals/${id}/chat`);return !(await r.json()).running},session.id);
 await post(page,`/api/terminals/${session.id}/chat`,{text:'ทดสอบการปฏิเสธ',permission:'ask',includeProjectContext:false});
 await popup.waitFor({state:'visible',timeout:30000});
 await popup.getByRole('button',{name:'ปิดหน้าต่างคำขอ'}).click();
 await popup.waitFor({state:'hidden'});
 assert.ok(await page.getByRole('status').filter({hasText:'รอการอนุญาต'}).isVisible());
 await page.locator('.chat-scroll .chat-permission.pending').getByRole('button',{name:'ไม่อนุญาต',exact:true}).click();
 for(let i=0;i<100;i++){answer=JSON.parse(await fs.readFile(record,'utf8'));if(answer.response.request_id==='test-request-2')break;await new Promise(r=>setTimeout(r,100))}
 assert.equal(answer.response.request_id,'test-request-2');assert.equal(answer.response.response.behavior,'deny');
 console.log('PASS: popup Allow and dismissed-card Deny reached the Claude protocol');
} finally {if(app)await app.close();await fs.rm(root,{recursive:true,force:true})}
