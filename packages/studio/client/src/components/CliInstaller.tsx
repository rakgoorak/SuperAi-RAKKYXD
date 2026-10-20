import { useEffect, useState } from 'react';
import { Download, ExternalLink, LoaderCircle, X } from 'lucide-react';
import { api, post, type Cli } from '../api';
interface Job {id:string;cliId:string;status:string;log:string;error?:string;}
export function CliInstaller({clis,onRefresh,onError}:{clis:Cli[];onRefresh:()=>Promise<void>;onError:(message:string)=>void}) {
  const [jobs,setJobs]=useState<Job[]>([]),[starting,setStarting]=useState('');
  const [selected,setSelected]=useState('');
  useEffect(()=> {
    let ended=false,pending=false,last='';
    const read=async()=>{
      if(pending)return;pending=true;
      try { const data=await api<Job[]>('/api/cli-installs');if(ended)return;setJobs(data);
        const signature=data.map(j=>j.id+j.status).join();
        if(signature!==last){last=signature;await onRefresh();}
      } catch(e) {if(!ended)onError((e as Error).message);} finally {pending=false;}
    };
    void read();const timer=setInterval(read,1000);return()=>{ended=true;clearInterval(timer);};
  },[onRefresh,onError]);
  const start=async(id:string)=>{
    setStarting(id);
    try {const job=await post<Job>(`/api/clis/${id}/install`);setJobs(current=>[...current,job]);setSelected(job.id);}catch(e){onError((e as Error).message);}finally{setStarting('');}
  };
  const job=jobs.find(j=>j.id===selected)||jobs[jobs.length-1];
  return <section className="cli-installer" aria-label="ติดตั้งเครื่องมือ CLI"><h3><Download size={14}/>ติดตั้งเครื่องมือที่ยังไม่มี</h3>
    <div className="install-buttons">{clis.filter(c=>!c.available&&c.installPackage).map(c=><button className="secondary compact" key={c.id} disabled={!c.installerReady||!!starting||jobs.some(j=>j.status==='running')} onClick={()=>void start(c.id)}><Download size={13}/>{starting===c.id?'กำลังเริ่ม…':`ติดตั้ง ${c.name}`}</button>)}
      {clis.every(c=>c.available)&&<p>เครื่องมือทั้งหมดพร้อมเปิด session</p>}
      {clis.some(c=>!c.available&&c.installPackage&&!c.installerReady)&&<button className="text-button" onClick={()=>window.superai?void window.superai.openExternal('https://nodejs.org/en/download').catch(e=>onError(e.message)):window.open('https://nodejs.org/en/download','_blank','noopener,noreferrer')}><ExternalLink size={13}/>ติดตั้ง Node.js 22+ ก่อน</button>}
      <button className="text-button" onClick={()=>void onRefresh().catch(e=>onError(e.message))}>ตรวจสอบอีกครั้ง</button>
    </div>
    <p className="team-footnote">ติดตั้งจากแพ็กเกจทางการลงโฟลเดอร์ส่วนตัวของ SuperAi · ต้องมี Node.js 22+ / npm · หลังติดตั้งให้เปิด CLI เพื่อล็อกอิน</p>
    {job&&<details className="install-log" open><summary>{clis.find(c=>c.id===job.cliId)?.name} · {({running:'กำลังติดตั้ง',completed:'ติดตั้งสำเร็จ',failed:'ติดตั้งไม่สำเร็จ',cancelled:'ยกเลิกแล้ว'} as Record<string,string>)[job.status]}</summary>
      <pre>{job.log}</pre>{job.error&&<p role="alert">{job.error}</p>}{job.status==='running'&&<button className="text-button" onClick={()=>void post(`/api/cli-installs/${job.id}/cancel`).catch(e=>onError(e.message))}><LoaderCircle size={13} className="spin"/><X size={13}/>ยกเลิกการติดตั้ง</button>}
    </details>}
  </section>;
}
