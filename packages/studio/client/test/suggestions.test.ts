import test from "node:test";
import assert from "node:assert/strict";
import { getSuggestions } from "../src/suggestions.js";

test("returns 4 follow-up actions after completed Agent run with allowTools", () => {
  const result = getSuggestions({
    mode: "agent",
    lastRun: { status: "completed", allowTools: true, output: "เสร็จสิ้น" },
    draft: "",
  });
  assert.equal(result.items.length, 4);
  assert.equal(result.items[0].promptText, "ตรวจดูการแก้ไขไฟล์ (Git Diff)");
  assert.equal(result.topChoice?.promptText, "ตรวจดูการแก้ไขไฟล์ (Git Diff)");
  assert.equal(result.ghostSuffix, "ตรวจดูการแก้ไขไฟล์ (Git Diff)");
});

test("returns appropriate actions after completed Chat run", () => {
  const result = getSuggestions({
    mode: "chat",
    lastRun: { status: "completed", mode: "chat", output: "สรุป" },
    draft: "",
  });
  assert.ok(result.items.length >= 3);
  assert.ok(result.items[0].promptText.includes("ตัวอย่างโค้ด"));
});

test("returns error recovery actions when run has error or failed", () => {
  const result = getSuggestions({
    mode: "agent",
    lastRun: { status: "failed", error: "CLI connection lost" },
    draft: "",
  });
  assert.ok(result.items[0].promptText.includes("ลองใหม่อีกครั้ง"));
});

test("calculates ghostSuffix when draft is a matching prefix", () => {
  const result = getSuggestions({
    mode: "agent",
    lastRun: { status: "completed", allowTools: true },
    draft: "ตรวจดู",
  });
  assert.equal(result.ghostSuffix, "การแก้ไขไฟล์ (Git Diff)");
});

test("matches slash commands like /skills and /diff", () => {
  const result = getSuggestions({
    mode: "code",
    draft: "/sk",
  });
  assert.equal(result.ghostSuffix, "ills ");
});

test("returns empty ghostSuffix when draft has newlines or no match", () => {
  const result = getSuggestions({
    mode: "code",
    draft: "ข้อความที่ไม่ตรง\nอีกบรรทัด",
  });
  assert.equal(result.ghostSuffix, "");
});
