from pathlib import Path

APP = Path('src/App.tsx')
LIB = Path('src/pages/SunoLibraryPage.tsx')
ENGINE = Path('src/lib/userDataEngine.ts')
ADAPTIVE = Path('src/lib/adaptiveListIndexV2.ts')
WORKER = Path('cloudflare/media-worker/src/index.js')
FUNCTIONS_INDEX = Path('functions/src/index.ts')

app = APP.read_text(encoding='utf-8')
lib = LIB.read_text(encoding='utf-8')
engine = ENGINE.read_text(encoding='utf-8')
adaptive = ADAPTIVE.read_text(encoding='utf-8')
worker = WORKER.read_text(encoding='utf-8')
functions_index = FUNCTIONS_INDEX.read_text(encoding='utf-8')

MARKER = 'SORIDRAW_COMMON_USER_DATA_ENGINE_1033'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'1033 {label} anchor mismatch: {count}')
    return source.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1) Music Note correctness: unsave is a mutation, never a creation-time rewrite.
# This was a confirmed source of sparse/out-of-order pagination because removed
# rows were moved to the newest chronological position.
# ---------------------------------------------------------------------------
old_unsave = """          isPublic: false,
          createdAtMs: unsavedAt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),"""
new_unsave = """          isPublic: false,
          // 1033: preserve the immutable creation axis on save release.
          // Recent Songs <-> Music Note linking stays unchanged; only mutation time advances.
          updatedAt: serverTimestamp(),"""
app = replace_once(app, old_unsave, new_unsave, 'unsave chronology')

# Cacheless Music Note must try the one-object catalog snapshot before any
# bounded Firestore first-page fallback. Partial old local caches can still use
# the bounded repair path as compatibility only.
old_bounded = """        const musicNoteCacheNeedsBoundedVerification = musicNoteCacheNeedsFullBootstrap
          || (hasAnyMusicNotePayload && cachedFavoriteCount < FAVORITES_PAGE_SIZE);"""
new_bounded = """        const musicNoteCacheNeedsBoundedVerification = hasAnyMusicNotePayload
          && cachedFavoriteCount < FAVORITES_PAGE_SIZE;"""
app = replace_once(app, old_bounded, new_bounded, 'cacheless bounded gate')

old_verify = """        const shouldVerifyMusicNoteBundle = hasCachedMusicNote
          && !musicNoteCacheNeedsBoundedVerification
          && (
            musicNoteLocalVersionAtBootstrap <= 0
            || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap
          );"""
new_verify = """        const shouldVerifyMusicNoteBundle = !hasCachedMusicNote || (
          !musicNoteCacheNeedsBoundedVerification
          && (
            musicNoteLocalVersionAtBootstrap <= 0
            || musicNoteRemoteVersionAtBootstrap > musicNoteLocalVersionAtBootstrap
          )
        );"""
app = replace_once(app, old_verify, new_verify, 'cacheless catalog verification')

# Current branch already has many historical markers. Add only one engine marker.
marker_anchor = "const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906 = true;"
if MARKER not in app:
    app = replace_once(app, marker_anchor, marker_anchor + f"\nconst {MARKER} = true;", 'app marker')

# ---------------------------------------------------------------------------
# 2) Library: publish a full object snapshot only when the session itself knows
# there is no server continuation. Never infer completeness from list.length.
# ---------------------------------------------------------------------------
old_lib_publish = """  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {
    saveLibraryWorkspaceTrackCache(uid, list);
    schedulePreviewAdaptiveListIndexPublishIfDirty('library', uid, list, {
      hasMore: list.length >= WORKSPACE_SERVER_PAGE_SIZE,
    });
  };"""
new_lib_publish = """  const saveWorkspaceTrackCache = (uid: string, list: any[]) => {
    saveLibraryWorkspaceTrackCache(uid, list);
    const activeSession = libraryWorkspaceSession?.uid === uid ? libraryWorkspaceSession : null;
    const sessionComplete = Boolean(activeSession?.ready && activeSession?.hasMore === false);
    schedulePreviewAdaptiveListIndexPublishIfDirty('library', uid, list, {
      hasMore: activeSession ? activeSession.hasMore : true,
      complete: sessionComplete,
    });
  };"""
lib = replace_once(lib, old_lib_publish, new_lib_publish, 'library completeness')

# A full catalog snapshot is authoritative: all subsequent More operations are
# local rendering only. Legacy latest-10 bundles retain their old safety logic.
old_lib_more = """        const hasOlderCachedRows = session.tracks.length > list.length;
        session.hasMore = Boolean(bundle.hasMore || hasOlderCachedRows || list.length >= WORKSPACE_SERVER_PAGE_SIZE);"""
new_lib_more = """        const hasOlderCachedRows = session.tracks.length > list.length;
        const isFullCatalogSnapshot = bundle.schemaVersion === 1001;
        session.hasMore = isFullCatalogSnapshot
          ? false
          : Boolean(bundle.hasMore || hasOlderCachedRows || list.length >= WORKSPACE_SERVER_PAGE_SIZE);"""
lib = replace_once(lib, old_lib_more, new_lib_more, 'library full catalog more')

# ---------------------------------------------------------------------------
# 3) Common engine compatibility metadata: catalog object uses a distinct bridge
# schema marker and real wall-clock updatedAtMs so existing sync-version logic
# does not repeatedly reverify a snapshot whose revision counter was only 1/2/3.
# ---------------------------------------------------------------------------
engine = replace_once(
    engine,
    "    revision: Math.max(1, Math.floor(revision)),\n    items,",
    "    revision: Math.max(Date.now(), Math.floor(revision)),\n    items,",
    'engine wall-clock revision',
)

adaptive = replace_once(
    adaptive,
    "    schemaVersion: snapshot.schemaVersion,",
    "    schemaVersion: 1001,",
    'adaptive full catalog marker',
)
adaptive = replace_once(
    adaptive,
    "    updatedAtMs: snapshot.revision,",
    "    updatedAtMs: snapshot.generatedAtMs,",
    'adaptive updatedAt compatibility',
)

# ---------------------------------------------------------------------------
# 4) Reuse the existing authenticated Cloudflare media worker + R2 binding.
# No new backend service and no Firestore reads inside this route.
# ---------------------------------------------------------------------------
worker_marker = '// SORIDRAW_COMMON_USER_DATA_ENGINE_1033'
if worker_marker not in worker:
    catalog_code = r'''
// SORIDRAW_COMMON_USER_DATA_ENGINE_1033
const CATALOG_SCHEMA_VERSION = 1;
const CATALOG_MAX_ITEMS = 100000;
const CATALOG_MAX_BYTES = 24 * 1024 * 1024;
const CATALOG_KINDS = new Set(['musicNote', 'library']);

const catalogKindFromPath = (pathname) => {
  const match = String(pathname || '').match(/^\/v1\/catalog\/(musicNote|library)$/);
  return match ? match[1] : '';
};

const catalogObjectKey = (uid, kind) => `catalog/v1/${encodeURIComponent(uid)}/${kind}.json`;

const validateCatalogPayload = (payload, kind) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.schemaVersion !== CATALOG_SCHEMA_VERSION || payload.kind !== kind || payload.complete !== true) return false;
  if (!Number.isInteger(payload.revision) || payload.revision <= 0) return false;
  if (!Number.isInteger(payload.generatedAtMs) || payload.generatedAtMs <= 0) return false;
  if (!Array.isArray(payload.items) || payload.items.length > CATALOG_MAX_ITEMS) return false;
  if (!Number.isInteger(payload.itemCount) || payload.itemCount !== payload.items.length) return false;

  const ids = new Set();
  let previousCreatedAtMs = Number.MAX_SAFE_INTEGER;
  for (const item of payload.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = text(item.id);
    const createdAtMs = Number(item.createdAtMs || 0);
    if (!id || ids.has(id) || !Number.isInteger(createdAtMs) || createdAtMs <= 0 || createdAtMs > previousCreatedAtMs) return false;
    ids.add(id);
    previousCreatedAtMs = createdAtMs;
  }
  return true;
};

const handleCatalog = async (request, env, origin, url) => {
  const kind = catalogKindFromPath(url.pathname);
  if (!CATALOG_KINDS.has(kind)) return jsonResponse({ ok: false, code: 'INVALID_CATALOG_KIND' }, 404, origin);

  let identity;
  try {
    identity = await requireClientIdentity(request, env);
  } catch (error) {
    return jsonResponse({ ok: false, code: text(error?.message) || 'UNAUTHENTICATED' }, 401, origin);
  }

  const key = catalogObjectKey(identity.uid, kind);
  if (request.method === 'GET') {
    const object = await env.MEDIA.get(key);
    if (!object) return jsonResponse({ ok: false, code: 'CATALOG_NOT_FOUND' }, 404, origin);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Content-Length', String(object.size));
    headers.set('ETag', object.httpEtag);
    headers.set('Cache-Control', 'private, no-store');
    applyCors(headers, origin);
    return new Response(object.body, { status: 200, headers });
  }

  if (request.method !== 'POST') return jsonResponse({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > CATALOG_MAX_BYTES) return jsonResponse({ ok: false, code: 'CATALOG_TOO_LARGE' }, 413, origin);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: 'INVALID_JSON' }, 400, origin);
  }
  if (!validateCatalogPayload(payload, kind)) return jsonResponse({ ok: false, code: 'INVALID_CATALOG' }, 400, origin);

  const encoded = JSON.stringify(payload);
  if (new TextEncoder().encode(encoded).length > CATALOG_MAX_BYTES) {
    return jsonResponse({ ok: false, code: 'CATALOG_TOO_LARGE' }, 413, origin);
  }

  const current = await env.MEDIA.head(key);
  const currentRevision = Number(current?.customMetadata?.revision || 0);
  if (currentRevision > Number(payload.revision)) {
    return jsonResponse({ ok: false, code: 'STALE_CATALOG_REVISION', currentRevision }, 409, origin);
  }

  await env.MEDIA.put(key, encoded, {
    httpMetadata: {
      contentType: 'application/json; charset=utf-8',
      cacheControl: 'private, no-store',
    },
    customMetadata: {
      uid: identity.uid,
      kind,
      revision: String(payload.revision),
      itemCount: String(payload.itemCount),
    },
  });
  return jsonResponse({ ok: true, kind, revision: payload.revision, itemCount: payload.itemCount }, 200, origin);
};

'''
    worker = replace_once(worker, 'const handleMedia = async (request, env, origin, url) => {', catalog_code + 'const handleMedia = async (request, env, origin, url) => {', 'worker catalog insertion')

    route_anchor = """    if (request.method === 'POST' && url.pathname === '/v1/archive/resolve') {
      return handleArchiveResolve(request, env, origin);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/v1/media/')) {"""
    route_new = """    if (request.method === 'POST' && url.pathname === '/v1/archive/resolve') {
      return handleArchiveResolve(request, env, origin);
    }

    if ((request.method === 'GET' || request.method === 'POST') && url.pathname.startsWith('/v1/catalog/')) {
      return handleCatalog(request, env, origin, url);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/v1/media/')) {"""
    worker = replace_once(worker, route_anchor, route_new, 'worker catalog route')

# ---------------------------------------------------------------------------
# 5) The Firebase adaptive callable is superseded by the R2 object engine.
# Remove its export so future Functions builds stop carrying unused runtime code.
# The source file itself is deleted in the cleanup commit after verification.
# ---------------------------------------------------------------------------
functions_index = functions_index.replace('\nexport { publishPreviewAdaptiveListIndexV2 } from "./previewAdaptiveListIndex";\n', '\n')
functions_index = functions_index.rstrip() + '\n'

APP.write_text(app, encoding='utf-8')
LIB.write_text(lib, encoding='utf-8')
ENGINE.write_text(engine, encoding='utf-8')
ADAPTIVE.write_text(adaptive, encoding='utf-8')
WORKER.write_text(worker, encoding='utf-8')
FUNCTIONS_INDEX.write_text(functions_index, encoding='utf-8')

# Static safety guarantees.
app2 = APP.read_text(encoding='utf-8')
lib2 = LIB.read_text(encoding='utf-8')
worker2 = WORKER.read_text(encoding='utf-8')
engine2 = ENGINE.read_text(encoding='utf-8')

unsave_start = app2.index('const unsaveUpdates = sanitizeForFirestore({')
unsave_end = app2.index('        });', unsave_start)
unsave_block = app2[unsave_start:unsave_end]
if 'createdAtMs: unsavedAt' in unsave_block or 'createdAt: serverTimestamp()' in unsave_block:
    raise SystemExit('1033 guard: unsave still rewrites creation time')
for anchor in ('persistRecentSongsDocument', 'favoriteSyncSignal', 'buildRecentMirrorTargets', "operation: 'music-note-unsave'"):
    if anchor not in app2:
        raise SystemExit(f'1033 guard: Recent<->MusicNote link anchor missing: {anchor}')
if "const shouldVerifyMusicNoteBundle = !hasCachedMusicNote || (" not in app2:
    raise SystemExit('1033 guard: cacheless snapshot-first path missing')
if 'complete: sessionComplete' not in lib2 or 'isFullCatalogSnapshot = bundle.schemaVersion === 1001' not in lib2:
    raise SystemExit('1033 guard: Library common catalog integration incomplete')
for anchor in ('SORIDRAW_USER_DATA_ENGINE_V1_20260906', 'indexedDB.open', '/v1/catalog/${kind}', 'scheduleCatalogSnapshotPublishIfDirty'):
    if anchor not in engine2:
        raise SystemExit(f'1033 guard: common engine anchor missing: {anchor}')
for anchor in ('SORIDRAW_COMMON_USER_DATA_ENGINE_1033', 'handleCatalog', 'catalog/v1/', "url.pathname.startsWith('/v1/catalog/')"):
    if anchor not in worker2:
        raise SystemExit(f'1033 guard: Worker catalog anchor missing: {anchor}')
if 'publishPreviewAdaptiveListIndexV2' in FUNCTIONS_INDEX.read_text(encoding='utf-8'):
    raise SystemExit('1033 guard: obsolete adaptive Function export remains')

print('SORIDRAW_1033_COMMON_USER_DATA_ENGINE=PASS')
