import { ArrowUpRight, MessageSquare, Users } from 'lucide-react';
import type { Cli } from '../api';
import { HEADLESS } from '../providers';
import { ProviderBadge } from './ProviderBadge';

export function WorkspaceWelcome({ clis, openSession, onMode, provider, onProvider, disabled }: {
  clis: Cli[]; openSession: (type?: string) => void; onMode: (mode: 'agent' | 'chat') => void;
  provider: string; onProvider: (provider: string) => void; disabled?: boolean;
}) {
  return <div className="workspace-welcome">
    <h2>วันนี้อยากทำอะไร?</h2>
    <p>เลือกผู้ช่วย แล้วเริ่มพิมพ์ด้านล่างได้เลย</p>
    <div className="welcome-providers" aria-label="เลือกผู้ช่วย AI">
      {clis.filter(cli => cli.id !== 'terminal').map(cli => <button key={cli.id} disabled={disabled} aria-pressed={HEADLESS.includes(cli.id) && provider === cli.id} onClick={() => HEADLESS.includes(cli.id) && cli.available ? onProvider(cli.id) : openSession(cli.id)}>
        <ProviderBadge provider={cli.id} />{!cli.available ? <small>ติดตั้ง</small> : !HEADLESS.includes(cli.id) && <small>Terminal</small>}
      </button>)}
      <button disabled={disabled} onClick={() => openSession('terminal')} title="หน้าต่างพิมพ์คำสั่ง สำหรับผู้ที่คุ้นเคยกับ Terminal">เปิด Terminal<ArrowUpRight size={13} /></button>
    </div>
    <div className="welcome-workflows">
      <button disabled={disabled} onClick={() => onMode('agent')} title="แบ่งงานให้ผู้ช่วยหลายตัว แล้วติดตามผลในหน้าเดียว"><Users size={15} /><span>ให้ทีม AI ช่วยลงมือทำ</span></button>
      <button disabled={disabled} onClick={() => onMode('chat')} title="ถามหลาย AI พร้อมกัน แล้วเลือกแนวทางที่เหมาะ"><MessageSquare size={15} /><span>คุยและเปรียบเทียบคำตอบ</span></button>
    </div>
  </div>;
}
