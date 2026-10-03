from pathlib import Path
import re

remote_dir = Path(__import__("os").environ["SORIDRAW_REMOTE_WORKER_DIR"])
worker_path = remote_dir / "worker.js"
source = worker_path.read_text(encoding="utf-8")

MARKER = "SORIDRAW_R2_HYBRID_READ_336_20261004"
if MARKER in source:
    print("[336] hybrid read already applied")
    raise SystemExit(0)

required = [
    "SORIDRAW_R2_ORDERED_CATALOG_PHASE_A_066_20260919",
    "handleFeedWithEdgeCacheCore066",
    "handleProfileTracksCore066",
    "handleGenreTracksCore066",
    "handleSearchCore066",
    "handleFeedWithEdgeCache",
    "handleProfileTracks",
    "handleGenreTracks",
    "handleSearch",
    "catalogListPrefix066",
    "listCatalogObjects066",
    "hydrateCatalogObjects066",
    "readCatalogJson066",
    "catalogMetaKey066",
    "readSharedTrackCard062",
    "readExploreSharedProfile060",
    "encodeCursor",
    "decodeCursor",
    "getPageSize",
    "json",
]
for name in required:
    if name not in source:
        raise SystemExit(f"[336] required runtime missing: {name}")

runtime_path = Path(__file__).resolve().parents[1] / "cloudflare" / "explore-worker" / "runtime" / "r2-hybrid-read-336.js"
runtime = runtime_path.read_text(encoding="utf-8")
runtime = re.sub(r"^export\s+", "", runtime, flags=re.M)
if MARKER not in runtime:
    raise SystemExit("[336] runtime marker missing")
if ".prepare(" in runtime or "env.DB" in runtime or "env?.DB" in runtime:
    raise SystemExit("[336] pure helper unexpectedly accesses D1")

helpers = r'''
async function parseHybridResponseData336(response) {
  if (!(response instanceof Response) || !response.ok) return null;
  try {
    const payload = await response.clone().json();
    return payload?.data && typeof payload.data === 'object' ? payload.data : null;
  } catch {
    return null;
  }
}

function withHybridReadHeaders336(response, sourceName) {
  if (!(response instanceof Response)) return response;
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Hybrid-Read', sourceName || 'R2-LEGACY-336');
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '')
    .split(',').map((value) => value.trim()).filter(Boolean));
  expose.add('X-SORIDRAW-Hybrid-Read');
  headers.set('Access-Control-Expose-Headers', [...expose].join(', '));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function hybridLegacyCursor336(kind, boundary) {
  if (!boundary || typeof boundary !== 'object') return null;
  if (kind === 'popular') {
    const likeCount = Number(boundary.likeCount);
    const publishedAt = Number(boundary.publishedAt);
    const id = String(boundary.id || '').trim();
    if (Number.isFinite(likeCount) && Number.isFinite(publishedAt) && id) {
      return encodeCursor({ likeCount, publishedAt, id });
    }
    return null;
  }
  if (kind === 'profile') {
    const profilePinned = Number(boundary.profilePinned);
    const publishedAt = Number(boundary.publishedAt);
    const id = String(boundary.id || '').trim();
    if ((profilePinned === 0 || profilePinned === 1) && Number.isFinite(publishedAt) && id) {
      return encodeCursor({ profilePinned, publishedAt, id });
    }
    return null;
  }
  const publishedAt = Number(boundary.publishedAt);
  const id = String(boundary.id || '').trim();
  if (Number.isFinite(publishedAt) && id) return encodeCursor({ publishedAt, id });
  return null;
}

async function filterLegacyCatalogOwned336(env, items, relevantPrefix) {
  const list = Array.isArray(items) ? items : [];
  const resolved = await Promise.all(list.map(async (item) => {
    const id = hybridTrackId336(item);
    if (!id) return null;
    let meta = null;
    try {
      meta = await readCatalogJson066(env, catalogMetaKey066(id));
    } catch {}
    if (!meta || typeof meta !== 'object') return item;
    if (meta.public === false) return null;
    const markerKeys = Array.isArray(meta.markerKeys) ? meta.markerKeys : [];
    if (markerKeys.some((key) => String(key || '').startsWith(relevantPrefix))) return null;
    return item;
  }));
  return resolved.filter(Boolean);
}

async function hydrateHybridTrackIds336(env, ids) {
  const unique = [...new Set((ids || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))].slice(0, 100);
  const rows = await Promise.all(unique.map(async (trackId) => {
    try {
      return await readSharedTrackCard062(env, trackId);
    } catch {
      return null;
    }
  }));
  return rows.filter(Boolean);
}

async function collectHybridCatalog336(env, prefix, limit, state) {
  let items = await hydrateHybridTrackIds336(env, state?.r2Carry || []);
  let r2Started = Boolean(state?.r2Started);
  let r2Done = Boolean(state?.r2Done);
  let r2Next = state?.r2Next && typeof state.r2Next === 'object'
    ? state.r2Next
    : null;
  const seen = new Set(items.map((item) => hybridTrackId336(item)).filter(Boolean));

  for (let pageIndex = 0; pageIndex < 4 && items.length < limit && !r2Done; pageIndex += 1) {
    const page = await listCatalogObjects066(
      env,
      prefix,
      limit,
      r2Started ? r2Next : null
    );
    r2Started = true;
    if (!page) {
      r2Done = true;
      r2Next = null;
      break;
    }
    const hydrated = await hydrateCatalogObjects066(env, page.objects || []);
    for (const item of hydrated) {
      const id = hybridTrackId336(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
    r2Next = page.nextState || null;
    r2Done = !page.nextState;
    if (!(page.objects || []).length) break;
  }

  return { items, r2Started, r2Done, r2Next };
}

async function collectHybridLegacyKind336(env, baseUrl, limit, boundary, prefix, kind, fetchPage) {
  const url = new URL(baseUrl.toString());
  url.searchParams.set('limit', String(limit));
  const firstCursor = hybridLegacyCursor336(kind, boundary);
  if (firstCursor) url.searchParams.set('cursor', firstCursor);
  else url.searchParams.delete('cursor');

  const collected = [];
  const seen = new Set();
  let hasMore = false;
  let failedResponse = null;

  for (let pageIndex = 0; pageIndex < 4 && collected.length < limit; pageIndex += 1) {
    const response = await fetchPage(url);
    if (!(response instanceof Response) || !response.ok) {
      failedResponse = response;
      break;
    }
    const data = await parseHybridResponseData336(response);
    if (!data) {
      failedResponse = response;
      break;
    }
    const rawItems = Array.isArray(data.items)
      ? data.items
      : (Array.isArray(data.tracks?.items) ? data.tracks.items : []);
    const filtered = await filterLegacyCatalogOwned336(env, rawItems, prefix);
    for (const item of filtered) {
      const id = hybridTrackId336(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      collected.push(item);
    }
    const nextCursor = String(data.nextCursor || data.tracks?.nextCursor || '').trim();
    hasMore = Boolean(nextCursor);
    if (!nextCursor) break;
    url.searchParams.set('cursor', nextCursor);
  }
  return { items: collected, hasMore, failedResponse };
}

function buildHybridNextCursor336(kind, key, merged, limit, legacyHasMore, catalogState) {
  const visible = merged.items || [];
  const ordered = merged.ordered || visible;
  const last = visible.at(-1);
  if (!last) return null;

  const visibleIds = new Set(visible
    .map((item) => hybridTrackId336(item))
    .filter(Boolean));
  const catalogItems = Array.isArray(catalogState?.items)
    ? catalogState.items
    : [];
  const r2Carry = catalogItems
    .filter((item) => !visibleIds.has(hybridTrackId336(item)))
    .map((item) => hybridTrackId336(item))
    .filter(Boolean);

  const hasMore = ordered.length > limit
    || Boolean(legacyHasMore)
    || r2Carry.length > 0
    || !Boolean(catalogState?.r2Done);
  if (!hasMore) return null;

  return encodeCursor(hybridCursorPayload336(kind, key, {
    boundary: hybridBoundary336(kind, last),
    r2Started: Boolean(catalogState?.r2Started),
    r2Done: Boolean(catalogState?.r2Done),
    r2Next: catalogState?.r2Next || null,
    r2Carry,
  }));
}
'''

old_feed = r'''async function handleFeedWithEdgeCache(request, url, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await handleFeedWithEdgeCacheCore066(request, url, env, cors);
  const cursorValue = url.searchParams.get('cursor');
  if (cursorValue) {
    try {
      const catalog = await handleCatalogFeed066(url, env, cors);
      if (catalog) return catalog;
    } catch (error) {
      console.warn('[SORIDRAW 066] catalog feed fallback:', String(error?.message || error || 'unknown'));
    }
    const decoded = decodeCursor(cursorValue);
    if (decoded?.legacy) {
      const fallbackUrl = new URL(url.toString());
      fallbackUrl.searchParams.set('cursor', String(decoded.legacy));
      return await handleFeedWithEdgeCacheCore066(request, fallbackUrl, env, cors);
    }
    return await handleFeedWithEdgeCacheCore066(request, url, env, cors);
  }
  const response = await handleFeedWithEdgeCacheCore066(request, url, env, cors);
  try { return await rewriteFirstFeedCursor066(response, url, env); }
  catch { return response; }
}'''

new_feed = old_feed.replace(
    "async function handleFeedWithEdgeCache(",
    "async function handleFeedWithEdgeCacheCore336(",
    1
) + r'''

async function handleFeedWithEdgeCache(request, url, env, cors) {
  if (!isExploreR2HybridReadEnabled336(env)) {
    return await handleFeedWithEdgeCacheCore336(request, url, env, cors);
  }
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const kind = sort;
  const prefix = catalogListPrefix066(sort);
  const limit = getPageSize(url);
  const rawCursor = url.searchParams.get('cursor');
  const state = rawCursor
    ? hybridCursorState336(decodeCursor(rawCursor), kind, prefix)
    : { boundary: null, r2Started: false, r2Done: false, r2Next: null, r2Carry: [] };
  if (rawCursor && !state) {
    return await handleFeedWithEdgeCacheCore336(request, url, env, cors);
  }

  const legacy = await collectHybridLegacyKind336(
    env,
    url,
    limit,
    state?.boundary,
    prefix,
    kind,
    async (pageUrl) => await handleFeedWithEdgeCacheCore066(request, pageUrl, env, cors)
  );
  if (legacy.failedResponse) return legacy.failedResponse;

  const catalog = await collectHybridCatalog336(env, prefix, limit, state);
  const merged = mergeHybridItems336(legacy.items, catalog.items, kind, limit);
  const nextCursor = buildHybridNextCursor336(
    kind,
    prefix,
    merged,
    limit,
    legacy.hasMore,
    catalog
  );
  return withHybridReadHeaders336(
    json({ ok: true, data: { items: merged.items, nextCursor, sort } }, 200, cors),
    'R2-LEGACY-FEED-336'
  );
}'''

old_profile = r'''async function handleProfileTracks(url, profileRef, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await handleProfileTracksCore066(url, profileRef, env, cors);
  const cursorValue = url.searchParams.get('cursor');
  if (cursorValue) {
    try {
      const catalog = await handleCatalogProfileTracks066(url, profileRef, env, cors);
      if (catalog) return catalog;
    } catch (error) {
      console.warn('[SORIDRAW 066] catalog profile fallback:', String(error?.message || error || 'unknown'));
    }
    const decoded = decodeCursor(cursorValue);
    if (decoded?.legacy) {
      const fallbackUrl = new URL(url.toString());
      fallbackUrl.searchParams.set('cursor', String(decoded.legacy));
      return await handleProfileTracksCore066(fallbackUrl, profileRef, env, cors);
    }
  }
  return await handleProfileTracksCore066(url, profileRef, env, cors);
}'''

new_profile = old_profile.replace(
    "async function handleProfileTracks(",
    "async function handleProfileTracksCore336(",
    1
) + r'''

async function handleProfileTracks(url, profileRef, env, cors) {
  if (!isExploreR2HybridReadEnabled336(env)) {
    return await handleProfileTracksCore336(url, profileRef, env, cors);
  }
  let bundle = null;
  try {
    bundle = await readExploreSharedProfile060(env, profileRef);
  } catch {}
  const uid = String(bundle?.uid || bundle?.body?.data?.profile?.uid || '').trim();
  if (!uid) return await handleProfileTracksCore336(url, profileRef, env, cors);

  const prefix = catalogListPrefix066('profile', uid);
  const kind = 'profile';
  const limit = getPageSize(url);
  const rawCursor = url.searchParams.get('cursor');
  const state = rawCursor
    ? hybridCursorState336(decodeCursor(rawCursor), kind, prefix)
    : { boundary: null, r2Started: false, r2Done: false, r2Next: null, r2Carry: [] };
  if (rawCursor && !state) {
    return await handleProfileTracksCore336(url, profileRef, env, cors);
  }

  const legacy = await collectHybridLegacyKind336(
    env,
    url,
    limit,
    state?.boundary,
    prefix,
    kind,
    async (pageUrl) => await handleProfileTracksCore066(pageUrl, profileRef, env, cors)
  );
  if (legacy.failedResponse) return legacy.failedResponse;

  const catalog = await collectHybridCatalog336(env, prefix, limit, state);
  const merged = mergeHybridItems336(legacy.items, catalog.items, kind, limit);
  const nextCursor = buildHybridNextCursor336(
    kind,
    prefix,
    merged,
    limit,
    legacy.hasMore,
    catalog
  );
  return withHybridReadHeaders336(
    json({ ok: true, data: { items: merged.items, nextCursor } }, 200, cors),
    'R2-LEGACY-PROFILE-336'
  );
}'''

old_genre = r'''async function handleGenreTracks(url, genreValue, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await handleGenreTracksCore066(url, genreValue, env, cors);
  try {
    const catalog = await handleCatalogGenre066(url, genreValue, env, cors);
    if (catalog) return catalog;
  } catch (error) {
    console.warn('[SORIDRAW 066] catalog genre fallback:', String(error?.message || error || 'unknown'));
  }
  return await handleGenreTracksCore066(url, genreValue, env, cors);
}'''

new_genre = old_genre.replace(
    "async function handleGenreTracks(",
    "async function handleGenreTracksCore336(",
    1
) + r'''

async function handleGenreTracks(url, genreValue, env, cors) {
  if (!isExploreR2HybridReadEnabled336(env)) {
    return await handleGenreTracksCore336(url, genreValue, env, cors);
  }
  const genre = normalizeCatalogText066(genreValue).slice(0, 160);
  if (!genre) return await handleGenreTracksCore336(url, genreValue, env, cors);

  const prefix = catalogListPrefix066('genre', genre);
  const kind = 'genre';
  const limit = getPageSize(url);
  const rawCursor = url.searchParams.get('cursor');
  const state = rawCursor
    ? hybridCursorState336(decodeCursor(rawCursor), kind, prefix)
    : { boundary: null, r2Started: false, r2Done: false, r2Next: null, r2Carry: [] };
  if (rawCursor && !state) {
    return await handleGenreTracksCore336(url, genreValue, env, cors);
  }

  const legacy = await collectHybridLegacyKind336(
    env,
    url,
    limit,
    state?.boundary,
    prefix,
    kind,
    async (pageUrl) => await handleGenreTracksCore066(pageUrl, genreValue, env, cors)
  );
  if (legacy.failedResponse) return legacy.failedResponse;

  const catalog = await collectHybridCatalog336(env, prefix, limit, state);
  const merged = mergeHybridItems336(legacy.items, catalog.items, kind, limit);
  const nextCursor = buildHybridNextCursor336(
    kind,
    prefix,
    merged,
    limit,
    legacy.hasMore,
    catalog
  );
  return withHybridReadHeaders336(
    json({ ok: true, data: { genre: genreValue, items: merged.items, nextCursor } }, 200, cors),
    'R2-LEGACY-GENRE-336'
  );
}'''

old_search = r'''async function handleSearch(url, env, cors) {
  if (!isExploreR2CatalogReadEnabled066(env)) return await handleSearchCore066(url, env, cors);
  try {
    const catalog = await handleCatalogSearch066(url, env, cors);
    if (catalog) return catalog;
  } catch (error) {
    console.warn('[SORIDRAW 066] catalog search fallback:', String(error?.message || error || 'unknown'));
  }
  return await handleSearchCore066(url, env, cors);
}'''

new_search = old_search.replace(
    "async function handleSearch(",
    "async function handleSearchCore336(",
    1
) + r'''

async function handleSearch(url, env, cors) {
  if (!isExploreR2HybridReadEnabled336(env)) {
    return await handleSearchCore336(url, env, cors);
  }
  if (url.searchParams.get('cursor')) {
    return await handleSearchCore066(url, env, cors);
  }

  const legacyResponse = await handleSearchCore066(url, env, cors);
  if (!(legacyResponse instanceof Response) || !legacyResponse.ok) return legacyResponse;
  const legacyData = await parseHybridResponseData336(legacyResponse);
  if (!legacyData) return legacyResponse;

  let catalogData = null;
  try {
    const catalogResponse = await handleCatalogSearch066(url, env, cors);
    catalogData = catalogResponse
      ? await parseHybridResponseData336(catalogResponse)
      : null;
  } catch (error) {
    console.warn(
      '[SORIDRAW 336] catalog search merge deferred:',
      String(error?.message || error || 'unknown')
    );
  }
  if (!catalogData) return legacyResponse;

  const q = String(url.searchParams.get('q') || '').trim();
  const merged = mergeHybridSearch336(legacyData, catalogData, q, getPageSize(url));
  return withHybridReadHeaders336(
    json({ ok: true, data: merged }, 200, cors),
    'R2-LEGACY-SEARCH-336'
  );
}'''

def replace_once(haystack: str, old: str, new: str, label: str) -> str:
    count = haystack.count(old)
    if count != 1:
        raise SystemExit(f"[336] {label} anchor count={count}")
    return haystack.replace(old, new, 1)

insert_anchor = old_feed
if source.count(insert_anchor) != 1:
    raise SystemExit(f"[336] helper insert feed anchor count={source.count(insert_anchor)}")
source = source.replace(insert_anchor, runtime + "\n\n" + helpers + "\n\n" + insert_anchor, 1)

source = replace_once(source, old_feed, new_feed, "feed wrapper")
source = replace_once(source, old_profile, new_profile, "profile wrapper")
source = replace_once(source, old_genre, new_genre, "genre wrapper")
source = replace_once(source, old_search, new_search, "search wrapper")

final_required = [
    MARKER,
    "isExploreR2HybridReadEnabled336",
    "filterLegacyCatalogOwned336",
    "collectHybridCatalog336",
    "buildHybridNextCursor336",
    "handleFeedWithEdgeCacheCore336",
    "handleProfileTracksCore336",
    "handleGenreTracksCore336",
    "handleSearchCore336",
    "R2-LEGACY-FEED-336",
    "R2-LEGACY-PROFILE-336",
    "R2-LEGACY-GENRE-336",
    "R2-LEGACY-SEARCH-336",
]
for name in final_required:
    if name not in source:
        raise SystemExit(f"[336] generated worker missing: {name}")

worker_path.write_text(source, encoding="utf-8")
print("[336] hybrid R2 + legacy read compatibility layer applied; dormant until preview flag is enabled")
