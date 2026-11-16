// What the AI's browser tools do in the browser panel. Runs in the main process on the active tab's
// webContents: page reading and element lookup run inside the page (scripts shared with Chrome/Edge
// in studio/server/BrowserPage.ts), while clicks and keys are sent as real input events so pages
// react the way they do to a person.
import { normalizeBrowserUrl } from "./browser-url.mjs";
import { tr } from "./i18n.mjs";
import { SNAPSHOT, SELECT_ALL, DIALOG_RELEASE, aiCursorScript, aiThinkingScript, clickScript, describe, dialogGuardScript, findScript, focusScript, hasTextScript, scrollScript, selectScript } from "../studio/dist/BrowserPage.js";

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
  const point = async (wc, ref, text) => {
    const target = await js(wc, findScript(ref, text));
    if (!target) throw new Error(ref ? `No element with ref ${ref}. Take a new browser_snapshot; refs change when the page changes.` : `No clickable element shows "${text}".`);
    await wait(120);
    return target;
  };
  // Real mouse input only reaches the page while its view is on screen.
  const onScreen = () => controller.visible && controller.bounds.width > 0 && controller.bounds.height > 0;
  // reveal() asks the window to show the panel; give it a moment to come on screen before real input.
  const shown = async () => { for (let i = 0; i < 12 && !onScreen(); i++) await wait(100); return onScreen(); };
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
    reveal?.();
    if (tool === "browser_open") {
      const url = normalizeBrowserUrl(String(args.url || ""));
      if (args.newTab || !controller.tabs.size) await controller.action("create", { url });
      else await controller.action("navigate", { url });
      const wc = await active();
      await settled(wc);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_tabs") {
      const before = controller.state();
      if (args.select !== undefined && args.select !== "") {
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
    const acting = ["browser_click", "browser_type", "browser_press", "browser_select"].includes(tool);
    if (acting) await guard(wc);
    try { return await act(wc, tool, args); } finally {
      if (acting) await release(wc);
      // Between actions the AI cursor says the AI is thinking about its next step.
      if (acting) await js(wc, aiThinkingScript(tr("กำลังคิด…")), 2000).catch(() => {});
    }
  };

  async function act(wc, tool, args) {
    if (tool === "browser_snapshot") return { text: await snapshot(wc) };
    if (tool === "browser_screenshot") {
      let image = await wc.capturePage();
      // A view that is covered or hidden paints nothing; capture it while it stays hidden.
      if (image.isEmpty()) image = await wc.capturePage(undefined, { stayHidden: true });
      if (image.isEmpty()) throw new Error(`The browser panel is hidden, so nothing could be captured (visible=${controller.visible}). Use browser_snapshot to read the page instead.`);
      const size = image.getSize();
      const small = size.width > 1280 ? image.resize({ width: 1280 }) : image;
      return { text: `Screenshot of ${wc.getURL()}`, image: { data: small.toPNG().toString("base64"), mimeType: "image/png" } };
    }
    if (tool === "browser_click") {
      const target = await point(wc, args.ref, args.text);
      // The AI's own cursor glides there first, so the user sees where it clicks (their mouse is untouched).
      if (await js(wc, aiCursorScript(target.x, target.y, tr("คลิก"))).catch(() => false)) await wait(330);
      if (await shown()) for (const type of ["mouseMove", "mouseDown", "mouseUp"]) wc.sendInputEvent({ type, x: target.x, y: target.y, button: "left", clickCount: 1 });
      else await js(wc, clickScript(args.ref, args.text));
      await settled(wc, 8000);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_type") {
      const field = await point(wc, args.ref);
      if (field && await js(wc, aiCursorScript(field.x, field.y, tr("พิมพ์ข้อความ"))).catch(() => false)) await wait(330);
      if (!(await js(wc, focusScript(args.ref)))) throw new Error(`Element ${args.ref} cannot take text. Take a new browser_snapshot and pick an input.`);
      wc.focus();
      await wait(60);
      const text = String(args.text ?? "");
      // Typed text replaces the selected old value. (A Backspace input event could land after the
      // inserted text and eat its last letter.) Nothing to type: delete the selection instead.
      if (!args.append) await js(wc, SELECT_ALL);
      if (text) await wc.insertText(text); else if (!args.append) wc.delete();
      if (args.submit) { await wait(80); key(wc, "Enter"); await settled(wc, 8000); }
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_press") {
      const parts = String(args.key || "").split("+");
      key(wc, parts.pop(), parts.map((m) => m.toLowerCase()));
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
