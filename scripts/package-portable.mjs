// Build a portable Windows folder from the installed, tested Electron runtime.
// All dependency files stay inside the artifact; no workspace symlinks remain.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd();const require=createRequire(path.join(root,'package.json'));
const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/[-:]/g,'').replace(' ','-');
const destination=path.join(root,'release',`SuperAi-RAKKYXD-${stamp}`);
const appRoot=path.join(destination,'resources','app');
const electronExecutable=require('electron');const runtime=path.dirname(electronExecutable);
await fs.mkdir(path.dirname(destination),{recursive:true});
await fs.cp(runtime,destination,{recursive:true,filter:source=>!source.endsWith('default_app.asar')});
await fs.rename(path.join(destination,'electron.exe'),path.join(destination,'SuperAi-RAKKYXD.exe'));
await fs.copyFile(path.join(destination,'SuperAi-RAKKYXD.exe'),path.join(destination,'SuperAiVoice-RAKKYXD.exe'));
await fs.mkdir(appRoot,{recursive:true});
await fs.writeFile(path.join(appRoot,'package.json'),JSON.stringify({name:'superai-rakkyxd',productName:'SuperAi & RAKKYXD',version:'1.0.0',type:'module',main:'bootstrap.mjs'},null,2));
await fs.writeFile(path.join(appRoot,'bootstrap.mjs'),`import path from 'node:path';\nconst voice=process.argv.includes('--superai-voice')||path.basename(process.execPath).toLowerCase().includes('voice');\nawait import(voice?'./packages/voice/main.mjs':'./packages/desktop/main.mjs');\n`);
const copy=async(relative)=>fs.cp(path.join(root,relative),path.join(appRoot,relative),{recursive:true,filter:source=>!/[\\/](test|__pycache__)([\\/]|$)/.test(source)&&!source.endsWith('.test.mjs')});
for(const relative of ['packages/desktop','packages/studio/dist','packages/studio/client/dist','packages/voice'])await copy(relative);
await fs.copyFile(path.join(root,'README.md'),path.join(destination,'README.md'));
const topModules=path.join(appRoot,'node_modules');const versions=new Map();const visited=new Map();
async function packageRoot(name,from){
 const resolve=createRequire(path.join(from,'package.json'));let entry;
 try{entry=resolve.resolve(`${name}/package.json`);}catch{entry=resolve.resolve(name);}
 let current=path.dirname(entry);
 while(current!==path.dirname(current)){
  try{const metadata=JSON.parse(await fs.readFile(path.join(current,'package.json'),'utf8'));if(metadata.name===name)return {directory:current,metadata};}catch{}
  current=path.dirname(current);
 }
 throw new Error(`Cannot locate runtime dependency ${name}`);
}
async function include(name,from,parentTarget){
 const {directory,metadata}=await packageRoot(name,from);
 const top=versions.get(name);
 const target=path.join(!top||top===metadata.version?topModules:path.join(parentTarget,'node_modules'),name);
 const key=target+':'+metadata.version;if(visited.has(key))return;
 visited.set(key,true);if(!top)versions.set(name,metadata.version);
 await fs.cp(directory,target,{recursive:true,filter:source=>{const relative=path.relative(directory,source);return !relative.split(path.sep).includes('node_modules')&&!relative.split(path.sep).includes('__pycache__');}});
 const optional=metadata.optionalDependencies||{};
 for(const dependency of new Set([...Object.keys(metadata.dependencies||{}),...Object.keys(optional)])){
  try{await include(dependency,directory,target);}catch(error){if(!(dependency in optional))throw error;}
 }
}
for(const name of ['express','ws','@lydell/node-pty','@opencode-multi/core'])await include(name,root,appRoot);
await fs.writeFile(path.join(destination,'PORTABLE.txt'),'SuperAi & RAKKYXD\r\nOpen SuperAi-RAKKYXD.exe for the workspace.\r\nOpen SuperAiVoice-RAKKYXD.exe for dictation.\r\nKeep this entire folder together. Voice requires Python 3.10+ and a Whisper model. CLI agents require their own installation and accounts.\r\n');
console.log(JSON.stringify({directory:destination,main:path.join(destination,'SuperAi-RAKKYXD.exe'),voice:path.join(destination,'SuperAiVoice-RAKKYXD.exe'),runtimePackages:visited.size}));
