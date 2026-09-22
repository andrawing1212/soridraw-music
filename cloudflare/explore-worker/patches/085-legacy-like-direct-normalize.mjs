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
  '  // SORIDRAW_LEGACY_LIKE_POSTWRITE_ACK_186_20260922',
  '  // Canonical D1 is already committed above. R2/cache publication is best-effort:',
  '  // it must never turn a successful mutation into HTTP 5xx and cause client replay.',
  '  let catalogBefore185 = null;',
  '  try { catalogBefore185 = await readSharedLikesState161(env, authContext.uid); }',
  "  catch (error) { console.warn('[186] personal catalog pre-read deferred:', String(error?.message || error || 'unknown')); }",
  "  let personalR2 = { ok: false, repairNeeded: true, reason: 'not-attempted' };",
  '  try { personalR2 = await syncExploreLikeR2AfterBatch074(env, authContext.uid, results, receivedAt, settlementBatchId185); }',
  "  catch (error) { console.warn('[186] personal R2 incremental publish deferred:', String(error?.message || error || 'unknown')); }",
  "  let personalLikeSnapshot185 = 'repair-needed';",
  '  if (personalR2?.ok && catalogBefore185?.exact) {',
  '    try {',
  '      const key185 = exploreSharedLikesKey061(authContext.uid);',
  '      let exactFinalized185 = false;',
  '      for (let attempt185 = 0; attempt185 < 8; attempt185 += 1) {',
  '        const object185 = await env.PROFILE_MEDIA.get(key185);',
  '        if (!object185) break;',
  '        let body185 = null; try { body185 = JSON.parse(await object185.text()); } catch {}',
  '        if (!body185 || !Array.isArray(body185.likedTrackIds)) break;',
  "        const ids185 = [...new Set(body185.likedTrackIds.map((id) => String(id || '').trim()).filter(Boolean))];",
  "        const next185 = { ...body185, canonicalComplete156: true, exactLikeCount156: ids185.length, canonicalSource156: 'direct-d1-catalog-186', updatedAt: Date.now(), likedTrackIds: ids185 };",
  "        const stored185 = await env.PROFILE_MEDIA.put(key185, JSON.stringify(next185), { onlyIf: { etagMatches: object185.etag }, httpMetadata: { contentType: 'application/json; charset=utf-8' }, customMetadata: { soridrawSharedLikes: '186', updatedAt: String(next185.updatedAt) } });",
  '        if (stored185) { exactFinalized185 = true; break; }',
  '      }',
  "      if (exactFinalized185) personalLikeSnapshot185 = 'settled';",
  '    } catch (catalogError185) {',
  "      console.warn('[186] exact personal catalog metadata finalize deferred:', String(catalogError185?.message || catalogError185 || 'unknown'));",
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
  '      personalLikeSnapshot: personalLikeSnapshot185,',
  "      personalLikeProtocol: 'legacy-direct-185',",
  "      publicLikePublication: 'targeted-r2-185',",
  '    },',
  '  }, 200, cors);',
].join('\n');

const nextFunction = range.text.slice(0, legacyStart) + direct + '\n}';
source = source.slice(0, range.start) + nextFunction + source.slice(range.end);

const finalRange = functionRange('handleLikeBatch034').text;
for (const required of [marker, 'SORIDRAW_LEGACY_LIKE_POSTWRITE_ACK_186_20260922', "queue: 'direct-legacy-185'", "canonicalD1: 'settled'", 'personalLikeSnapshot: personalLikeSnapshot185', 'adjustExploreLikeCounterDelta(', 'syncExploreLikeR2AfterBatch074(']) {
  if (!finalRange.includes(required)) throw new Error('[085/185] final batch missing: ' + required);
}
if (finalRange.includes('enqueueExploreLikeBatch035(env, authContext.uid')) throw new Error('[085/185] deferred 069 intake still present');
if (finalRange.includes("throwApi('LIKE_PUBLICATION_RETRY_REQUIRED'")) throw new Error('[085/186] post-write publication still converts canonical success to retry');
if (finalRange.includes('SELECT l.track_id FROM likes l JOIN tracks t')) throw new Error('[085/186] full personal like scan remains in mutation hotpath');

writeFileSync(workerPath, source, 'utf8');
console.log('[085/186] legacy batch settles canonical likes synchronously; post-write R2 is best-effort and never replays canonical success.');
