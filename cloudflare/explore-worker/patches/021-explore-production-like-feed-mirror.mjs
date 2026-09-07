import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_PRODUCTION_LIKE_FEED_MIRROR_021_20260908';
if (source.includes(marker)) {
  console.log('[021] production Explore like feed mirror already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_EXPLORE_PRODUCTION_FEED_MIRROR_020_20260908',
  'fanoutExploreMirror020',
  'exploreMirrorEnvironment020',
  'handleLike',
]) {
  if (!source.includes(required)) throw new Error(`[021] required runtime helper missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[021] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[021] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[021] unterminated function: ${name}`);
};

const range = functionRange('handleLike');
const coreName = 'handleLikeMirrorCore021';
const renamed = range.text.replace(/^(async\s+)?function\s+handleLike\s*\(/, (full) => full.replace('handleLike', coreName));
if (renamed === range.text) throw new Error('[021] could not rename handleLike');

const wrapper = `async function handleLike(request, env, cors, trackId, shouldLike) {
  const response = await ${coreName}(request, env, cors, trackId, shouldLike);
  if (response.ok && exploreMirrorEnvironment020(env) === "production") {
    try {
      const payload = await response.clone().json();
      const changedTrackId = String(payload?.data?.trackId || trackId || "").trim();
      if (changedTrackId) await fanoutExploreMirror020(env, changedTrackId, false);
    } catch (error) {
      console.warn("[SORIDRAW 021] production like-feed mirror skipped:", String(error?.message || error || "unknown"));
    }
  }
  return response;
}`;

source = source.slice(0, range.start) + `// ${marker}\n${wrapper}\n\n${renamed}` + source.slice(range.end);

for (const required of [marker, coreName, 'await fanoutExploreMirror020(env, changedTrackId, false)']) {
  if (!source.includes(required)) throw new Error(`[021] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[021] production like-count/popular-feed changes now mirror to isolated Preview/Test without mirroring user like identity.');
