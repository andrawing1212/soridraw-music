const FEED_LIMIT = 40;
const feedKey = (sort) => `internal/explore/feed-v1/${sort === 'popular' ? 'popular' : 'latest'}-${FEED_LIMIT}.json`;
const likeKey = (uid) => `internal/explore/likes-v1/${encodeURIComponent(String(uid || ''))}.json`;

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const readR2Json = async (env, key) => {
  const object = await env.PROFILE_MEDIA.get(key);
  if (!object) return null;
  try { return JSON.parse(await object.text()); } catch { return null; }
};
const writeR2Json = async (env, key, payload) => {
  await env.PROFILE_MEDIA.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawBundle: '1', updatedAt: String(Date.now()) },
  });
};
const clampCount = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const classify = (sql) => {
  const text = String(sql || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--.*$/gm, ' ').trim().toUpperCase();
  if (/^(SELECT|PRAGMA|EXPLAIN)\b/.test(text)) return 'read';
  if (/^(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|ANALYZE)\b/.test(text)) return 'write';
  if (/^WITH\b/.test(text)) return /\b(INSERT|UPDATE|DELETE|REPLACE)\b/.test(text) ? 'write' : 'read';
  return 'other';
};
const meteredDb = (db, usage) => new Proxy(db, {
  get(target, prop) {
    if (prop !== 'prepare') {
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
    return (sql) => {
      const kind = classify(sql);
      const wrap = (statement) => new Proxy(statement, {
        get(st, key) {
          if (key === 'bind') return (...args) => wrap(st.bind(...args));
          if (key === 'all' || key === 'run') return async (...args) => {
            const result = await st[key](...args);
            usage[kind] = Number(usage[kind] || 0) + 1;
            return result;
          };
          if (key === 'first') return async (column) => {
            const result = await st.all();
            usage[kind] = Number(usage[kind] || 0) + 1;
            const row = Array.isArray(result?.results) ? result.results[0] ?? null : null;
            return column ? (row ? row[column] : null) : row;
          };
          const value = st[key];
          return typeof value === 'function' ? value.bind(st) : value;
        },
      });
      return wrap(target.prepare(sql));
    };
  },
});

async function enforceRateLimit(db, uid, action, limit = 120, windowMs = 60_000) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const result = await db.prepare(`
    INSERT INTO api_rate_limits (scope, subject, action, window_start, count, updated_at)
    VALUES ('user', ?, ?, ?, 1, ?)
    ON CONFLICT(scope, subject, action, window_start) DO UPDATE SET
      count = api_rate_limits.count + 1,
      updated_at = excluded.updated_at
    RETURNING count
  `).bind(uid, action, windowStart, now).all();
  const count = Number(result?.results?.[0]?.count || 0);
  if (count > limit) throw new Error('diagnostic rate limit unexpectedly exceeded');
  if (count === 1 && Math.floor(windowStart / windowMs) % 6 === 0) {
    await db.prepare(`
      DELETE FROM api_rate_limits
      WHERE (scope, subject, action, window_start) IN (
        SELECT scope, subject, action, window_start
        FROM api_rate_limits
        WHERE updated_at < ?
        ORDER BY updated_at ASC
        LIMIT 8
      )
    `).bind(now - 48 * 60 * 60 * 1e3).run();
  }
}

async function getPublicTrackForWrite(db, trackId) {
  return await db.prepare(`
    SELECT id, owner_uid
    FROM tracks
    WHERE id = ? AND is_public = 1 AND status = 'published'
    LIMIT 1
  `).bind(trackId).first();
}

async function adjustLikeCounter(db, trackId, uid, shouldLike, now) {
  const mutation = shouldLike
    ? await db.prepare(`
        INSERT OR IGNORE INTO likes (track_id, user_uid, created_at)
        VALUES (?, ?, ?)
      `).bind(trackId, uid, now).run()
    : await db.prepare(`
        DELETE FROM likes WHERE track_id = ? AND user_uid = ?
      `).bind(trackId, uid).run();
  const changed = Number(mutation?.meta?.changes || 0) > 0;
  if (!changed) {
    const stat = await db.prepare('SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1').bind(trackId).first();
    return { likeCount: clampCount(stat?.like_count), changed: false };
  }
  const delta = shouldLike ? 1 : -1;
  const initial = shouldLike ? 1 : 0;
  const result = await db.prepare(`
    INSERT INTO track_stats (track_id, like_count, comment_count, play_count, updated_at)
    VALUES (?, ?, 0, 0, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      like_count = MAX(0, track_stats.like_count + ?),
      updated_at = excluded.updated_at
    RETURNING like_count
  `).bind(trackId, initial, now, delta).all();
  return { likeCount: clampCount(result?.results?.[0]?.like_count), changed: true };
}

async function syncLikeBundle(env, uid, trackId, liked) {
  const key = likeKey(uid);
  const bundle = await readR2Json(env, key);
  const ids = new Set(Array.isArray(bundle?.likedTrackIds) ? bundle.likedTrackIds.map(String) : []);
  if (liked) ids.add(String(trackId)); else ids.delete(String(trackId));
  await writeR2Json(env, key, {
    schemaVersion: 1,
    uid: String(uid),
    updatedAt: Date.now(),
    likedTrackIds: [...ids].filter(Boolean).slice(0, 2000),
  });
}

async function patchFeedBundles(env, trackId, likeCount) {
  for (const sort of ['latest', 'popular']) {
    const key = feedKey(sort);
    const bundle = await readR2Json(env, key);
    if (!bundle?.payload?.data || !Array.isArray(bundle.payload.data.items)) continue;
    let changed = false;
    const items = bundle.payload.data.items.map((item) => {
      const id = String(item?.id || item?.trackId || '');
      if (id !== String(trackId)) return item;
      changed = true;
      return { ...item, likeCount: Math.max(0, Number(likeCount || 0)) };
    });
    if (!changed) continue;
    if (sort === 'popular') {
      items.sort((a, b) => {
        const likes = Number(b?.likeCount || 0) - Number(a?.likeCount || 0);
        if (likes) return likes;
        const published = Number(b?.publishedAt || b?.published_at || 0) - Number(a?.publishedAt || a?.published_at || 0);
        if (published) return published;
        return String(b?.id || '').localeCompare(String(a?.id || ''));
      });
    }
    bundle.payload.data.items = items;
    bundle.updatedAt = Date.now();
    await writeR2Json(env, key, bundle);
  }
}

async function mutate(env, uid, trackId, shouldLike) {
  const usage = { read: 0, write: 0, other: 0 };
  const db = meteredDb(env.DB, usage);
  await enforceRateLimit(db, uid, 'like');
  const track = await getPublicTrackForWrite(db, trackId);
  if (!track?.id) throw new Error('public track validation failed');
  const now = Date.now();
  const adjusted = await adjustLikeCounter(db, trackId, uid, shouldLike, now);
  await Promise.all([
    syncLikeBundle(env, uid, trackId, shouldLike),
    patchFeedBundles(env, trackId, adjusted.likeCount),
  ]);
  return {
    liked: shouldLike,
    changed: adjusted.changed,
    likeCount: adjusted.likeCount,
    reads: usage.read,
    writes: usage.write,
    other: usage.other,
  };
}

async function pickTarget(env) {
  const latest = await readR2Json(env, feedKey('latest'));
  const items = latest?.payload?.data?.items;
  if (!Array.isArray(items) || !items.length) throw new Error('PREVIEW R2 latest feed bundle is empty');
  for (const item of items) {
    const id = String(item?.id || item?.trackId || '').trim();
    if (!id) continue;
    const track = await env.DB.prepare("SELECT id FROM tracks WHERE id = ? AND is_public = 1 AND status = 'published' LIMIT 1").bind(id).first();
    if (track?.id) return id;
  }
  throw new Error('no R2 feed item maps to a public D1 track');
}

async function cleanupDiagnostic(env, uid, trackId) {
  let removedOwnLike = false;
  if (trackId) {
    const result = await env.DB.prepare('DELETE FROM likes WHERE track_id = ? AND user_uid = ? RETURNING track_id').bind(trackId, uid).all();
    removedOwnLike = Array.isArray(result?.results) && result.results.length > 0;
    if (removedOwnLike) {
      const now = Date.now();
      const stat = await env.DB.prepare(`
        INSERT INTO track_stats (track_id, like_count, comment_count, play_count, updated_at)
        VALUES (?, 0, 0, 0, ?)
        ON CONFLICT(track_id) DO UPDATE SET
          like_count = MAX(0, track_stats.like_count - 1),
          updated_at = excluded.updated_at
        RETURNING like_count
      `).bind(trackId, now).all();
      const count = clampCount(stat?.results?.[0]?.like_count);
      await Promise.all([
        syncLikeBundle(env, uid, trackId, false).catch(() => {}),
        patchFeedBundles(env, trackId, count).catch(() => {}),
      ]);
    }
  }
  await env.DB.prepare("DELETE FROM api_rate_limits WHERE scope = 'user' AND subject = ?").bind(uid).run();
  await env.PROFILE_MEDIA.delete(likeKey(uid));
  return { removedOwnLike };
}

async function runProbe(env, nonce) {
  const uid = `soridraw044_preview_probe_${String(nonce || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)}`;
  if (uid.length < 30) throw new Error('diagnostic nonce missing');
  const trackId = await pickTarget(env);
  await cleanupDiagnostic(env, uid, trackId);
  await writeR2Json(env, likeKey(uid), { schemaVersion: 1, uid, updatedAt: Date.now(), likedTrackIds: [] });

  const cycles = [];
  let restored = false;
  try {
    for (let cycle = 1; cycle <= 2; cycle += 1) {
      const put = await mutate(env, uid, trackId, true);
      if (!put.changed) throw new Error('diagnostic like did not create relation');
      const del = await mutate(env, uid, trackId, false);
      if (!del.changed) throw new Error('diagnostic unlike did not remove relation');
      if (del.likeCount !== Math.max(0, put.likeCount - 1)) throw new Error('diagnostic counter roundtrip mismatch');
      cycles.push({ cycle, put, delete: del });
      if (put.reads === 1 && put.writes === 3) break;
    }
    const normal = cycles.find((entry) => entry.put.reads === 1 && entry.put.writes === 3);
    if (!normal) throw new Error(`normal 1-read/3-write like not observed: ${JSON.stringify(cycles)}`);

    const relation = await env.DB.prepare('SELECT 1 AS ok FROM likes WHERE track_id = ? AND user_uid = ? LIMIT 1').bind(trackId, uid).first();
    if (relation?.ok) throw new Error('diagnostic like relation remained after unlike');
    const likeBundle = await readR2Json(env, likeKey(uid));
    if (Array.isArray(likeBundle?.likedTrackIds) && likeBundle.likedTrackIds.map(String).includes(trackId)) throw new Error('R2 like bundle remained liked');
    const stat = await env.DB.prepare('SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1').bind(trackId).first();
    const currentCount = clampCount(stat?.like_count);
    const latest = await readR2Json(env, feedKey('latest'));
    const feedItem = latest?.payload?.data?.items?.find((item) => String(item?.id || item?.trackId || '') === trackId);
    if (!feedItem || clampCount(feedItem?.likeCount) !== currentCount) throw new Error('R2 latest feed counter is not synchronized');
    restored = true;
    return {
      ok: true,
      environment: 'preview',
      mode: 'temporary-worker-auth-bypass-cost-probe',
      uid,
      trackId,
      cycles,
      measuredNormalLike: normal.put,
      measuredNormalUnlike: normal.delete,
      feedR2RoundTrip: true,
      restoredToUnliked: true,
      authAppCheckChanged: false,
      measuredAt: new Date().toISOString(),
    };
  } finally {
    await cleanupDiagnostic(env, uid, trackId);
    if (!restored) console.warn('SORIDRAW 044 probe cleanup executed after a failed measurement');
  }
}

export default {
  async fetch(request, env) {
    try {
      if (request.method !== 'POST') return new Response('not found', { status: 404 });
      if (request.headers.get('Authorization') !== `Bearer ${env.PROBE_TOKEN}`) return new Response('not found', { status: 404 });
      const body = await request.json().catch(() => ({}));
      const result = await runProbe(env, body?.nonce);
      return json(result);
    } catch (error) {
      return json({ ok: false, error: String(error?.stack || error?.message || error || 'unknown') }, 500);
    }
  },
};
