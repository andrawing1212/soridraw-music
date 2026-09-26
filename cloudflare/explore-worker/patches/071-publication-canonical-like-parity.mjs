import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[071] Worker directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_PUBLICATION_CANONICAL_LIKE_PARITY_071_20260920';
if (source.includes(marker)) { console.log('[071] already applied'); process.exit(0); }
for (const needle of [
  'SORIDRAW_SHARED_FEED_TARGETED_PARITY_069_20260919',
  'SORIDRAW_SHARED_FEED_LEGACY_WRITER_GUARD_070_20260919',
  'async function syncExploreFeedR2Publication043(env, incomingItem)',
  'async function patchExploreProfileR2Publication043(...args)',
]) if (!source.includes(needle)) throw new Error('[071] missing prerequisite: ' + needle);

function replaceOnce(before, after, label) {
  if (source.split(before).length !== 2) throw new Error('[071] unexpected anchor: ' + label);
  source = source.replace(before, after);
}
const helper = [
  '// ' + marker,
  'async function readCanonicalPublicationLike071(env, trackId) {',
  "  const id = String(trackId || '').trim();",
  "  if (!id || !env?.DB) throw new Error('[071] invalid canonical track');",
  '  const row = await env.DB.prepare(',
  '    "SELECT COALESCE(s.like_count,0) AS like_count FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id=? AND t.is_public=1 AND t.status=\'published\' LIMIT 1"',
  '  ).bind(id).first();',
  "  if (!row) throw new Error('[071] canonical public track unavailable');",
  '  const count = Number(row.like_count);',
  "  if (!Number.isFinite(count) || count < 0) throw new Error('[071] invalid canonical like count');",
  '  return Math.floor(count);',
  '}',
  'function withCanonicalPublicationLike071(item, count) {',
  '  return { ...item, likeCount: count, stats: { ...(item?.stats || {}), likeCount: count } };',
  '}',
  '',
].join('\n');

replaceOnce(
  'async function syncExploreFeedR2Publication043(env, incomingItem) {',
  helper + [
    'async function syncExploreFeedR2Publication043(env, incomingItem) {',
    '  let canonicalItem;',
    '  try {',
    "    const trackId = String(incomingItem?.id || incomingItem?.trackId || '').trim();",
    '    const count = await readCanonicalPublicationLike071(env, trackId);',
    '    canonicalItem = withCanonicalPublicationLike071(incomingItem, count);',
    '  } catch (error) {',
    "    console.warn('[SORIDRAW 071] publication count deferred:', String(error?.message || error || 'unknown'));",
    "    return { ok: false, repairNeeded: true, reason: 'canonical_like_unavailable' };",
    '  }',
  ].join('\n'),
  'publication wrapper'
);
replaceOnce(
  'const result = await syncExploreFeedR2Publication043Core069(env, incomingItem);',
  'const result = await syncExploreFeedR2Publication043Core069(env, canonicalItem);',
  'local publication input'
);
replaceOnce('item: incomingItem });', 'item: canonicalItem });', 'shared publication input');
replaceOnce(
  'stats: { ...(incomingItem?.stats || {}), ...(existing?.stats || {}) },',
  'stats: { ...(incomingItem?.stats || {}), ...(existing?.stats || {}), likeCount: incomingItem.likeCount },',
  'local feed stats'
);
replaceOnce(
  'likeCount: existing?.likeCount ?? incomingItem?.likeCount ?? incomingItem?.stats?.likeCount ?? 0,',
  'likeCount: incomingItem.likeCount,',
  'local feed count'
);
replaceOnce(
  'stats: { ...(incoming?.stats || {}), ...(existing?.stats || {}) },',
  'stats: { ...(incoming?.stats || {}), ...(existing?.stats || {}), likeCount: incoming.likeCount },',
  'shared feed stats'
);
replaceOnce(
  'likeCount: existing?.likeCount ?? incoming?.likeCount ?? incoming?.stats?.likeCount ?? 0,',
  'likeCount: incoming.likeCount,',
  'shared feed count'
);
replaceOnce(
  'stats: { ...(change.item?.stats || {}), ...(previous?.stats || {}) },',
  'stats: { ...(change.item?.stats || {}), ...(previous?.stats || {}), likeCount: change.item.likeCount },',
  'profile stats'
);
replaceOnce(
  'likeCount: previous?.likeCount ?? change.item?.likeCount ?? change.item?.stats?.likeCount ?? 0,',
  'likeCount: change.item.likeCount,',
  'profile count'
);
replaceOnce(
  'async function patchExploreProfileR2Publication043(...args) {',
  [
    'async function patchExploreProfileR2Publication043(...args) {',
    '  const change = args[2];',
    '  if (change?.item) {',
    '    try {',
    '      const count = await readCanonicalPublicationLike071(args[0], change.trackId);',
    '      args[2] = { ...change, item: withCanonicalPublicationLike071(change.item, count) };',
    '    } catch (error) {',
    "      console.warn('[SORIDRAW 071] profile publication count deferred:', String(error?.message || error || 'unknown'));",
    "      return { ok: false, repairNeeded: true, reason: 'canonical_like_unavailable' };",
    '    }',
    '  }',
  ].join('\n'),
  'profile wrapper'
);

replaceOnce(
  "  }\n  return result;\n}\n\nasync function handleMusicNotePublicationSingleWrite016",
  [
    "  } else if (uid) {",
    "    try {",
    "      await mirrorExploreLocalProfile060(env, uid);",
    "    } catch (error) {",
    "      console.warn('[SORIDRAW publication] shared profile targeted mirror deferred:', String(error?.message || error || 'unknown'));",
    "    }",
    "  }",
    "  return result;",
    "}",
    "",
    "async function handleMusicNotePublicationSingleWrite016",
  ].join("\n"),
  'shared profile targeted mirror'
);
writeFileSync(path, source, 'utf8');
console.log('[071] key-only D1 canonical like read on actual publication, no read on app update/page navigation.');
