/// <reference path="./raw-assets.d.ts" />
import { transform } from 'sucrase';
import reactRuntime from '../../../../node_modules/react/umd/react.production.min.js?raw';
import domRuntime from '../../../../node_modules/react-dom/umd/react-dom.production.min.js?raw';
import { getLocale, tr } from './i18n';

export const visualArtifact = (language: string) => ['html', 'svg', 'mermaid', 'jsx', 'tsx', 'react'].includes(language.toLowerCase());
const js = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const script = (source: string) => `<script>${source.replace(/<\/script/gi, '<\\/script')}</script>`;

export function artifactDocument(language: string, content: string, token: string): string {
  const lang = language.toLowerCase();
  const bridge = `const notify=(status,message='')=>parent.postMessage({channel:'superai-artifact',token:${js(token)},status,message},'*');
    window.addEventListener('error',e=>notify('error',e.message||${js(tr("เกิดข้อผิดพลาดขณะแสดงผล"))}));
    window.addEventListener('unhandledrejection',e=>notify('error',String(e.reason?.message||e.reason)));
    const fail=e=>notify('error',String(e?.message||e));
    let diagramZoom=1;
    const fitDiagram=()=>{const svg=document.querySelector('#artifact-diagram svg');if(!svg)return;const b=svg.viewBox.baseVal;const w=b.width||Number.parseFloat(svg.getAttribute('width'))||640;const h=b.height||Number.parseFloat(svg.getAttribute('height'))||480;const fit=Math.min(1,Math.max(1,innerWidth-48)/w,Math.max(1,innerHeight-48)/h);svg.style.width=(w*fit*diagramZoom)+'px';svg.style.height=(h*fit*diagramZoom)+'px';svg.style.flexShrink='0';};
    window.addEventListener('resize',fitDiagram);
    window.addEventListener('message',e=>{if(e.source===parent&&e.data?.token===${js(token)}&&e.data?.channel==='superai-artifact-zoom'){diagramZoom=Math.max(.25,Math.min(3,Number(e.data.zoom)||1));fitDiagram();}});`;
  const base = `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src data:; img-src data: blob: https:; connect-src https://cdn.jsdelivr.net; base-uri 'none'; form-action 'none'">
    <style>html,body{margin:0;min-height:100%;font-family:'Noto Sans Thai','Segoe UI',sans-serif;line-height:1.6}body{background:#fff;color:#252522}*{box-sizing:border-box}button,input,select,textarea{font:inherit}button{cursor:pointer;padding:8px 14px;border:1px solid #c9cec5;border-radius:8px;background:#f0f3ed;color:#252522}button:focus-visible{outline:2px solid #59785e;outline-offset:3px}#artifact-root{min-height:100vh}#artifact-diagram{padding:24px;width:max-content;min-width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center}#artifact-diagram svg{max-width:none!important;height:auto}</style>
    ${script(bridge)}</head><body>`;
  if (lang === 'mermaid') {
    return base + `<div id="artifact-diagram"></div>${script(`let started=false;window.addEventListener('message',event=>{if(started||event.source!==parent||event.data?.channel!=='superai-artifact-start'||event.data.token!==${js(token)})return;started=true;(async()=>{try{
      const mermaid=await new Promise((resolve,reject)=>{const loader=document.createElement('script');loader.src='https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.min.js';loader.onload=()=>window.mermaid?resolve(window.mermaid):reject(new Error(${js(tr("โหลด Mermaid ไม่สำเร็จ"))}));loader.onerror=()=>reject(new Error(${js(tr("เชื่อมต่อเพื่อโหลด Mermaid ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่"))}));document.head.append(loader);});
      mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',suppressErrorRendering:true,fontFamily:'Segoe UI, sans-serif',themeVariables:{primaryColor:'#edf1eb',primaryTextColor:'#252522',primaryBorderColor:'#8a9c86',lineColor:'#69756b',secondaryColor:'#f3eee7',tertiaryColor:'#f6f6f2'},flowchart:{htmlLabels:false,useMaxWidth:false}});
      const {svg}=await mermaid.render('artifact-mermaid',${js(content)});
      document.getElementById('artifact-diagram').innerHTML=svg;
      fitDiagram();
      notify('ready');
    }catch(e){fail(e);}})();});`)}</body></html>`;
  }
  if (['jsx', 'tsx', 'react'].includes(lang)) {
    // CommonJS conversion keeps imports explicit: only the supplied React runtime is available.
    const compiled = transform(content, { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'classic', production: true, filePath: 'Artifact.tsx' }).code;
    return base + `<div id="artifact-root"></div>${script(reactRuntime)}${script(domRuntime)}${script(`try {
      const exports={};const module={exports};
      const require=name=>{if(name==='react')return React;if(name==='react-dom'||name==='react-dom/client')return ReactDOM;throw new Error(${js(tr("ยังไม่รองรับแพ็กเกจ {0} ใน Artifact นี้ ใช้ React หรือ HTML ที่มีทุกส่วนในไฟล์เดียว"))}.replace('{0}',name));};
      const {useState,useEffect,useRef,useMemo,useCallback,useReducer,useContext,createContext,Fragment}=React;
      ${compiled}
      const Component=module.exports.default||exports.default||(typeof App!=='undefined'?App:typeof Demo!=='undefined'?Demo:null);
      if(!Component)throw new Error(${js(tr("เพิ่ม export default ให้คอมโพเนนต์ หรือใช้ชื่อ App"))});
      class Boundary extends React.Component{constructor(p){super(p);this.state={error:null};}static getDerivedStateFromError(e){return {error:e};}componentDidCatch(e){fail(e);}render(){return this.state.error?null:this.props.children;}}
      ReactDOM.createRoot(document.getElementById('artifact-root')).render(React.createElement(Boundary,null,React.createElement(Component)));
      requestAnimationFrame(()=>notify('ready'));
    }catch(e){fail(e);}`)}</body></html>`;
  }
  if (lang === 'svg') {
    return base + `<div id="artifact-diagram">${content}</div>${script(`window.addEventListener('load',()=>{fitDiagram();notify('ready');});`)}</body></html>`;
  }
  if (lang === 'html') {
    return base + content + script(`window.addEventListener('load',()=>notify('ready'));`) + '</body></html>';
  }
  throw new Error(tr("ชนิดไฟล์นี้ดูได้ในแท็บโค้ด"));
}
