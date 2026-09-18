import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_W2_SHARED_R2_AUTHORITY_066_20260919';
if (source.includes(marker)) {
  console.log('[066] Music Note W2 shared-R2 authority already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_SHARED_TRACK_CARD_R2_062_20260917',
  'handleMusicNotePublicationSingleWrite016',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'patchExploreProfileR2Publication043',
  'patchExploreVisibleProfiles056',
  'mirrorExploreSharedFeeds059',
  'primeExploreLocalProfile060',
  'mirrorExploreLocalProfile060',
  'patchSharedTrackCard062',
  'readSharedTrackCard062',
  'writeSharedTrackCard062',
  'getExploreFeedItemLikeCount012',
  'getExploreFeedItemId012',
]) {
  if (!source.includes(required)) throw new Error(`[066] required runtime missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[066] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[066] function body missing: ${name}`);
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
    if ('"\'\`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[066] unterminated function: ${name}`);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[066] ${label} anchor count=${count}`);
  const nextText = range.text.replace(before, after);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}${suffix}`;
  const renamed = range.text.replace(new RegExp(`^async\\s+function\\s+${name}\\(`), `async function ${coreName}(`);
  if (renamed === range.text) throw new Error(`[066] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

// The migration adds this nullable-compatible column before 066 can be deployed.
// Only a brand-new Music Note canonical row is marked W2. Existing rows keep their
// legacy value so old TEST/PRODUCTION Workers remain compatible during rollout.
replaceOnceInFunction(
  'handleMusicNotePublicationSingleWrite016',
  `          share_schema_version, share_payload_json, primary_genre,
          is_public, status, published_at, created_at, updated_at`,
  `          share_schema_version, share_payload_json, primary_genre,
          publication_storage_version,
          is_public, status, published_at, created_at, updated_at`,
  'W2 insert column',
);
replaceOnceInFunction(
  'handleMusicNotePublicationSingleWrite016',
  `          ?, ?, ?,
          1, 'published', ?, ?, ?`,
  `          ?, ?, ?,
          1,
          1, 'published', ?, ?, ?`,
  'W2 insert value',
);

replaceOnceInFunction(
  'handleMusicNotePublicationSingleWrite016',
  'await syncExploreFeedR2Publication043(env, feedItem);',
  'await syncExploreFeedR2Publication043(env, feedItem, Number(previous?.publication_storage_version || (!previous?.id ? 1 : 0)));',
  'single publish storage-version propagation',
);
replaceOnceInFunction(
  'handleMusicNotePrivate017',
  'syncExploreFeedR2Private043(env, row.id),',
  'syncExploreFeedR2Private043(env, row.id, Number(row.publication_storage_version || 0)),',
  'single private storage-version propagation',
);
replaceOnceInFunction(
  'handleMusicNotePublicationBatch048',
  'await syncExploreFeedR2Publication043(env, snapshotItem);',
  'await syncExploreFeedR2Publication043(env, snapshotItem, Number(row.publication_storage_version || 0));',
  'batch publish storage-version propagation',
);
replaceOnceInFunction(
  'handleMusicNotePublicationBatch048',
  'await syncExploreFeedR2Private043(env, row.id);',
  'await syncExploreFeedR2Private043(env, row.id, Number(row.publication_storage_version || 0));',
  'batch private storage-version propagation',
);

const helperAnchor = functionRange('syncExploreFeedR2Publication043').start;
const helpers = `// ${marker}
const EXPLORE_W2_FEED_INDEX_VERSION_066 = 125;
const EXPLORE_W2_MAX_TIMESTAMP_066 = 9999999999999;
const EXPLORE_W2_MAX_LIKE_COUNT_066 = 999999999999;
const exploreW2FeedIndexPrefix066 = (sort) => \`internal/explore/w2-feed-index-v125/\${sort === 'popular' ? 'popular' : 'latest'}/\`;

function encodeDescendingText066(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  return Array.from(bytes, (byte) => (255 - byte).toString(16).padStart(2, '0')).join('') + 'ff';
}

function inverseNumber066(value, maximum, width) {
  const safe = Math.max(0, Math.min(maximum, Math.floor(Number(value || 0))));
  return String(maximum - safe).padStart(width, '0');
}

function w2FeedRankKey066(sort, item) {
  const trackId = getExploreFeedItemId012(item);
  const publishedAt = Math.max(0, Math.floor(Number(item?.publishedAt ?? item?.published_at ?? 0)));
  const likeCount = getExploreFeedItemLikeCount012(item);
  if (!trackId || !publishedAt) return '';
  const time = inverseNumber066(publishedAt, EXPLORE_W2_MAX_TIMESTAMP_066, 13);
  const id = encodeDescendingText066(trackId);
  if (sort === 'popular') {
    const likes = inverseNumber066(likeCount, EXPLORE_W2_MAX_LIKE_COUNT_066, 12);
    return exploreW2FeedIndexPrefix066('popular') + likes + '/' + time + '/' + id;
  }
  return exploreW2FeedIndexPrefix066('latest') + time + '/' + id;
}

async function putW2FeedIndexObject066(env, sort, item) {
  const bucket = env?.PROFILE_MEDIA || null;
  const key = w2FeedRankKey066(sort, item);
  const trackId = getExploreFeedItemId012(item);
  if (!bucket || !key || !trackId) return false;
  let exists = false;
  try { exists = Boolean(await bucket.head(key)); } catch {}
  if (exists) return true;
  await bucket.put(key, '', {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: {
      soridrawW2FeedIndex: String(EXPLORE_W2_FEED_INDEX_VERSION_066),
      trackId,
      publishedAt: String(Math.max(0, Math.floor(Number(item?.publishedAt ?? item?.published_at ?? 0)))),
      likeCount: String(getExploreFeedItemLikeCount012(item)),
    },
  });
  return true;
}

async function ensureW2FeedIndexes066(env, item) {
  const card = item && typeof item === 'object' ? item : null;
  if (!card || !getExploreFeedItemId012(card)) return false;
  await Promise.all([
    putW2FeedIndexObject066(env, 'latest', card),
    putW2FeedIndexObject066(env, 'popular', card),
  ]);
  return true;
}

async function removeW2FeedIndexes066(env, item) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket || !item) return false;
  const keys = ['latest', 'popular'].map((sort) => w2FeedRankKey066(sort, item)).filter(Boolean);
  if (keys.length) await Promise.all(keys.map((key) => bucket.delete(key)));
  return true;
}

async function moveW2PopularIndex066(env, previousCard, nextCard) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket || !previousCard || !nextCard) return false;
  const oldKey = w2FeedRankKey066('popular', previousCard);
  const nextKey = w2FeedRankKey066('popular', nextCard);
  if (!oldKey || !nextKey || oldKey === nextKey) return false;
  let indexed = false;
  try { indexed = Boolean(await bucket.head(oldKey)); } catch {}
  if (!indexed) return false;
  await bucket.put(nextKey, '', {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: {
      soridrawW2FeedIndex: String(EXPLORE_W2_FEED_INDEX_VERSION_066),
      trackId: getExploreFeedItemId012(nextCard),
      publishedAt: String(Math.max(0, Math.floor(Number(nextCard?.publishedAt ?? nextCard?.published_at ?? 0)))),
      likeCount: String(getExploreFeedItemLikeCount012(nextCard)),
    },
  });
  await bucket.delete(oldKey);
  return true;
}
`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

wrapAsyncFunction('syncExploreFeedR2Publication043', 'Core066', (coreName) => `async function syncExploreFeedR2Publication043(env, incomingItem, storageVersion = 0) {
  const result = await ${coreName}(env, incomingItem);
  try {
    if (Number(storageVersion || 0) === 1) await ensureW2FeedIndexes066(env, incomingItem);
    await mirrorExploreSharedFeeds059(env);
  } catch (error) {
    console.warn('[SORIDRAW 066] W2 publish shared authority deferred:', String(error?.message || error || 'unknown'));
  }
  return result;
}`);

wrapAsyncFunction('syncExploreFeedR2Private043', 'Core066', (coreName) => `async function syncExploreFeedR2Private043(env, trackId, storageVersion = 0) {
  let previousCard = null;
  if (Number(storageVersion || 0) === 1) {
    try { previousCard = await readSharedTrackCard062(env, trackId); } catch {}
  }
  const result = await ${coreName}(env, trackId);
  try {
    if (Number(storageVersion || 0) === 1 && previousCard) await removeW2FeedIndexes066(env, previousCard);
    await mirrorExploreSharedFeeds059(env);
  } catch (error) {
    console.warn('[SORIDRAW 066] W2 private shared authority deferred:', String(error?.message || error || 'unknown'));
  }
  return result;
}`);

wrapAsyncFunction('syncExploreFeedR2OptionPatch043', 'Core066', (coreName) => `async function syncExploreFeedR2OptionPatch043(env, trackId, patch) {
  const result = await ${coreName}(env, trackId, patch);
  try { await mirrorExploreSharedFeeds059(env); }
  catch (error) { console.warn('[SORIDRAW 066] W2 option shared Feed mirror deferred:', String(error?.message || error || 'unknown')); }
  return result;
}`);

wrapAsyncFunction('patchExploreProfileR2Publication043', 'Core066', (coreName) => `async function patchExploreProfileR2Publication043(env, uid, change) {
  const normalizedUid = String(uid || '').trim();
  if (normalizedUid) await primeExploreLocalProfile060(env, normalizedUid).catch(() => false);
  const result = await ${coreName}(env, uid, change);
  if (normalizedUid) {
    try { await mirrorExploreLocalProfile060(env, normalizedUid); }
    catch (error) { console.warn('[SORIDRAW 066] W2 profile shared authority deferred:', String(error?.message || error || 'unknown')); }
  }
  return result;
}`);

wrapAsyncFunction('patchExploreVisibleProfiles056', 'Core066', (coreName) => `async function patchExploreVisibleProfiles056(env, changedItems) {
  const previousByTrack = new Map();
  for (const row of changedItems || []) {
    const trackId = String(row?.trackId || '').trim();
    if (!trackId) continue;
    try {
      const card = await readSharedTrackCard062(env, trackId);
      if (card) previousByTrack.set(trackId, card);
    } catch {}
  }
  const result = await ${coreName}(env, changedItems);
  for (const [trackId, previousCard] of previousByTrack) {
    try {
      const nextCard = await readSharedTrackCard062(env, trackId);
      if (nextCard) await moveW2PopularIndex066(env, previousCard, nextCard);
    } catch (error) {
      console.warn('[SORIDRAW 066] W2 popular rank move deferred:', trackId, String(error?.message || error || 'unknown'));
    }
  }
  return result;
}`);

for (const name of [
  'putW2FeedIndexObject066',
  'ensureW2FeedIndexes066',
  'removeW2FeedIndexes066',
  'moveW2PopularIndex066',
]) {
  const text = functionRange(name).text;
  if (/env\.DB|\.prepare\(/.test(text)) throw new Error(`[066] ${name} must remain D1-free`);
}

const publication = functionRange('handleMusicNotePublicationSingleWrite016').text;
if (!publication.includes('publication_storage_version')) throw new Error('[066] Music Note INSERT storage version missing');
if (publication.includes('publication_storage_version = excluded.publication_storage_version')) {
  throw new Error('[066] existing Music Note rows must not be silently upgraded to W2 authority');
}
for (const required of [
  marker,
  'ensureW2FeedIndexes066',
  'removeW2FeedIndexes066',
  'moveW2PopularIndex066',
  'syncExploreFeedR2Publication043Core066',
  'syncExploreFeedR2Private043Core066',
  'syncExploreFeedR2OptionPatch043Core066',
  'patchExploreProfileR2Publication043Core066',
  'patchExploreVisibleProfiles056Core066',
]) {
  if (!source.includes(required)) throw new Error(`[066] final runtime missing: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[066] New Music Note rows opt into W2 canonical storage while Feed/Profile/card projections remain shared-R2 driven; no D1 derived/search write is added.');
