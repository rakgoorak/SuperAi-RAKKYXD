// What the AI's browser tools do in the browser panel. Runs in the main process on the active tab's
// webContents: page reading and element lookup run inside the page (scripts shared with Chrome/Edge
// in studio/server/BrowserPage.ts), while clicks and keys are sent as real input events so pages
// react the way they do to a person.
import fs from "node:fs";
import path from "node:path";
import { normalizeBrowserUrl } from "./browser-url.mjs";
import { tr } from "./i18n.mjs";
import { SNAPSHOT, SELECT_ALL, DIALOG_RELEASE, aiCursorScript, aiThinkingScript, clickScript, describe, dialogGuardScript, fileInputScript, findScript, focusScript, hasTextScript, hoverScript, scrollScript, selectScript } from "../studio/dist/BrowserPage.js";

const KEYS = { enter: "Enter", tab: "Tab", escape: "Escape", esc: "Escape", backspace: "Backspace", delete: "Delete", space: "Space",
  arrowup: "Up", arrowdown: "Down", arrowleft: "Left", arrowright: "Right", up: "Up", down: "Down", left: "Left", right: "Right",
  pageup: "PageUp", pagedown: "PageDown", home: "Home", end: "End" };

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

/** Runs a page script, but never waits forever: a page that is frozen (or shows its own dialog) gets an error instead. */
function js(wc, code, limit = 15000) {
  let timer;
  return Promise.race([
    wc.executeJavaScript(code, true).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("The page did not answer in time (busy, or showing its own dialog). Try browser_press Escape or browser_screenshot.")), limit); }),
  ]);
}

/** Resolves when the page stops loading (or after `limit` ms). */
async function settled(wc, limit = 20000) {
  const started = Date.now();
  await wait(150);
  while (wc.isLoading() && Date.now() - started < limit) await wait(150);
  await wait(250);
}

export function createBrowserAutomation(controller, { reveal } = {}) {
  const active = async () => {
    const tab = controller.tabs.get(controller.activeId);
    if (!tab) throw new Error("No browser tab is open. Use browser_open first.");
    return tab.view.webContents;
  };
  const snapshot = async (wc) => describe(await js(wc, SNAPSHOT));
  // The answer browser_dialog set for the page's next confirm / prompt.
  let dialogAnswer;
  const guard = async (wc) => { await js(wc, dialogGuardScript(dialogAnswer), 5000).catch(() => {}); dialogAnswer = undefined; };
  const release = (wc) => js(wc, DIALOG_RELEASE, 5000).catch(() => {});
  const point = async (wc, ref, text, label) => {
    const target = await js(wc, findScript(ref, text, label));
    if (!target) throw new Error(ref ? `No element with ref ${ref}. Take a new browser_snapshot; refs change when the page changes.` : `No element matching "${text || label || ""}".`);
    await wait(100);
    return target;
  };
  // Real mouse input only reaches the page while its view is on screen.
  const onScreen = () => controller.visible && controller.bounds.width > 0 && controller.bounds.height > 0;
  // reveal() asks the window to show the panel; give it a moment to come on screen before real input.
  const shown = async () => { for (let i = 0; i < 20 && !onScreen(); i++) await wait(100); return onScreen(); };
  const key = (wc, name, modifiers = []) => {
    const keyCode = KEYS[String(name).toLowerCase()] || name;
    wc.sendInputEvent({ type: "keyDown", keyCode, modifiers });
    // Enter and printable keys also need a "char" event, or forms and inputs ignore them.
    const char = keyCode === "Enter" ? "\r" : keyCode === "Space" ? " " : keyCode.length === 1 ? keyCode : "";
    if (char) wc.sendInputEvent({ type: "char", keyCode: char, modifiers });
    wc.sendInputEvent({ type: "keyUp", keyCode, modifiers });
  };

  async function run(tool, args = {}) {
    // The user should see what the AI does: bring the browser panel forward on every action.
    if (tool !== "browser_close_tab") reveal?.();
    if (tool === "browser_open") {
      const url = normalizeBrowserUrl(String(args.url || ""));
      if (args.newTab || !controller.tabs.size) await controller.action("create", { url });
      else await controller.action("navigate", { url });
      const wc = await active();
      await settled(wc);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_tabs" || tool === "browser_close_tab") {
      const before = controller.state();
      if (tool === "browser_close_tab") {
        const wanted = String(args.select ?? "");
        const target = wanted ? before.tabs.find((t) => t.id === wanted) || before.tabs[Number(wanted)] : before.tabs.find((t) => t.id === before.activeId);
        if (!target) throw new Error("No tab to close");
        await controller.action("close", { id: target.id });
      } else if (args.select !== undefined && args.select !== "") {
        // A tab id, or its number in the list (the same as Chrome / Edge).
        const wanted = String(args.select);
        const tab = before.tabs.find((t) => t.id === wanted) || before.tabs[Number(wanted)];
        if (!tab) throw new Error("No tab with that id or number");
        await controller.action("select", { id: tab.id });
      }
      const state = controller.state();
      return { text: state.tabs.map((t, i) => `${t.id === state.activeId ? "* " : "  "}${i}  ${t.id}  ${t.title}  ${t.url}`).join("\n") || "(no tabs)" };
    }
    if (tool === "browser_dialog") {
      dialogAnswer = { accept: args.accept !== false, ...(args.text !== undefined ? { text: String(args.text) } : {}) };
      return { text: `The page's next confirm / prompt will be answered ${dialogAnswer.accept ? "OK" : "Cancel"}${dialogAnswer.text !== undefined ? ` with "${dialogAnswer.text}"` : ""}. Now repeat the action that shows it.` };
    }
    const wc = await active();
    const acting = ["browser_click", "browser_hover", "browser_type", "browser_press", "browser_select", "browser_upload"].includes(tool);
    if (acting) await guard(wc);
    try { return await act(wc, tool, args); } finally {
      if (acting) await release(wc);
      // Between actions the AI cursor says the AI is thinking about its next step.
      if (acting) await js(wc, aiThinkingScript(tr("กำลังคิด…")), 2000).catch(() => {});
    }
  };

  async function act(wc, tool, args) {
    if (tool === "browser_snapshot") return { text: await snapshot(wc) };
    if (tool === "browser_console") {
      const tab = controller.tabs.get(controller.activeId);
      const logs = tab?.logs || [];
      const text = logs.length ? logs.join("\n") : "(no console errors or failed loads)";
      if (args.clear && tab) tab.logs = [];
      return { text };
    }
    if (tool === "browser_eval") {
      const expr = String(args.expression || "").trim();
      if (!expr) throw new Error("expression is required");
      const val = await js(wc, expr, 10000);
      const formatted = val === undefined ? "undefined" : typeof val === "string" ? val : JSON.stringify(val, null, 2);
      return { text: String(formatted).slice(0, 12000) };
    }
    if (tool === "browser_screenshot") {
      await shown();
      let image = await wc.capturePage();
      // A view that is covered or hidden paints nothing; capture it while it stays hidden.
      if (image.isEmpty()) image = await wc.capturePage(undefined, { stayHidden: true });
      if (image.isEmpty()) throw new Error(`The browser panel is hidden, so nothing could be captured (visible=${controller.visible}). Use browser_snapshot to read the page instead.`);
      const size = image.getSize();
      const small = size.width > 1280 ? image.resize({ width: 1280 }) : image;
      return { text: `Screenshot of ${wc.getURL()}`, image: { data: small.toJPEG(80).toString("base64"), mimeType: "image/jpeg" } };
    }
    if (tool === "browser_hover") {
      const target = await point(wc, args.ref, args.text);
      if (await js(wc, aiCursorScript(target.x, target.y, tr("ชี้"))).catch(() => false)) await wait(220);
      if (await shown()) wc.sendInputEvent({ type: "mouseMove", x: target.x, y: target.y });
      await js(wc, hoverScript(args.ref, args.text));
      await wait(200);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_click") {
      const hasCoords = !args.ref && !args.text && Number.isFinite(Number(args.x)) && Number.isFinite(Number(args.y));
      const target = hasCoords
        ? { x: Math.round(Number(args.x)), y: Math.round(Number(args.y)) }
        : await point(wc, args.ref, args.text);
      const button = args.button === "right" ? "right" : "left";
      const clickCount = args.double ? 2 : 1;
      // The AI's own cursor glides there first, so the user sees where it clicks (their mouse is untouched).
      if (await js(wc, aiCursorScript(target.x, target.y, tr("คลิก"))).catch(() => false)) await wait(240);
      if (await shown()) {
        wc.sendInputEvent({ type: "mouseMove", x: target.x, y: target.y });
        for (let c = 1; c <= clickCount; c++) {
          wc.sendInputEvent({ type: "mouseDown", x: target.x, y: target.y, button, clickCount: c });
          wc.sendInputEvent({ type: "mouseUp", x: target.x, y: target.y, button, clickCount: c });
        }
      } else if (!hasCoords) {
        await js(wc, clickScript(args.ref, args.text));
      }
      await settled(wc, 8000);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_type") {
      const field = await point(wc, args.ref, undefined, args.label);
      const ref = args.ref || field.ref;
      if (field && await js(wc, aiCursorScript(field.x, field.y, tr("พิมพ์ข้อความ"))).catch(() => false)) await wait(220);
      if (!(await js(wc, focusScript(ref, args.label)))) throw new Error(`Element ${ref || args.label} cannot take text. Take a new browser_snapshot and pick an input.`);
      wc.focus();
      await wait(50);
      const text = String(args.text ?? "");
      // Typed text replaces the selected old value. (A Backspace input event could land after the
      // inserted text and eat its last letter.) Nothing to type: delete the selection instead.
      if (!args.append) await js(wc, SELECT_ALL);
      if (text) await wc.insertText(text); else if (!args.append) wc.delete();
      if (args.submit) { await wait(60); key(wc, "Enter"); await settled(wc, 8000); }
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_upload") {
      const files = (Array.isArray(args.files) ? args.files : []).map((f) => String(f)).filter(Boolean);
      if (!files.length) throw new Error("files array must contain at least one local file path");
      for (const file of files) if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
      const ref = String(args.ref || "");
      if (!ref) throw new Error("ref of the <input type=file> is required");
      let attached = false;
      let objectId;
      try {
        if (!wc.debugger.isAttached()) { wc.debugger.attach("1.3"); attached = true; }
        const { result } = await wc.debugger.sendCommand("Runtime.evaluate", { expression: fileInputScript(ref) });
        objectId = result?.objectId;
        if (!objectId) throw new Error(`File input ${ref} is unavailable. Take a new browser_snapshot.`);
        await wc.debugger.sendCommand("DOM.setFileInputFiles", { objectId, files: files.map((f) => path.resolve(f)) });
      } finally {
        if (objectId) await wc.debugger.sendCommand("Runtime.releaseObject", { objectId }).catch(() => {});
        if (attached) try { wc.debugger.detach(); } catch {}
      }
      await wait(300);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_press") {
      const parts = String(args.key || "").split("+");
      const last = parts.pop();
      const mods = parts.map((m) => { const low = m.trim().toLowerCase(); return low === "ctrl" ? "control" : low === "cmd" ? "meta" : low; });
      key(wc, last, mods);
      await settled(wc, 5000);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_select") {
      if (!(await js(wc, selectScript(args.ref, args.value)))) throw new Error("Select element or option not found. Take a new browser_snapshot.");
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_scroll") {
      await js(wc, scrollScript(args.direction, args.amount));
      await wait(300);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_back" || tool === "browser_forward") {
      await controller.action(tool === "browser_back" ? "back" : "forward");
      await settled(wc);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_wait") {
      const limit = Math.min(20, Math.max(0, Number(args.seconds) || (args.text ? 10 : 2))) * 1000;
      const started = Date.now();
      if (args.text) {
        while (Date.now() - started < limit) {
          if (await js(wc, hasTextScript(args.text)).catch(() => false)) return { text: await snapshot(wc) };
          await wait(300);
        }
        throw new Error(`"${args.text}" did not appear within ${limit / 1000} s`);
      }
      await wait(limit);
      return { text: await snapshot(wc) };
    }
    throw new Error(`Unknown browser tool: ${tool}`);
  }

  return run;
}
