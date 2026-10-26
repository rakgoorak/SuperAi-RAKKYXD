import { useState } from 'react';
import { RESPONSE_STYLES, RESPONSE_STYLE_LABEL, type ResponseStyle } from '../responseStyle';
export function ResponseStyleSelect({ value, onChange, disabled = false }: { value: ResponseStyle; onChange: (value: ResponseStyle) => void; disabled?: boolean }) {
  const [problem, setProblem] = useState('');
  return <label className="response-style-select">รูปแบบคำตอบ<select aria-label="รูปแบบคำตอบ" value={value} disabled={disabled} onChange={event => {
    try { onChange(event.target.value as ResponseStyle); setProblem(''); }
    catch { setProblem('บันทึกรูปแบบคำตอบไม่ได้ กรุณาตรวจพื้นที่จัดเก็บ'); }
  }}>{RESPONSE_STYLES.map(style => <option key={style} value={style}>{RESPONSE_STYLE_LABEL[style]}</option>)}</select>
    <small>{problem || 'ใช้กับคำตอบถัดไป โดยไม่เปลี่ยนรุ่นหรือระดับการคิด'}</small>
  </label>;
}
