from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'cloudflare/explore-worker/canonical/preview-worker.js'
source=path.read_text(encoding='utf-8')
MARKER='SORIDRAW_SEARCH_R2_ONLY_341_20261004'
if MARKER in source:
    print('[341] R2-only search already applied')
    raise SystemExit(0)

def function_range(text,name):
    needle=f'async function {name}('
    start=text.find(needle)
    if start<0: raise SystemExit(f'[341] missing {name}')
    brace=text.find('{',start); depth=0; quote=''; escaped=False; comment=''; i=brace
    while i<len(text):
        c=text[i]; n=text[i+1] if i+1<len(text) else ''
        if comment=='line':
            if c=='\n': comment=''
            i+=1; continue
        if comment=='block':
            if c=='*' and n=='/': comment=''; i+=2; continue
            i+=1; continue
        if quote:
            if escaped: escaped=False
            elif c=='\\': escaped=True
            elif c==quote: quote=''
            i+=1; continue
        if c=='/' and n=='/': comment='line'; i+=2; continue
        if c=='/' and n=='*': comment='block'; i+=2; continue
        if c in ("'",'"','`'): quote=c; i+=1; continue
        if c=='{': depth+=1
        elif c=='}':
            depth-=1
            if depth==0: return start,i+1,text[start:i+1]
        i+=1
    raise SystemExit(f'[341] unterminated {name}')

start,end,old=function_range(source,'handleSearch')
for token in ['SORIDRAW_SEARCH_R2_FIRST_337_20261004','SORIDRAW_KOREAN_GENRE_ALIAS_BOUND_CACHE_339_20261004','handleCatalogSearch066']:
    if token not in source: raise SystemExit('[341] prerequisite missing '+token)

helpers=r'''// SORIDRAW_SEARCH_R2_ONLY_341_20261004
function searchEdgeKey341(url) {
  const q = String(url.searchParams.get('q') || '').normalize('NFKC').toLowerCase().trim();
  const genres = [...new Set(url.searchParams.getAll('genre').map((v) => String(v || '').normalize('NFKC').toLowerCase().trim()).filter(Boolean))].sort();
  return new Request(
    'https://preview.soridraw.com/__soridraw_edge/search-r2-only-341'
      + '?q=' + encodeURIComponent(q)
      + '&g=' + encodeURIComponent(genres.join('|')),
    { method: 'GET' }
  );
}
async function readSearchEdge341(url) {
  try {
    if (typeof caches === 'undefined' || !caches?.default) return null;
    const hit = await caches.default.match(searchEdgeKey341(url));
    if (!(hit instanceof Response)) return null;
    const headers = new Headers(hit.headers);
    headers.set('Cache-Control','no-store');
    headers.set('X-SORIDRAW-Search-Cache','HIT-341');
    return new Response(hit.body,{status:hit.status,statusText:hit.statusText,headers});
  } catch { return null; }
}
async function writeSearchEdge341(url,response) {
  try {
    if (typeof caches === 'undefined' || !caches?.default || !(response instanceof Response) || !response.ok) return;
    const clone=response.clone();
    const headers=new Headers(clone.headers);
    headers.set('Cache-Control','public, max-age=300');
    headers.set('X-SORIDRAW-Search-Cache','STORED-341');
    await caches.default.put(searchEdgeKey341(url),new Response(clone.body,{status:clone.status,statusText:clone.statusText,headers}));
  } catch {}
}

'''

new=r'''async function handleSearch(url, env, cors) {
  // SORIDRAW_SEARCH_R2_ONLY_341_20261004
  // PREVIEW hybrid mode: all user search is R2-only. D1 search/index fallbacks are
  // deliberately unreachable so arbitrary or typo queries cannot create D1 reads.
  if (!isExploreR2HybridReadEnabled336(env)) {
    return await handleSearchCore336(url, env, cors);
  }

  const q = String(url.searchParams.get('q') || '').trim();
  if (!q || q.length > 120) {
    return withCatalogDiagnostics066(json({
      ok: true,
      data: { query: q, items: [], tracks: { items: [], nextCursor: null }, creators: [], nextCursor: null },
    }, 200, cors), 'R2-ONLY-SEARCH-341');
  }

  const edgeHit = await readSearchEdge341(url);
  if (edgeHit) return edgeHit;

  let response = null;
  try { response = await handleCatalogSearch066(url, env, cors); }
  catch (error) {
    console.warn('[SORIDRAW 341] R2 search unavailable:', String(error?.message || error || 'unknown'));
  }
  if (!(response instanceof Response)) {
    response = withCatalogDiagnostics066(json({
      ok: true,
      data: { query: q, items: [], tracks: { items: [], nextCursor: null }, creators: [], nextCursor: null },
    }, 200, cors), 'R2-ONLY-SEARCH-341');
  } else {
    const headers = new Headers(response.headers);
    headers.set('X-SORIDRAW-Search-Authority','R2-ONLY-341');
    headers.set('X-SORIDRAW-D1-Read','0');
    headers.set('X-SORIDRAW-D1-Write','0');
    response = new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  await writeSearchEdge341(url,response);
  const headers = new Headers(response.headers);
  headers.set('X-SORIDRAW-Search-Cache','MISS-341');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}'''

source=source[:start]+helpers+new+source[end:]
_,_,live=function_range(source,'handleSearch')
for forbidden in ['handleSearchCore066(', 'handleIndexedGenreAlias338(', 'env.DB', '.prepare(', '.batch(']:
    if forbidden in live: raise SystemExit('[341] D1 fallback remains in live search: '+forbidden)
for token in [MARKER,'handleCatalogSearch066(url, env, cors)','R2-ONLY-SEARCH-341','X-SORIDRAW-D1-Read','readSearchEdge341','writeSearchEdge341']:
    if token not in source: raise SystemExit('[341] missing '+token)
path.write_text(source,encoding='utf-8')
print('[341] search runtime is R2-only with 5m edge cache; D1 fallbacks removed from live search')
