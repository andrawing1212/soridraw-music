import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_SINGLE_WRITE_HOTPATH_016_20260905';
if (source.includes(marker)) {
  console.log('[016] publication single-write hot path already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PUBLICATION_SINGLE_R2_BUNDLE_014_20260905',
  'SORIDRAW_PUBLICATION_SHARE_BUNDLE_V1_015_20260905',
]) {
  if (!source.includes(required)) throw new Error(`[016] missing prerequisite ${required}`);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[016] function missing: ${name}`);
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
  throw new Error(`[016] unterminated function: ${name}`);
};

const replaceFunction = (name, text) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + text + source.slice(range.end);
};

function publicationBool016(value, fallback) {
  return value === null || value === undefined ? (fallback ? 1 : 0) : (value ? 1 : 0);
}

function publicationText016(value) {
  return value === null || value === undefined ? '' : String(value);
}

function publicationNullableNumberEqual016(a, b) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  return Number(a) === Number(b);
}

function publicationPrimaryGenre016(source) {
  const tags = Array.isArray(source?.tags) ? source.tags : [];
  const genre = tags.find((tag) => String(tag?.kind || '') === 'genre' && String(tag?.value || '').trim());
  return genre ? String(genre.value).trim().slice(0, 160) : '';
}

function publicationCanonicalUnchanged016(row, source, options, primaryGenre) {
  if (!row?.id) return false;
  const sameText = (a, b) => publicationText016(a) === publicationText016(b);
  return Number(row.is_public || 0) === 1
    && String(row.status || '') === 'published'
    && sameText(row.source_type, source.sourceType)
    && sameText(row.source_id, source.sourceId)
    && sameText(row.source_parent_id, source.sourceParentId)
    && sameText(row.legacy_global_id, source.legacyGlobalId)
    && sameText(row.source_subtrack_key, source.sourceSubTrackKey)
    && publicationNullableNumberEqual016(row.source_subtrack_index, source.sourceSubTrackIndex)
    && sameText(row.source_subtrack_id, source.sourceSubTrackId)
    && sameText(row.title, source.title)
    && sameText(row.description, source.description)
    && sameText(row.cover_url, source.coverUrl)
    && publicationNullableNumberEqual016(row.duration_seconds, source.durationSeconds)
    && sameText(row.lyrics, source.lyrics)
    && sameText(row.style, source.style)
    && sameText(row.prompt, source.prompt)
    && sameText(row.suno_url_primary, source.sunoUrlPrimary)
    && sameText(row.suno_url_secondary, source.sunoUrlSecondary)
    && sameText(row.search_text, source.searchText)
    && Number(row.allow_next_song_apply || 0) === Number(options.allowNextSongApply || 0)
    && Number(row.allow_follower_save || 0) === Number(options.allowFollowerSave || 0)
    && Number(row.profile_pinned || 0) === Number(options.profilePinned || 0)
    && Number(row.share_schema_version || 0) === Number(source.shareSchemaVersion || 0)
    && sameText(row.share_payload_json, source.sharePayloadJson)
    && sameText(row.primary_genre, primaryGenre);
}

async function publicationReadState016(env, uid, trackId) {
  return await env.DB.prepare(`
    SELECT
      t.*,
      COALESCE(s.like_count, 0) AS like_count,
      COALESCE(s.comment_count, 0) AS comment_count,
      COALESCE(s.play_count, 0) AS play_count,
      p.uid AS profile_uid,
      p.nickname AS profile_nickname,
      p.avatar_url AS profile_avatar_url,
      p.is_public AS profile_is_public
    FROM (SELECT 1 AS seed) q
    LEFT JOIN tracks t ON t.id = ? AND t.owner_uid = ?
    LEFT JOIN track_stats s ON s.track_id = t.id
    LEFT JOIN public_profiles p ON p.uid = ?
    LIMIT 1
  `).bind(trackId, uid, uid).first();
}

async function publicationEnsureProfile016(env, authContext, row, now) {
  if (row?.profile_uid && Number(row.profile_is_public || 0) === 1) {
    return {
      nickname: String(row.profile_nickname || authContext.displayName || ''),
      avatarUrl: String(row.profile_avatar_url || authContext.picture || '')
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
      avatarUrl: String(row.profile_avatar_url || authContext.picture || '')
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
  return { nickname, avatarUrl };
}

function publicationBuildFeedItem016(source, authContext, profile, previous, options, primaryGenre, publishedAt, now) {
  return mapTrackRow({
    id: source.id,
    owner_uid: authContext.uid,
    owner_nickname: profile?.nickname || authContext.displayName || '',
    owner_avatar_url: profile?.avatarUrl || authContext.picture || '',
    source_type: source.sourceType,
    source_id: source.sourceId,
    source_parent_id: source.sourceParentId,
    legacy_global_id: source.legacyGlobalId,
    source_subtrack_key: source.sourceSubTrackKey,
    source_subtrack_index: source.sourceSubTrackIndex,
    source_subtrack_id: source.sourceSubTrackId,
    title: source.title,
    description: source.description,
    cover_url: source.coverUrl,
    duration_seconds: source.durationSeconds,
    lyrics: source.lyrics,
    style: source.style,
    prompt: source.prompt,
    suno_url_primary: source.sunoUrlPrimary,
    suno_url_secondary: source.sunoUrlSecondary,
    search_text: source.searchText,
    allow_next_song_apply: options.allowNextSongApply,
    allow_follower_save: options.allowFollowerSave,
    profile_pinned: options.profilePinned,
    share_schema_version: Number(source.shareSchemaVersion || 0),
    share_payload_json: source.sharePayloadJson || null,
    primary_genre: primaryGenre || null,
    is_public: 1,
    status: 'published',
    published_at: publishedAt,
    created_at: Number(previous?.created_at || now),
    updated_at: now,
    like_count: Number(previous?.like_count || 0),
    comment_count: Number(previous?.comment_count || 0),
    play_count: Number(previous?.play_count || 0)
  });
}

async function handleMusicNotePublicationSingleWrite016(request, env, cors, authContext, source, publicationOptions) {
  const now = Date.now();
  const previous = await publicationReadState016(env, authContext.uid, source.id);
  const resolvedOptions = {
    allowNextSongApply: publicationBool016(publicationOptions.allowNextSongApply, Number(previous?.allow_next_song_apply || 0) === 1),
    allowFollowerSave: publicationBool016(publicationOptions.allowFollowerSave, Number(previous?.allow_follower_save || 0) === 1),
    profilePinned: publicationBool016(publicationOptions.profilePinned, Number(previous?.profile_pinned || 0) === 1)
  };
  const primaryGenre = publicationPrimaryGenre016(source);
  const wasPublic = Number(previous?.is_public || 0) === 1 && String(previous?.status || '') === 'published';
  const publishedAt = wasPublic && Number(previous?.published_at || 0) > 0 ? Number(previous.published_at) : now;

  // Profile initialization is the only permitted first-publisher exception to the
  // one canonical track write. It happens before the track mutation, never after it.
  const profile = await publicationEnsureProfile016(env, authContext, previous, now);
  const unchanged = publicationCanonicalUnchanged016(previous, source, resolvedOptions, primaryGenre);

  if (!unchanged) {
    await env.DB.prepare(`
      INSERT INTO tracks (
        id, owner_uid,
        source_type, source_id, source_parent_id, legacy_global_id,
        source_subtrack_key, source_subtrack_index, source_subtrack_id,
        title, description, cover_url, duration_seconds,
        lyrics, style, prompt,
        suno_url_primary, suno_url_secondary, search_text,
        allow_next_song_apply, allow_follower_save, profile_pinned,
        share_schema_version, share_payload_json, primary_genre,
        is_public, status, published_at, created_at, updated_at
      ) VALUES (
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        1, 'published', ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        source_parent_id = excluded.source_parent_id,
        legacy_global_id = excluded.legacy_global_id,
        source_subtrack_key = excluded.source_subtrack_key,
        source_subtrack_index = excluded.source_subtrack_index,
        source_subtrack_id = excluded.source_subtrack_id,
        title = excluded.title,
        description = excluded.description,
        cover_url = excluded.cover_url,
        duration_seconds = excluded.duration_seconds,
        lyrics = excluded.lyrics,
        style = excluded.style,
        prompt = excluded.prompt,
        suno_url_primary = excluded.suno_url_primary,
        suno_url_secondary = excluded.suno_url_secondary,
        search_text = excluded.search_text,
        allow_next_song_apply = excluded.allow_next_song_apply,
        allow_follower_save = excluded.allow_follower_save,
        profile_pinned = excluded.profile_pinned,
        share_schema_version = excluded.share_schema_version,
        share_payload_json = excluded.share_payload_json,
        primary_genre = excluded.primary_genre,
        is_public = 1,
        status = 'published',
        published_at = excluded.published_at,
        updated_at = excluded.updated_at
    `).bind(
      source.id,
      authContext.uid,
      source.sourceType,
      source.sourceId,
      source.sourceParentId,
      source.legacyGlobalId,
      source.sourceSubTrackKey,
      source.sourceSubTrackIndex,
      source.sourceSubTrackId,
      source.title,
      source.description,
      source.coverUrl,
      source.durationSeconds,
      source.lyrics,
      source.style,
      source.prompt,
      source.sunoUrlPrimary,
      source.sunoUrlSecondary,
      source.searchText,
      resolvedOptions.allowNextSongApply,
      resolvedOptions.allowFollowerSave,
      resolvedOptions.profilePinned,
      Number(source.shareSchemaVersion || 0),
      source.sharePayloadJson || null,
      primaryGenre || null,
      publishedAt,
      Number(previous?.created_at || now),
      now
    ).run();
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

  // Everything below is derived/cache work. It may repair stale caches, but it can
  // never turn a completed canonical publication into HTTP 500.
  try {
    await syncExploreFeedR2Publication012(env, feedItem);
  } catch (error) {
    console.warn('[SORIDRAW stage3] feed R2 sync skipped:', String(error?.message || error || 'unknown'));
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
    console.warn('[SORIDRAW stage3] publication-state R2 sync skipped:', String(error?.message || error || 'unknown'));
  }
  try {
    await invalidatePublicProfileFirstViewEdgeCache(request, [authContext.uid]);
  } catch (error) {
    console.warn('[SORIDRAW stage3] profile edge invalidation skipped:', String(error?.message || error || 'unknown'));
  }

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
      mutation: unchanged ? 'idempotent' : 'written'
    }
  }, 200, cors);
}

async function syncExploreFeedR2Publication016(env, incomingItem) {
  const trackId = getExploreFeedItemId012(incomingItem);
  if (!trackId) throw new Error('publication feed item is missing track id');
  try {
    const bundles = await Promise.all([
      readExploreR2Json(env, exploreFeedR2Key('latest')),
      readExploreR2Json(env, exploreFeedR2Key('popular'))
    ]);
    const valid = bundles.every((bundle) => bundle?.payload?.data && Array.isArray(bundle.payload.data.items));
    if (!valid) {
      console.warn('[SORIDRAW stage3] publication feed R2 bundle missing; D1 rebuild intentionally skipped.');
      return;
    }
    await Promise.all(['latest', 'popular'].map(async (sort, index) => {
      const bundle = bundles[index];
      const previousItems = bundle.payload.data.items;
      const existing = previousItems.find((item) => getExploreFeedItemId012(item) === trackId) || null;
      const merged = existing ? {
        ...existing,
        ...incomingItem,
        stats: { ...(incomingItem?.stats || {}), ...(existing?.stats || {}) },
        likeCount: existing?.likeCount ?? incomingItem?.likeCount ?? incomingItem?.stats?.likeCount ?? 0
      } : incomingItem;
      const withoutCurrent = previousItems.filter((item) => getExploreFeedItemId012(item) !== trackId);
      const previousCursor = bundle.payload.data.nextCursor ?? null;
      const overflowed = !existing && previousItems.length >= EXPLORE_R2_FEED_LIMIT;
      const items = sortExploreFeedItems012([merged, ...withoutCurrent], sort).slice(0, EXPLORE_R2_FEED_LIMIT);
      if (sort === 'popular' && !existing && previousItems.length >= EXPLORE_R2_FEED_LIMIT) {
        const included = items.some((item) => getExploreFeedItemId012(item) === trackId);
        if (!included) return;
      }
      bundle.payload.data.items = items;
      bundle.payload.data.sort = sort;
      bundle.payload.data.nextCursor = buildExploreFeedCursor012(sort, items, previousCursor, overflowed);
      bundle.updatedAt = Date.now();
      await writeExploreR2Json(env, exploreFeedR2Key(sort), bundle);
    }));
  } catch (error) {
    console.warn('[SORIDRAW stage3] publication feed incremental R2 sync failed; D1 rebuild intentionally skipped:', String(error?.message || error || 'unknown'));
  }
}

function shareBundleTags016(bundle) {
  const selected = bundle?.selectedKeywords && typeof bundle.selectedKeywords === 'object' ? bundle.selectedKeywords : {};
  const mapping = [
    ['genres', 'genre'],
    ['styles', 'style'],
    ['moods', 'mood'],
    ['themes', 'theme'],
    ['sounds', 'sound']
  ];
  const out = [];
  const seen = new Set();
  for (const [key, kind] of mapping) {
    for (const raw of Array.isArray(selected[key]) ? selected[key] : []) {
      const value = String(raw || '').trim();
      const signature = `${kind}\u0000${value}`;
      if (!value || seen.has(signature)) continue;
      seen.add(signature);
      out.push({ kind, value });
    }
  }
  return out;
}

async function handleTrackDetail016(trackId, env, cors) {
  const row = await env.DB.prepare(`
    SELECT
      t.*,
      p.nickname AS owner_nickname,
      p.avatar_url AS owner_avatar_url,
      COALESCE(s.like_count, 0) AS like_count,
      COALESCE(s.comment_count, 0) AS comment_count,
      COALESCE(s.play_count, 0) AS play_count
    FROM tracks t
    LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
    LEFT JOIN track_stats s ON s.track_id = t.id
    WHERE t.id = ? AND t.is_public = 1 AND t.status = 'published'
    LIMIT 1
  `).bind(trackId).first();
  if (!row) return apiError('NOT_FOUND', '공개 곡을 찾을 수 없습니다.', 404, cors);

  const shareBundle = readPublicShareBundle015(row);
  let tags = shareBundle ? shareBundleTags016(shareBundle) : null;
  if (!tags) {
    const tagResult = await env.DB.prepare(`
      SELECT kind, value FROM track_tags WHERE track_id = ? ORDER BY kind ASC, value ASC
    `).bind(trackId).all();
    tags = (tagResult.results || []).map((tag) => ({ kind: tag.kind, value: tag.value }));
  }
  return json({ ok: true, data: { track: { ...mapTrackRow(row), tags } } }, 200, cors);
}

async function handleTrackApplySource016(request, env, cors, trackId) {
  await requireExploreAuth(request);
  const row = await env.DB.prepare(`
    SELECT * FROM tracks
    WHERE id = ? AND is_public = 1 AND status = 'published'
    LIMIT 1
  `).bind(trackId).first();
  if (!row) throwApi('NOT_FOUND', '공개 곡을 찾을 수 없습니다.', 404);
  if (Number(row.allow_next_song_apply || 0) !== 1) {
    throwApi('APPLY_NOT_ALLOWED', '이 곡은 다음곡 적용이 허용되지 않았습니다.', 403);
  }
  const shareBundle = readPublicShareBundle015(row);
  if (shareBundle?.nextSong) {
    return json({ ok: true, data: {
      trackId: row.id,
      title: row.title || '',
      style: row.style || null,
      prompt: row.prompt || null,
      tags: shareBundleTags016(shareBundle),
      shareBundle,
      nextSong: shareBundle.nextSong
    } }, 200, cors);
  }
  const tagResult = await env.DB.prepare(`
    SELECT kind, value FROM track_tags WHERE track_id = ? ORDER BY kind ASC, value ASC
  `).bind(trackId).all();
  return json({ ok: true, data: {
    trackId: row.id,
    title: row.title || '',
    style: row.style || null,
    prompt: row.prompt || null,
    tags: (tagResult.results || []).map((tag) => ({ kind: tag.kind, value: tag.value }))
  } }, 200, cors);
}

async function handleGenres016(env, cors) {
  const result = await env.DB.prepare(`
    WITH genre_tracks AS (
      SELECT TRIM(t.primary_genre) AS genre, t.id AS track_id
      FROM tracks t
      WHERE t.is_public = 1 AND t.status = 'published'
        AND t.primary_genre IS NOT NULL AND TRIM(t.primary_genre) <> ''
      UNION
      SELECT tt.value AS genre, t.id AS track_id
      FROM track_tags tt
      JOIN tracks t ON t.id = tt.track_id
      WHERE tt.kind = 'genre' AND t.is_public = 1 AND t.status = 'published'
        AND (t.primary_genre IS NULL OR TRIM(t.primary_genre) = '')
    )
    SELECT genre, COUNT(DISTINCT track_id) AS track_count
    FROM genre_tracks
    WHERE genre IS NOT NULL AND TRIM(genre) <> ''
    GROUP BY genre
    ORDER BY track_count DESC, genre COLLATE NOCASE ASC
    LIMIT 100
  `).all();
  const items = (result.results || []).map((row) => ({ genre: row.genre, trackCount: Number(row.track_count || 0) }));
  return json({ ok: true, data: { items } }, 200, cors);
}

async function handleGenreTracks016(url, genreValue, env, cors) {
  const genre = normalizeGenre(genreValue);
  const limit = getPageSize(url);
  const cursor = decodeCursor(url.searchParams.get('cursor'));
  const bindings = [genre, genre];
  let cursorSql = '';
  if (cursor) {
    const publishedAt = Number(cursor.publishedAt);
    const id = safeString(cursor.id);
    if (Number.isFinite(publishedAt) && id) {
      cursorSql = 'AND (t.published_at < ? OR (t.published_at = ? AND t.id < ?))';
      bindings.push(publishedAt, publishedAt, id);
    }
  }
  const result = await env.DB.prepare(`
    SELECT t.*, p.nickname AS owner_nickname, p.avatar_url AS owner_avatar_url,
      COALESCE(s.like_count,0) AS like_count,
      COALESCE(s.comment_count,0) AS comment_count,
      COALESCE(s.play_count,0) AS play_count
    FROM tracks t
    LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
    LEFT JOIN track_stats s ON s.track_id = t.id
    WHERE t.is_public = 1 AND t.status = 'published'
      AND (
        t.primary_genre = ?
        OR ((t.primary_genre IS NULL OR TRIM(t.primary_genre) = '') AND EXISTS (
          SELECT 1 FROM track_tags tt
          WHERE tt.track_id = t.id AND tt.kind = 'genre' AND tt.value = ?
        ))
      )
      ${cursorSql}
    ORDER BY t.published_at DESC, t.id DESC
    LIMIT ?
  `).bind(...bindings, limit + 1).all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const last = visible[visible.length - 1];
  return json({ ok: true, data: {
    genre,
    items: visible.map(mapTrackRow),
    nextCursor: hasMore && last ? encodeCursor({ publishedAt: Number(last.published_at || 0), id: last.id }) : null
  } }, 200, cors);
}

// Keep the old handler for Suno Library publications. Music Note is routed into the
// new bounded path, so no behavior is silently removed from the other source type.
const originalPublication = functionRange('handlePublicationR2Core').text;
const legacyPublication = originalPublication.replace(
  /^async function handlePublicationR2Core\(/,
  'async function handlePublicationR2CoreLegacy016('
);
if (legacyPublication === originalPublication) throw new Error('[016] failed to rename legacy publication handler');

function handlePublicationR2Core016(request, env, cors) {
  return (async () => {
    const probe = request.clone();
    const authContext = await requireExploreAuth(probe);
    const body = await readJsonBody(probe, 8192);
    const sourceType = firstNonEmptyString(body?.sourceType);
    if (sourceType !== 'music_note') {
      return await handlePublicationR2CoreLegacy016(request, env, cors);
    }
    const source = await resolvePublicationSource(body, authContext);
    const publicationOptions = normalizePublicationOptions(body);
    return await handleMusicNotePublicationSingleWrite016(request, env, cors, authContext, source, publicationOptions);
  })();
}

const helperSource = [
  publicationBool016,
  publicationText016,
  publicationNullableNumberEqual016,
  publicationPrimaryGenre016,
  publicationCanonicalUnchanged016,
  publicationReadState016,
  publicationEnsureProfile016,
  publicationBuildFeedItem016,
  handleMusicNotePublicationSingleWrite016,
  shareBundleTags016,
].map((fn) => fn.toString()).join('\n\n');
const wrapperSource = handlePublicationR2Core016.toString().replace('handlePublicationR2Core016', 'handlePublicationR2Core');
const replacementPublication = `// ${marker}\n${helperSource}\n\n${wrapperSource}\n\n${legacyPublication}`;
replaceFunction('handlePublicationR2Core', replacementPublication);

replaceFunction('syncExploreFeedR2Publication012', syncExploreFeedR2Publication016.toString().replace('syncExploreFeedR2Publication016', 'syncExploreFeedR2Publication012'));
replaceFunction('handleTrackDetail', handleTrackDetail016.toString().replace('handleTrackDetail016', 'handleTrackDetail'));
replaceFunction('handleTrackApplySource', handleTrackApplySource016.toString().replace('handleTrackApplySource016', 'handleTrackApplySource'));
replaceFunction('handleGenres', handleGenres016.toString().replace('handleGenres016', 'handleGenres'));
replaceFunction('handleGenreTracks', handleGenreTracks016.toString().replace('handleGenreTracks016', 'handleGenreTracks'));

for (const required of [
  marker,
  'primary_genre',
  'mutation: unchanged ? \'idempotent\' : \'written\'',
  'D1 rebuild intentionally skipped',
  'handlePublicationR2CoreLegacy016',
  'shareBundleTags016',
]) {
  if (!source.includes(required)) throw new Error(`[016] missing required token: ${required}`);
}
const hot = functionRange('handleMusicNotePublicationSingleWrite016').text;
for (const forbidden of [
  'enforceUserRateLimit(',
  'track_stats (',
  'track_tags',
  'applyPublicationOptions(',
  'refreshPublicationTrackSearchIndex013(',
  'refreshOrPrebuildPublicProfileTrackWindow(',
  'safelyRefreshExploreFeedR2Bundles(',
]) {
  if (hot.includes(forbidden)) throw new Error(`[016] hot-path forbidden token remains: ${forbidden}`);
}
const insertCount = (hot.match(/INSERT INTO tracks/g) || []).length;
if (insertCount !== 1) throw new Error(`[016] canonical track insert count=${insertCount}`);

writeFileSync(workerPath, source, 'utf8');
console.log('[016] Music Note publication hot path reduced to one canonical track write; first-profile activation is the only bounded exception.');
