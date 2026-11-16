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

/**
 * The AI's own pointer in the page: an arrow with an "AI" tag that glides to (x, y) and pulses.
 * It lives in a closed shadow root and takes no clicks, so page scripts, snapshots and the
 * element under the point never see it; the user's own mouse is never used.
 */
export const aiCursorScript = (x: number, y: number, label = "") => `(() => {
  const ID = '__superai_ai_cursor';
  let host = document.getElementById(ID);
  if (!host) {
    host = document.createElement('div');
    host.id = ID;
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = '<style>.c{position:fixed;left:0;top:0;transition:transform .32s cubic-bezier(.2,.8,.2,1),opacity .3s;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}'
      + '.t{position:absolute;left:18px;top:20px;padding:2px 8px;border-radius:99px;font:700 11px system-ui,sans-serif;color:#05110b;background:linear-gradient(135deg,#3ddc84,#38bdf8);white-space:nowrap}'
      + '.r{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;border:2px solid #3ddc84;opacity:0}'
      + '.r.go{animation:r .5s ease-out}@keyframes r{from{opacity:1;transform:scale(.4)}to{opacity:0;transform:scale(1.8)}}.c.idle{opacity:0}'
      + '.s:not(:empty)::before{content:" · "}.t.k .s{background:linear-gradient(90deg,#05110b 0 35%,#f2fff8 50%,#05110b 65% 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:sh 1.6s linear infinite}'
      + '@keyframes sh{from{background-position:100% 0}to{background-position:-150% 0}}.d{display:none}.t.k .d{display:inline-flex;gap:2px;margin-left:4px;vertical-align:middle}'
      + '.d i{width:3px;height:3px;border-radius:50%;background:#05110b;animation:hp 1s ease-in-out infinite}.d i:nth-child(2){animation-delay:.15s}.d i:nth-child(3){animation-delay:.3s}@keyframes hp{50%{transform:translateY(-3px);opacity:.5}}</style>'
      + '<div class="c"><span class="r"></span><svg width="22" height="26" viewBox="0 0 22 26"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ddc84"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs>'
      + '<path d="M1.5 1.5 L1.5 21 L7 16 L10.5 24 L14 22.5 L10.5 15 L18 15 Z" fill="url(#g)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="t"><b>AI</b><span class="s"></span><span class="d"><i></i><i></i><i></i></span></span></div>';
    const c = root.querySelector('.c');
    c.style.transform = 'translate(' + (${x} - 90) + 'px,' + (${y} - 60) + 'px)';
    Object.defineProperty(host, '__c', { value: c });
    (document.body || document.documentElement).appendChild(host);
    void c.offsetWidth;
  }
  const c = host.__c, ring = c.querySelector('.r');
  c.classList.remove('idle');
  c.querySelector('.t').classList.remove('k');
  c.querySelector('.s').textContent = ${JSON.stringify(String(label))};
  c.style.transform = 'translate(' + ${x} + 'px,' + ${y} + 'px)';
  clearTimeout(host.__t);
  host.__t = setTimeout(() => { ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go'); }, 300);
  clearTimeout(host.__h);
  host.__h = setTimeout(() => c.classList.add('idle'), 20000);
  return true;
})()`;

/** The label next to the AI cursor while the AI works out its next step (no cursor yet: nothing). */
export const aiThinkingScript = (label: string) => `(() => {
  const host = document.getElementById('__superai_ai_cursor');
  if (!host || !host.__c) return false;
  const c = host.__c;
  c.querySelector('.s').textContent = ${JSON.stringify(String(label))};
  c.querySelector('.t').classList.add('k');
  clearTimeout(host.__h);
  host.__h = setTimeout(() => c.classList.add('idle'), 20000);
  return true;
})()`;

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
