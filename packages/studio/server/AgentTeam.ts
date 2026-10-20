export type TeamRole = 'coder' | 'tester' | 'reviewer';
export interface TeamSeat { name:string; provider:string; model:string; }
export interface TeamMember extends TeamSeat { role:TeamRole; }
export interface AgentTeam { leader:TeamSeat; members:TeamMember[]; }
export function validateTeam(value:unknown): AgentTeam {
  const input=value as any;
  const seat=(s:any):TeamSeat=> {
    if(!s || typeof s.name!=='string' || !s.name.trim() || s.name.length>60 || typeof s.provider!=='string' || !s.provider.trim() || s.provider.length>150 || typeof s.model!=='string' || s.model.length>200 || /[\r\n\0]/.test(s.model) || s.model.startsWith('-')) throw new Error('ข้อมูลสมาชิกทีมไม่ถูกต้อง');
    if(s.provider.startsWith('cli:') && !['cli:claude-code','cli:codex','cli:opencode'].includes(s.provider)) throw new Error('CLI นี้ใช้ได้ใน session โค้ด แต่ยังไม่รองรับทีมอัตโนมัติ');
    return {name:s.name.trim(),provider:s.provider.trim(),model:s.model.trim()};
  };
  if(!input || !Array.isArray(input.members) || input.members.length<1 || input.members.length>3) throw new Error('เลือกลูกทีม 1–3 คน');
  const members=input.members.map((m:any)=> {
    if(!['coder','tester','reviewer'].includes(m?.role)) throw new Error('บทบาทลูกทีมไม่ถูกต้อง');
    return {...seat(m),role:m.role};
  });
  if(new Set(members.map((m:TeamMember)=>m.role)).size!==members.length) throw new Error('บทบาทลูกทีมซ้ำกัน');
  return {leader:seat(input.leader),members};
}
