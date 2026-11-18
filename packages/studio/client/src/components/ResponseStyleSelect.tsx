import { useState } from 'react';
import { RESPONSE_STYLES, RESPONSE_STYLE_LABEL, type ResponseStyle } from '../responseStyle';
import { useTokenSaver } from '../tokenSaver';
import { tr } from '../i18n';
export function ResponseStyleSelect({ value, onChange, disabled = false }: { value: ResponseStyle; onChange: (value: ResponseStyle) => void; disabled?: boolean }) {
  const [problem, setProblem] = useState('');
  const [saver, setSaver] = useTokenSaver();
  return <>
    <label className="response-style-select">{tr("รูปแบบคำตอบ")}<select aria-label={tr("รูปแบบคำตอบ")} value={saver ? 'concise' : value} disabled={disabled || saver} onChange={event => {
      try { onChange(event.target.value as ResponseStyle); setProblem(''); }
      catch { setProblem(tr("บันทึกรูปแบบคำตอบไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ")); }
    }}>{RESPONSE_STYLES.map(style => <option key={style} value={style}>{RESPONSE_STYLE_LABEL[style]}</option>)}</select>
      <small>{problem || (saver ? tr("ประหยัด Token เปิดอยู่ จึงตอบแบบสั้น") : tr("ใช้กับคำตอบถัดไป โดยไม่เปลี่ยนรุ่นหรือระดับการคิด"))}</small>
    </label>
    <label className="settings-toggle token-saver-toggle" title={tr("ตอบแบบสั้น ไม่ให้ AI เดาข้อความถัดไป และส่งประวัติให้ทีม Agent กับถามหลาย AI น้อยลง รุ่นและระดับการคิดไม่เปลี่ยน")}>
      <input type="checkbox" checked={saver} onChange={event => setSaver(event.target.checked)} />
      {tr("ประหยัด Token")}
    </label>
  </>;
}
