import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalSessionManager} from '../server/TerminalSessionManager.js';
test('closing a piped CLI kills descendants before releasing Freebuff capacity',async()=>{
 const manager=new TerminalSessionManager();let descendant=0;
 try{
  const code=`const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});console.log('CHILD:'+c.pid);setInterval(()=>{},1000);`;
  const session=manager.spawnSession({agentType:'freebuff',command:process.execPath,args:['-e',code],forcePipe:true});
  for(let i=0;i<100&&!session.bufferedOutput.includes('CHILD:');i++)await new Promise(r=>setTimeout(r,30));
  descendant=Number(session.bufferedOutput.match(/CHILD:(\d+)/)?.[1]);assert.ok(descendant);
  manager.killSession(session.id);
  assert.throws(()=>manager.spawnSession({agentType:'freebuff'}),/1 session/);
  for(let i=0;i<150&&manager.getSession(session.id);i++)await new Promise(r=>setTimeout(r,30));
  assert.equal(manager.getSession(session.id),undefined);
  assert.throws(()=>process.kill(descendant,0));
 }finally{manager.killAll();if(descendant)try{process.kill(descendant);}catch{}}
});
