import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// SORIDRAW_LIKE_D1_ATOMIC_CUTOVER_FENCE_174_20260922
//
// Source-only product fence. The control table is intentionally optional until
// the release controller applies the additive 174 schema. Before that moment
// every wrapper falls back to the exact existing legacy path. Once the table
// exists, legacy writes and processor acquisition are serialized by the same
// shared D1 that owns the like rows. No R2 boolean can authorize a D1 write.

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(remoteDir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_LIKE_D1_ATOMIC_CUTOVER_FENCE_174_20260922';
if (source.includes(marker)) {
  console.log('[084/174] atomic D1 cutover fence already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922',
  'SORIDRAW_DIRECT_LIKE_ATOMIC_D1_BATCH_168_20260921',
  'SORIDRAW_BATCH_LIKE_FINAL_CUTOVER_FREEZE_169_20260921',
  'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921',
  'adjustExploreLikeCounterDelta',
  'enqueueExploreLikeBatch035',
  'exploreLikeW1Batch040',
  'acquireExploreLikeProcessor035',
  'createLikeD1OnlyCanonical171',
  'handleLikeBatch034',
  'throwApi',
]) {
  if (!source.includes(required)) throw new Error('[084/174] predecessor missing: ' + required);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[084/174] function missing: ' + name);
  const openParen = source.indexOf('(', start);
  if (openParen < 0) throw new Error('[084/174] function signature missing: ' + name);
  let signatureEnd = -1;
  let parenDepth = 0, signatureQuote = '', signatureEscaped = false, signatureComment = '';
  for (let index = openParen; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
    if (signatureComment === 'line') { if (char === '\n') signatureComment = ''; continue; }
    if (signatureComment === 'block') { if (char === '*' && next === '/') { signatureComment = ''; index += 1; } continue; }
    if (signatureQuote) {
      if (signatureEscaped) signatureEscaped = false;
      else if (char === '\\') signatureEscaped = true;
      else if (char === signatureQuote) signatureQuote = '';
      continue;
    }
    if (char === '/' && next === '/') { signatureComment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { signatureComment = 'block'; index += 1; continue; }
    if ('"\'\`'.includes(char)) { signatureQuote = char; continue; }
    if (char === '(') parenDepth += 1;
    if (char === ')' && --parenDepth === 0) { signatureEnd = index; break; }
  }
  if (signatureEnd < 0) throw new Error('[084/174] function signature unterminated: ' + name);
  const brace = source.indexOf('{', signatureEnd);
  if (brace < 0) throw new Error('[084/174] function body missing: ' + name);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index], next = source[index + 1];
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
    if ('"\'\`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) {
      return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error('[084/174] unterminated function: ' + name);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const helperAnchor = functionRange('adjustExploreLikeCounterDelta').start;
const helpers = `// ${marker}
const EXPLORE_LIKE_CUTOVER_CONTROL_TABLE_174 = 'explore_like_cutover_control_174';

function isMissingLikeCutoverControl174(error) {
  return /no such table:\\s*explore_like_cutover_control_174/i.test(String(error?.message || error || ''));
}

function throwLikeCutoverFenceClosed174(phase) {
  const normalized = String(phase || '').trim();
  throwApi(
    normalized === 'frozen' ? 'LIKE_CUTOVER_FROZEN' : 'LIKE_CUTOVER_DRAINING',
    '좋아요 저장 방식을 안전하게 전환 중입니다. 변경 내용은 기기에 보관되며 잠시 후 다시 동기화됩니다.',
    503,
    { 'Retry-After': '2' },
  );
}

async function assertD1OnlyFrozen174(env) {
  if (!env?.DB?.prepare) throw new Error('[SORIDRAW 174] shared D1 unavailable');
  let row;
  try {
    row = await env.DB.prepare(
      "SELECT phase FROM explore_like_cutover_control_174 WHERE id = 1 LIMIT 1"
    ).first();
  } catch (error) {
    if (isMissingLikeCutoverControl174(error)) {
      throwApi(
        'LIKE_CUTOVER_FENCE_UNAVAILABLE',
        '좋아요 저장 전환 안전장치를 확인 중입니다. 잠시 후 다시 시도해 주세요.',
        503,
        { 'Retry-After': '2' },
      );
    }
    throw error;
  }
  if (String(row?.phase || '') !== 'frozen') throwLikeCutoverFenceClosed174(row?.phase);
  return true;
}
`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

// Direct legacy PUT/DELETE: relation + count already execute in one D1 batch
// (168). Add the control predicate to that SAME batch. A phase transition can
// therefore never split relation/count or slip between the fence and mutation.
{
  const range = functionRange('adjustExploreLikeCounterDelta');
  const coreName = 'adjustExploreLikeCounterDeltaCore174';
  const renamed = range.text.replace(
    /^async\s+function\s+adjustExploreLikeCounterDelta\(/,
    'async function ' + coreName + '(',
  );
  if (renamed === range.text) throw new Error('[084/174] direct core rename failed');
  const wrapper = `
async function adjustExploreLikeCounterDelta(env, trackId, userUid, shouldLike, now) {
  if (!env?.DB?.batch || !env?.DB?.prepare) {
    throw new Error('[SORIDRAW 174] atomic D1 batch unavailable');
  }
  try {
    const relation = shouldLike
      ? env.DB.prepare(\`
        INSERT OR IGNORE INTO likes (track_id, user_uid, created_at)
        SELECT ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM explore_like_cutover_control_174
          WHERE id = 1 AND phase = 'open'
        )
      \`).bind(trackId, userUid, now)
      : env.DB.prepare(\`
        DELETE FROM likes
        WHERE track_id = ? AND user_uid = ?
          AND EXISTS (
            SELECT 1 FROM explore_like_cutover_control_174
            WHERE id = 1 AND phase = 'open'
          )
      \`).bind(trackId, userUid);
    const delta = shouldLike ? 1 : -1;
    const initial = shouldLike ? 1 : 0;
    const result = await env.DB.batch([
      relation,
      env.DB.prepare(\`
        INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
        SELECT ?, ?, 0, 0, ?
        WHERE changes() = 1
        ON CONFLICT(track_id) DO UPDATE SET
          like_count = MAX(0, track_stats.like_count + ?),
          updated_at = excluded.updated_at
      \`).bind(trackId, initial, now, delta),
      env.DB.prepare(\`
        SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1
      \`).bind(trackId),
      env.DB.prepare(\`
        SELECT phase FROM explore_like_cutover_control_174 WHERE id = 1 LIMIT 1
      \`),
    ]);
    if (!Array.isArray(result) || result.length !== 4 ||
        result.some((row) => row?.success === false) ||
        !Number.isInteger(result[0]?.meta?.changes) ||
        result[0].meta.changes < 0 ||
        !Array.isArray(result[2]?.results) || !Array.isArray(result[3]?.results)) {
      throw new Error('[SORIDRAW 174] fenced direct D1 receipt unavailable; retry idempotently');
    }
    // Cloudflare D1 meta.changes includes AFTER-trigger side effects. The live
    // likes table has a shared-revision trigger, so one real relation mutation
    // reports changes=2 even though the direct relation change is exactly one.
    // SQL changes() in the following batch statement remains the direct-change
    // gate for track_stats; do not reject a committed mutation because billing
    // metadata includes trigger work.
    const phase = String(result[3]?.results?.[0]?.phase || '');
    if (phase !== 'open') throwLikeCutoverFenceClosed174(phase);
    return clampExploreSocialCount(result[2].results[0]?.like_count);
  } catch (error) {
    // Before the additive control schema is installed, preserve the exact
    // current 168 path. Any other failure is fail-closed.
    if (isMissingLikeCutoverControl174(error)) {
      return await ${coreName}(env, trackId, userUid, shouldLike, now);
    }
    throw error;
  }
}
`;
  source = source.slice(0, range.start) + renamed + wrapper + source.slice(range.end);
}

// New batch intake: the queue INSERT and control-state read are one D1 batch.
// open => W1 or duplicate W0. draining/frozen => W0 + retriable 503.
// Missing 174 table => exact pre-migration legacy path.
{
  const range = functionRange('enqueueExploreLikeBatch035');
  const coreName = 'enqueueExploreLikeBatch035Core174';
  const renamed = range.text.replace(
    /^async\s+function\s+enqueueExploreLikeBatch035\(/,
    'async function ' + coreName + '(',
  );
  if (renamed === range.text) throw new Error('[084/174] enqueue core rename failed');
  const wrapper = `
async function enqueueExploreLikeBatch035(env, uid, mutations, now) {
  const next = await exploreLikeW1Batch040(uid, mutations, now);
  try {
    const result = await env.DB.batch([
      env.DB.prepare(\`
        INSERT OR IGNORE INTO explore_like_batches_069(
          batch_id, user_uid, created_at, mutation_count, mutations_json
        )
        SELECT ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM explore_like_cutover_control_174
          WHERE id = 1 AND phase = 'open'
        )
      \`).bind(next.batchId, uid, next.batchAt, next.payload.length, JSON.stringify(next.payload)),
      env.DB.prepare(\`
        SELECT phase FROM explore_like_cutover_control_174 WHERE id = 1 LIMIT 1
      \`),
    ]);
    if (!Array.isArray(result) || result.length !== 2 ||
        result.some((row) => row?.success === false) ||
        !Number.isInteger(result[0]?.meta?.changes) ||
        result[0].meta.changes < 0 || result[0].meta.changes > 1 ||
        !Array.isArray(result[1]?.results)) {
      throw new Error('[SORIDRAW 174] fenced queue receipt unavailable');
    }
    const phase = String(result[1]?.results?.[0]?.phase || '');
    if (phase !== 'open') throwLikeCutoverFenceClosed174(phase);
    return {
      batchId: next.batchId,
      inserted: Number(result[0].meta.changes) > 0,
      queue: '069',
      fence174: 'open',
    };
  } catch (error) {
    if (isMissingLikeCutoverControl174(error)) {
      return await ${coreName}(env, uid, mutations, now);
    }
    throw error;
  }
}
`;
  source = source.slice(0, range.start) + renamed + wrapper + source.slice(range.end);
}

// Scheduled legacy drain is allowed in open/draining, but no processor can
// acquire a lease after the controller atomically freezes the shared D1.
{
  const range = functionRange('acquireExploreLikeProcessor035');
  const coreName = 'acquireExploreLikeProcessor035Core174';
  const renamed = range.text.replace(
    /^async\s+function\s+acquireExploreLikeProcessor035\(/,
    'async function ' + coreName + '(',
  );
  if (renamed === range.text) throw new Error('[084/174] processor core rename failed');
  const wrapper = `
async function acquireExploreLikeProcessor035(env, owner, now) {
  try {
    const result = await env.DB.prepare(\`
      UPDATE explore_like_processor_035
      SET lease_until = ?, owner = ?
      WHERE id = 1
        AND (lease_until <= ? OR owner = ?)
        AND EXISTS (
          SELECT 1 FROM explore_like_cutover_control_174
          WHERE id = 1 AND phase IN ('open', 'draining')
        )
      RETURNING owner
    \`).bind(now + EXPLORE_LIKE_PROCESSOR_LEASE_MS_035, owner, now, owner).all();
    return String(result?.results?.[0]?.owner || '') === owner;
  } catch (error) {
    if (isMissingLikeCutoverControl174(error)) {
      return await ${coreName}(env, owner, now);
    }
    throw error;
  }
}
`;
  source = source.slice(0, range.start) + renamed + wrapper + source.slice(range.end);
}

// 171 is not authorized merely because the R2 marker says d1only171. The
// mutation itself is conditionally fenced on shared D1 phase='frozen'.
{
  const range = functionRange('createLikeD1OnlyCanonical171');
  let body = range.text;
  const mutationAnchor = "        SELECT ?, ?, ?, 1, ?, ?\n        WHERE ";
  if (body.split(mutationAnchor).length !== 2) {
    throw new Error('[084/174] 171 mutation fence anchor changed');
  }
  body = body.replace(
    mutationAnchor,
    "        SELECT ?, ?, ?, 1, ?, ?\n" +
    "        WHERE EXISTS (\n" +
    "          SELECT 1 FROM explore_like_cutover_control_174\n" +
    "          WHERE id = 1 AND phase = 'frozen'\n" +
    "        )\n" +
    "          AND "
  );
  replaceFunction('createLikeD1OnlyCanonical171', body);
}

// Give the d1only route a readable fail-closed error before invoking 171.
// The SQL predicate above remains the actual atomic safety boundary.
{
  const range = functionRange('handleLikeBatch034');
  let body = range.text;
  const anchor = `  if (cutover172.mode === 'd1only171') {
    const canonical171 = createLikeD1OnlyCanonical171(env.DB, { cutoverVerified: true });`;
  if (body.split(anchor).length !== 2) throw new Error('[084/174] d1only route anchor changed');
  body = body.replace(anchor, `  if (cutover172.mode === 'd1only171') {
    await assertD1OnlyFrozen174(env);
    const canonical171 = createLikeD1OnlyCanonical171(env.DB, { cutoverVerified: true });`);
  replaceFunction('handleLikeBatch034', body);
}

for (const required of [
  marker,
  'EXPLORE_LIKE_CUTOVER_CONTROL_TABLE_174',
  'adjustExploreLikeCounterDeltaCore174',
  'enqueueExploreLikeBatch035Core174',
  'acquireExploreLikeProcessor035Core174',
  'assertD1OnlyFrozen174',
  "phase = 'open'",
  "phase IN ('open', 'draining')",
  "phase = 'frozen'",
]) {
  if (!source.includes(required)) throw new Error('[084/174] final runtime missing: ' + required);
}

const direct = functionRange('adjustExploreLikeCounterDelta').text;
const enqueue = functionRange('enqueueExploreLikeBatch035').text;
const acquire = functionRange('acquireExploreLikeProcessor035').text;
const canonical = functionRange('createLikeD1OnlyCanonical171').text;
const batch = functionRange('handleLikeBatch034').text;

if (!direct.includes('env.DB.batch([') || !direct.includes("phase = 'open'") ||
    !direct.includes('WHERE changes() = 1')) {
  throw new Error('[084/174] direct relation/count atomic fence missing');
}
if (!enqueue.includes('env.DB.batch([') || !enqueue.includes("phase = 'open'") ||
    !enqueue.includes('INSERT OR IGNORE INTO explore_like_batches_069')) {
  throw new Error('[084/174] queue intake atomic fence missing');
}
if (!acquire.includes("phase IN ('open', 'draining')")) {
  throw new Error('[084/174] processor freeze fence missing');
}
if (!canonical.includes("phase = 'frozen'")) {
  throw new Error('[084/174] 171 frozen fence missing');
}
if (!batch.includes('await assertD1OnlyFrozen174(env);')) {
  throw new Error('[084/174] d1only fail-closed precheck missing');
}

writeFileSync(path, source, 'utf8');
console.log('[084/174] Legacy direct/queue writes and processor acquisition are now serialized by shared D1 phase; 171 writes require frozen.');
