from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
worker_path = ROOT / "cloudflare" / "explore-worker" / "canonical" / "preview-worker.js"
source = worker_path.read_text(encoding="utf-8")

MARKER = "SORIDRAW_KOREAN_GENRE_INDEXED_FALLBACK_338_20261004"
if MARKER in source:
    print("[338] indexed Korean genre fallback already applied")
    raise SystemExit(0)

needle = "async function handleSearch(url, env, cors) {"
start = source.find(needle)
if start < 0:
    raise SystemExit("[338] handleSearch missing")
brace = source.find("{", start)
depth = 0
quote = ""
escaped = False
comment = ""
end = -1
i = brace
while i < len(source):
    c = source[i]
    n = source[i + 1] if i + 1 < len(source) else ""
    if comment == "line":
        if c == "\n":
            comment = ""
        i += 1
        continue
    if comment == "block":
        if c == "*" and n == "/":
            comment = ""
            i += 2
            continue
        i += 1
        continue
    if quote:
        if escaped:
            escaped = False
        elif c == "\\":
            escaped = True
        elif c == quote:
            quote = ""
        i += 1
        continue
    if c == "/" and n == "/":
        comment = "line"
        i += 2
        continue
    if c == "/" and n == "*":
        comment = "block"
        i += 2
        continue
    if c in ("'", '"', "`"):
        quote = c
        i += 1
        continue
    if c == "{":
        depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0:
            end = i + 1
            break
    i += 1
if end < 0:
    raise SystemExit("[338] handleSearch unterminated")

old = source[start:end]
if "SORIDRAW_SEARCH_R2_FIRST_337_20261004" not in old:
    raise SystemExit("[338] app337 search prerequisite missing")
if "handleGenreTracksCore066(genreUrl, genreAlias, env, cors)" not in old:
    raise SystemExit("[338] app337 scan-prone genre fallback anchor missing")

helper = r'''// SORIDRAW_KOREAN_GENRE_INDEXED_FALLBACK_338_20261004
async function handleIndexedGenreAlias338(url, genreAlias, env, cors) {
  const genre = String(genreAlias || '').trim().slice(0, 160);
  if (!genre) return json({ ok: true, data: { genre, items: [], nextCursor: null } }, 200, cors);
  const limit = Math.min(40, Math.max(1, getPageSize(url)));

  const [primary, legacyTags] = await env.DB.batch([
    env.DB.prepare(`
      SELECT
        t.*,
        p.nickname AS owner_nickname,
        p.avatar_url AS owner_avatar_url,
        COALESCE(s.like_count,0) AS like_count,
        COALESCE(s.comment_count,0) AS comment_count,
        COALESCE(s.play_count,0) AS play_count
      FROM tracks t INDEXED BY idx_tracks_primary_genre_latest
      LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
      LEFT JOIN track_stats s ON s.track_id = t.id
      WHERE t.primary_genre = ?
        AND t.is_public = 1
        AND t.status = 'published'
      ORDER BY t.published_at DESC, t.id DESC
      LIMIT ?
    `).bind(genre, limit + 1),
    env.DB.prepare(`
      SELECT
        t.*,
        p.nickname AS owner_nickname,
        p.avatar_url AS owner_avatar_url,
        COALESCE(s.like_count,0) AS like_count,
        COALESCE(s.comment_count,0) AS comment_count,
        COALESCE(s.play_count,0) AS play_count
      FROM track_tags tt INDEXED BY idx_track_tags_kind_value_track
      JOIN tracks t ON t.id = tt.track_id
      LEFT JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
      LEFT JOIN track_stats s ON s.track_id = t.id
      WHERE tt.kind = 'genre'
        AND tt.value = ?
        AND (t.primary_genre IS NULL OR TRIM(t.primary_genre) = '')
        AND t.is_public = 1
        AND t.status = 'published'
      ORDER BY t.published_at DESC, t.id DESC
      LIMIT ?
    `).bind(genre, limit + 1),
  ]);

  const byId = new Map();
  for (const row of [...(primary?.results || []), ...(legacyTags?.results || [])]) {
    const id = String(row?.id || '').trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, mapTrackRow(row));
  }
  const items = [...byId.values()]
    .sort((a, b) => Number(b?.publishedAt || 0) - Number(a?.publishedAt || 0)
      || String(b?.id || '').localeCompare(String(a?.id || '')))
    .slice(0, limit);
  return json({ ok: true, data: { genre, items, nextCursor: null } }, 200, cors);
}

'''

new = old.replace(
    "      const response = await handleGenreTracksCore066(genreUrl, genreAlias, env, cors);",
    "      const response = await handleIndexedGenreAlias338(genreUrl, genreAlias, env, cors);",
)
if new == old:
    raise SystemExit("[338] genre fallback replacement failed")

source = source[:start] + helper + new + source[end:]

for token in [
    MARKER,
    "INDEXED BY idx_tracks_primary_genre_latest",
    "INDEXED BY idx_track_tags_kind_value_track",
    "handleIndexedGenreAlias338(genreUrl, genreAlias, env, cors)",
]:
    if token not in source:
        raise SystemExit(f"[338] missing token: {token}")

search_start = source.find("async function handleSearch(url, env, cors)")
search_sample = source[search_start:search_start + 9000]
if "handleGenreTracksCore066(genreUrl, genreAlias, env, cors)" in search_sample:
    raise SystemExit("[338] scan-prone old genre fallback still active")

worker_path.write_text(source, encoding="utf-8")
print("[338] Korean genre fallback now uses live indexed primary_genre + track_tags paths")
