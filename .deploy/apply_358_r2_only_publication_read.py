from pathlib import Path
import os
import re

worker_path = Path(os.environ.get(
    "SORIDRAW_WORKER_FILE",
    "cloudflare/explore-worker/canonical/preview-worker.js",
))
source = worker_path.read_text(encoding="utf-8")

MARKER = "SORIDRAW_PUBLICATION_R2_ONLY_READ_CUTOVER_358_20261005"
if MARKER in source:
    print("[358] R2-only publication read cutover already composed")
    raise SystemExit(0)

required = [
    "SORIDRAW_R2_HYBRID_READ_336_20261004",
    "isExploreR2HybridReadEnabled336",
    "collectHybridCatalog336",
    "mergeHybridItems336",
    "buildHybridNextCursor336",
    "hybridCursorState336",
    "catalogListPrefix066",
    "catalogBucket066",
    "readExploreSharedProfile060",
    "normalizeCatalogText066",
    "handleFeedWithEdgeCache",
    "handleProfileTracks",
    "handleGenreTracks",
]
for name in required:
    if name not in source:
        raise SystemExit(f"[358] required runtime missing: {name}")

runtime_path = Path("cloudflare/explore-worker/runtime/publication-r2-only-read-358.js")
runtime = runtime_path.read_text(encoding="utf-8")
runtime = re.sub(r"^export\s+", "", runtime, flags=re.M)
if MARKER not in runtime:
    raise SystemExit("[358] runtime marker missing")
if ".prepare(" in runtime or "env.DB" in runtime or "env?.DB" in runtime:
    raise SystemExit("[358] pure gate unexpectedly accesses D1")

def function_range(text: str, name: str):
    needles = [f"async function {name}(", f"function {name}("]
    start = -1
    for needle in needles:
        start = text.find(needle)
        if start >= 0:
            break
    if start < 0:
        raise SystemExit(f"[358] function missing: {name}")
    brace = text.find("{", start)
    if brace < 0:
        raise SystemExit(f"[358] function body missing: {name}")

    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    i = brace
    while i < len(text):
        c = text[i]
        n = text[i + 1] if i + 1 < len(text) else ""

        if line_comment:
            if c == "\n":
                line_comment = False
            i += 1
            continue
        if block_comment:
            if c == "*" and n == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escaped:
                escaped = False
                i += 1
                continue
            if c == "\\":
                escaped = True
                i += 1
                continue
            if c == quote:
                quote = None
            i += 1
            continue

        if c == "/" and n == "/":
            line_comment = True
            i += 2
            continue
        if c == "/" and n == "*":
            block_comment = True
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
                return start, i + 1, text[start:i + 1]
        i += 1
    raise SystemExit(f"[358] unterminated function: {name}")

def rename_function(text: str, name: str, core_name: str):
    start, end, body = function_range(text, name)
    replaced = re.sub(
        rf"^(async\s+)?function\s+{re.escape(name)}\(",
        lambda m: m.group(0).replace(f"{name}(", f"{core_name}("),
        body,
        count=1,
    )
    if replaced == body:
        raise SystemExit(f"[358] rename failed: {name}")
    return text[:start] + replaced + text[end:], start + len(replaced)

helpers = r"""
async function publicationR2OnlyCatalogPage358(env, prefix, kind, limit, rawCursor) {
  const state = rawCursor
    ? hybridCursorState336(decodeCursor(rawCursor), kind, prefix)
    : { boundary: null, r2Started: false, r2Done: false, r2Next: null, r2Carry: [] };
  if (rawCursor && !state) return { invalidCursor: true };

  const catalog = await collectHybridCatalog336(env, prefix, limit, state);
  const merged = mergeHybridItems336([], catalog.items, kind, limit);
  const nextCursor = buildHybridNextCursor336(
    kind,
    prefix,
    merged,
    limit,
    false,
    catalog
  );
  return { items: merged.items, nextCursor, invalidCursor: false };
}

function withPublicationR2OnlyHeader358(response, kind) {
  if (!(response instanceof Response)) return response;
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Publication-Read-Authority', 'R2-ONLY-358');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-R2-Only-Kind', String(kind || ''));
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '')
    .split(',').map((value) => value.trim()).filter(Boolean));
  for (const name of [
    'X-SORIDRAW-Publication-Read-Authority',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-R2-Only-Kind',
  ]) expose.add(name);
  headers.set('Access-Control-Expose-Headers', [...expose].join(', '));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handlePublicationR2OnlyFeed358(request, url, env, cors) {
  if (!catalogBucket066(env)) {
    return apiError('R2_CATALOG_UNAVAILABLE', '공개곡 카탈로그를 확인할 수 없습니다.', 503, cors);
  }
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const prefix = catalogListPrefix066(sort);
  const limit = getPageSize(url);
  const rawCursor = url.searchParams.get('cursor');
  const page = await publicationR2OnlyCatalogPage358(env, prefix, sort, limit, rawCursor);
  if (page.invalidCursor) {
    // Transitional compatibility only. Existing pre-cutover cursors are allowed to
    // finish through the frozen hybrid path; new first pages mint R2-only cursors.
    return await handleFeedWithEdgeCacheCore358(request, url, env, cors);
  }
  return withPublicationR2OnlyHeader358(
    json({ ok: true, data: { items: page.items, nextCursor: page.nextCursor, sort } }, 200, cors),
    'feed'
  );
}

async function handlePublicationR2OnlyProfile358(url, profileRef, env, cors) {
  if (!catalogBucket066(env)) {
    return apiError('R2_CATALOG_UNAVAILABLE', '공개 프로필 카탈로그를 확인할 수 없습니다.', 503, cors);
  }
  let bundle = null;
  try { bundle = await readExploreSharedProfile060(env, profileRef); } catch {}
  const uid = String(bundle?.uid || bundle?.body?.data?.profile?.uid || '').trim();
  if (!uid) return apiError('NOT_FOUND', '공개 프로필을 찾을 수 없습니다.', 404, cors);

  const prefix = catalogListPrefix066('profile', uid);
  const limit = getPageSize(url);
  const rawCursor = url.searchParams.get('cursor');
  const page = await publicationR2OnlyCatalogPage358(env, prefix, 'profile', limit, rawCursor);
  if (page.invalidCursor) {
    return await handleProfileTracksCore358(url, profileRef, env, cors);
  }
  return withPublicationR2OnlyHeader358(
    json({ ok: true, data: { items: page.items, nextCursor: page.nextCursor } }, 200, cors),
    'profile'
  );
}

async function handlePublicationR2OnlyGenre358(url, genreValue, env, cors) {
  if (!catalogBucket066(env)) {
    return apiError('R2_CATALOG_UNAVAILABLE', '장르 카탈로그를 확인할 수 없습니다.', 503, cors);
  }
  const genre = normalizeCatalogText066(genreValue).slice(0, 160);
  if (!genre) {
    return withPublicationR2OnlyHeader358(
      json({ ok: true, data: { genre: genreValue, items: [], nextCursor: null } }, 200, cors),
      'genre'
    );
  }
  const prefix = catalogListPrefix066('genre', genre);
  const limit = getPageSize(url);
  const rawCursor = url.searchParams.get('cursor');
  const page = await publicationR2OnlyCatalogPage358(env, prefix, 'genre', limit, rawCursor);
  if (page.invalidCursor) {
    return await handleGenreTracksCore358(url, genreValue, env, cors);
  }
  return withPublicationR2OnlyHeader358(
    json({ ok: true, data: { genre: genreValue, items: page.items, nextCursor: page.nextCursor } }, 200, cors),
    'genre'
  );
}
"""

# Freeze current app336/app341 behavior as the OFF path.
source, _ = rename_function(source, "handleFeedWithEdgeCache", "handleFeedWithEdgeCacheCore358")
source, _ = rename_function(source, "handleProfileTracks", "handleProfileTracksCore358")
source, _ = rename_function(source, "handleGenreTracks", "handleGenreTracksCore358")

feed_start, _, _ = function_range(source, "handleFeedWithEdgeCacheCore358")
source = source[:feed_start] + runtime + "\n\n" + helpers + "\n\n" + source[feed_start:]

feed_core_start, feed_core_end, _ = function_range(source, "handleFeedWithEdgeCacheCore358")
feed_wrapper = r"""
async function handleFeedWithEdgeCache(request, url, env, cors) {
  if (!isExplorePublicationR2OnlyReadEnabled358(env)) {
    return await handleFeedWithEdgeCacheCore358(request, url, env, cors);
  }
  return await handlePublicationR2OnlyFeed358(request, url, env, cors);
}
"""
source = source[:feed_core_end] + "\n\n" + feed_wrapper + source[feed_core_end:]

profile_core_start, profile_core_end, _ = function_range(source, "handleProfileTracksCore358")
profile_wrapper = r"""
async function handleProfileTracks(url, profileRef, env, cors) {
  if (!isExplorePublicationR2OnlyReadEnabled358(env)) {
    return await handleProfileTracksCore358(url, profileRef, env, cors);
  }
  return await handlePublicationR2OnlyProfile358(url, profileRef, env, cors);
}
"""
source = source[:profile_core_end] + "\n\n" + profile_wrapper + source[profile_core_end:]

genre_core_start, genre_core_end, _ = function_range(source, "handleGenreTracksCore358")
genre_wrapper = r"""
async function handleGenreTracks(url, genreValue, env, cors) {
  if (!isExplorePublicationR2OnlyReadEnabled358(env)) {
    return await handleGenreTracksCore358(url, genreValue, env, cors);
  }
  return await handlePublicationR2OnlyGenre358(url, genreValue, env, cors);
}
"""
source = source[:genre_core_end] + "\n\n" + genre_wrapper + source[genre_core_end:]

for name in [
    MARKER,
    "isExplorePublicationR2OnlyReadEnabled358",
    "publicationR2OnlyCatalogPage358",
    "handlePublicationR2OnlyFeed358",
    "handlePublicationR2OnlyProfile358",
    "handlePublicationR2OnlyGenre358",
    "handleFeedWithEdgeCacheCore358",
    "handleProfileTracksCore358",
    "handleGenreTracksCore358",
    "R2-ONLY-358",
]:
    if name not in source:
        raise SystemExit(f"[358] generated Worker missing: {name}")

worker_path.write_text(source, encoding="utf-8")
print("[358] dormant R2-only publication read cutover composed; flag remains OFF")
