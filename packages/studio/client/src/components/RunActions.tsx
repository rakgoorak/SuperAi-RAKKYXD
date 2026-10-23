import { useState } from 'react';
import { post, type Run } from '../api';
import { prepareMessage, recoveryHint, showChanges } from '../recovery';
export function RunActions({ run, blocked }: { run: Run; blocked: boolean }) {
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const retry=async()=>{setPending(true);setError('');try{
    await post(`/api/conversations/${run.wsId}`,{mode:run.mode,prompt:run.prompt,attachments:run.attachments || [],allowTools:run.allowTools,main:run.main,subagents:run.subagents,panel:run.panel?.map(answer=>answer.seat),summarizer:run.summarizer,summaryStyle:run.summaryStyle});
    window.dispatchEvent(new Event('superai:refresh-runs'));
  }catch(e){setError((e as Error).message);}finally{setPending(false);}};
  return <div className="run-recovery">{run.error&&<p>{recoveryHint(run.error)}</p>}<small>ลองใหม่จะสร้างรอบใหม่ด้วยทีมและสิทธิ์เดิม{run.allowTools ? " · อนุญาตให้แก้ไฟล์และรันคำสั่ง" : ""}</small><div className="recovery-actions"><button disabled={pending||blocked} onClick={()=>void retry()}>ลองใหม่</button><button disabled={pending||blocked} onClick={()=>prepareMessage(run.prompt)}>แก้ข้อความแล้วส่งใหม่</button><button onClick={()=>showChanges()}>ไฟล์ที่เปลี่ยน / Preview</button>{run.error&&<button onClick={()=>window.dispatchEvent(new Event('superai:open-setup'))}>ตรวจบัญชีและเครื่องมือ</button>}</div>{run.attachments?.length? <small>ลองใหม่ใช้ไฟล์แนบเดิม · หากแก้ข้อความ กรุณาแนบไฟล์ใหม่</small>:null}{error&&<p role="alert">{recoveryHint(error)}<br/>{error}</p>}</div>;
}
