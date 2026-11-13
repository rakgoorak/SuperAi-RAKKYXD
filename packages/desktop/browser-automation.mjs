// What the AI's browser tools do in the browser panel. Runs in the main process on the active tab's
// webContents: page reading and element lookup run inside the page (scripts shared with Chrome/Edge
// in studio/server/BrowserPage.ts), while clicks and keys are sent as real input events so pages
// react the way they do to a person.
import { normalizeBrowserUrl } from "./browser-url.mjs";
import { SNAPSHOT, SELECT_ALL, clickScript, describe, findScript, focusScript, hasTextScript, scrollScript, selectScript } from "../studio/dist/BrowserPage.js";

const KEYS = { enter: "Enter", tab: "Tab", escape: "Escape", esc: "Escape", backspace: "Backspace", delete: "Delete", space: "Space",
  arrowup: "Up", arrowdown: "Down", arrowleft: "Left", arrowright: "Right", up: "Up", down: "Down", left: "Left", right: "Right",
  pageup: "PageUp", pagedown: "PageDown", home: "Home", end: "End" };

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

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
  const snapshot = async (wc) => describe(await wc.executeJavaScript(SNAPSHOT, true));
  const point = async (wc, ref, text) => {
    const target = await wc.executeJavaScript(findScript(ref, text), true);
    if (!target) throw new Error(ref ? `No element with ref ${ref}. Take a new browser_snapshot; refs change when the page changes.` : `No clickable element shows "${text}".`);
    await wait(120);
    return target;
  };
  // Real mouse input only reaches the page while its view is on screen.
  const onScreen = () => controller.visible && controller.bounds.width > 0 && controller.bounds.height > 0;
  const key = (wc, name, modifiers = []) => {
    const keyCode = KEYS[String(name).toLowerCase()] || name;
    wc.sendInputEvent({ type: "keyDown", keyCode, modifiers });
    // Enter and printable keys also need a "char" event, or forms and inputs ignore them.
    const char = keyCode === "Enter" ? "\r" : keyCode === "Space" ? " " : keyCode.length === 1 ? keyCode : "";
    if (char) wc.sendInputEvent({ type: "char", keyCode: char, modifiers });
    wc.sendInputEvent({ type: "keyUp", keyCode, modifiers });
  };

  return async function run(tool, args = {}) {
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
      if (args.select) await controller.action("select", { id: String(args.select) });
      const state = controller.state();
      return { text: state.tabs.map((t) => `${t.id === state.activeId ? "* " : "  "}${t.id}  ${t.title}  ${t.url}`).join("\n") || "(no tabs)" };
    }
    const wc = await active();
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
      if (onScreen()) for (const type of ["mouseMove", "mouseDown", "mouseUp"]) wc.sendInputEvent({ type, x: target.x, y: target.y, button: "left", clickCount: 1 });
      else await wc.executeJavaScript(clickScript(args.ref, args.text), true);
      await settled(wc, 8000);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_type") {
      await point(wc, args.ref);
      if (!(await wc.executeJavaScript(focusScript(args.ref), true))) throw new Error(`Element ${args.ref} cannot take text. Take a new browser_snapshot and pick an input.`);
      wc.focus();
      await wait(60);
      if (!args.append) {
        await wc.executeJavaScript(SELECT_ALL, true);
        key(wc, "Backspace");
      }
      await wc.insertText(String(args.text ?? ""));
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
      if (!(await wc.executeJavaScript(selectScript(args.ref, args.value), true))) throw new Error("Select element or option not found. Take a new browser_snapshot.");
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_scroll") {
      await wc.executeJavaScript(scrollScript(args.direction, args.amount), true);
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
          if (await wc.executeJavaScript(hasTextScript(args.text), true)) return { text: await snapshot(wc) };
          await wait(300);
        }
        throw new Error(`"${args.text}" did not appear within ${limit / 1000} s`);
      }
      await wait(limit);
      return { text: await snapshot(wc) };
    }
    throw new Error(`Unknown browser tool: ${tool}`);
  };
}
