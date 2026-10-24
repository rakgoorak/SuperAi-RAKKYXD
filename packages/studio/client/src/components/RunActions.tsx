import { useState } from 'react';
import { type Run } from '../api';
import { prepareMessage, recoveryHint, showChanges } from '../recovery';
import { ResponseActions } from './ResponseActions';
export function RunActions({ run, blocked, onRetry }: { run: Run; blocked: boolean; onRetry: (run: Run) => Promise<void> }) {
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(false);
  const retry=async()=>{setPending(true);setError('');try{
    await onRetry(run);
  }catch(e){setError((e as Error).message);}finally{setPending(false);}};
  if (run.status === 'running') return null;
  const text = run.output || run.panel?.map(answer => answer.output).filter(Boolean).join('\n\n') || '';
  return <div className="run-response">
    <ResponseActions text={text} disabled={pending || blocked} onRetry={() => void retry()}
      onEdit={() => { setEditing(true); prepareMessage(run.prompt, undefined, { expand: false }); }}
      onChanges={run.allowTools ? () => showChanges() : undefined} />
    {run.error && <div className="recovery-note"><p>{recoveryHint(run.error)}</p><button onClick={() => window.dispatchEvent(new Event('superai:open-setup'))}>ตรวจบัญชีและเครื่องมือ</button></div>}
    {editing && !!run.attachments?.length && <p className="recovery-note" role="status">กรุณาแนบไฟล์เดิมอีกครั้งก่อนส่งข้อความที่แก้ไข</p>}
    {error && <p role="alert">{recoveryHint(error)}<br />{error}</p>}
  </div>;
}
