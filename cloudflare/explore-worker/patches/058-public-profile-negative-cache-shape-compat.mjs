import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLIC_PROFILE_NEGATIVE_CACHE_SHAPE_058_20260916';
if (source.includes(marker)) {
  console.log('[058] public-profile negative-cache response shape compatibility already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_PUBLIC_PROFILE_NEGATIVE_CACHE_057_20260916')) {
  throw new Error('[058] requires public-profile negative-cache patch 057.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[058] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[058] unterminated function: ${name}`);
};

const range = functionRange('isCacheableExploreProfileNotFound057');
const next = `// ${marker}\nasync function isCacheableExploreProfileNotFound057(response) {\n  if (!response || response.status !== 404) return false;\n  try {\n    const payload = await response.clone().json();\n    const code = String(payload?.error?.code || payload?.code || '').trim();\n    if (code === 'NOT_FOUND') return true;\n    const message = typeof payload?.error === 'string'\n      ? payload.error.trim()\n      : String(payload?.error?.message || payload?.message || '').trim();\n    return message === 'Profile not found' || message === '공개 프로필을 찾을 수 없습니다.';\n  } catch {\n    return false;\n  }\n}`;
source = source.slice(0, range.start) + next + source.slice(range.end);

const finalFn = functionRange('isCacheableExploreProfileNotFound057').text;
for (const required of ["code === 'NOT_FOUND'", "message === 'Profile not found'", "message === '공개 프로필을 찾을 수 없습니다.'"]) {
  if (!finalFn.includes(required)) throw new Error(`[058] missing response-shape guard: ${required}`);
}
if (finalFn.includes('env.DB.') || finalFn.includes('.prepare(')) throw new Error('[058] response-shape guard must not use D1');

writeFileSync(workerPath, source, 'utf8');
console.log('[058] Public-profile negative cache now recognizes the live legacy 404 body {ok:false,error:"Profile not found"} plus NOT_FOUND-coded responses.');
