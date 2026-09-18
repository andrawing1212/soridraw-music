import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_MUTATION_COMPANIONS_017_20260905';
if (source.includes(marker)) {
  console.log('[017] publication mutation companions already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_PUBLICATION_SINGLE_WRITE_HOTPATH_016_20260905')) {
  throw new Error('[017] patch 016 must be applied first.');
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[017] function missing: ${name}`);
  const brace = source.indexOf('{', start);
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
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[017] unterminated function: ${name}`);
};

const replaceFunction = (name, text) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + text + source.slice(range.end);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[017] ${label} anchor count=${count}`);
  const next = range.text.replace(before, after);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

async function publicationReadState017(env, uid, trackId) {
  return await env.DB.prepare(`
    SELECT
      t.*,
      COALESCE(s.like_count, 0) AS like_count,
      COALESCE(s.comment_count, 0) AS comment_count,
      COALESCE(s.play_count, 0) AS play_count,
      p.uid AS profile_uid,
      p.nickname AS profile_nickname,
      p.avatar_url AS profile_avatar_url,
      p.handle AS profile_handle,
      p.is_public AS profile_is_public
    FROM (SELECT 1 AS seed) q
    LEFT JOIN tracks t ON t.id = ? AND t.owner_uid = ?
    LEFT JOIN track_stats s ON s.track_id = t.id
    LEFT JOIN public_profiles p ON p.uid = ?
    LIMIT 1
  `).bind(trackId, uid, uid).first();
}

async function publicationEnsureProfile017(env, authContext, row, now) {
  const handle = String(row?.profile_handle || '').trim();
  if (row?.profile_uid && Number(row.profile_is_public || 0) === 1) {
    return {
      nickname: String(row.profile_nickname || authContext.displayName || ''),
      avatarUrl: String(row.profile_avatar_url || authContext.picture || ''),
      handle
    };
  }
  if (row?.profile_uid) {
    await env.DB.prepare(`
      UPDATE public_profiles
      SET is_public = 1, updated_at = ?
      WHERE uid = ?
    `).bind(now, authContext.uid).run();
    return {
      nickname: String(row.profile_nickname || authContext.displayName || ''),
      avatarUrl: String(row.profile_avatar_url || authContext.picture || ''),
      handle
    };
  }
  const emailPrefix = String(authContext.email || '').split('@')[0].trim();
  const nickname = firstNonEmptyString(authContext.displayName, emailPrefix, 'SORIDRAW 사용자').slice(0, 80);
  const avatarUrl = firstNonEmptyString(authContext.picture).slice(0, 4e3);
  await env.DB.prepare(`
    INSERT INTO public_profiles (uid, nickname, avatar_url, bio, is_public, created_at, updated_at)
    VALUES (?, ?, ?, '', 1, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET is_public = 1, updated_at = excluded.updated_at
  `).bind(authContext.uid, nickname, avatarUrl, now, now).run();
  return { nickname, avatarUrl, handle: '' };
}

async function invalidatePublicationProfileCaches017(request, env, uid, handle) {
  try {
    if (env?.PROFILE_MEDIA) await env.PROFILE_MEDIA.delete(exploreProfileR2Key(uid));
  } catch (error) {
    console.warn('[SORIDRAW stage3] profile R2 invalidation skipped:', String(error?.message || error || 'unknown'));
  }
  try {
    await invalidatePublicProfileFirstViewEdgeCache(request, [uid, handle].filter(Boolean));
  } catch (error) {
    console.warn('[SORIDRAW stage3] profile edge invalidation skipped:', String(error?.message || error || 'unknown'));
  }
}

async function syncExploreFeedR2OptionPatch017(env, trackId, patch) {
  try {
    const bundles = await Promise.all([
      readExploreR2Json(env, exploreFeedR2Key('latest')),
      readExploreR2Json(env, exploreFeedR2Key('popular'))
    ]);
    await Promise.all(['latest', 'popular'].map(async (sort, index) => {
      const bundle = bundles[index];
      if (!bundle?.payload?.data || !Array.isArray(bundle.payload.data.items)) return;
      let changed = false;
      bundle.payload.data.items = bundle.payload.data.items.map((item) => {
        if (getExploreFeedItemId012(item) !== trackId) return item;
        changed = true;
        return { ...item, ...patch };
      });
      if (!changed) return;
      bundle.payload.data.items = sortExploreFeedItems012(bundle.payload.data.items, sort).slice(0, EXPLORE_R2_FEED_LIMIT);
      bundle.updatedAt = Date.now();
      await writeExploreR2Json(env, exploreFeedR2Key(sort), bundle);
    }));
  } catch (error) {
    console.warn('[SORIDRAW stage3] option feed R2 patch skipped:', String(error?.message || error || 'unknown'));
  }
}

async function syncExploreFeedR2Private017(env, trackId) {
  try {
    const bundles = await Promise.all([
      readExploreR2Json(env, exploreFeedR2Key('latest')),
      readExploreR2Json(env, exploreFeedR2Key('popular'))
    ]);
    await Promise.all(['latest', 'popular'].map(async (sort, index) => {
      const bundle = bundles[index];
      if (!bundle?.payload?.data || !Array.isArray(bundle.payload.data.items)) return;
      const before = bundle.payload.data.items.length;
      bundle.payload.data.items = bundle.payload.data.items.filter((item) => getExploreFeedItemId012(item) !== trackId);
      if (bundle.payload.data.items.length === before) return;
      bundle.updatedAt = Date.now();
      await writeExploreR2Json(env, exploreFeedR2Key(sort), bundle);
    }));
  } catch (error) {
    console.warn('[SORIDRAW stage3] private feed R2 removal skipped:', String(error?.message || error || 'unknown'));
  }
}

async function handleMusicNotePublicationOptions017(request, env, cors, authContext, body, row) {
  const options = normalizePublicationOptions(body);
  if (!hasPublicationOptionChanges(options)) {
    throwApi('PUBLICATION_OPTIONS_REQUIRED', '변경할 공개 옵션이 필요합니다.', 400);
  }
  const next = {
    allowNextSongApply: publicationBool016(options.allowNextSongApply, Number(row.allow_next_song_apply || 0) === 1),
    allowFollowerSave: publicationBool016(options.allowFollowerSave, Number(row.allow_follower_save || 0) === 1),
    profilePinned: publicationBool016(options.profilePinned, Number(row.profile_pinned || 0) === 1)
  };
  const changed = Number(row.allow_next_song_apply || 0) !== next.allowNextSongApply
    || Number(row.allow_follower_save || 0) !== next.allowFollowerSave
    || Number(row.profile_pinned || 0) !== next.profilePinned;
  const now = Date.now();
  if (changed) {
    await env.DB.prepare(`
      UPDATE tracks
      SET allow_next_song_apply = ?, allow_follower_save = ?, profile_pinned = ?, updated_at = ?
      WHERE id = ? AND owner_uid = ?
    `).bind(
      next.allowNextSongApply,
      next.allowFollowerSave,
      next.profilePinned,
      now,
      row.id,
      authContext.uid
    ).run();
  }
  try {
    await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, row.source_id, {
      status: Number(row.is_public || 0) === 1 ? 'public' : 'private',
      trackId: row.id,
      allowNextSongApply: next.allowNextSongApply === 1,
      allowFollowerSave: next.allowFollowerSave === 1,
      profilePinned: next.profilePinned === 1
    });
  } catch (error) {
    console.warn('[SORIDRAW stage3] option publication-state R2 sync skipped:', String(error?.message || error || 'unknown'));
  }
  await syncExploreFeedR2OptionPatch017(env, row.id, {
    allowNextSongApply: next.allowNextSongApply === 1,
    allowFollowerSave: next.allowFollowerSave === 1,
    profilePinned: next.profilePinned === 1
  });
  if (changed && Number(row.profile_pinned || 0) !== next.profilePinned) {
    await invalidatePublicationProfileCaches017(request, env, authContext.uid, row.profile_handle || '');
  }
  return json({ ok: true, data: {
    trackId: row.id,
    allowNextSongApply: next.allowNextSongApply === 1,
    allowFollowerSave: next.allowFollowerSave === 1,
    profilePinned: next.profilePinned === 1,
    mutation: changed ? 'written' : 'idempotent'
  } }, 200, cors);
}

async function handlePublicationOptions017(request, env, cors, trackId) {
  const probe = request.clone();
  const authContext = await requireExploreAuth(probe);
  const body = await readJsonBody(probe, 2048);
  const row = await env.DB.prepare(`
    SELECT t.id, t.owner_uid, t.source_type, t.source_id, t.is_public, t.status,
      t.allow_next_song_apply, t.allow_follower_save, t.profile_pinned,
      p.handle AS profile_handle
    FROM tracks t
    LEFT JOIN public_profiles p ON p.uid = t.owner_uid
    WHERE t.id = ? AND t.owner_uid = ?
    LIMIT 1
  `).bind(trackId, authContext.uid).first();
  if (!row) throwApi('NOT_FOUND', '곡을 찾을 수 없습니다.', 404);
  if (String(row.source_type || '') !== 'music_note') {
    return await handlePublicationOptionsR2CoreLegacy017(request, env, cors, trackId);
  }
  return await handleMusicNotePublicationOptions017(request, env, cors, authContext, body, row);
}

async function handleMusicNotePrivate017(request, env, cors, authContext, row) {
  const changed = Number(row.is_public || 0) !== 0;
  const now = Date.now();
  if (changed) {
    await env.DB.prepare(`
      UPDATE tracks SET is_public = 0, updated_at = ?
      WHERE id = ? AND owner_uid = ?
    `).bind(now, row.id, authContext.uid).run();
  }
  await syncExploreFeedR2Private017(env, row.id);
  try {
    await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, row.source_id, {
      status: 'private',
      trackId: row.id,
      allowNextSongApply: Number(row.allow_next_song_apply || 0) === 1,
      allowFollowerSave: Number(row.allow_follower_save || 0) === 1,
      profilePinned: Number(row.profile_pinned || 0) === 1
    });
  } catch (error) {
    console.warn('[SORIDRAW stage3] private publication-state R2 sync skipped:', String(error?.message || error || 'unknown'));
  }
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, row.profile_handle || '');
  return json({ ok: true, data: { trackId: row.id, isPublic: false, mutation: changed ? 'written' : 'idempotent' } }, 200, cors);
}

async function handleVisibility017(request, env, cors, trackId) {
  const probe = request.clone();
  const authContext = await requireExploreAuth(probe);
  const body = await readJsonBody(probe, 2048);
  if (typeof body.isPublic !== 'boolean') throwApi('VISIBILITY_REQUIRED', '공개 여부 값이 필요합니다.', 400);
  const row = await env.DB.prepare(`
    SELECT t.id, t.owner_uid, t.source_type, t.source_id, t.is_public, t.status,
      t.allow_next_song_apply, t.allow_follower_save, t.profile_pinned,
      p.handle AS profile_handle
    FROM tracks t
    LEFT JOIN public_profiles p ON p.uid = t.owner_uid
    WHERE t.id = ? AND t.owner_uid = ?
    LIMIT 1
  `).bind(trackId, authContext.uid).first();
  if (!row) throwApi('NOT_FOUND', '곡을 찾을 수 없습니다.', 404);
  if (String(row.source_type || '') !== 'music_note' || body.isPublic === true) {
    return await handleVisibilityR2CoreLegacy017(request, env, cors, trackId);
  }
  return await handleMusicNotePrivate017(request, env, cors, authContext, row);
}

replaceFunction('publicationReadState016', publicationReadState017.toString().replace('publicationReadState017', 'publicationReadState016'));
replaceFunction('publicationEnsureProfile016', publicationEnsureProfile017.toString().replace('publicationEnsureProfile017', 'publicationEnsureProfile016'));

const helperAnchor = 'async function handleMusicNotePublicationSingleWrite016(';
if (!source.includes(helperAnchor)) throw new Error('[017] publication helper anchor missing');
const extraHelpers = `// ${marker}\n${[
  invalidatePublicationProfileCaches017,
  syncExploreFeedR2OptionPatch017,
  syncExploreFeedR2Private017,
  handleMusicNotePublicationOptions017,
  handleMusicNotePrivate017,
].map((fn) => fn.toString()).join('\n\n')}\n\n`;
source = source.replace(helperAnchor, extraHelpers + helperAnchor);

replaceOnceInFunction(
  'handleMusicNotePublicationSingleWrite016',
  "  try {\n    await invalidatePublicProfileFirstViewEdgeCache(request, [authContext.uid]);\n  } catch (error) {\n    console.warn('[SORIDRAW stage3] profile edge invalidation skipped:', String(error?.message || error || 'unknown'));\n  }",
  "  await invalidatePublicationProfileCaches017(request, env, authContext.uid, profile?.handle || '');",
  'replace profile cache invalidation',
);

for (const [name, wrapper] of [
  ['handlePublicationOptionsR2Core', handlePublicationOptions017],
  ['handleVisibilityR2Core', handleVisibility017],
]) {
  const original = functionRange(name).text;
  const legacyName = `${name}Legacy017`;
  const renamed = original.replace(
    new RegExp(`^async function ${name}\\(`),
    `async function ${legacyName}(`
  );
  if (renamed === original) throw new Error(`[017] failed to rename ${name}`);
  const wrapperName = wrapper === handlePublicationOptions017 ? 'handlePublicationOptionsR2Core' : 'handleVisibilityR2Core';
  const wrapperText = wrapper.toString().replace(wrapper.name, wrapperName);
  replaceFunction(name, `${wrapperText}\n\n${renamed}`);
}

for (const required of [
  marker,
  'handlePublicationOptionsR2CoreLegacy017',
  'handleVisibilityR2CoreLegacy017',
  'invalidatePublicationProfileCaches017',
  "mutation: changed ? 'written' : 'idempotent'",
]) {
  if (!source.includes(required)) throw new Error(`[017] missing required token: ${required}`);
}
for (const name of ['handleMusicNotePublicationOptions017', 'handleMusicNotePrivate017']) {
  const text = functionRange(name).text;
  for (const forbidden of ['enforceUserRateLimit(', 'refreshOrPrebuildPublicProfileTrackWindow(', 'refreshTrackSearchIndex(', 'applyPublicationOptions(', 'track_tags']) {
    if (text.includes(forbidden)) throw new Error(`[017] ${name} forbidden token ${forbidden}`);
  }
}

writeFileSync(workerPath, source, 'utf8');
console.log('[017] Music Note option-save and private transitions now use bounded 0/1-write paths and invalidate profile caches without D1 snapshot rewrites.');
