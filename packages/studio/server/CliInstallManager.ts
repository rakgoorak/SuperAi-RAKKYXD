import { spawn, execFileSync, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { cliPath, findExecutable, getCliDefinition, INSTALL_PACKAGES, managedCliPrefix } from './CliCatalog.js';
export interface InstallJob { id:string; cliId:string; status:'running'|'completed'|'failed'|'cancelled'; log:string; error?:string; }
export class CliInstallManager {
  private jobs = new Map<string,InstallJob>();
  private child: ChildProcess | null = null;
  private stopCurrent: (()=>void) | null = null;
  list() { return [...this.jobs.values()]; }
  constructor(private dependencies = { find:findExecutable, spawn, prefix:managedCliPrefix(), timeout:600000, version:(node:string)=>execFileSync(node,['-p','process.versions.node'],{encoding:'utf8',timeout:5000,windowsHide:true}).trim() }) {}
  start(cliId:string) {
    const cli=getCliDefinition(cliId), pkg=INSTALL_PACKAGES[cliId];
    if(!pkg) throw new Error('Terminal มาพร้อมระบบปฏิบัติการ ไม่ต้องติดตั้ง');
    if(this.child) throw new Error('กำลังติดตั้งเครื่องมืออื่น กรุณารอหรือยกเลิกก่อน');
    if(this.dependencies.find(cli.command)) throw new Error('เครื่องมือนี้ติดตั้งแล้ว กดตรวจสอบอีกครั้งได้');
    const node=this.dependencies.find('node'), npm=this.dependencies.find('npm');
    if(!node || !npm) throw new Error('ต้องติดตั้ง Node.js 22+ และ npm ก่อน แล้วเปิดโปรแกรมใหม่');
    if(Number(this.dependencies.version(node).split('.')[0])<22) throw new Error('ต้องใช้ Node.js 22 ขึ้นไป');
    const real=fs.realpathSync(npm);
    const entry=[real.endsWith('.js')?real:'',path.join(path.dirname(real),'node_modules/npm/bin/npm-cli.js'),path.resolve(path.dirname(real),'../lib/node_modules/npm/bin/npm-cli.js')].find(p=>p && fs.existsSync(p));
    if(!entry) throw new Error('หา npm-cli.js ไม่พบ กรุณาติดตั้ง Node.js/npm ใหม่');
    fs.mkdirSync(this.dependencies.prefix,{recursive:true});
    if(this.jobs.size>20) for(const [id,j] of this.jobs) if(j.status!=='running') this.jobs.delete(id);
    const job:InstallJob={id:randomUUID(),cliId,status:'running',log:`ติดตั้ง ${pkg} จาก npm registry\n`}; this.jobs.set(job.id,job);
    const child=this.dependencies.spawn(node,[entry,'install','--global','--prefix',this.dependencies.prefix,`${pkg}@latest`,'--registry=https://registry.npmjs.org','--no-fund','--no-audit'],{windowsHide:true,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe'],env:{...process.env,PATH:cliPath()}});
    this.child=child;
    const append=(chunk:Buffer)=> {job.log=(job.log+chunk.toString()).slice(-20000);};
    child.stdout?.on('data',append); child.stderr?.on('data',append);
    const kill=()=> {
      if(!child.pid) return;
      if(process.platform==='win32') { const killer=spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}); killer.on('error',()=>child.kill()); killer.on('close',code=>{if(code)child.kill();}); }
      else try {process.kill(-child.pid,'SIGKILL');} catch {child.kill();}
    };
    this.stopCurrent=kill;
    const timer=setTimeout(()=>{job.error='ติดตั้งเกินเวลาที่กำหนด กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่';kill();},this.dependencies.timeout);
    child.on('error',e=>{job.error=e.message;job.status='failed';clearTimeout(timer);if(this.child===child){this.child=null;this.stopCurrent=null;}});
    child.on('close',code=>{
      clearTimeout(timer); if(this.child===child){this.child=null;this.stopCurrent=null;}
      if(job.status==='cancelled') return;
      if(job.error || code!==0 || !this.dependencies.find(cli.command)){job.status='failed';job.error=job.error || (code===0?'ติดตั้งเสร็จแต่ยังหา executable ไม่พบ กรุณาตรวจ log':`ติดตั้งไม่สำเร็จ (exit ${code})`);}
      else {job.status='completed';job.log+='\nติดตั้งสำเร็จ · เปิด CLI เพื่อเข้าสู่ระบบด้วยบัญชีของคุณ';}
    });
    return job;
  }
  cancel(id:string) { const job=this.jobs.get(id); if(!job || job.status!=='running') return false; job.status='cancelled';this.stopCurrent?.();return true; }
  stop() { const job=this.list().find(j=>j.status==='running');if(job)this.cancel(job.id); }
}
