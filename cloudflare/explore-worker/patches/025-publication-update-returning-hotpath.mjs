import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_UPDATE_RETURNING_025_20260907';
if (source.includes(marker)) {
  console.log('[025] publication UPDATE RETURNING hot path already applied.');
  process.exit(0);
}

for (const required of [
  'SORIDRAW_PUBLICATION_ONE_READ_ONE_WRITE_024_20260907',
  'handleMusicNotePublicationSingleWrite016',
  'handleVisibilityR2Core',
  'handleMusicNotePrivate017',
  'publicationReadProfileR2024',
  'publicationRepublishSemanticUnchanged022',
  'publicationBuildFeedItem016',
  'publicationResolveProfileHandle023',
  'patchExploreProfileR2Mutation019',
  'syncExploreFeedR2Publication012',
  'syncExploreFeedR2Private017',
  'syncMusicNotePublicationR2AfterMutation',
  'invalidatePublicationProfileCaches017',
]) {
  if (!source.includes(required)) throw new Error(`[025] prerequisite missing: ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[025] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[025] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[025] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

function publicationNullableNumber025(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function finalizeMusicNotePublic025(request, env, cors, authContext, source, publicationOptions, previous, now) {
  const resolvedOptions = {
    allowNextSongApply: publicationBool016(publicationOptions.allowNextSongApply, Number(previous?.allow_next_song_apply || 0) === 1),
    allowFollowerSave: publicationBool016(publicationOptions.allowFollowerSave, Number(previous?.allow_follower_save || 0) === 1),
    profilePinned: publicationBool016(publicationOptions.profilePinned, Number(previous?.profile_pinned || 0) === 1)
  };
  const primaryGenre = publicationPrimaryGenre016(source);
  const publishedAt = Number(previous?.published_at || 0) > 0 ? Number(previous.published_at) : now;

  let profile = await publicationReadProfileR2024(env, authContext);
  if (!profile) {
    profile = {
      nickname: String(authContext?.displayName || ''),
      avatarUrl: String(authContext?.picture || ''),
      handle: ''
    };
  }

  const feedItem = publicationBuildFeedItem016(
    source,
    authContext,
    profile,
    previous,
    resolvedOptions,
    primaryGenre,
    publishedAt,
    now
  );

  try {
    await syncExploreFeedR2Publication012(env, feedItem);
  } catch (error) {
    console.warn('[SORIDRAW 025] feed R2 sync skipped:', String(error?.message || error || 'unknown'));
  }
  try {
    await syncMusicNotePublicationR2AfterMutation(env, authContext.uid, source.sourceId, {
      status: 'public',
      trackId: source.id,
      allowNextSongApply: resolvedOptions.allowNextSongApply === 1,
      allowFollowerSave: resolvedOptions.allowFollowerSave === 1,
      profilePinned: resolvedOptions.profilePinned === 1
    });
  } catch (error) {
    console.warn('[SORIDRAW 025] publication-state R2 sync skipped:', String(error?.message || error || 'unknown'));
  }
  await patchExploreProfileR2Mutation019(env, authContext.uid, {
    trackId: source.id,
    item: feedItem,
    remove: false,
    trackCountDelta: 1
  });
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, profile?.handle || '');

  return json({
    ok: true,
    data: {
      trackId: source.id,
      published: true,
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      sourceSubTrackKey: source.sourceSubTrackKey,
      sunoUrlPrimary: source.sunoUrlPrimary,
      allowNextSongApply: resolvedOptions.allowNextSongApply === 1,
      allowFollowerSave: resolvedOptions.allowFollowerSave === 1,
      profilePinned: resolvedOptions.profilePinned === 1,
      mutation: 'visibility-transition'
    }
  }, 200, cors);
}

async function handleMusicNotePublicationSingleWrite025(request, env, cors, authContext, source, publicationOptions) {
  const now = Date.now();
  const primaryGenre = publicationPrimaryGenre016(source);
  const sourceSubTrackIndex = publicationNullableNumber025(source.sourceSubTrackIndex);
  const durationSeconds = publicationNullableNumber025(source.durationSeconds);
  const hasNextSongOption = publicationOptions.allowNextSongApply !== null && publicationOptions.allowNextSongApply !== undefined;
  const hasFollowerSaveOption = publicationOptions.allowFollowerSave !== null && publicationOptions.allowFollowerSave !== undefined;
  const hasPinnedOption = publicationOptions.profilePinned !== null && publicationOptions.profilePinned !== undefined;
  const nextSongOption = publicationBool016(publicationOptions.allowNextSongApply, false);
  const followerSaveOption = publicationBool016(publicationOptions.allowFollowerSave, false);
  const pinnedOption = publicationBool016(publicationOptions.profilePinned, false);

  // Normal private -> public is a pure visibility mutation. Match the stored
  // canonical payload in the same PK lookup so the hot path needs no pre-SELECT.
  // If content/options changed (or this is a first publication), fall back to the
  // proven 024 path before making any visibility change.
  const transitioned = await env.DB.prepare(`
    UPDATE tracks
    SET is_public = 1, updated_at = ?
    WHERE id = ? AND owner_uid = ?
      AND source_type = 'music_note'
      AND COALESCE(is_public, 0) <> 1
      AND status = 'published'
      AND COALESCE(published_at, 0) > 0
      AND COALESCE(source_type, '') = ?
      AND COALESCE(source_id, '') = ?
      AND COALESCE(source_parent_id, '') = ?
      AND COALESCE(legacy_global_id, '') = ?
      AND COALESCE(source_subtrack_key, '') = ?
      AND ((source_subtrack_index IS NULL AND ? IS NULL) OR source_subtrack_index = ?)
      AND COALESCE(source_subtrack_id, '') = ?
      AND COALESCE(title, '') = ?
      AND COALESCE(description, '') = ?
      AND COALESCE(cover_url, '') = ?
      AND ((duration_seconds IS NULL AND ? IS NULL) OR duration_seconds = ?)
      AND COALESCE(lyrics, '') = ?
      AND COALESCE(style, '') = ?
      AND COALESCE(prompt, '') = ?
      AND COALESCE(suno_url_primary, '') = ?
      AND COALESCE(suno_url_secondary, '') = ?
      AND COALESCE(search_text, '') = ?
      AND (? = 0 OR COALESCE(allow_next_song_apply, 0) = ?)
      AND (? = 0 OR COALESCE(allow_follower_save, 0) = ?)
      AND (? = 0 OR COALESCE(profile_pinned, 0) = ?)
      AND COALESCE(share_schema_version, 0) = ?
      AND COALESCE(share_payload_json, '') = ?
      AND COALESCE(primary_genre, '') = ?
    RETURNING *
  `).bind(
    now,
    source.id,
    authContext.uid,
    publicationText016(source.sourceType),
    publicationText016(source.sourceId),
    publicationText016(source.sourceParentId),
    publicationText016(source.legacyGlobalId),
    publicationText016(source.sourceSubTrackKey),
    sourceSubTrackIndex,
    sourceSubTrackIndex,
    publicationText016(source.sourceSubTrackId),
    publicationText016(source.title),
    publicationText016(source.description),
    publicationText016(source.coverUrl),
    durationSeconds,
    durationSeconds,
    publicationText016(source.lyrics),
    publicationText016(source.style),
    publicationText016(source.prompt),
    publicationText016(source.sunoUrlPrimary),
    publicationText016(source.sunoUrlSecondary),
    publicationText016(source.searchText),
    hasNextSongOption ? 1 : 0,
    nextSongOption,
    hasFollowerSaveOption ? 1 : 0,
    followerSaveOption,
    hasPinnedOption ? 1 : 0,
    pinnedOption,
    Number(source.shareSchemaVersion || 0),
    publicationText016(source.sharePayloadJson),
    publicationText016(primaryGenre)
  ).first();

  if (!transitioned) {
    return await handleMusicNotePublicationSingleWrite016Legacy025(
      request,
      env,
      cors,
      authContext,
      source,
      publicationOptions
    );
  }

  return await finalizeMusicNotePublic025(
    request,
    env,
    cors,
    authContext,
    source,
    publicationOptions,
    transitioned,
    now
  );
}

async function finalizeMusicNotePrivate025(request, env, cors, authContext, row) {
  const derived = await Promise.allSettled([
    syncExploreFeedR2Private017(env, row.id),
    syncMusicNotePublicationR2AfterMutation(env, authContext.uid, row.source_id, {
      status: 'private',
      trackId: row.id,
      allowNextSongApply: Number(row.allow_next_song_apply || 0) === 1,
      allowFollowerSave: Number(row.allow_follower_save || 0) === 1,
      profilePinned: Number(row.profile_pinned || 0) === 1
    }),
    patchExploreProfileR2Mutation019(env, authContext.uid, { trackId: row.id, remove: true, trackCountDelta: -1 })
  ]);
  const profileMutation = derived[2]?.status === 'fulfilled' ? derived[2].value : null;
  const handle = await publicationResolveProfileHandle023(env, authContext.uid, profileMutation?.handle || '');
  await invalidatePublicationProfileCaches017(request, env, authContext.uid, handle);
  return json({ ok: true, data: { trackId: row.id, isPublic: false, mutation: 'written' } }, 200, cors);
}

async function handleVisibilityR2Core025(request, env, cors, trackId) {
  const probe = request.clone();
  const authContext = await requireExploreAuth(probe);
  const body = await readJsonBody(probe, 2048);
  if (typeof body.isPublic !== 'boolean') throwApi('VISIBILITY_REQUIRED', '공개 여부 값이 필요합니다.', 400);

  if (body.isPublic === false) {
    const now = Date.now();
    // UPDATE ... RETURNING replaces the old SELECT + UPDATE pair for a real
    // Music Note public -> private transition. The returned row feeds all R2 work.
    const transitioned = await env.DB.prepare(`
      UPDATE tracks
      SET is_public = 0, updated_at = ?
      WHERE id = ? AND owner_uid = ?
        AND source_type = 'music_note'
        AND COALESCE(is_public, 0) <> 0
      RETURNING id, owner_uid, source_type, source_id, is_public, status,
        allow_next_song_apply, allow_follower_save, profile_pinned,
        published_at, created_at, updated_at
    `).bind(now, trackId, authContext.uid).first();

    if (transitioned) {
      return await finalizeMusicNotePrivate025(request, env, cors, authContext, transitioned);
    }
  }

  // Idempotent private, non-Music-Note, public=true and not-found cases keep the
  // existing behavior. Only the actual changed visibility path is optimized.
  return await handleVisibilityR2CoreLegacy025(request, env, cors, trackId);
}

const currentPublic = functionRange('handleMusicNotePublicationSingleWrite016').text;
const legacyPublic = currentPublic.replace(
  /^async function handleMusicNotePublicationSingleWrite016\(/,
  'async function handleMusicNotePublicationSingleWrite016Legacy025('
);
if (legacyPublic === currentPublic) throw new Error('[025] failed to preserve public fallback');

const currentVisibility = functionRange('handleVisibilityR2Core').text;
const legacyVisibility = currentVisibility.replace(
  /^async function handleVisibilityR2Core\(/,
  'async function handleVisibilityR2CoreLegacy025('
);
if (legacyVisibility === currentVisibility) throw new Error('[025] failed to preserve visibility fallback');

const publicReplacement = `// ${marker}\n${publicationNullableNumber025.toString()}\n\n${finalizeMusicNotePublic025.toString()}\n\n${handleMusicNotePublicationSingleWrite025.toString().replace('handleMusicNotePublicationSingleWrite025', 'handleMusicNotePublicationSingleWrite016')}\n\n${legacyPublic}`;
replaceFunction('handleMusicNotePublicationSingleWrite016', publicReplacement);

const visibilityReplacement = `${finalizeMusicNotePrivate025.toString()}\n\n${handleVisibilityR2Core025.toString().replace('handleVisibilityR2Core025', 'handleVisibilityR2Core')}\n\n${legacyVisibility}`;
replaceFunction('handleVisibilityR2Core', visibilityReplacement);

const publicHot = functionRange('handleMusicNotePublicationSingleWrite016').text;
const privateHot = functionRange('handleVisibilityR2Core').text;
const publicFinalize = functionRange('finalizeMusicNotePublic025').text;
const privateFinalize = functionRange('finalizeMusicNotePrivate025').text;

for (const required of [
  'UPDATE tracks',
  'SET is_public = 1, updated_at = ?',
  'RETURNING *',
  'handleMusicNotePublicationSingleWrite016Legacy025(',
  'finalizeMusicNotePublic025(',
]) {
  if (!publicHot.includes(required)) throw new Error(`[025] public hot-path invariant missing: ${required}`);
}
for (const required of [
  'UPDATE tracks',
  'SET is_public = 0, updated_at = ?',
  'RETURNING id, owner_uid',
  'handleVisibilityR2CoreLegacy025(',
  'finalizeMusicNotePrivate025(',
]) {
  if (!privateHot.includes(required)) throw new Error(`[025] private hot-path invariant missing: ${required}`);
}
if ((publicHot.match(/env\.DB\.prepare/g) || []).length !== 1) throw new Error('[025] public changed hot path must own exactly one D1 statement');
if ((privateHot.match(/env\.DB\.prepare/g) || []).length !== 1) throw new Error('[025] private changed hot path must own exactly one D1 statement');
if (publicHot.includes('publicationReadState016(')) throw new Error('[025] public fast path still pre-reads D1');
for (const text of [publicFinalize, privateFinalize]) {
  if (text.includes('env.DB.')) throw new Error('[025] derived R2 finalizer must not touch D1');
}
for (const forbidden of ['SET status =', 'SET published_at =', 'SET primary_genre =']) {
  if (publicHot.includes(forbidden)) throw new Error(`[025] public visibility UPDATE touches indexed/canonical field: ${forbidden}`);
}
if (!source.includes(marker)) throw new Error('[025] marker missing after transform');

writeFileSync(workerPath, source, 'utf8');
console.log('[025] Changed Music Note public/private visibility now uses one UPDATE RETURNING statement; explicit pre-SELECT is fallback-only.');
