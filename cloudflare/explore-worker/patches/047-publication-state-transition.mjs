import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PUBLICATION_STATE_TRANSITION_047_20260913';
if (source.includes(MARKER)) {
  console.log('[047] publication state transition already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PUBLICATION_WRITE_COMPACTION_046_20260913',
  'handleVisibilityR2CoreLegacy017',
  'handleVisibilityR2Core',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'patchExploreProfileR2Publication043',
  'syncMusicNotePublicationR2AfterMutation',
  'invalidatePublicationProfileCaches017',
  'readExploreProfileCanonicalR2Bundle020',
  'derivedItems032',
  'derivedRank032',
  'derivedProfile032',
]) {
  if (!source.includes(required)) throw new Error(`[047] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[047] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[047] function body missing: ${name}`);
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
  throw new Error(`[047] unterminated function: ${name}`);
};

const replaceFunction = (name, text) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + text + source.slice(range.end);
};

async function derivedItems047(env, ids) {
  if (!ids.length) return [];
  const rows = await env.DB.prepare(`SELECT d.row_json,
      p.row_json AS profile_json,p.active AS profile_active,
      c.is_public AS canonical_is_public,c.status AS canonical_status,
      c.published_at AS canonical_published_at,c.updated_at AS canonical_updated_at,
      c.allow_next_song_apply AS canonical_allow_next_song_apply,
      c.allow_follower_save AS canonical_allow_follower_save,
      c.profile_pinned AS canonical_profile_pinned
    FROM explore_derived_tracks AS d
    JOIN tracks AS c ON c.id=d.id
    LEFT JOIN explore_derived_profiles AS p ON p.uid=d.owner_uid
    WHERE d.id IN (${ids.map(() => '?').join(',')})
      AND c.is_public=1 AND c.status='published'`).bind(...ids).all();
  return rows.results.map((row) => {
    const p = row.profile_active ? JSON.parse(row.profile_json) : {};
    const track = JSON.parse(row.row_json);
    return mapTrackRow({
      ...track,
      is_public: Number(row.canonical_is_public || 0),
      status: String(row.canonical_status || 'published'),
      published_at: Number(row.canonical_published_at || track.published_at || 0),
      updated_at: Number(row.canonical_updated_at || track.updated_at || 0),
      allow_next_song_apply: Number(row.canonical_allow_next_song_apply || 0),
      allow_follower_save: Number(row.canonical_allow_follower_save || 0),
      profile_pinned: Number(row.canonical_profile_pinned || 0),
      owner_nickname: p.nickname || '',
      owner_avatar_url: p.avatar_url || '',
    });
  });
}

async function derivedRank047(env, sort, uid) {
  const limit = uid ? 51 : 41;
  const index = uid ? 'idx_explore_rank_profile' : sort === 'popular' ? 'idx_explore_rank_popular' : 'idx_explore_rank_latest';
  const order = uid
    ? 'c.profile_pinned DESC,d.published_at DESC,d.id DESC'
    : sort === 'popular'
      ? 'd.likes DESC,d.published_at DESC,d.id DESC'
      : 'd.published_at DESC,d.id DESC';
  const rows = await env.DB.prepare(`SELECT d.id
    FROM explore_derived_tracks AS d INDEXED BY ${index}
    JOIN tracks AS c ON c.id=d.id
    WHERE ${uid ? 'd.owner_uid=? AND ' : ''}c.is_public=1 AND c.status='published'
    ORDER BY ${order} LIMIT ${limit}`).bind(...(uid ? [uid] : [])).all();
  return rows.results.map((row) => row.id);
}

async function derivedProfile047(env, uid) {
  const row = await env.DB.prepare(`SELECT p.*,
      COALESCE((SELECT COUNT(*) FROM tracks c
        WHERE c.owner_uid=? AND c.is_public=1 AND c.status='published'),0) AS canonical_track_count
    FROM explore_derived_profiles p WHERE p.uid=?`).bind(uid, uid).first();
  if (!row?.active) return null;
  const p = JSON.parse(row.row_json);
  return {
    uid,
    nickname: p.nickname || '',
    avatarUrl: p.avatar_url || '',
    backgroundUrl: p.background_url || '',
    bio: p.bio || '',
    handle: p.handle || '',
    genres: parseProfileGenres(p.genre_override),
    socialLinks: { spotify: p.spotify_url || '', instagram: p.instagram_url || '', tiktok: p.tiktok_url || '' },
    followerCount: row.followers,
    followingCount: row.following,
    trackCount: Number(row.canonical_track_count || 0),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

async function handleMusicNoteVisibility047(request, env, cors, authContext, body, row) {
  const nextPublic = body.isPublic === true;
  const wasPublic = Number(row.is_public || 0) === 1 && String(row.status || '') === 'published';
  if (nextPublic && String(row.status || '') !== 'published') {
    return await handleVisibilityR2CoreLegacy017(request, env, cors, row.id);
  }

  const next = {
    allowNextSongApply: publicationBool016(body.allowNextSongApply, Number(row.allow_next_song_apply || 0) === 1),
    allowFollowerSave: publicationBool016(body.allowFollowerSave, Number(row.allow_follower_save || 0) === 1),
    profilePinned: publicationBool016(body.profilePinned, Number(row.profile_pinned || 0) === 1),
  };
  const nextPublicInt = nextPublic ? 1 : 0;
  const changed = Number(row.is_public || 0) !== nextPublicInt
    || Number(row.allow_next_song_apply || 0) !== next.allowNextSongApply
    || Number(row.allow_follower_save || 0) !== next.allowFollowerSave
    || Number(row.profile_pinned || 0) !== next.profilePinned;
  const now = Date.now();

  if (changed) {
    await env.DB.prepare(`UPDATE tracks
      SET is_public=?,allow_next_song_apply=?,allow_follower_save=?,profile_pinned=?,updated_at=?
      WHERE id=? AND owner_uid=? AND source_type='music_note'`).bind(
      nextPublicInt,
      next.allowNextSongApply,
      next.allowFollowerSave,
      next.profilePinned,
      now,
      row.id,
      authContext.uid,
    ).run();
  }

  const nextRow = {
    ...row,
    is_public: nextPublicInt,
    allow_next_song_apply: next.allowNextSongApply,
    allow_follower_save: next.allowFollowerSave,
    profile_pinned: next.profilePinned,
    updated_at: now,
  };
  let profile = null;
  try {
    const profileBundle = await readExploreProfileCanonicalR2Bundle020(env, authContext.uid);
    profile = profileBundle?.body?.data?.profile || null;
  } catch (error) {
    console.warn('[SORIDRAW 047] profile R2 read skipped:', String(error?.message || error || 'unknown'));
  }
  const snapshotItem = mapTrackRow({
    ...nextRow,
    owner_nickname: String(profile?.nickname || authContext.displayName || ''),
    owner_avatar_url: String(profile?.avatarUrl || profile?.avatar_url || authContext.picture || ''),
    like_count: Number(row.like_count || 0),
    comment_count: Number(row.comment_count || 0),
    play_count: Number(row.play_count || 0),
  });

  if (nextPublic) {
    await syncExploreFeedR2Publication043(env, snapshotItem);
    await patchExploreProfileR2Publication043(env, authContext.uid, {
      trackId: row.id,
      item: snapshotItem,
      trackCountDelta: wasPublic ? 0 : 1,
    });
  } else {
    await syncExploreFeedR2Private043(env, row.id);
    await patchExploreProfileR2Publication043(env, authContext.uid, {
      trackId: row.id,
      remove: true,
      trackCountDelta: wasPublic ? -1 : 0,
    });
  }

  try {
    await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, row.source_id, {
      status: nextPublic ? 'public' : 'private',
      trackId: row.id,
      allowNextSongApply: next.allowNextSongApply === 1,
      allowFollowerSave: next.allowFollowerSave === 1,
      profilePinned: next.profilePinned === 1,
    });
  } catch (error) {
    console.warn('[SORIDRAW 047] publication-state R2 sync skipped:', String(error?.message || error || 'unknown'));
  }
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, String(profile?.handle || ''));

  return json({ ok: true, data: {
    trackId: row.id,
    isPublic: nextPublic,
    allowNextSongApply: next.allowNextSongApply === 1,
    allowFollowerSave: next.allowFollowerSave === 1,
    profilePinned: next.profilePinned === 1,
    snapshotItem: nextPublic ? snapshotItem : null,
    mutation: changed ? 'written' : 'idempotent',
  } }, 200, cors);
}

async function handleVisibility047(request, env, cors, trackId) {
  const probe = request.clone();
  const authContext = await requireExploreAuth(probe);
  const body = await readJsonBody(probe, 4096);
  if (typeof body.isPublic !== 'boolean') throwApi('VISIBILITY_REQUIRED', '공개 여부 값이 필요합니다.', 400);
  const row = await env.DB.prepare(`SELECT t.*,
      COALESCE(s.like_count,0) AS like_count,
      COALESCE(s.comment_count,0) AS comment_count,
      COALESCE(s.play_count,0) AS play_count
    FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id
    WHERE t.id=? AND t.owner_uid=? LIMIT 1`).bind(trackId, authContext.uid).first();
  if (!row) throwApi('NOT_FOUND', '곡을 찾을 수 없습니다.', 404);
  if (String(row.source_type || '') !== 'music_note') {
    return await handleVisibilityR2CoreLegacy017(request, env, cors, trackId);
  }
  return await handleMusicNoteVisibility047(request, env, cors, authContext, body, row);
}

replaceFunction('derivedItems032', derivedItems047.toString().replace('derivedItems047', 'derivedItems032'));
replaceFunction('derivedRank032', derivedRank047.toString().replace('derivedRank047', 'derivedRank032'));
replaceFunction('derivedProfile032', derivedProfile047.toString().replace('derivedProfile047', 'derivedProfile032'));

// The wrapper calls this helper at runtime, so the helper must be embedded in the
// generated Worker as actual source, not left only inside this build-time patch file.
{
  const visibilityAnchor = functionRange('handleVisibilityR2Core').start;
  source = source.slice(0, visibilityAnchor)
    + handleMusicNoteVisibility047.toString()
    + '\n\n'
    + source.slice(visibilityAnchor);
}
replaceFunction('handleVisibilityR2Core', handleVisibility047.toString().replace('handleVisibility047', 'handleVisibilityR2Core'));

// Older 079 clients can still republish through POST /v1/publications. Keep that
// compatibility route cheap as well: a visibility-only republish never changes the
// original published_at or status, so the indexed ordering columns remain untouched.
{
  const range = functionRange('handleMusicNotePublicationSingleWrite016');
  let text = range.text;
  const before = "SET is_public = 1,\n            status = 'published',\n            published_at = ?,\n            updated_at = ?";
  const after = "SET is_public = 1,\n            updated_at = ?";
  if (text.split(before).length - 1 !== 1) throw new Error('[047] legacy republish update anchor mismatch');
  text = text.replace(before, after);
  const bindBefore = ').bind(publishedAt, now, source.id, authContext.uid).run();';
  const bindAfter = ').bind(now, source.id, authContext.uid).run();';
  if (text.split(bindBefore).length - 1 !== 1) throw new Error('[047] legacy republish bind anchor mismatch');
  text = text.replace(bindBefore, bindAfter);
  source = source.slice(0, range.start) + text + source.slice(range.end);
}

for (const [name, requiredTokens] of [
  ['handleVisibilityR2Core', ["'music_note'", 'handleMusicNoteVisibility047']],
  ['handleMusicNoteVisibility047', ["source_type='music_note'", 'syncExploreFeedR2Publication043', 'syncExploreFeedR2Private043', 'snapshotItem']],
  ['derivedItems032', ['JOIN tracks AS c', "c.is_public=1", "c.status='published'"]],
  ['derivedRank032', ['JOIN tracks AS c', "c.is_public=1", "c.status='published'"]],
  ['derivedProfile032', ['COUNT(*) FROM tracks c', 'canonical_track_count']],
]) {
  const text = functionRange(name).text;
  for (const token of requiredTokens) if (!text.includes(token)) throw new Error(`[047] ${name} missing ${token}`);
}
const publishText = functionRange('handleMusicNotePublicationSingleWrite016').text;
if (publishText.includes('published_at = ?')) throw new Error('[047] legacy visibility-only republish still rewrites published_at');

source += `\n// ${MARKER}\n`;
writeFileSync(workerPath, source, 'utf8');
console.log('[047] registered Music Note public/private changes use one visibility state transition; indexed publish time is stable and cold derived recovery validates canonical visibility.');
