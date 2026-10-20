// packages/voice/thai_normalizer.mjs
/**
 * Advanced Thai Technical Dictation Normalizer
 * Converts spoken Thai phonetic pronunciations into accurate code identifiers,
 * CLI commands, and programming syntax. Far surpasses standard Windows + H.
 */

const TECH_TERMS = [
  // CLI & Package managers
  [/รัน\s*(เดฟ|dev)/gi, 'run dev'],
  [/รัน\s*(บิวด์|บิลด์|build)/gi, 'run build'],
  [/รัน\s*(เทสต์|เทส|test)/gi, 'run test'],
  [/รัน\s*(สตาร์ท|สตาร์ต|start)/gi, 'run start'],
  [/จุด\s*(ทีเอสเอ็กซ์|tsx)/gi, '.tsx'],
  [/จุด\s*(เจเอสเอ็กซ์|jsx)/gi, '.jsx'],
  [/จุด\s*(ทีเอส|ts)/gi, '.ts'],
  [/จุด\s*(เจเอส|js)/gi, '.js'],
  [/จุด\s*(ซีเอสเอส|css)/gi, '.css'],
  [/จุด\s*(เจซอน|เจสัน|json)/gi, '.json'],
  [/จุด\s*(เอ็มดี|md)/gi, '.md'],
  [/จุด\s*(เอชทีเอ็มแอล|html)/gi, '.html'],
  [/อินเด็กซ์|index/gi, 'index'],
  [/เอ็นพีเอ็กซ์|npx/gi, 'npx'],
  [/เอ็นพีเอ็ม|npm/gi, 'npm'],
  [/ยาร์น|yarn/gi, 'yarn'],
  [/พีเอ็นพีเอ็ม|pnpm/gi, 'pnpm'],
  [/บัน|bun/gi, 'bun'],
  [/กิต\s*คอมมิต|git\s*commit/gi, 'git commit'],
  [/กิต\s*พุช|git\s*push/gi, 'git push'],
  [/กิต\s*พูล|git\s*pull/gi, 'git pull'],
  [/กิต\s*สเตตัส|git\s*status/gi, 'git status'],
  [/กิต\s*แอด|git\s*add/gi, 'git add'],
  [/กิต\s*เช็คเอาท์|กิต\s*เช็กเอาต์|git\s*checkout/gi, 'git checkout'],
  [/กิต\s*โคลน|git\s*clone/gi, 'git clone'],
  [/กิต\s*ดิฟ|กิต\s*ดิฟฟ์|git\s*diff/gi, 'git diff'],
  [/กิต\s*บล็อก|กิต\s*ล็อก|git\s*log/gi, 'git log'],
  [/กิต|กิท/g, 'git'],
  [/ด็อกเกอร์\s*คอมโพส|docker\s*compose/gi, 'docker compose'],
  [/ด็อกเกอร์|ดอคเกอร์/g, 'docker'],

  // Frameworks & Libraries
  [/รีแอกต์|รีแอค|react/gi, 'React'],
  [/เน็กซ์\s*เจเอส|เน็กซ์เจเอส|nextjs|next\.js/gi, 'Next.js'],
  [/วิว\s*เจเอส|วิวเจเอส|vuejs|vue\.js/gi, 'Vue.js'],
  [/สเวลต์|svelte/gi, 'Svelte'],
  [/โน้ด\s*เจเอส|โนด\s*เจเอส|nodejs|node\.js/gi, 'Node.js'],
  [/อิเล็กตรอน|electron/gi, 'Electron'],
  [/เทลวินด์|ไทล์วินด์|tailwind/gi, 'Tailwind'],
  [/ไทป์สคริปต์|ไทป์สคริป|typescript/gi, 'TypeScript'],
  [/จาวาสคริปต์|จาวาสคริป|javascript/gi, 'JavaScript'],
  [/ไพทอน|ไพธอน|python/gi, 'Python'],

  // Code Constructs & Identifiers
  [/ฟังก์ชัน|ฟังก์ชั่น|ฟังชั่น/g, 'function'],
  [/คอมโพเนนต์|คอมโพเน้น|คอมโพเนนท์/g, 'component'],
  [/คอนโซล\s*ล็อก|คอนโซล\s*ดอท\s*ล็อก|console\s*log/gi, 'console.log'],
  [/อิมพอร์ต|อิมพอต/g, 'import'],
  [/เอกซ์พอร์ต|เอ็กซ์พอร์ต|เอ็กพอร์ต/g, 'export'],
  [/เทอร์มินัล|เทอมินอล/g, 'terminal'],
  [/คอนฟิก|คอนฟิกกูเรชัน/g, 'config'],
  [/ดาต้าเบส/g, 'database'],
  [/เอพีไอ/g, 'API'],
  [/ยูไอ/g, 'UI'],
  [/ยูอาร์แอล/g, 'URL'],
  [/เจสัน|เจซอน/g, 'JSON'],
  [/ซีเอสเอส/g, 'CSS'],
  [/เอชทีเอ็มแอล/g, 'HTML'],
  [/แบคเอนด์|แบ็กเอนด์/g, 'backend'],
  [/ฟรอนต์เอนด์|ฟร้อนท์เอนด์/g, 'frontend'],
  [/เออเร่อ|เออร์เรอร์/g, 'error'],
  [/บั๊ก/g, 'bug'],
  [/เทสต์|เทส/g, 'test'],
  [/บิลด์|บิวด์/g, 'build'],
  [/เดฟ/g, 'dev'],
  [/พอร์ต|พอร์ท/g, 'port'],
  [/โลคอลโฮสต์|โลคัลโฮสต์/g, 'localhost'],
  [/รีเควสต์|รีเควส/g, 'request'],
  [/เรสปอนส์|ริสปอนส์/g, 'response'],
  [/พารามิเตอร์/g, 'parameter'],
  [/แอตทริบิวต์/g, 'attribute'],
  [/อาร์เรย์|อาเรย์/g, 'array'],
  [/ออบเจกต์|ออบเจ็ค/g, 'object'],
  [/สตริง/g, 'string'],
  [/บูลีน/g, 'boolean'],
  [/พรอมต์|พรอบท์/g, 'prompt'],
  [/เวิร์กสเปซ/g, 'workspace'],
  [/รีโพสิทอรี|รีโป/g, 'repo'],
];

const PUNCTUATION_TERMS = [
  [/\s*(?:จุด|ดอท|ด็อท)\s*/gi, '.'],
  [/\s*(?:ขีดกลาง|ขีด|แดช)\s*/gi, '-'],
  [/\s*(?:อันเดอร์สกอร์|ขีดล่าง)\s*/gi, '_'],
  [/\s*(?:สแลช|ทับ)\s*/gi, '/'],
  [/\s*(?:เท่ากับ)\s*/gi, ' = '],
  [/\s*(?:บวก)\s*/gi, ' + '],
  [/\s*(?:โคลอน)\s*/gi, ': '],
  [/\s*(?:เซมิโคลอน)\s*/gi, '; '],
  [/\s*(?:ขึ้นบรรทัดใหม่)\s*/gi, '\n'],
];

export function normalizeThaiTech(
  text,
  options = { techMode: true, punctuationMode: true },
) {
  if (!text || typeof text !== 'string') return '';
  let result = text;

  if (options.techMode) {
    for (const [pattern, replacement] of TECH_TERMS) {
      result = result.replace(pattern, replacement);
    }
  }

  if (options.punctuationMode) {
    for (const [pattern, replacement] of PUNCTUATION_TERMS) {
      result = result.replace(pattern, replacement);
    }
  }

  // Clean double spaces and edge spacing
  result = result.replace(/[ \t]+/g, ' ').trim();
  return result;
}
