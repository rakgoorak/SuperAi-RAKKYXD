export interface SuggestionItem {
  id: string;
  label: string;
  promptText: string;
  icon?: string;
}

export interface SuggestionContext {
  mode: "code" | "agent" | "chat";
  lastRun?: {
    status?: string;
    mode?: string;
    allowTools?: boolean;
    prompt?: string;
    output?: string;
    error?: string;
  } | null;
  activeSessionName?: string;
  draft: string;
}

export interface SuggestionResult {
  items: SuggestionItem[];
  topChoice?: SuggestionItem;
  ghostSuffix: string;
}

export const SLASH_COMMANDS: SuggestionItem[] = [
  { id: "slash-skills", label: "/skills", promptText: "/skills " },
  { id: "slash-test", label: "/test", promptText: "/test " },
  { id: "slash-diff", label: "/diff", promptText: "/diff " },
  { id: "slash-clear", label: "/clear", promptText: "/clear" },
];

export function getSuggestions(ctx: SuggestionContext): SuggestionResult {
  const { mode, lastRun, draft } = ctx;
  let items: SuggestionItem[] = [];

  const isFailed = lastRun && (lastRun.status === "failed" || !!lastRun.error);
  const isCompleted = lastRun && lastRun.status === "completed";

  if (isFailed) {
    items = [
      { id: "retry", label: "ลองใหม่อีกครั้ง", promptText: "ลองใหม่อีกครั้งพร้อมวิเคราะห์สาเหตุและแก้ไข", icon: "refresh" },
      { id: "explain-err", label: "อธิบายวิธีแก้ปัญหา", promptText: "ขอวิธีแก้ปัญหาและข้อผิดพลาดที่เกิดขึ้นแบบทีละขั้นตอน", icon: "help" },
      { id: "check-logs", label: "ตรวจบันทึก Log", promptText: "ตรวจดูบันทึกข้อผิดพลาดและแนะนำวิธีแก้ไข", icon: "file" },
    ];
  } else if (isCompleted && mode === "agent") {
    if (lastRun?.allowTools) {
      items = [
        { id: "diff", label: "ตรวจดู Git Diff", promptText: "ตรวจดูการแก้ไขไฟล์ (Git Diff)", icon: "git" },
        { id: "test", label: "รันการทดสอบ", promptText: "รันการทดสอบระบบ (Test)", icon: "play" },
        { id: "explain", label: "อธิบายโค้ดที่แก้", promptText: "อธิบายรายละเอียดโค้ดที่แก้และไฟล์ที่เปลี่ยนแปลง", icon: "help" },
        { id: "next-step", label: "สรุปขั้นตอนถัดไป", promptText: "สรุปขั้นตอนถัดไปที่แนะนำในการพัฒนา", icon: "sparkles" },
      ];
    } else {
      items = [
        { id: "start-code", label: "เริ่มลงมือเขียนโค้ด", promptText: "เริ่มลงมือเขียนโค้ดตามแผนที่วางไว้", icon: "sparkles" },
        { id: "code-sample", label: "ขอตัวอย่างโค้ดละเอียด", promptText: "ขอตัวอย่างโค้ดและโครงสร้างไฟล์แบบละเอียด", icon: "file" },
        { id: "test-plan", label: "วางแผนการทดสอบ", promptText: "วางแผนการทดสอบระบบและกรณีทดสอบ (Test cases)", icon: "play" },
      ];
    }
  } else if (isCompleted && mode === "chat") {
    items = [
      { id: "chat-sample", label: "ขอตัวอย่างโค้ดละเอียด", promptText: "ขอตัวอย่างโค้ดและการนำไปประยุกต์ใช้อย่างละเอียด", icon: "file" },
      { id: "chat-compare", label: "เปรียบเทียบข้อดีข้อเสีย", promptText: "เปรียบเทียบข้อดีข้อเสียและจุดเด่นของแต่ละแนวทางข้างต้น", icon: "sparkles" },
      { id: "chat-action", label: "เริ่มลงมือทำตามคำแนะนำ", promptText: "ช่วยพาเริ่มลงมือทำตามแนวทางที่แนะนำทีละขั้นตอน", icon: "play" },
    ];
  } else {
    items = [
      { id: "cmd-test", label: "รันการทดสอบ", promptText: "รันการทดสอบระบบและตรวจความเรียบร้อย", icon: "play" },
      { id: "cmd-diff", label: "ตรวจ Git Diff", promptText: "ตรวจดูการแก้ไขไฟล์ล่าสุดในโปรเจกต์ (Git Diff)", icon: "git" },
      { id: "cmd-skills", label: "เรียกใช้ Skill", promptText: "/skills ", icon: "sparkles" },
    ];
  }

  const topChoice = items[0];
  let ghostSuffix = "";

  if (!draft.includes("\n")) {
    const trimmed = draft.trim();
    if (!trimmed && topChoice) {
      ghostSuffix = topChoice.promptText;
    } else if (trimmed) {
      const allCandidates = [...SLASH_COMMANDS, ...items];
      const match = allCandidates.find((c) => c.promptText.toLowerCase().startsWith(draft.toLowerCase()) && c.promptText.length > draft.length);
      if (match) {
        ghostSuffix = match.promptText.slice(draft.length);
      }
    }
  }

  return { items, topChoice, ghostSuffix };
}
