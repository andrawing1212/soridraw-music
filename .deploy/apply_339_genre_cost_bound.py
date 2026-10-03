from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
worker_path = ROOT / "cloudflare" / "explore-worker" / "canonical" / "preview-worker.js"
source = worker_path.read_text(encoding="utf-8")

MARKER = "SORIDRAW_KOREAN_GENRE_ALIAS_BOUND_CACHE_339_20261004"
if MARKER in source:
    print("[339] Korean genre alias bound/cache already applied")
    raise SystemExit(0)

def function_range(text: str, name: str):
    needle = f"async function {name}("
    start = text.find(needle)
    if start < 0:
        raise SystemExit(f"[339] function missing: {name}")
    brace = text.find("{", start)
    depth = 0
    quote = ""
    escaped = False
    comment = ""
    i = brace
    while i < len(text):
        c = text[i]
        n = text[i + 1] if i + 1 < len(text) else ""
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
                return start, i + 1, text[start:i + 1]
        i += 1
    raise SystemExit(f"[339] unterminated function: {name}")

start, end, old = function_range(source, "handleSearch")
if "SORIDRAW_SEARCH_R2_FIRST_337_20261004" not in source:
    raise SystemExit("[339] app337 R2-first prerequisite missing")
if "SORIDRAW_KOREAN_GENRE_INDEXED_FALLBACK_338_20261004" not in source:
    raise SystemExit("[339] app338 indexed genre prerequisite missing")
if "const genreAliases = [...new Set(" not in old:
    raise SystemExit("[339] genre alias anchor missing")
if "handleIndexedGenreAlias338(genreUrl, genreAlias, env, cors)" not in old:
    raise SystemExit("[339] app338 helper call missing")

helpers = r'''// SORIDRAW_KOREAN_GENRE_ALIAS_BOUND_CACHE_339_20261004
function narrowKoreanGenreAliases339(query, aliases) {
  const q = String(query || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const list = [...new Set((aliases || []).map((value) => String(value || '').trim()).filter(Boolean))];
  const exact = new Map([
    ['힙합', 'Hip-hop'],
    ['재즈', 'Jazz'],
    ['트로트', 'Trot'],
    ['록', 'Rock'],
    ['락', 'Rock'],
    ['메탈', 'Metal'],
    ['하우스', 'House'],
    ['테크노', 'Techno'],
    ['트랜스', 'Trance'],
    ['클래식', 'Classical'],
    ['팝', 'Pop'],
  ]);
  const exactAlias = exact.get(q);
  if (exactAlias) {
    const found = list.find((value) => value.toLowerCase() === exactAlias.toLowerCase());
    return [found || exactAlias];
  }
  // Family searches such as 발라드/시티팝 may legitimately need multiple
  // English genre labels, but never fan one user search out beyond three aliases.
  return list.slice(0, 3);
}

function genreSearchCacheKey339(url, aliases) {
  const q = String(url.searchParams.get('q') || '').normalize('NFKC').toLowerCase().trim();
  const canonical = [...new Set((aliases || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean))]
    .sort()
    .join('|');
  return new Request(
    'https://preview.soridraw.com/__soridraw_edge/genre-search-339'
      + '?q=' + encodeURIComponent(q)
      + '&g=' + encodeURIComponent(canonical),
    { method: 'GET' }
  );
}

async function readGenreSearchCache339(url, aliases) {
  try {
    if (typeof caches === 'undefined' || !caches?.default) return null;
    const hit = await caches.default.match(genreSearchCacheKey339(url, aliases));
    if (!(hit instanceof Response)) return null;
    const headers = new Headers(hit.headers);
    headers.set('X-SORIDRAW-Genre-Cache', 'HIT-339');
    headers.set('Cache-Control', 'no-store');
    return new Response(hit.body, {
      status: hit.status,
      statusText: hit.statusText,
      headers,
    });
  } catch {
    return null;
  }
}

async function writeGenreSearchCache339(url, aliases, response) {
  try {
    if (typeof caches === 'undefined' || !caches?.default || !(response instanceof Response) || !response.ok) return;
    const clone = response.clone();
    const headers = new Headers(clone.headers);
    headers.set('Cache-Control', 'public, max-age=90');
    headers.set('X-SORIDRAW-Genre-Cache', 'STORED-339');
    await caches.default.put(
      genreSearchCacheKey339(url, aliases),
      new Response(clone.body, {
        status: clone.status,
        statusText: clone.statusText,
        headers,
      })
    );
  } catch {}
}

'''

new = old.replace(
"""  const genreAliases = [...new Set(
    url.searchParams.getAll('genre')
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )].slice(0, 6);""",
"""  const genreAliases = narrowKoreanGenreAliases339(
    url.searchParams.get('q'),
    url.searchParams.getAll('genre')
  );"""
)
if new == old:
    raise SystemExit("[339] alias fanout replacement failed")

old_branch = """  if (genreAliases.length > 0) {
    const limit = getPageSize(url);
    const items = [];
    const seen = new Set();"""
new_branch = """  if (genreAliases.length > 0) {
    const cachedGenreSearch339 = await readGenreSearchCache339(url, genreAliases);
    if (cachedGenreSearch339) return cachedGenreSearch339;

    const limit = getPageSize(url);
    const items = [];
    const seen = new Set();"""
if old_branch not in new:
    raise SystemExit("[339] genre branch anchor missing")
new = new.replace(old_branch, new_branch, 1)

old_return = """      return withHybridReadHeaders336(
        json({ ok: true, data }, 200, cors),
        'INDEXED-GENRE-FALLBACK-337'
      );"""
new_return = """      const response339 = withHybridReadHeaders336(
        json({ ok: true, data }, 200, cors),
        'INDEXED-GENRE-FALLBACK-337'
      );
      await writeGenreSearchCache339(url, genreAliases, response339);
      const headers339 = new Headers(response339.headers);
      headers339.set('X-SORIDRAW-Genre-Cache', 'MISS-339');
      return new Response(response339.body, {
        status: response339.status,
        statusText: response339.statusText,
        headers: headers339,
      });"""
if old_return not in new:
    raise SystemExit("[339] indexed genre return anchor missing")
new = new.replace(old_return, new_return, 1)

source = source[:start] + helpers + new + source[end:]

for token in [
    MARKER,
    "narrowKoreanGenreAliases339",
    "list.slice(0, 3)",
    "['힙합', 'Hip-hop']",
    "readGenreSearchCache339",
    "writeGenreSearchCache339",
    "HIT-339",
    "MISS-339",
]:
    if token not in source:
        raise SystemExit(f"[339] missing token: {token}")

search_start = source.find("async function handleSearch(url, env, cors)")
sample = source[search_start:search_start + 12000]
if "].slice(0, 6);" in sample:
    raise SystemExit("[339] six-alias fanout still active")

worker_path.write_text(source, encoding="utf-8")
print("[339] exact Korean main genres now use one alias; family searches max three; 90s edge cache added")
