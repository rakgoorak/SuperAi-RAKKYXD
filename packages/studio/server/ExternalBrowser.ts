import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { SNAPSHOT, SELECT_ALL, describe, findScript, focusScript, hasTextScript, scrollScript, selectScript, type PageSnapshot } from "./BrowserPage.js";
import type { BrowserToolResult } from "./BrowserTools.js";

/**
 * Chrome or Edge on this computer, driven for the AI's browser tools. The browser opens in its own
 * window with a SuperAi profile kept between runs (so a site the user signs into once stays signed
 * in), separate from the user's everyday profile: Chrome and Edge refuse remote control of that one.
 */
export type ExternalKind = "chrome" | "edge";
const CHANNEL: Record<ExternalKind, string> = { chrome: "chrome", edge: "msedge" };
const NAME: Record<ExternalKind, string> = { chrome: "Google Chrome", edge: "Microsoft Edge" };

const contexts = new Map<ExternalKind, Promise<BrowserContext>>();
const active = new Map<ExternalKind, Page>();

const profileDir = (kind: ExternalKind) =>
  path.join(process.env.SUPERAI_DATA_DIR || path.join(os.homedir(), ".opencode-multi"), "browser-profiles", kind);

async function context(kind: ExternalKind): Promise<BrowserContext> {
  let opening = contexts.get(kind);
  if (!opening) {
    const dir = profileDir(kind);
    fs.mkdirSync(dir, { recursive: true });
    opening = chromium.launchPersistentContext(dir, { channel: CHANNEL[kind], headless: false, viewport: null, args: ["--no-first-run", "--no-default-browser-check"] })
      .then((ctx) => {
        // Closed by the user: the next tool call opens it again.
        ctx.on("close", () => { contexts.delete(kind); active.delete(kind); });
        ctx.on("page", (page) => active.set(kind, page));
        return ctx;
      })
      .catch((error) => {
        contexts.delete(kind);
        const missing = /executable|not found|is not installed|distribution/i.test(String(error?.message));
        throw new Error(missing ? `${NAME[kind]} is not installed on this computer. Use the other browser, or the SuperAi browser panel (no "browser" argument).` : `Could not open ${NAME[kind]}: ${error.message}`);
      });
    contexts.set(kind, opening);
  }
  return opening;
}

async function page(kind: ExternalKind, open = false): Promise<Page> {
  const ctx = await context(kind);
  let current = active.get(kind);
  if (!current || current.isClosed()) current = ctx.pages().find((p) => !p.isClosed());
  if (!current && open) current = await ctx.newPage();
  if (!current) throw new Error(`No ${NAME[kind]} tab is open. Use browser_open first.`);
  active.set(kind, current);
  return current;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function settled(p: Page, limit = 15000) {
  await p.waitForLoadState("domcontentloaded", { timeout: limit }).catch(() => {});
  await p.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
}
/** Reads the page, waiting out a navigation that a click or key just started. */
async function snapshot(p: Page): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    try { return describe(await p.evaluate(SNAPSHOT) as PageSnapshot); }
    catch (error) {
      if (attempt >= 4 || !/context was destroyed|navigat/i.test(String((error as Error).message))) throw error;
      await p.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
      await wait(200);
    }
  }
}
const KEYS: Record<string, string> = { enter: "Enter", tab: "Tab", escape: "Escape", esc: "Escape", backspace: "Backspace", delete: "Delete", space: "Space",
  up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight",
  pageup: "PageUp", pagedown: "PageDown", home: "Home", end: "End" };
const keyName = (combo: string) => combo.split("+").map((part) => {
  const lower = part.trim().toLowerCase();
  return KEYS[lower] || (lower === "ctrl" ? "Control" : lower === "cmd" || lower === "meta" ? "Meta" : lower === "alt" ? "Alt" : lower === "shift" ? "Shift" : part.trim());
}).join("+");

export async function runExternal(kind: ExternalKind, tool: string, args: Record<string, any>): Promise<BrowserToolResult> {
  if (tool === "browser_open") {
    const url = String(args.url || "");
    if (!/^https?:\/\//i.test(url) && !/^localhost(:\d+)?(\/|$)/i.test(url)) throw new Error("Use an http(s) address");
    const ctx = await context(kind);
    const p = args.newTab ? await ctx.newPage() : await page(kind, true);
    active.set(kind, p);
    await p.goto(/^localhost/i.test(url) ? `http://${url}` : url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await settled(p);
    await p.bringToFront().catch(() => {});
    return { text: `${NAME[kind]}\n${await snapshot(p)}` };
  }
  if (tool === "browser_tabs") {
    const ctx = await context(kind);
    const pages = ctx.pages();
    if (args.select !== undefined) {
      const chosen = pages[Number(args.select)];
      if (!chosen) throw new Error("No tab with that number");
      active.set(kind, chosen); await chosen.bringToFront();
    }
    const current = active.get(kind);
    return { text: (await Promise.all(pages.map(async (p, i) => `${p === current ? "* " : "  "}${i}  ${await p.title().catch(() => "")}  ${p.url()}`))).join("\n") || "(no tabs)" };
  }
  const p = await page(kind);
  if (tool === "browser_snapshot") return { text: await snapshot(p) };
  if (tool === "browser_screenshot") {
    const data = await p.screenshot({ type: "png" });
    return { text: `Screenshot of ${p.url()} in ${NAME[kind]}`, image: { data: data.toString("base64"), mimeType: "image/png" } };
  }
  if (tool === "browser_click" || tool === "browser_type") {
    const target = await p.evaluate(findScript(args.ref, args.text)) as { x: number; y: number } | null;
    if (!target) throw new Error(args.ref ? `No element with ref ${args.ref}. Take a new browser_snapshot; refs change when the page changes.` : `No clickable element shows "${args.text}".`);
    if (tool === "browser_click") {
      await p.mouse.click(target.x, target.y);
      await wait(250);
      await settled(p, 8000);
      return { text: await snapshot(p) };
    }
    if (!(await p.evaluate(focusScript(args.ref)))) throw new Error(`Element ${args.ref} cannot take text. Take a new browser_snapshot and pick an input.`);
    if (!args.append) { await p.evaluate(SELECT_ALL); await p.keyboard.press("Backspace"); }
    await p.keyboard.insertText(String(args.text ?? ""));
    if (args.submit) { await p.keyboard.press("Enter"); await settled(p, 8000); }
    return { text: await snapshot(p) };
  }
  if (tool === "browser_press") { await p.keyboard.press(keyName(String(args.key || ""))); await settled(p, 5000); return { text: await snapshot(p) }; }
  if (tool === "browser_select") {
    if (!(await p.evaluate(selectScript(args.ref, args.value)))) throw new Error("Select element or option not found. Take a new browser_snapshot.");
    return { text: await snapshot(p) };
  }
  if (tool === "browser_scroll") { await p.evaluate(scrollScript(args.direction, args.amount)); await wait(300); return { text: await snapshot(p) }; }
  if (tool === "browser_back") { await p.goBack({ timeout: 15000 }).catch(() => null); await settled(p); return { text: await snapshot(p) }; }
  if (tool === "browser_forward") { await p.goForward({ timeout: 15000 }).catch(() => null); await settled(p); return { text: await snapshot(p) }; }
  if (tool === "browser_wait") {
    const limit = Math.min(20, Math.max(0, Number(args.seconds) || (args.text ? 10 : 2))) * 1000;
    if (args.text) {
      await p.waitForFunction(hasTextScript(args.text), undefined, { timeout: limit }).catch(() => { throw new Error(`"${args.text}" did not appear within ${limit / 1000} s`); });
    } else await wait(limit);
    return { text: await snapshot(p) };
  }
  throw new Error(`Unknown browser tool: ${tool}`);
}

/** Closes the browsers this app opened (on quit). */
export async function closeExternal() {
  await Promise.all([...contexts.values()].map((opening) => opening.then((ctx) => ctx.close()).catch(() => {})));
  contexts.clear(); active.clear();
}
