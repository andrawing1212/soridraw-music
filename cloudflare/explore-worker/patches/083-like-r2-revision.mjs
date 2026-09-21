import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(remoteDir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_LIKE_R2_REVISION_ROUTE_173_20260922';
if (source.includes(marker)) {
  console.log('[083/173] revision-safe like R2 route already applied.');
  process.exit(0);
}
for (const needed of [
  'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921',
  'SORIDRAW_SHARED_SOCIAL_R2_PARITY_061_20260917',
  'SORIDRAW_SHARED_FEED_R2_PARITY_059_20260917',
  'SORIDRAW_SHARED_PROFILE_R2_PARITY_060_20260917',
  'SORIDRAW_SHARED_TRACK_CARD_R2_062_20260917',
  'exploreSharedTrackCardKey062',
  'exploreSharedFeedR2Key059',
  'exploreSharedProfileR2Key060',
  'sortExploreFeedItems012',
  'EXPLORE_R2_FEED_LIMIT',
  'handleLikeBatch034',
  'writeSharedLikes061',
]) {
  if (!source.includes(needed)) throw new Error('[083/173] predecessor missing: ' + needed);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[083/173] function missing: ' + name);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error('[083/173] function body missing: ' + name);
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
    if ('"\'\`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[083/173] unterminated function: ' + name);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const runtimePath = new URL('../runtime/like-r2-revision-173.mjs', import.meta.url);
let runtime = readFileSync(runtimePath, 'utf8');
if (!runtime.includes('SORIDRAW_LIKE_R2_REVISION_SAFE_173_20260922') ||
    !runtime.includes('applyGenerationGuard173') ||
    !runtime.includes('applyPersonalLikeRevision173') ||
    !runtime.includes('onlyIf: read.object?.etag')) {
  throw new Error('[083/173] unreviewed 173 runtime fragment');
}
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(runtime)) {
  throw new Error('[083/173] 173 R2 publication runtime must remain D1-free');
}
runtime = runtime.replace(/^export\s+/gm, '');
const batchAnchor = functionRange('handleLikeBatch034').start;
source = source.slice(0, batchAnchor) + runtime + '\n// ' + marker + '\n' + source.slice(batchAnchor);

{
  const range = functionRange('writeSharedLikes061');
  const oldGuard = '  if (existing?.canonicalComplete156 === true) return false;';
  if (range.text.split(oldGuard).length !== 2) throw new Error('[083/173] shared-like legacy guard anchor changed');
  replaceFunction('writeSharedLikes061', range.text.replace(
    oldGuard,
    "  if (existing?.canonicalComplete156 === true || existing?.revisionProtocol173 === 'd1only171') return false;"
  ));
}

{
  const range = functionRange('handleLikeBatch034');
  let body = range.text;
  const listAnchor = `    const canonical171 = createLikeD1OnlyCanonical171(env.DB, { cutoverVerified: true });
    const results171 = [];
    for (const mutation of mutations) {`;
  if (body.split(listAnchor).length !== 2) throw new Error('[083/173] 172 D1-only list anchor changed');
  body = body.replace(listAnchor, `    const canonical171 = createLikeD1OnlyCanonical171(env.DB, { cutoverVerified: true });
    const publisher173 = createLikeR2RevisionPublisher173(env, {
      trackCardKey: exploreSharedTrackCardKey062,
      feedKey: exploreSharedFeedR2Key059,
      profileKey: exploreSharedProfileR2Key060,
      sortItems: sortExploreFeedItems012,
      feedLimit: EXPLORE_R2_FEED_LIMIT,
    });
    const results171 = [];
    const publicationFailures173 = [];
    for (const mutation of mutations) {`);

  const settleAnchor = `      const settled = await canonical171.applyAtomically(
        authContext.uid,
        mutation.trackId,
        mutation.liked,
        {
          expectedRevision: mutation.expectedRevision,
          operationId: mutation.operationId,
          now: receivedAt,
        },
      );
      results171.push({`;
  if (body.split(settleAnchor).length !== 2) throw new Error('[083/173] 172 settlement anchor changed');
  body = body.replace(settleAnchor, `      const settled = await canonical171.applyAtomically(
        authContext.uid,
        mutation.trackId,
        mutation.liked,
        {
          expectedRevision: mutation.expectedRevision,
          operationId: mutation.operationId,
          now: receivedAt,
        },
      );
      const publication173 = await publisher173.publish({
        uid: authContext.uid,
        trackId: mutation.trackId,
        liked: settled.liked,
        likeCount: settled.likeCount,
        revision: settled.revision,
        generation: settled.generation,
        operationId: settled.operationId || mutation.operationId,
        status: settled.status,
      });
      if (!publication173.ok) publicationFailures173.push({ trackId: mutation.trackId, stage: publication173.stage || publication173.reason || 'unknown' });
      results171.push({`);

  const returnAnchor = `    return json({
      ok: true,
      data: {
        results: results171,`;
  if (body.split(returnAnchor).length !== 2) throw new Error('[083/173] 172 response anchor changed');
  body = body.replace(returnAnchor, `    if (publicationFailures173.length) {
      console.warn('[SORIDRAW 173] canonical D1 settled but R2 publication needs retry:', JSON.stringify(publicationFailures173));
      throwApi(
        'LIKE_PUBLICATION_RETRY_REQUIRED',
        '좋아요 상태는 저장되었고 기기 간 표시를 맞추는 중입니다. 잠시 후 다시 동기화합니다.',
        503,
        { 'Retry-After': '2' },
      );
    }
    return json({
      ok: true,
      data: {
        results: results171,`);
  body = body.replace(
    "        personalLikeSnapshot: 'pending',",
    "        personalLikeSnapshot: 'revision-safe-173',\n        publicLikePublication: 'generation-safe-173',"
  );
  replaceFunction('handleLikeBatch034', body);
}

const finalBatch = functionRange('handleLikeBatch034').text;
const finalLegacyWriter = functionRange('writeSharedLikes061').text;
for (const required of [
  marker,
  'createLikeR2RevisionPublisher173',
  'LIKE_PUBLICATION_RETRY_REQUIRED',
  "personalLikeSnapshot: 'revision-safe-173'",
  "publicLikePublication: 'generation-safe-173'",
]) {
  if (!source.includes(required)) throw new Error('[083/173] final runtime missing: ' + required);
}
if (!finalBatch.includes('canonical171.applyAtomically') ||
    finalBatch.indexOf('canonical171.applyAtomically') > finalBatch.indexOf('publisher173.publish')) {
  throw new Error('[083/173] R2 publication must occur only after canonical D1 settlement');
}
if (!finalBatch.includes("'Retry-After': '2'")) throw new Error('[083/173] retry response missing');
if (!finalLegacyWriter.includes("revisionProtocol173 === 'd1only171'")) {
  throw new Error('[083/173] legacy full-list overwrite guard missing');
}
writeFileSync(path, source, 'utf8');
console.log('[083/173] D1-only likes now publish generation/revision-safe shared R2 after canonical settlement; failures retry with D1 W0 semantics.');
