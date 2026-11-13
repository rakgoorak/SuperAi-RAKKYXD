/**
 * Scripts the AI's browser tools run inside a web page, shared by the app's browser panel
 * (packages/desktop/browser-automation.mjs) and Chrome/Edge (ExternalBrowser.ts). Each is the
 * source of one expression, evaluated in the page.
 */
const MAX_TEXT = 12000;
const MAX_ELEMENTS = 150;
const CLICKABLE = "a,button,[role=button],[role=link],input[type=submit],summary,label";
const byRef = (ref: unknown) => `document.querySelector('[data-superai-ref=' + ${JSON.stringify(JSON.stringify(String(ref || "")))} + ']')`;

/** Tags interactive elements with data-superai-ref and describes the page. */
export const SNAPSHOT = `(() => {
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

export interface PageSnapshot { title: string; url: string; text: string; more: boolean; elements: string[]; scroll: string }

/** Finds an element by ref (or visible text), scrolls it into view and returns its centre. */
export const findScript = (ref?: unknown, text?: unknown) => `(() => {
  let el = ${JSON.stringify(String(ref || ""))} ? ${byRef(ref)} : null;
  if (!el && ${JSON.stringify(String(text || ""))}) {
    const want = ${JSON.stringify(String(text || "").toLowerCase())};
    el = [...document.querySelectorAll('${CLICKABLE}')].find((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').toLowerCase().includes(want));
  }
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), tag: el.tagName.toLowerCase() };
})()`;

/** A click done by the page itself, for when real input cannot reach it. */
export const clickScript = (ref?: unknown, text?: unknown) => `(() => {
  let el = ${JSON.stringify(String(ref || ""))} ? ${byRef(ref)} : null;
  if (!el && ${JSON.stringify(String(text || ""))}) el = [...document.querySelectorAll('${CLICKABLE}')]
    .find((e) => (e.innerText || e.value || e.getAttribute('aria-label') || '').toLowerCase().includes(${JSON.stringify(String(text || "").toLowerCase())}));
  if (!el) return false; el.focus?.(); el.click(); return true;
})()`;

/** Focuses an input by ref; true when it took the focus. */
export const focusScript = (ref: unknown) => `(() => { const el = ${byRef(ref)};
  if (!el) return false; el.scrollIntoView({ block: 'center' }); el.focus(); return document.activeElement === el; })()`;

/** Selects all of the focused field's text, so typing replaces it. */
export const SELECT_ALL = `(() => { const el = document.activeElement; if (el && 'value' in el) el.select?.(); else document.execCommand('selectAll'); })()`;

export const selectScript = (ref: unknown, value: unknown) => `(() => { const el = ${byRef(ref)};
  if (!el || el.tagName !== 'SELECT') return false; const want = ${JSON.stringify(String(value || ""))};
  const option = [...el.options].find((o) => o.value === want || o.text.trim() === want); if (!option) return false;
  el.value = option.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`;

export function scrollScript(direction: unknown, amount: unknown): string {
  const by = Number(amount) || 0;
  const how: Record<string, string> = { up: `scrollBy(0, -(${by} || innerHeight * 0.85))`, down: `scrollBy(0, ${by} || innerHeight * 0.85)`, top: "scrollTo(0, 0)", bottom: "scrollTo(0, document.documentElement.scrollHeight)" };
  if (!how[String(direction)]) throw new Error("direction must be up, down, top or bottom");
  return how[String(direction)];
}

export const hasTextScript = (text: unknown) => `(document.body?.innerText || '').includes(${JSON.stringify(String(text || ""))})`;

export function describe(snap: PageSnapshot): string {
  return [`Title: ${snap.title}`, `URL: ${snap.url}`, `Scroll: ${snap.scroll}`, "",
    "Elements (use the ref in browser_click / browser_type):", ...(snap.elements.length ? snap.elements : ["(none)"]), "",
    "Page text:", snap.text + (snap.more ? "\n…(text cut; scroll and snapshot again for more)" : "")].join("\n");
}
