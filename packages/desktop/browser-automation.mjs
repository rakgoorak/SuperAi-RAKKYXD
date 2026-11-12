// What the AI's browser tools do in the browser panel. Runs in the main process on the active tab's
// webContents: page reading and element lookup run inside the page, while clicks and keys are sent
// as real input events so pages react the way they do to a person.
import { normalizeBrowserUrl } from "./browser-url.mjs";

const MAX_TEXT = 12000;
const MAX_ELEMENTS = 150;

// Runs inside the page. Tags interactive elements with data-superai-ref and describes the page.
const SNAPSHOT = `(() => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.innerText || el.value || el.getAttribute('alt') || el.getAttribute('name') || '').replace(/\\s+/g, ' ').trim().slice(0, 100);
  const query = 'a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=option],[contenteditable=""],[contenteditable=true],summary';
  let n = 0; const elements = [];
  document.querySelectorAll('[data-superai-ref]').forEach((el) => el.removeAttribute('data-superai-ref'));
  for (const el of document.querySelectorAll(query)) {
    if (!visible(el) || el.closest('[aria-hidden=true]')) continue;
    if (elements.length >= ${MAX_ELEMENTS}) break;
    const ref = 'e' + (++n); el.setAttribute('data-superai-ref', ref);
    const tag = el.tagName.toLowerCase(); const type = el.getAttribute('type');
    const role = el.getAttribute('role') || (tag === 'a' ? 'link' : tag === 'input' ? (type || 'text') + ' input' : tag);
    const extra = (tag === 'input' || tag === 'textarea') && el.value ? ' value="' + String(el.value).slice(0, 60) + '"' : el.checked ? ' checked' : el.disabled ? ' disabled' : '';
    elements.push('[' + ref + '] ' + role + ' "' + label(el) + '"' + extra);
  }
  const text = (document.body?.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim();
  return { title: document.title, url: location.href, text: text.slice(0, ${MAX_TEXT}), more: text.length > ${MAX_TEXT}, elements,
    scroll: Math.round(scrollY) + '/' + Math.max(0, Math.round(document.documentElement.scrollHeight - innerHeight)) };
})()`;

const find = (ref, text) => `(() => {
  let el = ${JSON.stringify(ref || "")} ? document.querySelector('[data-superai-ref=' + JSON.stringify(${JSON.stringify(ref || "")}) + ']') : null;
  if (!el && ${JSON.stringify(text || "")}) {
    const want = ${JSON.stringify((text || "").toLowerCase())};
    el = [...document.querySelectorAll('a,button,[role=button],[role=link],input[type=submit],summary,label')]
      .find((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').toLowerCase().includes(want));
  }
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), tag: el.tagName.toLowerCase() };
})()`;

// Fallbacks used when the panel is covered (a dialog is open) and real input cannot reach the page.
const jsClick = (ref, text) => `(() => {
  let el = ${JSON.stringify(ref || "")} ? document.querySelector('[data-superai-ref=' + JSON.stringify(${JSON.stringify(ref || "")}) + ']') : null;
  if (!el && ${JSON.stringify(text || "")}) el = [...document.querySelectorAll('a,button,[role=button],[role=link],input[type=submit],summary,label')]
    .find((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').toLowerCase().includes(${JSON.stringify((text || "").toLowerCase())}));
  if (!el) return false; el.focus?.(); el.click(); return true;
})()`;

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

function describe(snap) {
  return [`Title: ${snap.title}`, `URL: ${snap.url}`, `Scroll: ${snap.scroll}`, "",
    "Elements (use the ref in browser_click / browser_type):", ...(snap.elements.length ? snap.elements : ["(none)"]), "",
    "Page text:", snap.text + (snap.more ? "\n…(text cut; scroll and snapshot again for more)" : "")].join("\n");
}

export function createBrowserAutomation(controller, { reveal } = {}) {
  const active = async (open) => {
    let tab = controller.tabs.get(controller.activeId);
    if (!tab && open) { await controller.action("create", { url: open }); tab = controller.tabs.get(controller.activeId); }
    if (!tab) throw new Error("No browser tab is open. Use browser_open first.");
    return tab.view.webContents;
  };
  const snapshot = async (wc) => describe(await wc.executeJavaScript(SNAPSHOT, true));
  const point = async (wc, ref, text) => {
    const target = await wc.executeJavaScript(find(ref, text), true);
    if (!target) throw new Error(ref ? `No element with ref ${ref}. Take a new browser_snapshot; refs change when the page changes.` : `No clickable element shows "${text}".`);
    await wait(120);
    return target;
  };
  // Real mouse input only reaches the page while its view is on screen.
  const onScreen = () => controller.visible && controller.bounds.width > 0 && controller.bounds.height > 0;
  const focus = (wc, ref) => wc.executeJavaScript(`(() => { const el = document.querySelector('[data-superai-ref=' + ${JSON.stringify(JSON.stringify(String(ref || "")))} + ']');
    if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus(); return document.activeElement === el; })()`, true);
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
      else await wc.executeJavaScript(jsClick(args.ref, args.text), true);
      await settled(wc, 8000);
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_type") {
      await point(wc, args.ref);
      if (!(await focus(wc, args.ref))) throw new Error(`Element ${args.ref} cannot take text. Take a new browser_snapshot and pick an input.`);
      wc.focus();
      await wait(60);
      if (!args.append) {
        await wc.executeJavaScript(`(() => { const el = document.activeElement; if (el && 'value' in el) { el.select?.(); } else document.execCommand('selectAll'); })()`, true);
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
      const ok = await wc.executeJavaScript(`(() => { const el = document.querySelector('[data-superai-ref=' + ${JSON.stringify(JSON.stringify(String(args.ref || "")))} + ']');
        if (!el || el.tagName !== 'SELECT') return false; const want = ${JSON.stringify(String(args.value || ""))};
        const option = [...el.options].find((o) => o.value === want || o.text.trim() === want); if (!option) return false;
        el.value = option.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`, true);
      if (!ok) throw new Error("Select element or option not found. Take a new browser_snapshot.");
      return { text: await snapshot(wc) };
    }
    if (tool === "browser_scroll") {
      const amount = Number(args.amount) || 0;
      const how = { up: `scrollBy(0, -(${amount} || innerHeight * 0.85))`, down: `scrollBy(0, ${amount} || innerHeight * 0.85)`, top: "scrollTo(0, 0)", bottom: "scrollTo(0, document.documentElement.scrollHeight)" }[args.direction];
      if (!how) throw new Error("direction must be up, down, top or bottom");
      await wc.executeJavaScript(how, true);
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
          if (await wc.executeJavaScript(`(document.body?.innerText || '').includes(${JSON.stringify(String(args.text))})`, true)) return { text: await snapshot(wc) };
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
