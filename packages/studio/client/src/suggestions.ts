export interface SuggestionItem {
  id: string;
  label: string;
  promptText: string;
  icon?: string;
}

export interface SuggestionContext {
  mode: "code" | "agent" | "chat";
  lastRun?: { status?: string; allowTools?: boolean; output?: string; error?: string } | null;
}

/** Suggestions belong to a finished answer, never to the user's partially typed prompt. */
export function getSuggestions({ mode, lastRun }: SuggestionContext): SuggestionItem[] {
  if (lastRun?.status !== "completed" || lastRun.error || !lastRun.output?.trim()) return [];
  const answer = lastRun.output.replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1");
  const lines = answer.split(/\r?\n/);
  const candidates: string[] = [];
  let inNextSteps = false;
  for (const line of lines) {
    if (/^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:ขั้นตอน(?:ถัดไป|ต่อไป)|สิ่งที่(?:ควร|แนะนำให้)ทำต่อ|ข้อเสนอแนะ|แนะนำให้ทำต่อ|next steps?|recommended actions?)[:：\s*]*$/iu.test(line.trim())) {
      inNextSteps = true;
      continue;
    }
    if (inNextSteps && /^\s*#{1,6}\s/.test(line)) inNextSteps = false;
    if (inNextSteps && /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)) {
      candidates.push(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+(?:\[[ x]\]\s*)?/i, ""));
    }
  }
  const offered = answer.match(/(?:หากต้องการ|ถ้าต้องการ|ผมสามารถ|ฉันสามารถ|would you like me to|I can)\s*([^\n.!?。]{8,180})/gi);
  if (offered) for (const offer of offered.slice(-2)) {
    const action = offer.replace(/^(?:(?:หาก|ถ้า)ต้องการ[,\s]*(?:ผม|ฉัน)?(?:สามารถ|จะ|ช่วย)?|(?:ผม|ฉัน)สามารถ|would you like me to|I can)\s*/i, "")
      .replace(/(?:ให้(?:คุณ)?(?:ต่อ)?ได้|ได้เลย|ครับ|ค่ะ|ไหม|หรือไม่)[\s?]*$/g, "").trim();
    if (/^(?:ช่วย|เริ่ม|ทำ|เขียน|เพิ่ม|ปรับ|แก้|ตรวจ|ทดสอบ|สร้าง|วางแผน|สรุป|อธิบาย|build|implement|add|fix|test|review|create|write|explain)/i.test(action)) candidates.push(action);
  }
  const unique = [...new Set(candidates.map(text => text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*/g, "").trim()))]
    .filter(text => text.length >= 6 && text.length <= 180);
  if (unique.length) return unique.slice(0, 3).map((text, index) => ({
    id: `answer-${index}`, label: text, promptText: `ช่วยทำขั้นตอนต่อไปจากคำตอบล่าสุด: ${text}`,
  }));
  if (/(?:แผน(?:งาน|การ|นี้)|ขั้นตอน(?:การ|ที่)|implementation plan|proposed approach)/i.test(answer) && (mode !== "agent" || !lastRun.allowTools)) {
    return [{ id: "follow-plan", label: "เริ่มทำตามแผนนี้", promptText: "ช่วยเริ่มลงมือทำตามแผนที่แนะนำในคำตอบล่าสุด" }];
  }
  if (/(?:แก้(?:ไข)?(?:ไฟล์|โค้ด)|เปลี่ยนแปลงไฟล์|implemented|files? changed|git diff)/i.test(answer)) {
    return [{ id: "review-changes", label: "ตรวจการแก้ไขและทดสอบ", promptText: "ช่วยตรวจการแก้ไขจากงานล่าสุดและรันการทดสอบที่เกี่ยวข้อง พร้อมสรุปผล" }];
  }
  return [];
}
