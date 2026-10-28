import test from "node:test";
import assert from "node:assert/strict";
import {
  conversationMarkdown,
  conversationHtml,
  teamHtml,
  conversationSummaryText,
  exportFilename,
} from "../client/src/conversationExport.js";

test("exportFilename sanitizes dangerous characters and appends extension", () => {
  assert.equal(exportFilename("Test Project", "md"), "Test Project.md");
  assert.equal(exportFilename("Project: A/B?", "html"), "Project- A-B-.html");
  assert.equal(exportFilename("CON", "json"), "conversation-CON.json");
});

test("conversationMarkdown formats user, assistant, tools and todos", () => {
  const items = [
    { kind: "user", text: "เขียนโค้ดทดสอบ", attachments: ["a.ts"] },
    { kind: "tool", title: "Bash", status: "done", output: "test passed" },
    { kind: "todos", todos: [{ text: "สร้างไฟล์", status: "completed" }, { text: "รันเทสต์", status: "pending" }] },
    { kind: "assistant", text: "เสร็จเรียบร้อยครับ" },
  ];
  const md = conversationMarkdown("งานที่ 1", items);
  assert.ok(md.includes("# งานที่ 1"));
  assert.ok(md.includes("## ผู้ใช้"));
  assert.ok(md.includes("ไฟล์แนบ: a.ts"));
  assert.ok(md.includes("### เครื่องมือ: Bash (done)"));
  assert.ok(md.includes("- [x] สร้างไฟล์"));
  assert.ok(md.includes("- [ ] รันเทสต์"));
  assert.ok(md.includes("## AI"));
  assert.ok(md.includes("เสร็จเรียบร้อยครับ"));
});

test("conversationHtml generates valid HTML document with styled elements", () => {
  const items = [
    { kind: "user", text: "สวัสดี" },
    { kind: "assistant", text: "สวัสดีครับ มีอะไรให้ช่วยไหมครับ" },
  ];
  const html = conversationHtml("ทดสอบ HTML", items);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(html.includes("<title>ทดสอบ HTML - SuperAi &amp; RAKKYXD</title>"));
  assert.ok(html.includes("👤 ผู้ใช้"));
  assert.ok(html.includes("สวัสดี"));
  assert.ok(html.includes("🤖 ผู้ช่วย AI"));
  assert.ok(html.includes("สวัสดีครับ มีอะไรให้ช่วยไหมครับ"));
  assert.ok(html.includes("</html>"));
});

test("teamHtml generates valid HTML team report", () => {
  const runs = [
    {
      mode: "chat",
      prompt: "ช่วยวิเคราะห์ระบบ",
      panel: [{ seat: { name: "Claude", provider: "claude-code" }, output: "ระบบทำงานได้ดี" }],
      output: "สรุป: ผ่านเกณฑ์",
    },
  ];
  const html = teamHtml("รายงานทีม AI", runs);
  assert.ok(html.includes("<!DOCTYPE html>"));
  assert.ok(html.includes("Claude (claude-code)"));
  assert.ok(html.includes("ระบบทำงานได้ดี"));
  assert.ok(html.includes("สรุปผลลัพธ์:"));
  assert.ok(html.includes("สรุป: ผ่านเกณฑ์"));
});

test("conversationSummaryText extracts user and assistant summary", () => {
  const items = [
    { kind: "user", text: "ช่วยเขียนฟังก์ชันบวกเลข" },
    { kind: "assistant", text: "นี่คือฟังก์ชัน function add(a, b) { return a + b; }" },
  ];
  const summary = conversationSummaryText("คำนวณเลข", items);
  assert.ok(summary.includes("### คำนวณเลข"));
  assert.ok(summary.includes("**คำขอ:** ช่วยเขียนฟังก์ชันบวกเลข"));
  assert.ok(summary.includes("**ผลลัพธ์:**"));
  assert.ok(summary.includes("function add(a, b)"));
  assert.ok(summary.includes("SuperAi & RAKKYXD"));
});
