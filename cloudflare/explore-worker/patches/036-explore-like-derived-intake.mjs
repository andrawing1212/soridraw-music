import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_EXPLORE_LIKE_DERIVED_INTAKE_036_20260911';
if (source.includes(marker)) {
  console.log('[036] Explore derived like intake already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[036] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[036] function body missing: ${name}`);
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
  throw new Error(`[036] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

for (const required of [
  'readExploreLikeBatchStates035',
  'processExploreLikeAggregateWave035',
  'explore_derived_tracks',
  'explore_derived_profiles',
]) {
  if (!source.includes(required)) throw new Error(`[036] required 035/derived behavior missing: ${required}`);
}

replaceFunction('readExploreLikeBatchStates035', `// ${marker}
async function readExploreLikeBatchStates035(env, uid, mutations) {
  const trackIds = mutations.map((row) => String(row.trackId || '')).filter(Boolean);
  if (!trackIds.length) return new Map();
  const values = trackIds.map(() => '(?)').join(',');
  const rows = await env.DB.prepare(\`
    WITH requested(track_id) AS (VALUES \${values})
    SELECT
      r.track_id,
      CASE
        WHEN t.id IS NOT NULL AND t.active = 1 AND p.uid IS NOT NULL AND p.active = 1 THEN 1
        ELSE 0
      END AS valid_track,
      COALESCE(t.likes, 0) AS like_count,
      CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END AS canonical_liked
    FROM requested r
    LEFT JOIN explore_derived_tracks t
      ON t.id = r.track_id
    LEFT JOIN explore_derived_profiles p
      ON p.uid = t.owner_uid
    LEFT JOIN likes l
      ON l.track_id = r.track_id AND l.user_uid = ?
  \`).bind(...trackIds, uid).all();
  return new Map((rows?.results || []).map((row) => [String(row.track_id || ''), row]));
}`);

if (!source.includes(marker)) throw new Error('[036] final source marker missing');
const intake = functionRange('readExploreLikeBatchStates035').text;
for (const required of [
  'LEFT JOIN explore_derived_tracks',
  'LEFT JOIN explore_derived_profiles',
  'LEFT JOIN likes',
  't.active = 1',
  'p.active = 1',
  'COALESCE(t.likes, 0)',
]) {
  if (!intake.includes(required)) throw new Error(`[036] final intake missing: ${required}`);
}
for (const forbidden of [
  'LEFT JOIN tracks ',
  'LEFT JOIN public_profiles ',
  'LEFT JOIN track_stats ',
]) {
  if (intake.includes(forbidden)) throw new Error(`[036] old canonical intake join remained: ${forbidden.trim()}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[036] Explore like intake now reuses keyed derived track/profile rows; canonical likes relation remains authoritative.');
