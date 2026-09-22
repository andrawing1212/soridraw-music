import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[085] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_LEGACY_LIKE_DIRECT_NORMALIZE_185_20260922';
if (source.includes(marker)) { console.log('[085/185] already applied'); process.exit(0); }

for (const required of [
  'async function handleLikeBatch034(request, env, cors) {',
  'await assertLegacyLikeIntakeOpen165(env);',
  'adjustExploreLikeCounterDelta',
  'getPublicTrackForWrite',
  'syncExploreLikeR2AfterBatch074',
  'rebuildExploreLikeR2Bundle',
  'patchSharedFeedLikeCounts065',
  'patchExploreProfileR2Like044',
]) if (!source.includes(required)) throw new Error('[085/185] missing prerequisite: ' + required);

function functionRange(name) {
  const needle = 'async function ' + name + '(';
  const start = source.indexOf(needle);
  if (start < 0) throw new Error('[085/185] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], next = source[i + 1];
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
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[085/185] unterminated function: ' + name);
}

const range = functionRange('handleLikeBatch034');
const anchor = '  await assertLegacyLikeIntakeOpen165(env);';
const legacyStart = range.text.indexOf(anchor);
if (legacyStart < 0) throw new Error('[085/185] legacy branch anchor missing');

const direct = [
  '  // ' + marker,
  '  // Functionality-first recovery: legacy batch settles requested state synchronously.',
  '  // One real toggle changes membership + track_stats only in canonical D1 (W2).',
  '  await assertLegacyLikeIntakeOpen165(env);',
  '  const results = [];',
  '  const sharedRows185 = [];',
  '  for (const mutation of mutations) {',
  '    const track = await getPublicTrackForWrite(env, mutation.trackId);',
  '    const settledAt = Date.now();',
  '    const likeCount = await adjustExploreLikeCounterDelta(env, mutation.trackId, authContext.uid, mutation.liked, settledAt);',
  '    results.push({ trackId: mutation.trackId, liked: mutation.liked, likeCount });',
  "    sharedRows185.push({ trackId: mutation.trackId, ownerUid: String(track?.owner_uid || '').trim(), likeCount });",
  '    if (track?.owner_uid) {',
  '      try { await patchExploreProfileR2Like044(env, track.owner_uid, mutation.trackId, likeCount); }',
  "      catch (error) { console.warn('[185] profile R2 like patch deferred:', String(error?.message || error || 'unknown')); }",
  '    }',
  '  }',
  '  if (sharedRows185.length) {',
  '    try { await patchSharedFeedLikeCounts065(env, sharedRows185); }',
  "    catch (error) { console.warn('[185] shared feed/card like patch deferred:', String(error?.message || error || 'unknown')); }",
  '  }',
  "  const settlementBatchId185 = 'direct185_' + String(receivedAt) + '_' + crypto.randomUUID();",
  '  let personalR2 = await syncExploreLikeR2AfterBatch074(env, authContext.uid, results, receivedAt, settlementBatchId185);',
  '  if (!personalR2?.ok) {',
  '    try {',
  '      await rebuildExploreLikeR2Bundle(env, authContext.uid);',
  "      personalR2 = { ok: true, repaired: true, reason: personalR2?.reason || 'rebuild' };",
  '    } catch (error) {',
  "      console.warn('[185] canonical D1 settled but personal R2 repair failed:', String(error?.message || error || 'unknown'));",
  "      throwApi('LIKE_PUBLICATION_RETRY_REQUIRED', '좋아요 상태는 저장되었고 기기 간 표시를 맞추는 중입니다. 잠시 후 다시 동기화합니다.', 503, { 'Retry-After': '2' });",
  '    }',
  '  }',
  '  return json({',
  '    ok: true,',
  '    data: {',
  '      results,',
  '      queued: false,',
  '      batchId: settlementBatchId185,',
  "      queue: 'direct-legacy-185',",
  "      canonicalD1: 'settled',",
  "      personalLikeSnapshot: 'settled',",
  "      personalLikeProtocol: 'legacy-direct-185',",
  "      publicLikePublication: 'targeted-r2-185',",
  '    },',
  '  }, 200, cors);',
].join('\n');

const nextFunction = range.text.slice(0, legacyStart) + direct + '\n}';
source = source.slice(0, range.start) + nextFunction + source.slice(range.end);

const finalRange = functionRange('handleLikeBatch034').text;
for (const required of [marker, "queue: 'direct-legacy-185'", "canonicalD1: 'settled'", "personalLikeSnapshot: 'settled'", 'adjustExploreLikeCounterDelta(', 'syncExploreLikeR2AfterBatch074(']) {
  if (!finalRange.includes(required)) throw new Error('[085/185] final batch missing: ' + required);
}
if (finalRange.includes('enqueueExploreLikeBatch035(env, authContext.uid')) throw new Error('[085/185] deferred 069 intake still present');

writeFileSync(workerPath, source, 'utf8');
console.log('[085/185] legacy batch now settles canonical likes synchronously and publishes personal/shared R2; no 069 intake.');
