import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_COST_ZERO_PROFILE_FIRST_VIEW_MATERIALIZER_004';
if (source.includes(marker) || source.includes('materializePublicProfileFirstView')) {
  console.log('[SORIDRAW Worker] Cost-Zero profile first-view materializer already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needle = `async function ${name}(`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`004 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`004 function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`004 unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const transformFunction = (name, transform) => {
  const range = functionRange(name);
  const next = transform(range.text);
  if (!next || next === range.text) throw new Error(`004 ${name} transform made no change`);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

const publicProfileAnchor = 'async function handlePublicProfile(profileRef, env, cors) {';
if (!source.includes(publicProfileAnchor)) throw new Error('004 public profile anchor missing');

const helpers = `// ${marker}
var PUBLIC_PROFILE_FIRST_VIEW_SCHEMA_VERSION = 1;
var PUBLIC_PROFILE_FIRST_VIEW_LIMIT = 50;
var PUBLIC_PROFILE_FIRST_VIEW_EDGE_TTL_SECONDS = 30;

async function ensurePublicProfileFirstViewTable(env) {
  await env.DB.batch([
    env.DB.prepare(\`CREATE TABLE IF NOT EXISTS public_profile_first_views (
      uid TEXT PRIMARY KEY,
      handle TEXT NOT NULL DEFAULT '',
      schema_version INTEGER NOT NULL DEFAULT 1,
      revision INTEGER NOT NULL DEFAULT 1,
      payload_json TEXT NOT NULL,
      next_cursor TEXT,
      updated_at INTEGER NOT NULL
    )\`),
    env.DB.prepare(\`CREATE UNIQUE INDEX IF NOT EXISTS idx_public_profile_first_views_handle
      ON public_profile_first_views(handle COLLATE NOCASE)
      WHERE handle <> ''\`),
    env.DB.prepare(\`CREATE INDEX IF NOT EXISTS idx_public_profile_first_views_updated
      ON public_profile_first_views(updated_at DESC)\`)
  ]);
}

function parsePublicProfileFirstViewRow(row) {
  if (!row) return null;
  try {
    const snapshot = JSON.parse(String(row.payload_json || '{}'));
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.profile || !Array.isArray(snapshot.items)) return null;
    return {
      row,
      snapshot,
      profile: snapshot.profile,
      items: snapshot.items,
      nextCursor: row.next_cursor || snapshot.nextCursor || null
    };
  } catch {
    return null;
  }
}

async function readPublicProfileFirstViewRow(env, ref) {
  const normalized = String(ref || '').trim().replace(/^@+/, '');
  if (!normalized) return null;
  return await env.DB.prepare(\`
    SELECT uid, handle, schema_version, revision, payload_json, next_cursor, updated_at
    FROM public_profile_first_views
    WHERE uid = ? OR handle = ? COLLATE NOCASE
    ORDER BY CASE WHEN uid = ? THEN 0 ELSE 1 END
    LIMIT 1
  \`).bind(normalized, normalized, normalized).first();
}

async function readPublicProfileFirstViewBaseProfile(env, uid) {
  const profile = await env.DB.prepare(\`
    SELECT
      p.uid, p.nickname, p.avatar_url, p.background_url, p.bio, p.handle,
      p.genre_override, p.spotify_url, p.instagram_url, p.tiktok_url,
      p.created_at, p.updated_at,
      COALESCE(ps.follower_count, 0) AS follower_count,
      COALESCE(ps.following_count, 0) AS following_count
    FROM public_profiles p
    LEFT JOIN profile_stats ps ON ps.uid = p.uid
    WHERE p.uid = ? AND p.is_public = 1
    LIMIT 1
  \`).bind(uid).first();
  if (!profile) return null;
  return {
    uid: profile.uid,
    nickname: profile.nickname || '',
    avatarUrl: profile.avatar_url || '',
    backgroundUrl: profile.background_url || '',
    bio: profile.bio || '',
    handle: profile.handle || '',
    genres: parseProfileGenres(profile.genre_override),
    socialLinks: {
      spotify: profile.spotify_url || '',
      instagram: profile.instagram_url || '',
      tiktok: profile.tiktok_url || ''
    },
    followerCount: Number(profile.follower_count || 0),
    followingCount: Number(profile.following_count || 0),
    createdAt: Number(profile.created_at || 0),
    updatedAt: Number(profile.updated_at || 0)
  };
}

async function readPublicProfileFirstViewTrackWindow(env, uid) {
  const result = await env.DB.prepare(\`
    SELECT t.*, p.nickname AS owner_nickname, p.avatar_url AS owner_avatar_url,
      COALESCE(s.like_count,0) AS like_count,
      COALESCE(s.comment_count,0) AS comment_count,
      COALESCE(s.play_count,0) AS play_count
    FROM tracks t
    LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
    LEFT JOIN track_stats s ON s.track_id = t.id
    WHERE t.owner_uid = ? AND t.is_public = 1 AND t.status = 'published'
    ORDER BY t.profile_pinned DESC, t.published_at DESC, t.id DESC
    LIMIT ?
  \`).bind(uid, PUBLIC_PROFILE_FIRST_VIEW_LIMIT + 1).all();
  const rows = result.results || [];
  const hasMore = rows.length > PUBLIC_PROFILE_FIRST_VIEW_LIMIT;
  const visible = rows.slice(0, PUBLIC_PROFILE_FIRST_VIEW_LIMIT);
  const last = visible[visible.length - 1];
  return {
    items: visible.map(mapTrackRow),
    nextCursor: hasMore && last
      ? encodeCursor({ profilePinned: Number(last.profile_pinned || 0), publishedAt: Number(last.published_at || 0), id: last.id })
      : null
  };
}

async function writePublicProfileFirstViewSnapshot(env, uid, handle, snapshot, nextCursor, now) {
  await env.DB.prepare(\`
    INSERT INTO public_profile_first_views (
      uid, handle, schema_version, revision, payload_json, next_cursor, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET
      handle = excluded.handle,
      schema_version = excluded.schema_version,
      revision = public_profile_first_views.revision + 1,
      payload_json = excluded.payload_json,
      next_cursor = excluded.next_cursor,
      updated_at = excluded.updated_at
  \`).bind(
    uid,
    String(handle || '').trim().replace(/^@+/, ''),
    PUBLIC_PROFILE_FIRST_VIEW_SCHEMA_VERSION,
    JSON.stringify(snapshot),
    nextCursor || null,
    now
  ).run();
}

async function materializePublicProfileFirstView(env, uid) {
  const profile = await readPublicProfileFirstViewBaseProfile(env, uid);
  if (!profile) return null;
  const [countRow, window] = await Promise.all([
    env.DB.prepare(\`
      SELECT COUNT(*) AS track_count
      FROM tracks
      WHERE owner_uid = ? AND is_public = 1 AND status = 'published'
    \`).bind(uid).first(),
    readPublicProfileFirstViewTrackWindow(env, uid)
  ]);
  const profileWithCount = { ...profile, trackCount: Number(countRow?.track_count || 0) };
  const snapshot = { profile: profileWithCount, items: window.items };
  const now = Date.now();
  await writePublicProfileFirstViewSnapshot(env, uid, profile.handle, snapshot, window.nextCursor, now);
  return await readPublicProfileFirstViewRow(env, uid);
}

async function refreshPublicProfileFirstViewProfile(env, uid) {
  try {
    const stored = parsePublicProfileFirstViewRow(await readPublicProfileFirstViewRow(env, uid));
    if (!stored) return [];
    const profile = await readPublicProfileFirstViewBaseProfile(env, uid);
    if (!profile) {
      await env.DB.prepare('DELETE FROM public_profile_first_views WHERE uid = ?').bind(uid).run();
      return [uid, stored.row.handle].filter(Boolean);
    }
    const nextProfile = { ...profile, trackCount: Number(stored.profile?.trackCount || 0) };
    await writePublicProfileFirstViewSnapshot(
      env,
      uid,
      profile.handle,
      { ...stored.snapshot, profile: nextProfile },
      stored.nextCursor,
      Date.now()
    );
    return [uid, stored.row.handle, profile.handle].filter(Boolean);
  } catch (error) {
    console.warn('[SORIDRAW first-view] profile refresh skipped:', String(error?.message || error || 'unknown'));
    return [];
  }
}

async function refreshPublicProfileFirstViewTrackWindow(env, uid, trackCountDelta = 0) {
  try {
    const stored = parsePublicProfileFirstViewRow(await readPublicProfileFirstViewRow(env, uid));
    if (!stored) return [];
    const window = await readPublicProfileFirstViewTrackWindow(env, uid);
    const nextTrackCount = Math.max(0, Number(stored.profile?.trackCount || 0) + Number(trackCountDelta || 0));
    const snapshot = {
      ...stored.snapshot,
      profile: { ...stored.profile, trackCount: nextTrackCount },
      items: window.items
    };
    await writePublicProfileFirstViewSnapshot(env, uid, stored.row.handle, snapshot, window.nextCursor, Date.now());
    return [uid, stored.row.handle].filter(Boolean);
  } catch (error) {
    console.warn('[SORIDRAW first-view] track window refresh skipped:', String(error?.message || error || 'unknown'));
    return [];
  }
}

async function patchPublicProfileFirstViewLikeCount(env, uid, trackId, likeCount) {
  try {
    const stored = parsePublicProfileFirstViewRow(await readPublicProfileFirstViewRow(env, uid));
    if (!stored) return [];
    let changed = false;
    const items = stored.items.map((item) => {
      if (String(item?.id || '') !== String(trackId || '')) return item;
      changed = true;
      return { ...item, likeCount: Number(likeCount || 0) };
    });
    if (!changed) return [uid, stored.row.handle].filter(Boolean);
    await writePublicProfileFirstViewSnapshot(
      env,
      uid,
      stored.row.handle,
      { ...stored.snapshot, items },
      stored.nextCursor,
      Date.now()
    );
    return [uid, stored.row.handle].filter(Boolean);
  } catch (error) {
    console.warn('[SORIDRAW first-view] like patch skipped:', String(error?.message || error || 'unknown'));
    return [];
  }
}

function getPublicProfileFirstViewEdgeCacheKey(requestUrl, profileRef, requestOrigin) {
  const base = new URL(requestUrl).origin;
  const normalized = String(profileRef || '').trim();
  const url = new URL(\`/v1/profiles/\${encodeURIComponent(normalized)}/first-view\`, base);
  url.searchParams.set('limit', String(PUBLIC_PROFILE_FIRST_VIEW_LIMIT));
  url.searchParams.set('__soridraw_edge_origin', requestOrigin || 'none');
  return new Request(url.toString(), { method: 'GET' });
}

function withPublicProfileFirstViewEdgeHeader(response, status) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', \`public, max-age=0, s-maxage=\${PUBLIC_PROFILE_FIRST_VIEW_EDGE_TTL_SECONDS}\`);
  headers.set('X-SORIDRAW-Profile-Edge-Cache', status);
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '').split(',').map((item) => item.trim()).filter(Boolean));
  expose.add('X-SORIDRAW-Profile-Edge-Cache');
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function invalidatePublicProfileFirstViewEdgeCache(request, refs) {
  try {
    const uniqueRefs = [...new Set((refs || []).map((value) => String(value || '').trim()).filter(Boolean))];
    if (!uniqueRefs.length) return;
    const cache = caches.default;
    const origins = ['', ...ALLOWED_ORIGINS];
    await Promise.all(uniqueRefs.flatMap((ref) => {
      const normalized = ref.replace(/^@+/, '');
      const variants = [...new Set([normalized, normalized ? '@' + normalized : ''].filter(Boolean))];
      return variants.flatMap((variant) => origins.map((origin) => cache.delete(getPublicProfileFirstViewEdgeCacheKey(request.url, variant, origin))));
    }));
  } catch (error) {
    console.warn('[SORIDRAW first-view] edge invalidation skipped:', String(error?.message || error || 'unknown'));
  }
}

async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {
  const cache = caches.default;
  const requestOrigin = request.headers.get('Origin') || '';
  const key = getPublicProfileFirstViewEdgeCacheKey(request.url, profileRef, requestOrigin);
  const cached = await cache.match(key);
  if (cached) return withPublicProfileFirstViewEdgeHeader(cached, 'HIT');
  const live = await handlePublicProfileFirstViewSnapshot(profileRef, env, cors);
  if (!live.ok) return live;
  const cacheable = withPublicProfileFirstViewEdgeHeader(live, 'MISS');
  await cache.put(key, cacheable.clone());
  return cacheable;
}

`;
source = source.replace(publicProfileAnchor, helpers + publicProfileAnchor);

replaceFunction('handlePublicProfileFirstViewSnapshot', `async function handlePublicProfileFirstViewSnapshot(profileRef, env, cors) {
  const ref = String(profileRef || '').trim().replace(/^@+/, '');
  if (!ref) return apiError('NOT_FOUND', '공개 프로필을 찾을 수 없습니다.', 404, cors);

  let row = null;
  try {
    row = await readPublicProfileFirstViewRow(env, ref);
  } catch (error) {
    const message = String(error?.message || error || '');
    if (!message.includes('no such table') && !message.includes('public_profile_first_views')) throw error;
    try {
      await ensurePublicProfileFirstViewTable(env);
    } catch (tableError) {
      console.warn('[SORIDRAW first-view] table preparation unavailable:', String(tableError?.message || tableError || 'unknown'));
      return apiError('FIRST_VIEW_SNAPSHOT_UNAVAILABLE', '공개 프로필 스냅샷을 준비 중입니다.', 404, cors);
    }
  }

  let parsed = parsePublicProfileFirstViewRow(row);
  if (!parsed) {
    const resolved = await resolvePublicProfileRef(env, ref);
    if (!resolved?.uid) return apiError('NOT_FOUND', '공개 프로필을 찾을 수 없습니다.', 404, cors);
    try {
      row = await materializePublicProfileFirstView(env, resolved.uid);
      parsed = parsePublicProfileFirstViewRow(row);
    } catch (error) {
      console.warn('[SORIDRAW first-view] lazy materialization unavailable:', String(error?.message || error || 'unknown'));
      return apiError('FIRST_VIEW_SNAPSHOT_UNAVAILABLE', '공개 프로필 스냅샷을 준비 중입니다.', 404, cors);
    }
  }

  if (!parsed) return apiError('FIRST_VIEW_SNAPSHOT_MISS', '공개 프로필 스냅샷을 준비 중입니다.', 404, cors);
  return json({
    ok: true,
    data: {
      ...parsed.snapshot,
      nextCursor: parsed.nextCursor,
      revision: Number(parsed.row.revision || 0),
      schemaVersion: Number(parsed.row.schema_version || PUBLIC_PROFILE_FIRST_VIEW_SCHEMA_VERSION),
      updatedAt: Number(parsed.row.updated_at || 0)
    }
  }, 200, cors);
}`);

transformFunction('handleMyProfileUpdate', (text) => {
  const anchor = '  const profile = await readPublicProfileByUid(env, authContext.uid);\n  return json({ ok: true, data: { profile } }, 200, cors);';
  if (!text.includes(anchor)) throw new Error('004 profile update anchor missing');
  return text.replace(anchor, `  const profile = await readPublicProfileByUid(env, authContext.uid);\n  const firstViewRefs = await refreshPublicProfileFirstViewProfile(env, authContext.uid);\n  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json({ ok: true, data: { profile } }, 200, cors);`);
});

transformFunction('handleProfileMediaUpload', (text) => {
  const anchor = '  await refreshProfileSearchIndex(env, authContext.uid);\n  return json({ ok: true, data: { kind, url: publicUrl, updatedAt: now } }, 200, cors);';
  if (!text.includes(anchor)) throw new Error('004 profile media anchor missing');
  return text.replace(anchor, `  await refreshProfileSearchIndex(env, authContext.uid);\n  const firstViewRefs = await refreshPublicProfileFirstViewProfile(env, authContext.uid);\n  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json({ ok: true, data: { kind, url: publicUrl, updatedAt: now } }, 200, cors);`);
});

transformFunction('handleFollow', (text) => {
  const anchor = '  const stats = await env.DB.prepare(`\n    SELECT follower_count, following_count FROM profile_stats WHERE uid = ? LIMIT 1\n  `).bind(targetUid).first();\n  return json({ ok: true, data: {';
  if (!text.includes(anchor)) throw new Error('004 follow anchor missing');
  return text.replace(anchor, `  const stats = await env.DB.prepare(\`\n    SELECT follower_count, following_count FROM profile_stats WHERE uid = ? LIMIT 1\n  \`).bind(targetUid).first();\n  const followerFirstViewRefs = await refreshPublicProfileFirstViewProfile(env, authContext.uid);\n  const targetFirstViewRefs = await refreshPublicProfileFirstViewProfile(env, targetUid);\n  await invalidatePublicProfileFirstViewEdgeCache(request, [...followerFirstViewRefs, ...targetFirstViewRefs]);\n  return json({ ok: true, data: {`);
});

transformFunction('handlePublication', (text) => {
  const beforeAnchor = '  const publicationOptions = normalizePublicationOptions(body);\n  const now = Date.now();';
  if (!text.includes(beforeAnchor)) throw new Error('004 publication pre-state anchor missing');
  let next = text.replace(beforeAnchor, `  const publicationOptions = normalizePublicationOptions(body);\n  const previousFirstViewTrack = await env.DB.prepare(\`\n    SELECT is_public, status FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1\n  \`).bind(source.id, authContext.uid).first();\n  const now = Date.now();`);
  const returnAnchor = '  const storedOptions = await env.DB.prepare(`\n    SELECT allow_next_song_apply, allow_follower_save, profile_pinned\n    FROM tracks\n    WHERE id = ? AND owner_uid = ?\n    LIMIT 1\n  `).bind(source.id, authContext.uid).first();\n  return json(';
  if (!next.includes(returnAnchor)) throw new Error('004 publication refresh anchor missing');
  next = next.replace(returnAnchor, `  const storedOptions = await env.DB.prepare(\`\n    SELECT allow_next_song_apply, allow_follower_save, profile_pinned\n    FROM tracks\n    WHERE id = ? AND owner_uid = ?\n    LIMIT 1\n  \`).bind(source.id, authContext.uid).first();\n  const wasPublishedForFirstView = Number(previousFirstViewTrack?.is_public || 0) === 1 && String(previousFirstViewTrack?.status || '') === 'published';\n  const firstViewRefs = await refreshPublicProfileFirstViewTrackWindow(env, authContext.uid, wasPublishedForFirstView ? 0 : 1);\n  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json(`);
  return next;
});

transformFunction('handlePublicationOptions', (text) => {
  const anchor = '  const row = await env.DB.prepare(`\n    SELECT allow_next_song_apply, allow_follower_save, profile_pinned\n    FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1\n  `).bind(trackId, authContext.uid).first();\n  return json({ ok: true, data: {';
  if (!text.includes(anchor)) throw new Error('004 publication options anchor missing');
  return text.replace(anchor, `  const row = await env.DB.prepare(\`\n    SELECT allow_next_song_apply, allow_follower_save, profile_pinned\n    FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1\n  \`).bind(trackId, authContext.uid).first();\n  const firstViewRefs = await refreshPublicProfileFirstViewTrackWindow(env, authContext.uid, 0);\n  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json({ ok: true, data: {`);
});

transformFunction('handleVisibility', (text) => {
  const beforeAnchor = '  await getOwnedTrack(env, trackId, authContext.uid);\n  const body = await readJsonBody(request, 2048);';
  if (!text.includes(beforeAnchor)) throw new Error('004 visibility pre-state anchor missing');
  let next = text.replace(beforeAnchor, `  await getOwnedTrack(env, trackId, authContext.uid);\n  const previousFirstViewTrack = await env.DB.prepare(\`\n    SELECT is_public, status FROM tracks WHERE id = ? AND owner_uid = ? LIMIT 1\n  \`).bind(trackId, authContext.uid).first();\n  const body = await readJsonBody(request, 2048);`);
  const returnAnchor = '  await refreshTrackSearchIndex(env, trackId);\n  return json(';
  if (!next.includes(returnAnchor)) throw new Error('004 visibility refresh anchor missing');
  next = next.replace(returnAnchor, `  await refreshTrackSearchIndex(env, trackId);\n  const wasPublishedForFirstView = Number(previousFirstViewTrack?.is_public || 0) === 1 && String(previousFirstViewTrack?.status || '') === 'published';\n  const isPublishedForFirstView = body.isPublic === true && String(previousFirstViewTrack?.status || '') === 'published';\n  const firstViewDelta = wasPublishedForFirstView === isPublishedForFirstView ? 0 : (isPublishedForFirstView ? 1 : -1);\n  const firstViewRefs = await refreshPublicProfileFirstViewTrackWindow(env, authContext.uid, firstViewDelta);\n  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json(`);
  return next;
});

transformFunction('handleLike', (text) => {
  const anchor = '  const likeCount = await refreshLikeCount(env, trackId, now);\n  return json(';
  if (!text.includes(anchor)) throw new Error('004 like anchor missing');
  return text.replace(anchor, `  const likeCount = await refreshLikeCount(env, trackId, now);\n  const firstViewOwner = await env.DB.prepare('SELECT owner_uid FROM tracks WHERE id = ? LIMIT 1').bind(trackId).first();\n  const firstViewRefs = firstViewOwner?.owner_uid\n    ? await patchPublicProfileFirstViewLikeCount(env, firstViewOwner.owner_uid, trackId, likeCount)\n    : [];\n  await invalidatePublicProfileFirstViewEdgeCache(request, firstViewRefs);\n  return json(`);
});

const routePattern = /return\s+await\s+handlePublicProfileFirstViewSnapshot\(\s*decodeURIComponent\(segments\[2\]\)\s*,\s*env\s*,\s*cors\s*\);/;
if (!routePattern.test(source)) throw new Error('004 first-view route anchor missing');
source = source.replace(
  routePattern,
  'return await handlePublicProfileFirstViewWithEdgeCache(request, decodeURIComponent(segments[2]), env, cors);'
);

const requiredMarkers = [
  marker,
  'ensurePublicProfileFirstViewTable',
  'materializePublicProfileFirstView',
  'handlePublicProfileFirstViewWithEdgeCache',
  'refreshPublicProfileFirstViewTrackWindow',
  'patchPublicProfileFirstViewLikeCount',
];
for (const required of requiredMarkers) {
  if (!source.includes(required)) throw new Error(`004 verification failed: ${required}`);
}

writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Cost-Zero profile first-view lazy materializer + edge cache prepared.');
