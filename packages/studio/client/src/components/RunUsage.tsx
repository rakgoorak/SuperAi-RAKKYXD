import type { UsageStep } from '../api';
import { tr } from '../i18n';

/** Show the provider's numbers by call; never sum unknown or differently defined fields. */
export function RunUsage({ steps }: { steps?: UsageStep[] }) {
  if (!steps?.length) return null;
  return <details className="activity-log"><summary>{tr("Token ตามขั้นตอน (")}{steps.length} {tr("ขั้นตอน)")}</summary>
    <p>{tr("ตัวเลขจาก provider เท่านั้น · ไม่แสดงฟิลด์ที่ไม่ได้รับ และไม่ใช่ยอดรวมทั้งงาน")}</p>
    <ul>{steps.map((step, i) => <li key={i}>
      <strong>{step.stage} · {step.seat} ({step.provider})</strong>
      {step.calls.map((call, j) => <span key={j}> {tr("รอบ")} {j + 1}: {[
        call.input !== undefined ? `input ${call.input.toLocaleString()}${call.inputIncludesCache === undefined ? '' : call.inputIncludesCache ? tr(" (รวม cache)") : tr(" (ไม่รวม cache)")}` : '',
        call.cachedInput !== undefined ? `cache read ${call.cachedInput.toLocaleString()}` : '',
        call.cacheWrite !== undefined ? `cache write ${call.cacheWrite.toLocaleString()}` : '',
        call.output !== undefined ? `output ${call.output.toLocaleString()}` : '',
      ].filter(Boolean).join(' · ')}</span>)}
      {step.status === 'running' ? <span>{tr("กำลังทำ")}</span> : step.missing || !step.calls.length ? <span>{tr("ไม่มีข้อมูลครบสำหรับขั้นตอนนี้")}</span> : null}
    </li>)}</ul>
  </details>;
}
