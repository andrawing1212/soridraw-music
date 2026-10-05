from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
worker_path = ROOT / "cloudflare" / "explore-worker" / "canonical" / "preview-worker.js"
runtime_path = ROOT / "cloudflare" / "explore-worker" / "runtime" / "r2-catalog-v1.js"

MARKER = "SORIDRAW_SEARCH_R2_FIRST_337_20261004"
source = worker_path.read_text(encoding="utf-8")
runtime = runtime_path.read_text(encoding="utf-8")

if MARKER in source:
    print("[337] search R2-first patch already applied")
    raise SystemExit(0)

def function_range(text: str, name: str):
    needles = [
        f"export async function {name}(",
        f"async function {name}(",
        f"export function {name}(",
        f"function {name}(",
    ]
    start = -1
    for needle in needles:
        start = text.find(needle)
        if start >= 0:
            break
    if start < 0:
        raise SystemExit(f"[337] function missing: {name}")
    brace = text.find("{", start)
    depth = 0
    quote = ""
    escaped = False
    comment = ""
    i = brace
    while i < len(text):
        c = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if comment == "line":
            if c == "\n":
                comment = ""
            i += 1
            continue
        if comment == "block":
            if c == "*" and nxt == "/":
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
        if c == "/" and nxt == "/":
            comment = "line"
            i += 2
            continue
        if c == "/" and nxt == "*":
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
                return start, i + 1, text[start:i + 1]
        i += 1
    raise SystemExit(f"[337] unterminated function: {name}")

def replace_function(text: str, name: str, replacement: str):
    start, end, _ = function_range(text, name)
    return text[:start] + replacement + text[end:]

_, _, runtime_search = function_range(runtime, "handleCatalogSearch066")
runtime_search = re.sub(r"^export\s+", "", runtime_search)
if "SORIDRAW_R2_SEARCH_GENRE_ALIASES_337_20261004" not in runtime_search:
    raise SystemExit("[337] updated R2 catalog search source missing alias marker")
source = replace_function(source, "handleCatalogSearch066", runtime_search)

search337 = r'''// SORIDRAW_SEARCH_R2_FIRST_337_20261004
async function handleSearch(url, env, cors) {
  if (!isExploreR2HybridReadEnabled336(env)) {
    return await handleSearchCore336(url, env, cors);
  }
  if (url.searchParams.get('cursor')) {
    return await handleSearchCore066(url, env, cors);
  }

  let catalogData = null;
  try {
    const catalogResponse = await handleCatalogSearch066(url, env, cors);
    catalogData = catalogResponse
      ? await parseHybridResponseData336(catalogResponse)
      : null;
  } catch (error) {
    console.warn(
      '[SORIDRAW 337] catalog search first-pass deferred:',
      String(error?.message || error || 'unknown')
    );
  }

  const catalogItems = Array.isArray(catalogData?.items)
    ? catalogData.items
    : (Array.isArray(catalogData?.tracks?.items) ? catalogData.tracks.items : []);
  const catalogCreators = Array.isArray(catalogData?.creators) ? catalogData.creators : [];
  if (catalogData && (catalogItems.length > 0 || catalogCreators.length > 0)) {
    return withHybridReadHeaders336(
      json({ ok: true, data: catalogData }, 200, cors),
      'R2-FIRST-SEARCH-337'
    );
  }

  const genreAliases = [...new Set(
    url.searchParams.getAll('genre')
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )].slice(0, 6);
  if (genreAliases.length > 0) {
    const limit = getPageSize(url);
    const items = [];
    const seen = new Set();
    for (const genreAlias of genreAliases) {
      const genreUrl = new URL(url.toString());
      genreUrl.searchParams.delete('cursor');
      genreUrl.searchParams.set('limit', String(limit));
      const response = await handleGenreTracksCore066(genreUrl, genreAlias, env, cors);
      const data = await parseHybridResponseData336(response);
      for (const item of Array.isArray(data?.items) ? data.items : []) {
        const id = hybridTrackId336(item);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        items.push(item);
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
    }
    if (items.length > 0) {
      const q = String(url.searchParams.get('q') || '').trim();
      const data = {
        query: q,
        items,
        tracks: { items, nextCursor: null },
        creators: [],
        nextCursor: null,
      };
      return withHybridReadHeaders336(
        json({ ok: true, data }, 200, cors),
        'INDEXED-GENRE-FALLBACK-337'
      );
    }
  }

  const legacyResponse = await handleSearchCore066(url, env, cors);
  return withHybridReadHeaders336(
    legacyResponse,
    'LEGACY-SEARCH-FALLBACK-337'
  );
}'''
source = replace_function(source, "handleSearch", search337)

required = [
    MARKER,
    "SORIDRAW_R2_SEARCH_GENRE_ALIASES_337_20261004",
    "R2-FIRST-SEARCH-337",
    "INDEXED-GENRE-FALLBACK-337",
    "LEGACY-SEARCH-FALLBACK-337",
    "url.searchParams.getAll('genre')",
]
for token in required:
    if token not in source:
        raise SystemExit(f"[337] generated worker missing: {token}")

_, _, live_search = function_range(source, "handleSearch")
catalog_pos = live_search.find("handleCatalogSearch066")
legacy_pos = live_search.find("const legacyResponse = await handleSearchCore066")
if catalog_pos < 0 or legacy_pos < 0 or catalog_pos > legacy_pos:
    raise SystemExit("[337] first-page search is not R2-first")

worker_path.write_text(source, encoding="utf-8")
print("[337] R2-first search + Korean genre alias/indexed fallback applied")
