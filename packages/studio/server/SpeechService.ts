import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Chromium on Windows only sees SAPI desktop voices; Thai ("Pattara") ships as a
// OneCore voice, so synthesis goes through WinRT via PowerShell instead.
const PRELUDE = `$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
$null=[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
$asTask=[System.WindowsRuntimeSystemExtensions].GetMethods()|Where-Object{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'}|Select-Object -First 1
function Await($op,[type]$t){$task=$asTask.MakeGenericMethod($t).Invoke($null,@($op));$task.Wait();$task.Result}
`;
const LIST = `${PRELUDE}
[Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices|ForEach-Object{[pscustomobject]@{id=$_.Id;name=$_.DisplayName;lang=$_.Language;gender=[string]$_.Gender}}|ConvertTo-Json -Compress`;
const SPEAK = `${PRELUDE}
$text=[IO.File]::ReadAllText($env:SUPERAI_TTS_TEXT,[Text.Encoding]::UTF8)
$s=New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$all=[Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices
$v=$all|Where-Object{$_.Id -eq $env:SUPERAI_TTS_VOICE}|Select-Object -First 1
if(-not $v){$v=$all|Where-Object{$_.Language -like "$($env:SUPERAI_TTS_LANG)*"}|Select-Object -First 1}
if(-not $v){throw 'NO_VOICE'}
$s.Voice=$v
$s.Options.SpeakingRate=[double]$env:SUPERAI_TTS_RATE
$stream=Await ($s.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$r=New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
$n=Await ($r.LoadAsync([uint32]$stream.Size)) ([uint32])
$b=New-Object byte[] $n;$r.ReadBytes($b);[IO.File]::WriteAllBytes($env:SUPERAI_TTS_OUT,$b)`;

export interface SystemVoice { id: string; name: string; lang: string; gender: string }

const encoded = (script: string) => Buffer.from(script, 'utf16le').toString('base64');
const powershell = (script: string, env: Record<string, string> = {}, timeout = 30000) =>
  execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded(script)], {
    windowsHide: true, timeout, maxBuffer: 1 << 20, encoding: 'utf8', env: { ...process.env, ...env },
  });

export class SpeechService {
  private cache: SystemVoice[] | null = null;
  constructor(private platform = process.platform) {}
  get supported() { return this.platform === 'win32'; }

  async voices(refresh = false): Promise<SystemVoice[]> {
    if (!this.supported) return [];
    if (this.cache && !refresh) return this.cache;
    const { stdout } = await powershell(LIST, {}, 20000);
    const parsed = stdout.trim() ? JSON.parse(stdout) : [];
    this.cache = (Array.isArray(parsed) ? parsed : [parsed]).map((v: any) => ({ id: String(v.id), name: String(v.name), lang: String(v.lang), gender: String(v.gender) }));
    return this.cache;
  }

  async synthesize(text: string, lang: string, voice = '', rate = 1): Promise<Buffer> {
    if (!this.supported) throw new Error('เสียงพูดจากระบบผ่านเซิร์ฟเวอร์รองรับเฉพาะ Windows');
    const clean = text.trim().slice(0, 6000);
    if (!clean) throw new Error('ไม่มีข้อความให้อ่าน');
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(lang)) throw new Error('ภาษาไม่ถูกต้อง');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'superai-tts-'));
    try {
      const input = path.join(dir, 'text.txt'), output = path.join(dir, 'speech.wav');
      fs.writeFileSync(input, clean, 'utf8');
      try {
        await powershell(SPEAK, {
          SUPERAI_TTS_TEXT: input, SUPERAI_TTS_OUT: output, SUPERAI_TTS_LANG: lang,
          SUPERAI_TTS_VOICE: voice.slice(0, 300), SUPERAI_TTS_RATE: String(Math.min(2, Math.max(0.5, rate || 1))),
        }, 60000);
      } catch (error: any) {
        if (String(error.stderr || error.message).includes('NO_VOICE'))
          throw Object.assign(new Error(`ยังไม่มีเสียงพูดภาษา ${lang} ใน Windows เปิด การตั้งค่า → เวลาและภาษา → เสียงพูด แล้วเพิ่มเสียง`), { code: 'NO_VOICE' });
        throw new Error('สร้างเสียงพูดไม่สำเร็จ');
      }
      return fs.readFileSync(output);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
