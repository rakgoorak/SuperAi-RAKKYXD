import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const output = path.resolve('output/artifact-rendering');
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'fixture.tsx'), `import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PreviewPanel} from '../../packages/studio/client/src/components/PreviewPanel';
import '../../packages/studio/client/src/index.css';
import '../../packages/studio/client/src/minimal-workspace.css';
function Fixture(){const [request,setRequest]=useState();window.show=target=>setRequest({id:crypto.randomUUID(),workspaceId:'fixture',target});return <PreviewPanel embedded request={request} workspaceId="fixture" suspended={false} onClose={()=>{}} onError={console.error}/>;}
createRoot(document.getElementById('root')).render(<Fixture/>);`);
await build({ entryPoints: [path.join(output, 'fixture.tsx')], outdir: output, bundle: true, format: 'esm', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.woff': 'file', '.woff2': 'file' }, plugins: [{ name: 'raw-assets', setup(plugin) {
  plugin.onResolve({ filter: /\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw' }));
  plugin.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: await fs.readFile(args.path, 'utf8'), loader: 'text' }));
} }] });
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return res.writeHead(200, { 'Content-Type': 'text/plain' }).end('LOCAL FILE');
    if (req.url === '/' || req.url === '/web') return res.end(`<html><head><link rel="stylesheet" href="/fixture.css"><style>#root .preview-panel{width:100%!important;height:100%;border:0}#root .browser-canvas{flex:1;min-height:0}#root .artifact-title{font-size:14px}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`);
    const file = path.resolve(output, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(output + path.sep)) return res.writeHead(403).end();
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' })[path.extname(file)] || 'application/octet-stream' }).end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const checks = [], errors = [];
const check = (value, message) => { assert.ok(value, message); checks.push(message); console.log('PASS ' + message); };
try {
  const page = await browser.newPage({ locale: 'th-TH',  viewport: { width: 620, height: 900 } });
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => { console.log('PAGEERROR', error.stack); errors.push(error.message); });
  // No external network is used. This stub verifies Mermaid loading/configuration/render wiring,
  // not the actual Mermaid parser; real-CDN rendering requires a separate online check.
  let mermaidRequests = 0, registryFailure = false;
  const mermaidSource = () => {
    mermaidRequests++;
    if (registryFailure) throw new Error('Fixture connection unavailable');
    return `window.mermaid={initialize(config){if(config.securityLevel!=='strict')throw Error('strict mode required')},async render(id,source){if(source.includes('INVALID'))throw Error('Parse error on line 2');return {svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 620"><rect width="960" height="620" fill="white"/><text x="40" y="70" font-size="28">Mermaid renderer integration fixture</text><rect x="100" y="120" width="300" height="100" rx="12" fill="#edf1eb" stroke="#8a9c86"/><text x="125" y="180" font-size="24">Frontend</text><path d="M250 220V350" stroke="#69756b" stroke-width="3"/><rect x="100" y="350" width="300" height="100" rx="12" fill="#f3eee7" stroke="#8a9c86"/><text x="125" y="410" font-size="24">Studio Server</text></svg>'}}};`;
  };
  await page.context().route('https://cdn.jsdelivr.net/**', async route => {
    try { await route.fulfill({ contentType: 'text/javascript', body: mermaidSource() }); }
    catch { await route.abort(); }
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => !!window.show);
  const show = (language, content, title = 'ตัวอย่างชิ้นงาน') => page.evaluate(target => window.show(target), { kind: 'artifact', language, content, title });
  const ready = () => page.locator('.artifact-loading').waitFor({ state: 'hidden' });
  const iframe = () => page.frameLocator('.artifact-iframe');
  await show('mermaid', 'graph TD;A-->B;', 'First Mermaid');
  await iframe().locator('svg').waitFor(); await ready();
  mermaidRequests = 0;

  await show('jsx', `export default function App(){const [count,setCount]=React.useState(0);return <main style={{padding:32}}><h1>รายการงานวันนี้</h1><button onClick={()=>setCount(count+1)}>เสร็จแล้ว {count}</button></main>}`);
  await iframe().getByRole('button', { name: 'เสร็จแล้ว 0', exact: true }).click();
  await iframe().getByRole('button', { name: 'เสร็จแล้ว 1', exact: true }).waitFor();
  await ready(); check(true, 'JSX renders and responds to interaction with local React runtime');
  check(mermaidRequests === 0, 'React preview does not need Mermaid or external runtime requests');
  await page.screenshot({ path: path.join(output, 'react-preview.png') });
  await page.getByRole('button', { name: 'โค้ด', exact: true }).click();
  check((await page.locator('.artifact-code-view').innerText()).includes('setCount'), 'code tab retains exact source');
  await show('tsx', `import React,{useState} from 'react';type Props={};export default function Task(_props:Props){const [n,setN]=useState<number>(2);return <button onClick={()=>setN(n+1)}>Count {n}</button>}`);
  await iframe().getByRole('button', { name: 'Count 2', exact: true }).click();
  await iframe().getByRole('button', { name: 'Count 3', exact: true }).waitFor();
  check(await page.getByRole('button', { name: 'แสดงผล', exact: true }).getAttribute('aria-pressed') === 'true', 'selecting a different artifact resets preview and compiles TypeScript/imports');
  await show('jsx', `import other from 'unknown-package'; export default function App(){return <h1>{other}</h1>}`);
  await page.getByRole('alert').waitFor();
  check((await page.getByRole('alert').innerText()).includes('unknown-package'), 'unsupported package produces an actionable error');
  await show('jsx', 'export default function App(){return <broken;}');
  await page.getByRole('alert').waitFor();
  check(await page.getByRole('button', { name: 'ดูโค้ด', exact: true }).isVisible(), 'invalid JSX has an error with source fallback');
  await show('jsx', `export default function App(){throw Error('Component failed')}`);
  await page.getByRole('alert').waitFor();
  check((await page.getByRole('alert').innerText()).includes('Component failed'), 'React render boundary reports component runtime errors');
  await show('html', '<h1>HTML Ready</h1><button onclick="this.textContent=\'Clicked\'">Click me</button>');
  await iframe().getByRole('button', { name: 'Click me', exact: true }).click();
  await iframe().getByRole('button', { name: 'Clicked', exact: true }).waitFor();
  await ready(); check(true, 'HTML renders and remains interactive after an invalid artifact');
  await page.evaluate(() => window.svgReviewFlag = false);
  await show('svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 620"><rect width="960" height="620" fill="#edf1eb"/><text x="30" y="60" font-size="32">SVG Preview</text><foreignObject width="100" height="100"><img xmlns="http://www.w3.org/1999/xhtml" src="/missing" onerror="try{parent.svgReviewFlag=true}catch(e){}"/></foreignObject></svg>`);
  await iframe().locator('svg').waitFor(); await ready();
  check(await page.locator('.artifact-iframe').getAttribute('sandbox') === 'allow-scripts' && !await page.evaluate(() => window.svgReviewFlag), 'SVG remains isolated from parent DOM and app storage');
  await show('svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 620" font-family="Segoe UI,sans-serif"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#708171"/></marker></defs><rect x="10" y="10" width="940" height="165" rx="18" fill="#f5f7f3" stroke="#c6d0bf"/><text x="40" y="55" font-size="25" fill="#3d4b3d">Frontend · พื้นที่ทำงานของคุณ</text><g fill="#e5eddf" stroke="#9bac91"><rect x="40" y="80" width="260" height="65" rx="10"/><rect x="350" y="80" width="260" height="65" rx="10"/><rect x="660" y="80" width="260" height="65" rx="10"/></g><g font-size="24" fill="#293526" text-anchor="middle"><text x="170" y="120">File Explorer</text><text x="480" y="120">Changes</text><text x="790" y="120">Worktrees</text></g><path d="M480 175V245M480 365V435" stroke="#708171" stroke-width="3" marker-end="url(#arrow)"/><rect x="210" y="250" width="540" height="115" rx="16" fill="#f5eee4" stroke="#c4b498"/><text x="480" y="296" text-anchor="middle" font-size="27" fill="#4d4434">Studio Server</text><text x="480" y="333" text-anchor="middle" font-size="21" fill="#746853">ตรวจสอบเส้นทาง · สร้าง · รวมการเปลี่ยนแปลง</text><rect x="210" y="440" width="540" height="140" rx="16" fill="#eef0f3" stroke="#acb5c4"/><text x="480" y="486" text-anchor="middle" font-size="27" fill="#364456">Git Filesystem</text><text x="480" y="526" text-anchor="middle" font-size="22" fill="#627082">main / feature-diff / feature-api</text></svg>`, 'โครงสร้างพื้นที่ทำงาน');
  await iframe().locator('svg').waitFor(); await ready();
  await page.screenshot({ path: path.join(output, 'diagram-preview.png') });
  await page.waitForFunction(() => document.querySelector('.artifact-iframe')?.getBoundingClientRect().height > 200);
  const svgWidth = () => iframe().locator('svg').evaluate(el => el.getBoundingClientRect().width);
  const before = await svgWidth();
  await page.getByTitle('ซูมเข้า', { exact: true }).click();
  await page.waitForTimeout(100);
  check(await svgWidth() > before, 'diagram zoom increases the actual SVG size');
  await page.getByRole('button', { name: 'พอดีจอ', exact: true }).click();
  await page.waitForTimeout(100);
  check(Math.abs(await svgWidth() - before) < 2, 'Fit restores a readable diagram contained by the viewport');
  check(before < 620, 'large SVG initially fits the available panel');
  await page.getByTitle('ขยายพื้นที่', { exact: true }).click();
  const expanded = page.getByRole('dialog', { name: 'ชิ้นงานแบบขยาย', exact: true });
  await expanded.waitFor(); await ready();
  check(await expanded.getByRole('button', { name: 'ปิดมุมมองขยาย', exact: true }).evaluate(el => el.getBoundingClientRect().top >= 65), 'expanded view has a visible close action below the native titlebar');
  await page.screenshot({ path: path.join(output, 'svg-expanded.png') });
  await page.keyboard.press('Escape'); await expanded.waitFor({ state: 'hidden' });
  check(await page.getByTitle('ขยายพื้นที่', { exact: true }).isVisible(), 'Escape returns from expanded view to the preview panel');
  check(await page.getByTitle('ขยายพื้นที่', { exact: true }).evaluate(el => el === document.activeElement), 'closing expanded view restores keyboard focus');
  await show('mermaid', 'flowchart TD\n A[Frontend] --> B[Studio Server]', 'แผนภาพระบบ');
  await iframe().locator('svg').waitFor(); await ready();
  check(mermaidRequests > 0, 'Mermaid loads its pinned renderer and inserts generated SVG (stubbed parser)');
  await page.setViewportSize({ width: 390, height: 760 });
  await page.getByTitle('ขยายพื้นที่', { exact: true }).click(); await ready();
  check(await expanded.locator('.artifact-actions').evaluate(el => el.getBoundingClientRect().right <= innerWidth), 'toolbar fits a narrow expanded viewport');
  await expanded.getByRole('button', { name: 'ปิดมุมมองขยาย', exact: true }).click();
  await show('mermaid', 'INVALID'); await page.getByRole('alert').waitFor();
  check((await page.getByRole('alert').innerText()).includes('Parse error'), 'Mermaid parser errors are surfaced without printing source as a fake preview');
  registryFailure = true;
  await show('mermaid', 'graph TD;A-->B;', 'Offline'); await page.getByRole('alert').waitFor();
  check(await page.getByRole('button', { name: 'ลองใหม่', exact: true }).isVisible(), 'unavailable Mermaid renderer shows retry and source actions');
  registryFailure = false;
  await page.getByRole('button', { name: 'ลองใหม่', exact: true }).click(); await iframe().locator('svg').waitFor(); await ready();
  check(true, 'Mermaid retry reloads the renderer after connection recovery');
  await show('html', '<h1>Old Artifact</h1>');
  await page.evaluate(() => window.show({ kind: 'file', path: 'example.txt' }));
  await page.locator('.preview-file-text').waitFor();
  check(await page.locator('.artifact-preview-panel').count() === 0, 'opening a local file clears the previous artifact');
  await show('html', '<h1>Old Artifact</h1>');
  await page.getByLabel('URL เว็บไซต์', { exact: true }).fill('https://example.com');
  await page.route('https://example.com/**', route => route.fulfill({ body: 'WEB PREVIEW' }));
  await page.getByLabel('URL เว็บไซต์', { exact: true }).press('Enter');
  await page.locator('iframe[title="เว็บไซต์ Preview"]').waitFor();
  check(await page.locator('.artifact-preview-panel').count() === 0, 'address-bar navigation clears the previous artifact');
  check(errors.length === 0, 'preview content does not escape into the parent');
} catch (error) {
  for (const page of browser.contexts().flatMap(context => context.pages())) {
    console.log('FAILURE BODY', await page.locator('body').innerText());
    await page.screenshot({ path: path.join(output, 'failure.png') });
  }
  throw error;
} finally {
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ checks, errors, limitation: 'Mermaid network module is stubbed; real parser/CDN not validated in this restricted environment.' }, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
console.log(`RESULT ${checks.length} checks passed`);


