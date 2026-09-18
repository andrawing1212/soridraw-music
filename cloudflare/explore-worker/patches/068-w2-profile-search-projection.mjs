import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_W2_PROFILE_SEARCH_PROJECTION_068_20260919';
if (source.includes(marker)) {
  console.log('[068] W2 profile/search projection already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_PUBLICATION_W2_SHARED_R2_AUTHORITY_066_20260919',
  'SORIDRAW_W2_FEED_PAGINATION_067_20260919',
  'handleMusicNotePublicationSingleWrite016',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'readSharedTrackCard062',
  'readExploreSharedProfile060',
  'writeExploreSharedProfile060',
  'writeExploreR2Json',
  'exploreProfileR2Key',
  'validExploreProfileR2Bundle020',
  'EXPLORE_R2_PROFILE_SCHEMA_VERSION',
  'inverseNumber066',
  'encodeDescendingText066',
  'handlePublicProfile',
  'handleFollowR2Core',
]) {
  if (!source.includes(required)) throw new Error('[068] required runtime missing: ' + required);
}

const functionRange = (name) => {
  const needles = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[068] function missing: ' + name);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error('[068] function body missing: ' + name);
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
  throw new Error('[068] unterminated function: ' + name);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error('[068] ' + label + ' anchor count=' + count);
  const nextText = range.text.replace(before, after);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const wrapAsyncFunction = (name, suffix, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = name + suffix;
  const renamed = range.text.replace(
    new RegExp('^async\\s+function\\s+' + name + '\\('),
    'async function ' + coreName + '(',
  );
  if (renamed === range.text) throw new Error('[068] could not wrap ' + name);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

const helperAnchor = functionRange('handleMusicNotePublicationSingleWrite016').start;
const helpers = `// ${marker}
const EXPLORE_W2_PROFILE_INDEX_PREFIX_068 = 'internal/explore/w2-profile-index-v125/';
const EXPLORE_W2_TITLE_INDEX_PREFIX_068 = 'internal/explore/w2-title-index-v125/';
const EXPLORE_W2_GENRE_INDEX_PREFIX_068 = 'internal/explore/w2-genre-index-v125/';
const EXPLORE_W2_CREATOR_INDEX_PREFIX_068 = 'internal/explore/w2-creator-index-v125/';

function normalizeW2SearchText068(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\\s+/g, ' ').toLowerCase().slice(0, 240);
}

function w2CardGenre068(item) {
  const genres = item?.shareBundle?.selectedKeywords?.genres;
  if (!Array.isArray(genres)) return '';
  return String(genres.find((value) => String(value || '').trim()) || '').trim().slice(0, 160);
}

function w2ProfileRankKey068(item) {
  const ownerUid = String(item?.ownerUid || item?.owner_uid || '').trim();
  const trackId = getExploreFeedItemId012(item);
  const publishedAt = Math.max(0, Math.floor(Number(item?.publishedAt ?? item?.published_at ?? 0)));
  if (!ownerUid || !trackId || !publishedAt) return '';
  const pinned = item?.profilePinned === true || Number(item?.profile_pinned || 0) === 1 ? '0' : '1';
  return EXPLORE_W2_PROFILE_INDEX_PREFIX_068
    + encodeURIComponent(ownerUid) + '/'
    + pinned + '/'
    + inverseNumber066(publishedAt, EXPLORE_W2_MAX_TIMESTAMP_066, 13) + '/'
    + encodeDescendingText066(trackId);
}

function w2TitleRankKey068(item) {
  const title = normalizeW2SearchText068(item?.title || '');
  const trackId = getExploreFeedItemId012(item);
  const publishedAt = Math.max(0, Math.floor(Number(item?.publishedAt ?? item?.published_at ?? 0)));
  if (!title || !trackId || !publishedAt) return '';
  return EXPLORE_W2_TITLE_INDEX_PREFIX_068
    + encodeURIComponent(title) + '/'
    + inverseNumber066(publishedAt, EXPLORE_W2_MAX_TIMESTAMP_066, 13) + '/'
    + encodeDescendingText066(trackId);
}

function w2GenreRankKey068(item) {
  const genre = normalizeW2SearchText068(w2CardGenre068(item));
  const trackId = getExploreFeedItemId012(item);
  const publishedAt = Math.max(0, Math.floor(Number(item?.publishedAt ?? item?.published_at ?? 0)));
  if (!genre || !trackId || !publishedAt) return '';
  return EXPLORE_W2_GENRE_INDEX_PREFIX_068
    + encodeURIComponent(genre) + '/'
    + inverseNumber066(publishedAt, EXPLORE_W2_MAX_TIMESTAMP_066, 13) + '/'
    + encodeDescendingText066(trackId);
}

function w2CreatorIndexKeys068(profile) {
  const uid = String(profile?.uid || '').trim();
  if (!uid) return [];
  const entries = [];
  const nickname = normalizeW2SearchText068(profile?.nickname || profile?.displayName || '');
  const handle = normalizeW2SearchText068(profile?.handle || '').replace(/^@+/, '');
  if (nickname) entries.push(EXPLORE_W2_CREATOR_INDEX_PREFIX_068 + 'nickname/' + encodeURIComponent(nickname) + '/' + encodeURIComponent(uid));
  if (handle) entries.push(EXPLORE_W2_CREATOR_INDEX_PREFIX_068 + 'handle/' + encodeURIComponent(handle) + '/' + encodeURIComponent(uid));
  return [...new Set(entries)];
}

function w2ProjectionKeys068(item) {
  return [w2ProfileRankKey068(item), w2TitleRankKey068(item), w2GenreRankKey068(item)].filter(Boolean);
}

async function putW2ProjectionObject068(env, key, item) {
  const bucket = env?.PROFILE_MEDIA || null;
  const trackId = getExploreFeedItemId012(item);
  if (!bucket || !key || !trackId) return false;
  await bucket.put(key, '', {
    httpMetadata: { contentType: 'application/octet-stream' },
    customMetadata: {
      soridrawW2Projection: '125',
      trackId,
      ownerUid: String(item?.ownerUid || item?.owner_uid || ''),
      publishedAt: String(Math.max(0, Math.floor(Number(item?.publishedAt ?? item?.published_at ?? 0)))),
      title: String(item?.title || '').slice(0, 240),
      genre: w2CardGenre068(item),
    },
  });
  return true;
}

async function ensureW2CreatorIndex068(env, profile) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket) return false;
  const keys = w2CreatorIndexKeys068(profile);
  for (const key of keys) {
    let exists = false;
    try { exists = Boolean(await bucket.head(key)); } catch {}
    if (exists) continue;
    await bucket.put(key, '', {
      httpMetadata: { contentType: 'application/octet-stream' },
      customMetadata: {
        soridrawW2Creator: '125',
        uid: String(profile?.uid || ''),
        nickname: String(profile?.nickname || profile?.displayName || '').slice(0, 160),
        handle: String(profile?.handle || '').replace(/^@+/, '').slice(0, 80),
      },
    });
  }
  return true;
}

async function updateW2SecondaryProjection068(env, previousItem, nextItem) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket || !nextItem) return false;
  const previousKeys = new Set(w2ProjectionKeys068(previousItem));
  const nextKeys = new Set(w2ProjectionKeys068(nextItem));
  for (const key of nextKeys) await putW2ProjectionObject068(env, key, nextItem);
  const stale = [...previousKeys].filter((key) => !nextKeys.has(key));
  if (stale.length) await Promise.all(stale.map((key) => bucket.delete(key)));
  const ownerUid = String(nextItem?.ownerUid || nextItem?.owner_uid || '').trim();
  if (ownerUid) {
    const shared = await readExploreSharedProfile060(env, ownerUid);
    const profile = shared?.body?.data?.profile || {
      uid: ownerUid,
      nickname: nextItem?.ownerNickname || nextItem?.owner_nickname || '',
      handle: '',
    };
    await ensureW2CreatorIndex068(env, profile);
  }
  return true;
}

async function removeW2SecondaryProjection068(env, item) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket || !item) return false;
  const keys = w2ProjectionKeys068(item);
  if (keys.length) await Promise.all(keys.map((key) => bucket.delete(key)));
  return true;
}

async function bootstrapPublicationProfileR2068(env, authContext, now) {
  const uid = String(authContext?.uid || '').trim();
  if (!uid) throw new Error('[068] publication profile uid missing');
  const existing = await readExploreSharedProfile060(env, uid);
  if (validExploreProfileR2Bundle020(existing)) {
    const p = existing.body.data.profile || {};
    return {
      nickname: String(p.nickname || p.displayName || authContext?.displayName || ''),
      avatarUrl: String(p.avatarUrl || p.avatar_url || authContext?.picture || ''),
      handle: String(p.handle || existing.handle || '').trim().replace(/^@+/, ''),
    };
  }
  const emailPrefix = String(authContext?.email || '').split('@')[0].trim();
  const nickname = String(authContext?.displayName || emailPrefix || 'SORIDRAW 사용자').trim().slice(0, 80);
  const avatarUrl = String(authContext?.picture || '').trim().slice(0, 4000);
  const profile = {
    uid,
    nickname,
    avatarUrl,
    backgroundUrl: '',
    bio: '',
    handle: '',
    genres: [],
    socialLinks: { spotify: '', instagram: '', tiktok: '' },
    followerCount: 0,
    followingCount: 0,
    trackCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const bundle = {
    schemaVersion: EXPLORE_R2_PROFILE_SCHEMA_VERSION,
    uid,
    handle: '',
    revision: 1,
    updatedAt: now,
    body: {
      ok: true,
      data: {
        profile,
        items: [],
        nextCursor: null,
        revision: 1,
        updatedAt: now,
        schemaVersion: 1,
      },
    },
  };
  await writeExploreR2Json(env, exploreProfileR2Key(uid), bundle);
  await writeExploreSharedProfile060(env, bundle);
  await ensureW2CreatorIndex068(env, profile);
  return { nickname, avatarUrl, handle: '' };
}
`;
source = source.slice(0, helperAnchor) + helpers + '\n' + source.slice(helperAnchor);

replaceOnceInFunction(
  'handleMusicNotePublicationSingleWrite016',
  `  let profile = await publicationReadProfileR2024(env, authContext);
  if (!profile && !previous?.id) {
    profile = await publicationEnsureProfile016(env, authContext, previous, now);
  }
  if (!profile) {
    profile = {
      nickname: String(authContext?.displayName || ""),
      avatarUrl: String(authContext?.picture || ""),
      handle: ""
    };
  }`,
  `  let profile = await publicationReadProfileR2024(env, authContext);
  if (!profile && !previous?.id) {
    profile = await bootstrapPublicationProfileR2068(env, authContext, now);
  }
  if (!profile) {
    profile = {
      nickname: String(authContext?.displayName || ""),
      avatarUrl: String(authContext?.picture || ""),
      handle: ""
    };
  }`,
  'new-user profile bootstrap',
);

wrapAsyncFunction('syncExploreFeedR2Publication043', 'Core068', (coreName) => `async function syncExploreFeedR2Publication043(env, incomingItem, storageVersion = 0) {
  let previousCard = null;
  if (Number(storageVersion || 0) === 1) {
    try { previousCard = await readSharedTrackCard062(env, getExploreFeedItemId012(incomingItem)); } catch {}
  }
  const result = await ${coreName}(env, incomingItem, storageVersion);
  if (Number(storageVersion || 0) === 1) {
    try { await updateW2SecondaryProjection068(env, previousCard, incomingItem); }
    catch (error) { console.warn('[SORIDRAW 068] W2 secondary projection deferred:', String(error?.message || error || 'unknown')); }
  }
  return result;
}`);

wrapAsyncFunction('syncExploreFeedR2Private043', 'Core068', (coreName) => `async function syncExploreFeedR2Private043(env, trackId, storageVersion = 0) {
  let previousCard = null;
  if (Number(storageVersion || 0) === 1) {
    try { previousCard = await readSharedTrackCard062(env, trackId); } catch {}
  }
  const result = await ${coreName}(env, trackId, storageVersion);
  if (Number(storageVersion || 0) === 1 && previousCard) {
    try { await removeW2SecondaryProjection068(env, previousCard); }
    catch (error) { console.warn('[SORIDRAW 068] W2 secondary projection remove deferred:', String(error?.message || error || 'unknown')); }
  }
  return result;
}`);

wrapAsyncFunction('syncExploreFeedR2OptionPatch043', 'Core068', (coreName) => `async function syncExploreFeedR2OptionPatch043(env, trackId, patch) {
  let previousCard = null;
  try { previousCard = await readSharedTrackCard062(env, trackId); } catch {}
  const result = await ${coreName}(env, trackId, patch);
  if (previousCard) {
    const oldProfileKey = w2ProfileRankKey068(previousCard);
    if (oldProfileKey) {
      try {
        const bucket = env?.PROFILE_MEDIA || null;
        const indexed = bucket ? await bucket.head(oldProfileKey) : null;
        if (indexed) {
          const nextCard = await readSharedTrackCard062(env, trackId);
          if (nextCard) await updateW2SecondaryProjection068(env, previousCard, nextCard);
        }
      } catch (error) {
        console.warn('[SORIDRAW 068] W2 profile rank option patch deferred:', String(error?.message || error || 'unknown'));
      }
    }
  }
  return result;
}`);

wrapAsyncFunction('handlePublicProfile', 'Core068', (coreName) => `async function handlePublicProfile(profileRef, env, cors) {
  try {
    const shared = await readExploreSharedProfile060(env, profileRef);
    if (validExploreProfileR2Bundle020(shared)) {
      return json({ ok: true, data: { profile: shared.body.data.profile } }, 200, cors);
    }
  } catch {}
  return await ${coreName}(profileRef, env, cors);
}`);

replaceOnceInFunction(
  'handleFollowR2Core',
  `  if (shouldFollow) {
    const target = await env.DB.prepare(\`
      SELECT uid FROM public_profiles WHERE uid = ? AND is_public = 1 LIMIT 1
    \`).bind(targetUid).first();
    if (!target) throwApi("NOT_FOUND", "\\uACF5\\uAC1C \\uD06C\\uB9AC\\uC5D0\\uC774\\uD130\\uB97C \\uCC3E\\uC744 \\uC218 \\uC5C6\\uC2B5\\uB2C8\\uB2E4.", 404);
  }`,
  `  if (shouldFollow) {
    let target = null;
    try {
      const shared = await readExploreSharedProfile060(env, targetUid);
      if (validExploreProfileR2Bundle020(shared)) target = { uid: String(shared.uid || shared.body?.data?.profile?.uid || targetUid) };
    } catch {}
    if (!target) {
      target = await env.DB.prepare(\`
        SELECT uid FROM public_profiles WHERE uid = ? AND is_public = 1 LIMIT 1
      \`).bind(targetUid).first();
    }
    if (!target) throwApi("NOT_FOUND", "\\uACF5\\uAC1C \\uD06C\\uB9AC\\uC5D0\\uC774\\uD130\\uB97C \\uCC3E\\uC744 \\uC218 \\uC5C6\\uC2B5\\uB2C8\\uB2E4.", 404);
  }`,
  'R2-first follow target',
);

for (const name of [
  'bootstrapPublicationProfileR2068',
  'putW2ProjectionObject068',
  'ensureW2CreatorIndex068',
  'updateW2SecondaryProjection068',
  'removeW2SecondaryProjection068',
]) {
  const block = functionRange(name).text;
  if (/env\.DB|\.prepare\(/.test(block)) throw new Error('[068] ' + name + ' must remain D1-free');
}

const publish = functionRange('handleMusicNotePublicationSingleWrite016').text;
if (publish.includes('publicationEnsureProfile016(env, authContext, previous, now)')) {
  throw new Error('[068] first Music Note publication still creates D1 public_profiles row');
}
for (const required of [
  marker,
  'bootstrapPublicationProfileR2068',
  'EXPLORE_W2_PROFILE_INDEX_PREFIX_068',
  'EXPLORE_W2_TITLE_INDEX_PREFIX_068',
  'EXPLORE_W2_GENRE_INDEX_PREFIX_068',
  'EXPLORE_W2_CREATOR_INDEX_PREFIX_068',
  'syncExploreFeedR2Publication043Core068',
  'syncExploreFeedR2Private043Core068',
  'syncExploreFeedR2OptionPatch043Core068',
  'handlePublicProfileCore068',
]) {
  if (!source.includes(required)) throw new Error('[068] final runtime missing: ' + required);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[068] First Music Note publication bootstraps public profile in shared R2, and W2 title/genre/profile/creator projections stay outside D1 writes.');
