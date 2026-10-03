from pathlib import Path
import json

ROOT = Path('.')
ENTRY = ROOT / 'cloudflare/explore-worker/canonical/preview-entry.js'
MANIFEST = ROOT / 'cloudflare/explore-worker/release-patches.json'

entry = ENTRY.read_text(encoding='utf-8')
marker = 'SORIDRAW_SHARED_FEED_R2_READ_112_20260917'


def function_range(source: str, name: str):
    needles = [f'async function {name}(', f'function {name}(']
    start = -1
    for needle in needles:
        start = source.find(needle)
        if start >= 0:
            break
    if start < 0:
        raise RuntimeError(f'function missing: {name}')
    brace = source.find('{', start)
    if brace < 0:
        raise RuntimeError(f'function body missing: {name}')
    depth = 0
    quote = None
    escaped = False
    comment = None
    i = brace
    while i < len(source):
        c = source[i]
        n = source[i + 1] if i + 1 < len(source) else ''
        if comment == 'line':
            if c == '\n':
                comment = None
            i += 1
            continue
        if comment == 'block':
            if c == '*' and n == '/':
                comment = None
                i += 2
                continue
            i += 1
            continue
        if quote:
            if escaped:
                escaped = False
            elif c == '\\':
                escaped = True
            elif c == quote:
                quote = None
            i += 1
            continue
        if c == '/' and n == '/':
            comment = 'line'
            i += 2
            continue
        if c == '/' and n == '*':
            comment = 'block'
            i += 2
            continue
        if c in ('"', "'", '`'):
            quote = c
            i += 1
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    raise RuntimeError(f'unterminated function: {name}')


def replace_function(source: str, name: str, replacement: str):
    start, end = function_range(source, name)
    return source[:start] + replacement + source[end:]

if marker not in entry:
    anchor = '// SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916\n'
    if anchor not in entry:
        raise RuntimeError('108 entry marker missing')
    entry = entry.replace(anchor, anchor + f'// {marker}\n', 1)

    const_anchor = 'const EXPLORE_FEED_R2_SNAPSHOT_EDGE_SECONDS_108 = 5 * 60;\n'
    if const_anchor not in entry:
        raise RuntimeError('108 edge constant missing')
    helpers = r'''const EXPLORE_SHARED_FEED_R2_VERSION_112 = '112';
const sharedFeedR2Key112 = (sort) => `internal/explore/shared-feed-v112/${sort === 'popular' ? 'popular' : 'latest'}-40.json`;

async function readFeedHeadSource112(env, sort) {
  const shared = env?.PROFILE_MEDIA || null;
  if (shared) {
    try {
      const head = await shared.head(sharedFeedR2Key112(sort));
      if (head) return { head, r2ClassB: 1, source: 'SHARED-R2-HEAD-112' };
    } catch {}
  }
  const local = feedCacheBucket077(env);
  if (!local) return { head: null, r2ClassB: shared ? 1 : 0, source: 'R2-BINDING-MISSING-112' };
  try {
    const head = await local.head(feedR2Key077(sort));
    if (head) return { head, r2ClassB: shared ? 2 : 1, source: 'LOCAL-R2-HEAD-FALLBACK-112' };
  } catch {}
  return { head: null, r2ClassB: shared ? 2 : 1, source: 'R2-MISSING-112' };
}

async function readFeedObjectSource112(env, sort) {
  const shared = env?.PROFILE_MEDIA || null;
  if (shared) {
    try {
      const object = await shared.get(sharedFeedR2Key112(sort));
      if (object) return { object, r2ClassB: 1, source: 'SHARED-R2-GET-112' };
    } catch {}
  }
  const local = feedCacheBucket077(env);
  if (!local) return { object: null, r2ClassB: shared ? 1 : 0, source: 'R2-BINDING-MISSING-112' };
  try {
    const object = await local.get(feedR2Key077(sort));
    if (object) return { object, r2ClassB: shared ? 2 : 1, source: 'LOCAL-R2-GET-FALLBACK-112' };
  } catch {}
  return { object: null, r2ClassB: shared ? 2 : 1, source: 'R2-MISSING-112' };
}
'''
    entry = entry.replace(const_anchor, const_anchor + helpers, 1)

    entry = replace_function(entry, 'readFeedR2Revision077', r'''async function readFeedR2Revision077(url, env, sort) {
  const edgeUrl = new URL(`/__soridraw/feed-r2-revision-077/${sort}`, url.origin);
  const edgeKey = new Request(edgeUrl.toString(), { method: 'GET' });
  try {
    const cached = await caches.default.match(edgeKey);
    if (cached) {
      const revision = String(await cached.text() || '').trim();
      if (revision) return { revision, r2ClassB: 0, source: 'EDGE-SHARED-R2-HEAD-112' };
    }
  } catch {}

  const selected = await readFeedHeadSource112(env, sort);
  const head = selected.head;
  if (!head) return { revision: '', r2ClassB: selected.r2ClassB, source: selected.source };
  const revision = String(
    head.httpEtag
    || head.etag
    || head.customMetadata?.mirroredAt
    || head.customMetadata?.updatedAt
    || (head.uploaded && typeof head.uploaded.getTime === 'function' ? head.uploaded.getTime() : '')
    || '',
  ).trim();
  if (!revision) return { revision: '', r2ClassB: selected.r2ClassB, source: 'R2-REVISION-MISSING-112' };
  try {
    await caches.default.put(edgeKey, new Response(revision, {
      headers: { 'Cache-Control': `public, max-age=${REVISION_HEAD_CACHE_SECONDS_077}` },
    }));
  } catch {}
  return { revision, r2ClassB: selected.r2ClassB, source: selected.source };
}''')

    entry = replace_function(entry, 'handleFeedR2Snapshot108', r'''async function handleFeedR2Snapshot108(request, env) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const limit = Math.max(1, Number(url.searchParams.get('limit') || 40));
  const cursor = String(url.searchParams.get('cursor') || '').trim();
  if (limit !== 40 || cursor) {
    return new Response(JSON.stringify({ ok: false, error: 'R2 snapshot supports first page only' }), {
      status: 400,
      headers: feedSnapshotHeaders108(request, '', 'INVALID-FIRST-PAGE-108', 0),
    });
  }

  const requestedRevision = String(url.searchParams.get(EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108) || '').trim();
  if (requestedRevision) {
    try {
      const cached = await caches.default.match(feedSnapshotEdgeKey108(url, sort, requestedRevision));
      if (cached) {
        return new Response(await cached.text(), {
          status: 200,
          headers: feedSnapshotHeaders108(request, requestedRevision, 'EDGE-R2-SNAPSHOT-108', 0),
        });
      }
    } catch {}
  }

  const selected = await readFeedObjectSource112(env, sort);
  const object = selected.object;
  if (!object) {
    return new Response(JSON.stringify({ ok: false, error: 'Explore Feed snapshot unavailable' }), {
      status: 503,
      headers: feedSnapshotHeaders108(request, '', selected.source, selected.r2ClassB),
    });
  }

  let bundle = null;
  try { bundle = JSON.parse(await object.text()); } catch {}
  const payload = bundle?.payload;
  if (!payload?.data || !Array.isArray(payload.data.items)) {
    return new Response(JSON.stringify({ ok: false, error: 'Explore Feed snapshot invalid' }), {
      status: 503,
      headers: feedSnapshotHeaders108(request, '', 'R2-INVALID-112', selected.r2ClassB),
    });
  }

  const actualRevision = String(
    object.httpEtag
    || object.etag
    || object.customMetadata?.mirroredAt
    || object.customMetadata?.updatedAt
    || (object.uploaded && typeof object.uploaded.getTime === 'function' ? object.uploaded.getTime() : '')
    || requestedRevision
    || '',
  ).trim();
  const body = JSON.stringify(payload);
  if (actualRevision) {
    try {
      await caches.default.put(feedSnapshotEdgeKey108(url, sort, actualRevision), new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${EXPLORE_FEED_R2_SNAPSHOT_EDGE_SECONDS_108}` },
      }));
    } catch {}
  }
  return new Response(body, {
    status: 200,
    headers: feedSnapshotHeaders108(request, actualRevision, selected.source, selected.r2ClassB),
  });
}''')

ENTRY.write_text(entry, encoding='utf-8')

manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
patches = list(manifest.get('patches') or [])
patch_name = '059-shared-feed-r2-parity.mjs'
if patch_name not in patches:
    patches.append(patch_name)
manifest['patches'] = patches
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('[112] shared Feed read path now prefers the shared PROFILE_MEDIA mirror and falls back to environment-local R2 only when the shared mirror is not seeded.')
