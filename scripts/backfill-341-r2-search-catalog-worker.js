// SORIDRAW_SEARCH_R2_BACKFILL_341_20261004
const ROOT = 'internal/explore/catalog-v1';
const CARD_ROOT = 'internal/explore/shared-track-card-v115';

const text = (v) => String(v ?? '').trim();
const norm = (v) => text(v).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const tokenNorm = (v) => norm(v).replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const seg = (v) => encodeURIComponent(text(v));
const inverse = (v) => {
  const n = Number(v);
  const safe = Number.isFinite(n) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(n))) : 0;
  return String(Number.MAX_SAFE_INTEGER - safe).padStart(16, '0');
};
const desc = (v) => {
  const out = Array.from(String(v ?? ''), (c) => (0x10ffff - (c.codePointAt(0) ?? 0)).toString(16).padStart(6, '0'));
  out.push('ffffff');
  return out.join('');
};
const titleTokens = (title) => {
  const full = norm(title).slice(0, 160);
  const parts = tokenNorm(title).split(' ').filter(Boolean);
  const out = [], seen = new Set();
  const push = (v) => {
    const x = text(v).slice(0, 80);
    if (!x || seen.has(x)) return;
    seen.add(x); out.push(x);
  };
  push(full);
  for (const p of parts) { push(p); if (out.length >= 8) break; }
  return out.slice(0, 8);
};
const metaKey = (id) => `${ROOT}/meta/${seg(id)}.json`;
const cardKey = (id) => `${CARD_ROOT}/${seg(id)}.json`;
const artistMetaKey = (uid) => `${ROOT}/artist-meta/${seg(uid)}.json`;
const latestKey = (t) => `${ROOT}/latest/${inverse(t.publishedAt)}/${desc(t.id)}/${seg(t.id)}.json`;
const popularKey = (t) => `${ROOT}/popular/${inverse(t.likeCount)}/${inverse(t.publishedAt)}/${desc(t.id)}/${seg(t.id)}.json`;
const profileKey = (t) => `${ROOT}/profile/${seg(t.ownerUid)}/${t.profilePinned ? '0' : '1'}/${inverse(t.publishedAt)}/${desc(t.id)}/${seg(t.id)}.json`;
const genreKey = (t) => t.primaryGenre ? `${ROOT}/genre/${seg(t.primaryGenre)}/${inverse(t.publishedAt)}/${desc(t.id)}/${seg(t.id)}.json` : '';
const titleKeys = (t) => titleTokens(t.title).map((x) => `${ROOT}/title/${seg(x)}/${inverse(t.publishedAt)}/${desc(t.id)}/${seg(t.id)}.json`);
const markerKeys = (t) => [...new Set([latestKey(t), popularKey(t), profileKey(t), genreKey(t), ...titleKeys(t)].filter(Boolean))].sort();

function shareBundle(row) {
  try {
    if (Number(row.share_schema_version || 0) !== 1) return null;
    const parsed = JSON.parse(String(row.share_payload_json || ''));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Number(parsed.schemaVersion || 0) !== 1) return null;
    return {
      schemaVersion: 1,
      selectedKeywords: parsed.selectedKeywords && typeof parsed.selectedKeywords === 'object' ? parsed.selectedKeywords : {},
      nextSong: Number(row.allow_next_song_apply || 0) === 1 && parsed.nextSong && typeof parsed.nextSong === 'object' ? parsed.nextSong : null,
    };
  } catch { return null; }
}

function cardFromRow(row) {
  const likeCount = Math.max(0, Number(row.like_count || 0));
  return {
    id: text(row.id),
    ownerUid: text(row.owner_uid),
    ownerHandle: text(row.owner_handle).replace(/^@+/, ''),
    ownerNickname: text(row.owner_nickname),
    ownerAvatarUrl: text(row.owner_avatar_url),
    sourceType: text(row.source_type),
    sourceId: text(row.source_id),
    sourceParentId: text(row.source_parent_id) || null,
    legacyGlobalId: text(row.legacy_global_id) || null,
    sourceSubTrackKey: text(row.source_subtrack_key),
    sourceSubTrackIndex: row.source_subtrack_index == null ? null : Number(row.source_subtrack_index),
    sourceSubTrackId: text(row.source_subtrack_id) || null,
    title: text(row.title),
    description: text(row.description),
    coverUrl: text(row.cover_url),
    durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
    lyrics: text(row.lyrics),
    style: text(row.style),
    prompt: text(row.prompt),
    sunoUrlPrimary: text(row.suno_url_primary),
    sunoUrlSecondary: text(row.suno_url_secondary) || null,
    openUrl: text(row.suno_url_primary || row.suno_url_secondary),
    allowNextSongApply: Number(row.allow_next_song_apply || 0) === 1,
    allowFollowerSave: Number(row.allow_follower_save || 0) === 1,
    profilePinned: Number(row.profile_pinned || 0) === 1,
    shareBundle: shareBundle(row),
    primaryGenre: text(row.primary_genre),
    likeCount,
    publishedAt: Math.max(0, Number(row.published_at || 0)),
    stats: {
      likeCount,
      commentCount: Math.max(0, Number(row.comment_count || 0)),
      playCount: Math.max(0, Number(row.play_count || 0)),
    },
  };
}

const trackSummary = (card) => ({
  id: card.id,
  ownerUid: card.ownerUid,
  title: card.title,
  publishedAt: card.publishedAt,
  likeCount: card.likeCount,
  profilePinned: card.profilePinned,
  primaryGenre: norm(card.primaryGenre).slice(0, 160),
});

async function readJson(bucket, key) {
  try {
    const obj = await bucket.get(key);
    return obj ? JSON.parse(await obj.text()) : null;
  } catch { return null; }
}
async function putJson(bucket, key, value, metadata = {}) {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawBackfill: '341', updatedAt: String(Date.now()), ...metadata },
  });
}

async function syncArtist(bucket, row) {
  const uid = text(row.owner_uid);
  if (!uid) return;
  const nickname = norm(row.owner_nickname).slice(0, 120);
  const handle = norm(row.owner_handle).replace(/^@+/, '').slice(0, 120);
  const keys = [];
  if (nickname) keys.push(`${ROOT}/artist/name/${seg(nickname)}/${seg(uid)}.json`);
  if (handle) keys.push(`${ROOT}/artist/handle/${seg(handle)}/${seg(uid)}.json`);
  const nextKeys = [...new Set(keys)].sort();
  const mk = artistMetaKey(uid);
  const previous = await readJson(bucket, mk);
  const old = new Set(Array.isArray(previous?.markerKeys) ? previous.markerKeys : []);
  const next = new Set(nextKeys);
  const remove = [...old].filter((k) => !next.has(k));
  if (remove.length) await bucket.delete(remove);
  for (const key of nextKeys) await putJson(bucket, key, { schemaVersion: 1, uid }, { uid, kind: 'artist' });
  const signature = JSON.stringify({ uid, nickname, handle, nextKeys });
  await putJson(bucket, mk, { schemaVersion: 1, uid, markerKeys: nextKeys, signature, updatedAt: Date.now() }, { uid, kind: 'artist-meta' });
}

async function syncTrack(bucket, row) {
  const card = cardFromRow(row);
  const track = trackSummary(card);
  const keys = markerKeys(track);
  const mk = metaKey(track.id);
  const previous = await readJson(bucket, mk);
  const old = new Set(Array.isArray(previous?.markerKeys) ? previous.markerKeys : []);
  const next = new Set(keys);
  const remove = [...old].filter((k) => !next.has(k));
  if (remove.length) await bucket.delete(remove);
  const markerPayload = { schemaVersion: 1, trackId: track.id, ownerUid: track.ownerUid, publishedAt: track.publishedAt, likeCount: track.likeCount };
  for (const key of keys) await putJson(bucket, key, markerPayload, { trackId: track.id, ownerUid: track.ownerUid });
  const signature = JSON.stringify({ schemaVersion: 1, public: true, ...track, markerKeys: keys });
  await putJson(bucket, mk, { schemaVersion: 1, trackId: track.id, public: true, track, markerKeys: keys, signature, updatedAt: Date.now() }, { trackId: track.id, kind: 'meta' });
  await putJson(bucket, cardKey(track.id), { schemaVersion: 1, trackId: track.id, updatedAt: Date.now(), card }, { trackId: track.id, kind: 'shared-track-card' });
  await syncArtist(bucket, row);
  return { id: track.id, markers: keys.length };
}

const SELECT_PAGE = `
  SELECT
    t.*,
    p.nickname AS owner_nickname,
    p.avatar_url AS owner_avatar_url,
    p.handle AS owner_handle,
    COALESCE(s.like_count,0) AS like_count,
    COALESCE(s.comment_count,0) AS comment_count,
    COALESCE(s.play_count,0) AS play_count
  FROM tracks t
  LEFT JOIN public_profiles p ON p.uid=t.owner_uid AND p.is_public=1
  LEFT JOIN track_stats s ON s.track_id=t.id
  WHERE t.is_public=1 AND t.status='published' AND t.id>?
  ORDER BY t.id ASC
  LIMIT ?
`;

async function page(env, cursor, limit) {
  const result = await env.DB.prepare(SELECT_PAGE).bind(cursor, limit).all();
  return Array.isArray(result?.results) ? result.results : [];
}

async function verifyRows(env, rows) {
  const missing = [];
  for (const row of rows) {
    const id = text(row.id);
    const meta = await readJson(env.PROFILE_MEDIA, metaKey(id));
    const card = await env.PROFILE_MEDIA.head(cardKey(id));
    if (!meta?.public || !Array.isArray(meta?.markerKeys) || !meta.markerKeys.length || !card) {
      missing.push({ id, meta: Boolean(meta), card: Boolean(card), markers: meta?.markerKeys?.length || 0 });
      continue;
    }
    for (const key of meta.markerKeys) {
      const found = await env.PROFILE_MEDIA.head(key);
      if (!found) { missing.push({ id, marker: key }); break; }
    }
    const uid = text(row.owner_uid);
    if (uid && (text(row.owner_nickname) || text(row.owner_handle))) {
      const artistMeta = await env.PROFILE_MEDIA.head(artistMetaKey(uid));
      if (!artistMeta) missing.push({ id, artistMeta: uid });
    }
  }
  return missing;
}

export default {
  async fetch(request, env) {
    if (request.headers.get('x-soridraw-backfill') !== env.BACKFILL_SECRET) return new Response('Not Found', { status: 404 });
    const url = new URL(request.url);
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit') || 5)));
    if (url.pathname === '/stats') {
      const row = await env.DB.prepare("SELECT COUNT(*) AS total FROM tracks WHERE is_public=1 AND status='published'").first();
      return Response.json({ ok: true, total: Number(row?.total || 0) });
    }
    const cursor = text(url.searchParams.get('cursor'));
    const rows = await page(env, cursor, limit);
    if (url.pathname === '/backfill') {
      const results = [];
      for (const row of rows) results.push(await syncTrack(env.PROFILE_MEDIA, row));
      const nextCursor = rows.length === limit ? text(rows.at(-1)?.id) : '';
      return Response.json({ ok: true, processed: rows.length, nextCursor, results });
    }
    if (url.pathname === '/verify') {
      const missing = await verifyRows(env, rows);
      const nextCursor = rows.length === limit ? text(rows.at(-1)?.id) : '';
      return Response.json({ ok: missing.length === 0, checked: rows.length, nextCursor, missing });
    }
    return new Response('Not Found', { status: 404 });
  },
};
