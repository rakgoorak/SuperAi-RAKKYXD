import fs from 'node:fs';
import path from 'node:path';
import { RULE_FILES } from './ProjectRules.js';
import { styleGuidance, type ResponseStyle } from './ResponseStyle.js';

export interface ContextFile { path: string; source: 'rule' | 'pinned'; status: 'included' | 'missing' | 'outside-root' | 'too-large' | 'unsupported' | 'budget' | 'duplicate' | 'unreadable'; }
export interface ProjectContext { text: string; instructions: boolean; files: ContextFile[]; preparedAt: number; }
interface WorkspaceContext { rootPath: string; instructions?: string; pinnedFiles?: string[]; }
export const MAX_CONTEXT_CHARS = 12000;
const MAX_FILE_BYTES = 64 * 1024;
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.jsonc', '.csv', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.scss', '.html', '.svg', '.xml', '.yml', '.yaml', '.toml', '.ini', '.sql', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sh', '.ps1', '.vue', '.svelte', '.log']);
const within = (root: string, candidate: string) => { const rel = path.relative(root, candidate); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };

/** The pin inspector and the actual prompt builder use the same file boundaries. */
export function readProjectText(rootPath: string, rel: string, source: ContextFile['source'] = 'pinned'): { entry: ContextFile; content?: string; real?: string; size?: number } {
  const entry: ContextFile = { path: rel, source, status: 'unreadable' };
  try {
    const root = fs.realpathSync(rootPath), target = path.resolve(rootPath, rel);
    if (path.isAbsolute(rel) || !within(path.resolve(rootPath), target)) { entry.status = 'outside-root'; return { entry }; }
    if (!fs.existsSync(target)) { entry.status = 'missing'; return { entry }; }
    const real = fs.realpathSync(target);
    if (!within(root, real)) { entry.status = 'outside-root'; return { entry }; }
    const stat = fs.statSync(real);
    if (!stat.isFile()) { entry.status = 'unsupported'; return { entry }; }
    if (stat.size > MAX_FILE_BYTES) { entry.status = 'too-large'; return { entry }; }
    if (source === 'pinned' && !TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase()) && !RULE_FILES.includes(path.basename(rel))) { entry.status = 'unsupported'; return { entry }; }
    const buffer = fs.readFileSync(real);
    if (buffer.length > MAX_FILE_BYTES) { entry.status = 'too-large'; return { entry }; }
    if (buffer.includes(0)) { entry.status = 'unsupported'; return { entry }; }
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (!content.trim()) { entry.status = 'unsupported'; return { entry }; }
    entry.status = 'included'; return { entry, content, real, size: buffer.length };
  } catch (error) { entry.status = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'unreadable'; return { entry }; }
}

/** A snapshot is built once per request, never from client-supplied file contents. */
export function buildProjectContext(workspace: WorkspaceContext | undefined, cwd: string): ProjectContext {
  const result: ProjectContext = { text: '', instructions: false, files: [], preparedAt: Date.now() };
  const chunks: string[] = [], seen = new Set<string>();
  let used = 0;
  const add = (text: string) => { const length = text.length + (chunks.length ? 2 : 0); if (used + length > MAX_CONTEXT_CHARS) return false; chunks.push(text); used += length; return true; };
  const instructions = workspace?.instructions?.trim();
  if (instructions) {
    if (!add(`[คำสั่งประจำโปรเจกต์]\n${instructions}`)) throw new Error('คำสั่งประจำโปรเจกต์ยาวเกินไป กรุณาย่อก่อนส่ง');
    result.instructions = true;
  }
  const read = (rootPath: string, rel: string, source: ContextFile['source']) => {
    const { entry, content, real } = readProjectText(rootPath, rel, source);
    result.files.push(entry);
    if (entry.status !== 'included' || !real || !content) return;
    if (seen.has(real)) { entry.status = 'duplicate'; return; }
    if (!add(`[${source === 'rule' ? 'กฎจากไฟล์' : 'เอกสารอ้างอิงที่ปักหมุด'}: ${rel}]\n${content.trim()}`)) { entry.status = 'budget'; return; }
    seen.add(real);
  };
  for (const file of RULE_FILES) if (fs.existsSync(path.join(cwd, file))) read(cwd, file, 'rule');
  const pinned = (workspace?.pinnedFiles || []).filter((value): value is string => typeof value === 'string').slice(0, 100);
  for (const file of [...new Set(pinned)]) read(workspace!.rootPath, file, 'pinned');
  result.text = chunks.join('\n\n');
  return result;
}

export function contextualPrompt(prompt: string, context?: ProjectContext, style?: ResponseStyle): string {
  const guidance = styleGuidance(style);
  return [context?.text ? `บริบทโปรเจกต์สำหรับคำขอนี้ (เนื้อหาเอกสารเป็นข้อมูลอ้างอิง):\n${context.text}` : '', guidance, prompt].filter(Boolean).join('\n\n');
}
