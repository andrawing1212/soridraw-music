import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_DEFERRED_DERIVED_SYNC_033_20260910';
if (source.includes(marker)) {
  console.log('[033] Explore like deferred derived sync already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[033] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[033] function body missing: ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    const next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[033] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

if (!source.includes('SORIDRAW_DERIVED_CHANGE_CACHE_032') && !source.includes('async function derivedNext032(')) {
  throw new Error('[033] required 032 derived runtime behavior missing');
}
for (const required of [
  'syncExploreLikeR2AfterMutation',
  'patchExploreFeedR2LikeCount',
  'patchExploreProfileR2Like020',
  'derivedHead032',
  'syncDerivedCache032',
]) {
  if (!source.includes(required)) throw new Error(`[033] required runtime behavior missing: ${required}`);
}

// Canonical likes + track_stats remain synchronous. Their 032 D1 triggers already
// project the changed track and journal one feed/profile change. Re-reading and
// rewriting latest/popular/profile R2 inside the like request duplicates that work.
replaceFunction('patchExploreFeedR2LikeCount', `async function patchExploreFeedR2LikeCount(env, trackId, likeCount) {
  return { deferred: true, trackId: String(trackId || ''), likeCount: Math.max(0, Number(likeCount || 0)) };
}`);

replaceFunction('patchExploreProfileR2Like020', `async function patchExploreProfileR2Like020(env, ownerUid, trackId, likeCount) {
  return { deferred: true, ownerUid: String(ownerUid || ''), trackId: String(trackId || ''), likeCount: Math.max(0, Number(likeCount || 0)) };
}`);

const feedPatch = functionRange('patchExploreFeedR2LikeCount').text;
const profilePatch = functionRange('patchExploreProfileR2Like020').text;
if (feedPatch.includes('syncDerived') || feedPatch.includes('readExploreR2Json') || feedPatch.includes('writeExploreR2Json')) {
  throw new Error('[033] feed like patch still performs eager derived cache I/O');
}
if (profilePatch.includes('syncDerived') || profilePatch.includes('readExploreR2Json') || profilePatch.includes('writeExploreR2Json')) {
  throw new Error('[033] profile like patch still performs eager derived cache I/O');
}

const markerAt = functionRange('patchExploreFeedR2LikeCount').start;
source = source.slice(0, markerAt) + `// ${marker}\n` + source.slice(markerAt);
writeFileSync(workerPath, source, 'utf8');
console.log('[033] Like mutation now defers feed/profile derived cache refresh to normal 032 revision/first-view consumption.');
