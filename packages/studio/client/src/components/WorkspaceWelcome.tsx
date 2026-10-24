import { ArrowUpRight, MessageSquare, Users } from 'lucide-react';
import type { Cli } from '../api';

export function WorkspaceWelcome({ clis, openSession, onMode }: {
  clis: Cli[]; openSession: (type?: string) => void; onMode: (mode: 'agent' | 'chat') => void;
}) {
  return <div className="workspace-welcome">
    <img className="welcome-mark" src="/brand/mark.png" alt="" />
    <h2>วันนี้อยากทำอะไร?</h2>
    <p>เริ่มง่าย ๆ: เลือก AI ด้านล่าง แล้วพิมพ์สิ่งที่อยากให้ช่วย<br />ไม่แน่ใจว่าจะเริ่มอย่างไร เปิด “เริ่มต้นใช้งาน” ที่แถบซ้ายได้เลย</p>
    <div className="welcome-providers" aria-label="เลือกผู้ช่วย AI">
      {clis.filter(cli => cli.id !== 'terminal').map(cli => <button key={cli.id} onClick={() => openSession(cli.id)}>
        <span className={`status-dot ${cli.available ? '' : 'offline'}`} />
        <span>{cli.name}</span>{!cli.available && <small>ติดตั้ง</small>}<ArrowUpRight size={13} />
      </button>)}
      <button onClick={() => openSession('terminal')} title="หน้าต่างพิมพ์คำสั่ง สำหรับผู้ที่คุ้นเคยกับ Terminal">เปิด Terminal<ArrowUpRight size={13} /></button>
    </div>
    <div className="welcome-workflows">
      <button onClick={() => onMode('agent')}><Users size={18} /><span><strong>ให้ทีม AI ช่วยลงมือทำ</strong><small>แบ่งงานให้ผู้ช่วยหลายตัว แล้วติดตามผลในหน้าเดียว</small></span></button>
      <button onClick={() => onMode('chat')}><MessageSquare size={18} /><span><strong>คุยและเปรียบเทียบคำตอบ</strong><small>ถามหลาย AI พร้อมกัน แล้วเลือกแนวทางที่เหมาะ</small></span></button>
    </div>
  </div>;
}
