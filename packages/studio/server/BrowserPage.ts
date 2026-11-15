/**
 * Scripts the AI's browser tools run inside a web page, shared by the app's browser panel
 * (packages/desktop/browser-automation.mjs) and Chrome/Edge (ExternalBrowser.ts). Each is the
 * source of one expression, evaluated in the page.
 *
 * Elements are found in the page, in open shadow roots (web components) and in same-origin
 * iframes; coordinates are always those of the top page. Cross-origin frames stay out of reach.
 */
const MAX_TEXT = 12000;
const MAX_ELEMENTS = 150;
const CLICKABLE = "a,button,[role=button],[role=link],[role=tab],[role=menuitem],input[type=submit],input[type=button],summary,label";

/** Shared helpers: every root (document, shadow roots, same-origin frames) with its offset, and lookup by ref. */
const DEEP = `
  const __roots = () => {
    const out = [{ root: document, ox: 0, oy: 0 }];
    for (let i = 0; i < out.length && out.length < 80; i++) {
      const { root, ox, oy } = out[i];
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) out.push({ root: el.shadowRoot, ox, oy });
        if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
          try { const d = el.contentDocument; if (d && d.documentElement) { const r = el.getBoundingClientRect(); out.push({ root: d, ox: ox + r.left + el.clientLeft, oy: oy + r.top + el.clientTop }); } } catch (e) {}
        }
      }
    }
    return out;
  };
  const __byRef = (ref) => {
    if (!ref) return null;
    for (const r of __roots()) { const el = r.root.querySelector('[data-superai-ref="' + CSS.escape(ref) + '"]'); if (el) return { el, ox: r.ox, oy: r.oy }; }
    return null;
  };
  const __byText = (text) => {
    if (!text) return null; const want = String(text).toLowerCase();
    for (const r of __roots()) {
      const el = [...r.root.querySelectorAll(${JSON.stringify(CLICKABLE)})].find((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').toLowerCase().includes(want));
      if (el) return { el, ox: r.ox, oy: r.oy };
    }
    return null;
  };
  const __active = () => { let a = document.activeElement; for (let i = 0; i < 20 && a; i++) { const inner = a.shadowRoot?.activeElement || (a.tagName === 'IFRAME' ? (() => { try { return a.contentDocument?.activeElement; } catch (e) { return null; } })() : null); if (!inner || inner === a) break; a = inner; } return a; };
`;
const wrap = (body: string) => `(() => {${DEEP}\n${body}\n})()`;

/** Tags interactive elements with data-superai-ref and describes the page (with dialogs the page showed since last time). */
export const SNAPSHOT = wrap(`
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.innerText || el.value || el.getAttribute('alt') || el.getAttribute('name') || '').replace(/\\s+/g, ' ').trim().slice(0, 100);
  const query = 'a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=radio],[role=switch],[role=option],[role=combobox],[role=textbox],[contenteditable=""],[contenteditable=true],summary';
  const roots = __roots();
  for (const r of roots) r.root.querySelectorAll('[data-superai-ref]').forEach((el) => el.removeAttribute('data-superai-ref'));
  let n = 0; const elements = [];
  for (const r of roots) {
    const where = r.root === document ? '' : r.root.nodeType === 9 ? ' (in frame)' : '';
    for (const el of r.root.querySelectorAll(query)) {
      if (elements.length >= ${MAX_ELEMENTS}) break;
      if (!visible(el) || el.closest('[aria-hidden=true]')) continue;
      const ref = 'e' + (++n); el.setAttribute('data-superai-ref', ref);
      const tag = el.tagName.toLowerCase(); const type = el.getAttribute('type');
      const role = el.getAttribute('role') || (tag === 'a' ? 'link' : tag === 'input' ? (type || 'text') + ' input' : tag);
      const extra = (tag === 'input' || tag === 'textarea') && el.value && type !== 'password' ? ' value="' + String(el.value).slice(0, 60) + '"' : el.checked ? ' checked' : el.disabled ? ' disabled' : '';
      elements.push('[' + ref + '] ' + role + ' "' + label(el) + '"' + extra + where);
    }
  }
  let text = (document.body?.innerText || '');
  for (const r of roots) if (r.root !== document && r.root.nodeType === 9 && r.root.body) text += '\\n[frame]\\n' + r.root.body.innerText;
  text = text.replace(/\\n{3,}/g, '\\n\\n').trim();
  const dialogs = (window.__superaiDialogLog || []).splice(0);
  return { title: document.title, url: location.href, text: text.slice(0, ${MAX_TEXT}), more: text.length > ${MAX_TEXT}, elements, dialogs,
    scroll: Math.round(scrollY) + '/' + Math.max(0, Math.round(document.documentElement.scrollHeight - innerHeight)) };
`);

export interface PageSnapshot { title: string; url: string; text: string; more: boolean; elements: string[]; scroll: string; dialogs?: string[] }

/** Finds an element by ref (or visible text), scrolls it into view and returns its centre in top-page coordinates. */
export const findScript = (ref?: unknown, text?: unknown) => wrap(`
  const hit = __byRef(${JSON.stringify(String(ref || ""))}) || __byText(${JSON.stringify(String(text || ""))});
  if (!hit) return null;
  hit.el.scrollIntoView({ block: 'center', inline: 'center' });
  // A frame scrolled into view moves too: measure it again.
  const again = __byRef(hit.el.getAttribute('data-superai-ref') || '') || hit;
  const r = hit.el.getBoundingClientRect();
  return { x: Math.round(again.ox + r.left + r.width / 2), y: Math.round(again.oy + r.top + r.height / 2), tag: hit.el.tagName.toLowerCase() };
`);

/** A click done by the page itself, for when real input cannot reach it. */
export const clickScript = (ref?: unknown, text?: unknown) => wrap(`
  const hit = __byRef(${JSON.stringify(String(ref || ""))}) || __byText(${JSON.stringify(String(text || ""))});
  if (!hit) return false; hit.el.focus?.(); hit.el.click(); return true;
`);

/** Focuses an input by ref; true when it took the focus. */
export const focusScript = (ref: unknown) => wrap(`
  const hit = __byRef(${JSON.stringify(String(ref || ""))});
  if (!hit) return false; hit.el.scrollIntoView({ block: 'center' }); hit.el.focus(); return __active() === hit.el;
`);

/** Selects all of the focused field's text, so typing replaces it. */
export const SELECT_ALL = wrap(`
  const el = __active();
  if (el && 'value' in el && typeof el.select === 'function') el.select();
  else (el?.ownerDocument || document).execCommand('selectAll');
`);

export const selectScript = (ref: unknown, value: unknown) => wrap(`
  const hit = __byRef(${JSON.stringify(String(ref || ""))}); const el = hit?.el;
  if (!el || el.tagName !== 'SELECT') return false; const want = ${JSON.stringify(String(value || ""))};
  const option = [...el.options].find((o) => o.value === want || o.text.trim() === want); if (!option) return false;
  el.value = option.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true;
`);

export function scrollScript(direction: unknown, amount: unknown): string {
  const by = Number(amount) || 0;
  const how: Record<string, string> = { up: `scrollBy(0, -(${by} || innerHeight * 0.85))`, down: `scrollBy(0, ${by} || innerHeight * 0.85)`, top: "scrollTo(0, 0)", bottom: "scrollTo(0, document.documentElement.scrollHeight)" };
  if (!how[String(direction)]) throw new Error("direction must be up, down, top or bottom");
  return how[String(direction)];
}

export const hasTextScript = (text: unknown) => wrap(`
  const want = ${JSON.stringify(String(text || ""))};
  return __roots().some((r) => ((r.root === document ? document.body : r.root.nodeType === 9 ? r.root.body : r.root.host)?.innerText || '').includes(want));
`);

/**
 * The browser panel (Electron) has no way to answer alert / confirm / prompt for the page, and a
 * dialog left open freezes every script. While the AI acts, the page's dialogs are replaced by
 * ones that answer at once and are reported in the next snapshot. confirm and prompt are
 * cancelled unless browser_dialog said otherwise. DIALOG_RELEASE puts the page's own back, so the
 * user's own clicks later get real dialogs again.
 */
export const dialogGuardScript = (answer?: { accept: boolean; text?: string }) => wrap(`
  if (${JSON.stringify(answer ?? null)}) window.__superaiDialogAnswer = ${JSON.stringify(answer ?? null)};
  const log = (type, message, result) => (window.__superaiDialogLog = window.__superaiDialogLog || []).push(type + ' "' + String(message ?? '').slice(0, 300) + '" -> ' + result);
  const take = () => { const a = window.__superaiDialogAnswer; window.__superaiDialogAnswer = undefined; return a; };
  const guard = (w) => {
    if (!w || w.__superaiDialogOriginal) return;
    w.__superaiDialogOriginal = { alert: w.alert, confirm: w.confirm, prompt: w.prompt };
    w.alert = (m) => { log('alert', m, 'OK'); };
    w.confirm = (m) => { const a = take(); const ok = !!a?.accept; log('confirm', m, ok ? 'OK' : 'Cancel'); return ok; };
    w.prompt = (m, d) => { const a = take(); const v = a?.accept ? (a.text ?? d ?? '') : null; log('prompt', m, v === null ? 'Cancel' : JSON.stringify(v)); return v; };
  };
  guard(window);
  for (const r of __roots()) if (r.root.nodeType === 9) try { guard(r.root.defaultView); } catch (e) {}
  return true;
`);
export const DIALOG_RELEASE = wrap(`
  const release = (w) => { const o = w?.__superaiDialogOriginal; if (!o) return; w.alert = o.alert; w.confirm = o.confirm; w.prompt = o.prompt; delete w.__superaiDialogOriginal; };
  release(window);
  for (const r of __roots()) if (r.root.nodeType === 9) try { release(r.root.defaultView); } catch (e) {}
  return true;
`);

export function describe(snap: PageSnapshot): string {
  const dialogs = snap.dialogs?.length
    ? ["", "Dialogs the page showed (answered automatically; confirm/prompt are cancelled unless you call browser_dialog first and repeat the action):", ...snap.dialogs]
    : [];
  return [`Title: ${snap.title}`, `URL: ${snap.url}`, `Scroll: ${snap.scroll}`, ...dialogs, "",
    "Elements (use the ref in browser_click / browser_type):", ...(snap.elements.length ? snap.elements : ["(none)"]), "",
    "Page text:", snap.text + (snap.more ? "\n…(text cut; scroll and snapshot again for more)" : "")].join("\n");
}
