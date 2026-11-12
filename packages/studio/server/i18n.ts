import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import en from "./locales/en.js";
import ja from "./locales/ja.js";
import zh from "./locales/zh.js";

/**
 * Messages the server shows to the person using the app (errors, notices, labels) follow the
 * language chosen in the window. The app serves one person, so the language is a single setting:
 * the window reports it and it is kept on disk for the next start. Prompts written for an AI are
 * never passed through here.
 */
export type Locale = "th" | "en" | "ja" | "zh";
const TEXT: Record<Locale, Record<string, string> | null> = { th: null, en, ja, zh };
const isLocale = (value: unknown): value is Locale => typeof value === "string" && Object.prototype.hasOwnProperty.call(TEXT, value);
const file = () => path.join(process.env.SUPERAI_DATA_DIR || path.join(os.homedir(), ".opencode-multi"), "locale.txt");

// Until the window reports its choice: the computer's language when supported, otherwise English.
// SUPERAI_LANG (the same switch the desktop app takes) wins, e.g. for tests that check the Thai text.
const system = String(process.env.SUPERAI_LANG || Intl.DateTimeFormat().resolvedOptions().locale || "").toLowerCase().slice(0, 2);
let locale: Locale = system === "th" || system === "ja" || system === "zh" ? system : "en";
try {
  const saved = fs.readFileSync(file(), "utf8").trim();
  if (isLocale(saved)) locale = saved;
} catch {}

export const serverLocale = () => locale;
export function setServerLocale(value: unknown, save = true): boolean {
  if (!isLocale(value)) return false;
  locale = value;
  if (save) try { fs.mkdirSync(path.dirname(file()), { recursive: true }); fs.writeFileSync(file(), value); } catch {}
  return true;
}

/** tr('ข้อความ') or tr`เปิด ${name} ไม่สำเร็จ`; a template's values are {0}, {1}, … in the translation. */
export function tr(source: TemplateStringsArray | string, ...values: unknown[]): string {
  const key = typeof source === "string" ? source : source.reduce((out, part, index) => out + part + (index < source.length - 1 ? `{${index}}` : ""), "");
  const text = TEXT[locale]?.[key] || (locale !== "th" && en[key]) || key;
  return typeof source === "string" ? text : text.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)] ?? ""));
}
