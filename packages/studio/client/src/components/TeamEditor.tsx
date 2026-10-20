import { useEffect, useState } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import type { AgentTeam, Cli, Run, TeamRole, TeamSeat } from '../api';
const labels:Record<TeamRole,string>={coder:'เขียนโค้ด',tester:'ทดสอบ',reviewer:'ตรวจงาน'};
export function TeamEditor({workspaceId,clis,models,openCodeModels,provider,override,disabled,onChange,onError,discover}: {
  workspaceId:string;clis:Cli[];models:string[];openCodeModels:string[];provider:string;override:string;disabled:boolean;
  onChange:(team:AgentTeam)=>void;onError:(text:string)=>void;discover:()=>void;
}) {
  const [team,setTeam]=useState<AgentTeam>(()=> {
    try { const saved=JSON.parse(localStorage.getItem(`superai-team-v1:${workspaceId}`)||'null');
      if(saved && saved.leader && Array.isArray(saved.members) && saved.members.length<=3 && [saved.leader,...saved.members].every(s=>typeof s.name==='string' && typeof s.provider==='string' && typeof s.model==='string') && saved.members.every((m:any)=>Object.prototype.hasOwnProperty.call(labels,m.role))) return saved;
    } catch {}
    const seat={provider,model:provider==='cli:opencode' && override!=='auto'?override:'',name:'หัวหน้าทีม'};
    return {leader:seat,members:(Object.keys(labels) as TeamRole[]).map(role=>({...seat,role,name:labels[role]}))};
  });
  useEffect(()=> {
    onChange(team);
    try {localStorage.setItem(`superai-team-v1:${workspaceId}`,JSON.stringify(team));} catch {onError('บันทึกทีมบนเครื่องไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ');}
  },[team,workspaceId,onChange,onError]);
  const edit=(role:'leader'|TeamRole,seat:TeamSeat)=>setTeam(current=>role==='leader'?{...current,leader:seat}:{...current,members:current.members.map(m=>m.role===role?{...seat,role}:m)});
  const fields=(role:'leader'|TeamRole,seat:TeamSeat)=> {
    const label=role==='leader'?'หัวหน้าทีม':labels[role];
    return <div className="team-seat-fields">
      <label>ชื่อ<input aria-label={`ชื่อ${label}`} value={seat.name} maxLength={60} onChange={e=>edit(role,{...seat,name:e.target.value})}/></label>
      <label>เครื่องมือ<select aria-label={`เครื่องมือ${label}`} value={seat.provider.startsWith('cli:')?seat.provider:'ollama'} onChange={e=>edit(role,{...seat,provider:e.target.value==='ollama'?(models[0]||''):e.target.value,model:e.target.value==='cli:opencode'?(openCodeModels.find(m=>m.startsWith('opencode/')&&m.endsWith('-free'))||''):''})}>
        {clis.filter(c=>c.teamSupported).map(c=><option key={c.id} value={`cli:${c.id}`} disabled={!c.available}>{c.name}{!c.available?' · ยังไม่ติดตั้ง':''}</option>)}<option value="ollama">Ollama บนเครื่อง</option>
      </select></label>
      <label>รุ่นโมเดล{seat.provider.startsWith('cli:')?<input aria-label={`โมเดล${label}`} value={seat.model} list={`team-models-${role}`} maxLength={200} placeholder="ค่าเริ่มต้นของ CLI" onChange={e=>edit(role,{...seat,model:e.target.value})}/>:<input aria-label={`โมเดล${label}`} value={seat.provider} list={`team-models-${role}`} placeholder="ชื่อรุ่น Ollama" maxLength={150} onChange={e=>edit(role,{...seat,provider:e.target.value})}/>}
        <datalist id={`team-models-${role}`}>{(seat.provider==='cli:opencode'?openCodeModels:!seat.provider.startsWith('cli:')?models:[]).map(m=><option key={m} value={m}/>)}</datalist>
      </label>
    </div>;
  };
  return <section className="team-editor" aria-label="จัดทีม AI">
    <header><div><h2><Users size={18}/>มอบหมายเป้าหมายให้ทีม AI</h2><p>หัวหน้าวางแผน → ลูกทีมทำตามลำดับ → ส่งผลกลับ → หัวหน้าสรุป</p></div><button className="text-button" disabled={disabled} onClick={discover}><RefreshCw size={13}/>ตรวจรุ่น Ollama</button></header>
    <fieldset disabled={disabled}><div className="team-seat leader"><h3>หัวหน้าทีม · วางแผนและสรุปผล</h3>{fields('leader',team.leader)}</div>
      {(Object.keys(labels) as TeamRole[]).map(role=>{const member=team.members.find(m=>m.role===role);return <div key={role} className="team-seat">
        <label className="team-role"><input type="checkbox" aria-label={`เปิดลูกทีม${labels[role]}`} checked={!!member} onChange={e=>setTeam(current=>({...current,members:e.target.checked?[...current.members,{role,name:labels[role],provider:team.leader.provider,model:team.leader.model}]:current.members.filter(m=>m.role!==role)}))}/><strong>ลูกทีม · {labels[role]}</strong>{role==='reviewer'&&<small>อ่านและตรวจเท่านั้น</small>}</label>
        {member&&fields(role,member)}
      </div>;})}
    </fieldset>
    <p className="team-footnote">หากต้องการแก้ไฟล์/รันทดสอบ ให้เปิด “อนุญาตแก้ไฟล์และรันคำสั่ง” ด้านล่าง · เลือกอย่างน้อย 1 ลูกทีม · เว้นรุ่น CLI ว่างเพื่อใช้ค่าเริ่มต้น · ใช้บัญชีและโควตาของแต่ละ CLI · Gemini/Freebuff ใช้ในโหมดโค้ดได้ ส่วนทีมอัตโนมัติยังไม่รองรับ</p>
  </section>;
}
export function TeamProgress({run}:{run:Run}) {
  if(!run.team)return null;
  const stage:Record<string,string>={planning:'หัวหน้ากำลังวางแผน',working:'ลูกทีมกำลังทำงานตามลำดับ',summarizing:'หัวหน้ากำลังสรุปผล',completed:'ทีมส่งผลครบแล้ว',failed:'งานจบโดยมีข้อผิดพลาด',cancelled:'ยกเลิกงานแล้ว'};
  return <section className="team-progress" aria-label="ความคืบหน้าทีม"><h3>{stage[run.stage||run.status]||'รอเริ่มงาน'}</h3><p>หัวหน้า: {run.team.leader.name} · {run.team.leader.provider} {run.team.leader.model}</p>
    <div className="team-members-status">{run.team.members.map(member=>{
      const tasks=run.tasks?.filter(t=>t.assignedAgent===member.role)||[];
      const state=tasks.some(t=>t.status==='running')?(run.status==='cancelled'?'ยกเลิก':'กำลังทำงาน'):tasks.some(t=>t.status==='failed')?'มีข้อผิดพลาด':tasks.length&&tasks.every(t=>t.status==='completed')?'ส่งผลแล้ว':run.status==='cancelled'?'ยกเลิก':tasks.length?'รอคิว':run.stage==='planning'?'รอแผน':'ไม่ได้รับงาน';
      return <div key={member.role}><strong>{member.name}</strong><span>{state}</span><small>{member.provider} {member.model}</small></div>;
    })}</div>
    {run.tasks?.map(task=><details key={task.id}><summary>{task.title} · {labels[task.assignedAgent]} · {({pending:'รอคิว',running:'กำลังทำ',completed:'ส่งผลแล้ว',failed:'ไม่สำเร็จ',cancelled:'ยกเลิก'} as Record<string,string>)[task.status]||task.status}</summary><pre>{task.result||'ยังไม่มีผลลัพธ์'}</pre></details>)}
  </section>;
}
