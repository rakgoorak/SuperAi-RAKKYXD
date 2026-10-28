import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CliChatManager } from '../server/CliChat.js';
const wait = async (f:()=>boolean) => { for(let n=0;n<500&&!f();n++) await new Promise(r=>setTimeout(r,10)); assert.ok(f()); };
test('OpenCode server receives a permission reply over authenticated localhost and closes after the turn',async()=>{
 let eventStream:http.ServerResponse|undefined, answer:any, expected='';
 const server=http.createServer(async(req,res)=>{
  if(req.headers.authorization!==expected){res.writeHead(401).end();return;}
  if(req.url==='/event'){res.writeHead(200,{'Content-Type':'text/event-stream'});eventStream=res;res.write('data: {"type":"server.connected","properties":{}}\n\n');return;}
  if(req.url==='/session'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({id:'ses-1'}));return;}
  if(req.url==='/session/ses-1/prompt_async'){
   res.writeHead(204).end();
   eventStream!.write('data: '+JSON.stringify({type:'session.status',properties:{sessionID:'ses-1',status:{type:'busy'}}})+'\n\n');
   eventStream!.write('data: '+JSON.stringify({type:'permission.asked',properties:{sessionID:'ses-1',id:'perm-1',permission:'bash',metadata:{command:'echo test'}}})+'\n\n');return;
  }
  if(req.url==='/permission/perm-1/reply'){
   let body='';for await(const chunk of req)body+=chunk;answer=JSON.parse(body);res.writeHead(200,{'Content-Type':'application/json'}).end('true');
   setTimeout(()=>eventStream?.write('data: '+JSON.stringify({type:'session.idle',properties:{sessionID:'ses-1'}})+'\n\n'),20);return;
  }
  res.writeHead(404).end();
 });
 const proc:any=new EventEmitter();proc.stdin=new PassThrough();proc.stdout=new PassThrough();proc.stderr=new PassThrough();
 proc.kill=()=>{eventStream?.end();server.close(()=>proc.emit('close',0));return true;};
 const spawn=(_command:string,args:string[],options:any)=>{
  assert.equal(args[0],'serve');const port=Number(args[args.indexOf('--port')+1]);
  assert.ok(options.env.OPENCODE_SERVER_PASSWORD.length>=40);
  expected='Basic '+Buffer.from('superai:'+options.env.OPENCODE_SERVER_PASSWORD).toString('base64');
  server.listen(port,'127.0.0.1',()=>proc.stdout.write(`opencode server listening on http://127.0.0.1:${port}\n`));return proc;
 };
 const chats=new CliChatManager(spawn as any,undefined,((_id:string,args:string[])=>({command:'opencode',args})) as any);
 try{
  chats.send('room',{agent:'opencode',cwd:process.cwd(),text:'test',permission:'ask'});
  await wait(()=>chats.snapshot('room').items.some(i=>i.kind==='permission'));
  const card=chats.snapshot('room').items.find(i=>i.kind==='permission')!;assert.equal(card.kind,'permission');if(card.kind!=='permission')return;
  assert.equal(await chats.answerPermissionAsync('room',card.requestId,'always'),false);
  assert.equal(card.detail,'echo test');assert.equal(await chats.answerPermissionAsync('room',card.requestId,'allow'),true);
  assert.deepEqual(answer,{reply:'once'});await wait(()=>!chats.isRunning('room'));
  assert.equal(await chats.answerPermissionAsync('room',card.requestId,'deny'),false);
 }finally{chats.stopAll();server.close();}
});

test('a failed OpenCode reply expires the request and stops the waiting server',async()=>{
 let stream:http.ServerResponse|undefined, expected='';
 const server=http.createServer(async(req,res)=>{
  if(req.headers.authorization!==expected){res.writeHead(401).end();return;}
  if(req.url==='/event'){res.writeHead(200,{'Content-Type':'text/event-stream'});stream=res;res.write('data: {"type":"server.connected","properties":{}}\n\n');return;}
  if(req.url==='/session'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"id":"s"}');return;}
  if(req.url==='/session/s/prompt_async'){res.writeHead(204).end();stream!.write('data: {"type":"session.status","properties":{"sessionID":"s","status":{"type":"busy"}}}\n\ndata: {"type":"permission.asked","properties":{"sessionID":"s","id":"p","permission":"bash","patterns":["echo test"]}}\n\n');return;}
  if(req.url==='/permission/p/reply'){res.writeHead(200,{'Content-Type':'application/json'}).end('false');return;}
  res.writeHead(404).end();
 });
 const proc:any=new EventEmitter();proc.stdin=new PassThrough();proc.stdout=new PassThrough();proc.stderr=new PassThrough();
 proc.kill=()=>{stream?.end();server.close(()=>proc.emit('close',0));return true};
 const spawn=(_cmd:string,args:string[],opts:any)=>{expected='Basic '+Buffer.from('superai:'+opts.env.OPENCODE_SERVER_PASSWORD).toString('base64');const port=Number(args[args.indexOf('--port')+1]);server.listen(port,'127.0.0.1',()=>proc.stdout.write(`opencode server listening on http://127.0.0.1:${port}\n`));return proc};
 const chats=new CliChatManager(spawn as any,undefined,((_id:string,args:string[])=>({command:'opencode',args})) as any);
 try{
  chats.send('room',{agent:'opencode',cwd:process.cwd(),text:'test',permission:'ask'});
  await wait(()=>chats.snapshot('room').items.some(i=>i.kind==='permission'));
  const item=chats.snapshot('room').items.find(i=>i.kind==='permission')!;if(item.kind!=='permission')throw Error('missing permission');
  assert.equal(await chats.answerPermissionAsync('room',item.requestId,'allow'),false);
  await wait(()=>!chats.isRunning('room'));
  assert.equal((chats.snapshot('room').items.find(i=>i.id===item.id) as any).status,'expired');
  assert.ok(chats.snapshot('room').items.some(i=>i.kind==='error'));
 }finally{chats.stopAll();server.close();}
});
