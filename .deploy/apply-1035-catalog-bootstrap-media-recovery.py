from pathlib import Path

WORKER = Path('cloudflare/media-worker/src/index.js')
APP = Path('src/App.tsx')
FAVORITES = Path('src/pages/FavoritesPage.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Cloudflare: canonical lazy materialization + compact delta sync.
# ---------------------------------------------------------------------------
w = WORKER.read_text(encoding='utf-8')
w = replace_once(
    w,
    "return { uid: auth.uid, idToken };",
    "return { uid: auth.uid, idToken, appCheckToken };",
    'worker identity appcheck',
)
w = replace_once(
    w,
    "'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Firebase-AppCheck',",
    "'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Firebase-AppCheck,X-Soridraw-Known-Revision',",
    'worker cors revision header',
)

start_marker = '// SORIDRAW_COMMON_USER_DATA_ENGINE_1033'
end_marker = 'const handleMedia = async (request, env, origin, url) => {'
start = w.find(start_marker)
end = w.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('worker catalog block anchors missing')

catalog_block = r'''// SORIDRAW_COMMON_USER_DATA_ENGINE_1035
// V2: R2 holds one compact private catalog object per user/kind. A missing or
// stale object is materialized server-side from canonical Firestore exactly when
// needed; normal devices then read R2/IndexedDB and mutations send only deltas.
const CATALOG_SCHEMA_VERSION = 2;
const CATALOG_MAX_ITEMS = 100000;
const CATALOG_MAX_BYTES = 24 * 1024 * 1024;
const CATALOG_DELTA_MAX_CHANGES = 5000;
const CATALOG_KINDS = new Set(['musicNote', 'library']);

const MUSIC_NOTE_CATALOG_FIELDS = [
  'uid', 'soridrawSongId', 'favoriteKey',
  'title', 'koreanTitle', 'englishTitle', 'genre', 'appliedKeywords', 'searchTokens',
  'isLocked', 'liked', 'isLiked', 'personalLiked', 'favoriteLiked', 'isFavorite',
  'isPublic', 'exploreTrackId', 'explorePublicationId',
  'hidden', 'favoriteHidden', 'favoriteRemoved', 'favoriteRemovedAt', 'saved', 'deletedAt', 'trashedAt',
  'color', 'favoriteColor', 'noteColor', 'folderId', 'folderIds', 'musicNoteFolderIds',
  'createdAtMs', 'createdAt', 'updatedAtMs', 'updatedAt',
  'sunoLinks', 'sunoShareLinks', 'mainSunoIndex',
  'sunoShareUrl', 'sunoUrl', 'sunoSongUrl', 'sunoTitle',
  'sunoCoverUrl', 'sunoImageUrl', 'sunoArtworkUrl',
  'sunoDurationSeconds', 'sunoDurationText', 'sunoShareUrlUpdatedAt', 'sunoCoverFetchedAt',
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'sunoAudioUrl',
  'creatorNickname', 'ownerNickname', 'ownerUid', 'nickname',
];

const LIBRARY_CATALOG_FIELDS = [
  'uid', 'taskId', 'sourceTrackId', 'sourceTaskId', 'status', 'model', 'modelVersion',
  'title', 'koreanTitle', 'englishTitle', 'genre', 'style', 'tags', 'prompt',
  'createdAtMs', 'createdAt', 'updatedAtMs', 'updatedAt',
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'audioUrls', 'duration', 'durationSeconds',
  'sunoData', 'isPublic', 'hidden', 'deletedAt', 'trashedAt', 'favoriteColor', 'color',
];

const MUSIC_NOTE_MEDIA_FIELDS = [
  'sunoLinks', 'sunoShareLinks', 'mainSunoIndex',
  'sunoShareUrl', 'sunoUrl', 'sunoSongUrl', 'sunoTitle',
  'sunoCoverUrl', 'sunoImageUrl', 'sunoArtworkUrl',
  'sunoDurationSeconds', 'sunoDurationText', 'sunoShareUrlUpdatedAt', 'sunoCoverFetchedAt',
  'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',
  'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'sunoAudioUrl',
];

const catalogRouteFromPath = (pathname) => {
  const match = String(pathname || '').match(/^\/v1\/catalog\/(musicNote|library)(?:\/(delta))?$/);
  return match ? { kind: match[1], action: match[2] || 'base' } : null;
};

const catalogObjectKey = (uid, kind) => `catalog/v2/${encodeURIComponent(uid)}/${kind}.json`;

const catalogKnownRevision = (request) => {
  const value = Math.floor(Number(request.headers.get('X-Soridraw-Known-Revision') || 0));
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const catalogFieldList = (kind) => kind === 'musicNote' ? MUSIC_NOTE_CATALOG_FIELDS : LIBRARY_CATALOG_FIELDS;

const catalogDocumentId = (document) => {
  const name = text(document?.name);
  if (!name) return '';
  const last = name.split('/').pop() || '';
  try { return decodeURIComponent(last); } catch { return last; }
};

const isActiveMusicNoteCatalogItem = (item) => !(
  item?.favoriteRemoved === true
  || item?.saved === false
  || item?.hidden === true
  || item?.favoriteHidden === true
  || item?.deletedAt
  || item?.trashedAt
);

const catalogCreatedAtMs = (item, document = null) => {
  const value = Number(item?.createdAtMs || 0)
    || toMs(item?.createdAt)
    || Number(item?.updatedAtMs || 0)
    || toMs(item?.updatedAt)
    || toMs(document?.createTime)
    || toMs(document?.updateTime)
    || 1;
  return Math.max(1, Math.floor(Number(value) || 1));
};

const projectCatalogFields = (kind, source, id, document = null) => {
  if (!source || typeof source !== 'object' || Array.isArray(source) || !id) return null;
  if (kind === 'musicNote' && !isActiveMusicNoteCatalogItem(source)) return null;
  const projected = {
    id,
    firestoreId: text(source.firestoreId) || id,
    createdAtMs: catalogCreatedAtMs(source, document),
    __catalogSummary: true,
  };
  for (const key of catalogFieldList(kind)) {
    if (source[key] !== undefined) projected[key] = source[key];
  }
  projected.createdAtMs = catalogCreatedAtMs(projected, document);
  return projected;
};

const sortCatalogItems = (items) => items.sort((left, right) => {
  const diff = Number(right?.createdAtMs || 1) - Number(left?.createdAtMs || 1);
  if (diff !== 0) return diff;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
});

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
    if (!id || ids.has(id) || !Number.isFinite(createdAtMs) || createdAtMs <= 0 || createdAtMs > previousCreatedAtMs) return false;
    ids.add(id);
    previousCreatedAtMs = createdAtMs;
  }
  return true;
};

const catalogEncodedSize = (payload) => new TextEncoder().encode(JSON.stringify(payload)).length;

const firestoreCatalogQuery = async (uid, kind, idToken, appCheckToken, env) => {
  const parent = kind === 'musicNote'
    ? `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
    : `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/suno_tracks/${encodeURIComponent(uid)}`;
  const endpoint = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
  const collectionId = kind === 'musicNote' ? 'favorites' : 'tracks';
  const structuredQuery = {
    select: { fields: catalogFieldList(kind).map((fieldPath) => ({ fieldPath })) },
    from: [{ collectionId }],
  };
  if (kind === 'musicNote') {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'uid' },
        op: 'EQUAL',
        value: { stringValue: uid },
      },
    };
  }
  const headers = {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ structuredQuery }),
    cf: { cacheTtl: 0 },
  });
  if (!response.ok) throw new Error(`CATALOG_FIRESTORE_${kind}_${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`CATALOG_FIRESTORE_${kind}_INVALID`);
  const items = [];
  for (const row of rows) {
    const document = row?.document;
    if (!document) continue;
    const id = catalogDocumentId(document);
    const data = decodeFirestoreDocument(document);
    const projected = projectCatalogFields(kind, data, id, document);
    if (projected) items.push(projected);
    if (items.length > CATALOG_MAX_ITEMS) throw new Error('CATALOG_TOO_MANY_ITEMS');
  }
  return sortCatalogItems(items);
};

const fetchRecentSongsForCatalogEnrichment = async (uid, idToken, appCheckToken, env) => {
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/user_recent_songs/${encodeURIComponent(uid)}`;
  const headers = { Authorization: `Bearer ${idToken}` };
  if (appCheckToken) headers['X-Firebase-AppCheck'] = appCheckToken;
  const response = await fetch(endpoint, { headers, cf: { cacheTtl: 0 } });
  if (response.status === 404) return [];
  if (!response.ok) return [];
  const data = decodeFirestoreDocument(await response.json());
  const candidates = [data?.songs, data?.items, data?.recentSongs, data?.results];
  return candidates.find((value) => Array.isArray(value)) || [];
};

const catalogIdentityKeys = (item) => [
  text(item?.soridrawSongId),
  text(item?.favoriteKey),
  text(item?.id),
].filter(Boolean);

const enrichMusicNoteCatalogMedia = async (items, uid, idToken, appCheckToken, env) => {
  if (!items.length) return items;
  const recentSongs = await fetchRecentSongsForCatalogEnrichment(uid, idToken, appCheckToken, env);
  if (!recentSongs.length) return items;
  const byIdentity = new Map();
  for (const song of recentSongs) {
    for (const key of catalogIdentityKeys(song)) if (!byIdentity.has(key)) byIdentity.set(key, song);
  }
  for (const item of items) {
    const source = catalogIdentityKeys(item).map((key) => byIdentity.get(key)).find(Boolean);
    if (!source) continue;
    const firstSunoItem = Array.isArray(source?.sunoData) ? source.sunoData.find(Boolean) : null;
    for (const key of MUSIC_NOTE_MEDIA_FIELDS) {
      const current = item[key];
      if (current !== undefined && current !== null && current !== '') continue;
      const fallback = source?.[key] ?? firstSunoItem?.[key];
      if (fallback !== undefined && fallback !== null && fallback !== '') item[key] = fallback;
    }
  }
  return items;
};

const buildCanonicalCatalog = async (identity, kind, minimumRevision, env) => {
  let items = await firestoreCatalogQuery(identity.uid, kind, identity.idToken, identity.appCheckToken, env);
  if (kind === 'musicNote') {
    items = await enrichMusicNoteCatalogMedia(items, identity.uid, identity.idToken, identity.appCheckToken, env);
    sortCatalogItems(items);
  }
  const generatedAtMs = Date.now();
  const payload = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    kind,
    revision: Math.max(generatedAtMs, Math.floor(minimumRevision || 0)),
    items,
    itemCount: items.length,
    complete: true,
    generatedAtMs,
  };
  if (!validateCatalogPayload(payload, kind)) throw new Error('CATALOG_BUILD_INVALID');
  if (catalogEncodedSize(payload) > CATALOG_MAX_BYTES) throw new Error('CATALOG_TOO_LARGE');
  return payload;
};

const putCatalogObject = async (env, uid, payload) => {
  const key = catalogObjectKey(uid, payload.kind);
  const encoded = JSON.stringify(payload);
  if (new TextEncoder().encode(encoded).length > CATALOG_MAX_BYTES) throw new Error('CATALOG_TOO_LARGE');
  await env.MEDIA.put(key, encoded, {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' },
    customMetadata: {
      uid,
      kind: payload.kind,
      revision: String(payload.revision),
      itemCount: String(payload.itemCount),
      schemaVersion: String(payload.schemaVersion),
    },
  });
};

const readCatalogObject = async (env, uid, kind) => {
  const object = await env.MEDIA.get(catalogObjectKey(uid, kind));
  if (!object) return null;
  try {
    const payload = JSON.parse(await object.text());
    return validateCatalogPayload(payload, kind) ? payload : null;
  } catch {
    return null;
  }
};

const getOrBuildCatalog = async (identity, kind, minimumRevision, env) => {
  const current = await readCatalogObject(env, identity.uid, kind);
  if (current && current.revision >= minimumRevision) return current;
  const rebuilt = await buildCanonicalCatalog(identity, kind, minimumRevision, env);
  await putCatalogObject(env, identity.uid, rebuilt);
  return rebuilt;
};

const validateCatalogDelta = (payload, kind) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.schemaVersion !== CATALOG_SCHEMA_VERSION || payload.kind !== kind) return false;
  if (!Number.isInteger(payload.revision) || payload.revision <= 0) return false;
  if (!Array.isArray(payload.upserts) || !Array.isArray(payload.deletedIds)) return false;
  if (payload.upserts.length + payload.deletedIds.length > CATALOG_DELTA_MAX_CHANGES) return false;
  return payload.deletedIds.every((id) => Boolean(text(id)))
    && payload.upserts.every((item) => Boolean(item && typeof item === 'object' && text(item.id)));
};

const applyCatalogDelta = async (identity, kind, delta, env) => {
  const current = await getOrBuildCatalog(identity, kind, 0, env);
  const byId = new Map(current.items.map((item) => [text(item.id), item]));
  for (const idValue of delta.deletedIds) byId.delete(text(idValue));
  for (const rawItem of delta.upserts) {
    const id = text(rawItem?.id);
    if (!id) continue;
    const projected = projectCatalogFields(kind, rawItem, id);
    if (!projected) {
      byId.delete(id);
      continue;
    }
    byId.set(id, projected);
  }
  const items = sortCatalogItems(Array.from(byId.values()));
  const generatedAtMs = Date.now();
  const payload = {
    schemaVersion: CATALOG_SCHEMA_VERSION,
    kind,
    revision: Math.max(generatedAtMs, Number(delta.revision || 0), Number(current.revision || 0) + 1),
    items,
    itemCount: items.length,
    complete: true,
    generatedAtMs,
  };
  if (!validateCatalogPayload(payload, kind)) throw new Error('CATALOG_DELTA_RESULT_INVALID');
  await putCatalogObject(env, identity.uid, payload);
  return payload;
};

const handleCatalog = async (request, env, origin, url) => {
  const route = catalogRouteFromPath(url.pathname);
  if (!route || !CATALOG_KINDS.has(route.kind)) return jsonResponse({ ok: false, code: 'INVALID_CATALOG_KIND' }, 404, origin);
  let identity;
  try {
    identity = await requireClientIdentity(request, env);
  } catch (error) {
    return jsonResponse({ ok: false, code: text(error?.message) || 'UNAUTHENTICATED' }, 401, origin);
  }

  try {
    if (request.method === 'GET' && route.action === 'base') {
      const payload = await getOrBuildCatalog(identity, route.kind, catalogKnownRevision(request), env);
      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Soridraw-Catalog-Revision': String(payload.revision),
      });
      applyCors(headers, origin);
      return new Response(JSON.stringify(payload), { status: 200, headers });
    }

    if (request.method === 'POST' && route.action === 'delta') {
      const declaredLength = Number(request.headers.get('content-length') || 0);
      if (declaredLength > 2 * 1024 * 1024) return jsonResponse({ ok: false, code: 'CATALOG_DELTA_TOO_LARGE' }, 413, origin);
      const delta = await request.json();
      if (!validateCatalogDelta(delta, route.kind)) return jsonResponse({ ok: false, code: 'INVALID_CATALOG_DELTA' }, 400, origin);
      const next = await applyCatalogDelta(identity, route.kind, delta, env);
      return jsonResponse({ ok: true, kind: route.kind, revision: next.revision, itemCount: next.itemCount }, 200, origin);
    }

    // Compatibility only: accept a full V2 object, but V2 clients normally use delta.
    if (request.method === 'POST' && route.action === 'base') {
      const payload = await request.json();
      if (!validateCatalogPayload(payload, route.kind)) return jsonResponse({ ok: false, code: 'INVALID_CATALOG' }, 400, origin);
      if (catalogEncodedSize(payload) > CATALOG_MAX_BYTES) return jsonResponse({ ok: false, code: 'CATALOG_TOO_LARGE' }, 413, origin);
      await putCatalogObject(env, identity.uid, payload);
      return jsonResponse({ ok: true, kind: route.kind, revision: payload.revision, itemCount: payload.itemCount }, 200, origin);
    }

    return jsonResponse({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, origin);
  } catch (error) {
    console.error('catalog request failed', { kind: route.kind, action: route.action, error: String(error?.message || error) });
    return jsonResponse({ ok: false, code: text(error?.message) || 'CATALOG_FAILED' }, 503, origin);
  }
};

'''
w = w[:start] + catalog_block + w[end:]
WORKER.write_text(w, encoding='utf-8')

# ---------------------------------------------------------------------------
# Recent Songs -> Music Note save: never erase media URLs on deterministic save.
# ---------------------------------------------------------------------------
a = APP.read_text(encoding='utf-8')
media_anchor = """      const resolvedGenre = getResolvedGenre(song);\n      const favoritePayload = sanitizeForFirestore({"""
media_insert = """      const resolvedGenre = getResolvedGenre(song);\n      const favoriteMediaKeys = [\n        'audioUrl', 'audio_url', 'streamAudioUrl', 'stream_audio_url', 'sourceAudioUrl', 'sourceStreamAudioUrl',\n        'imageUrl', 'image_url', 'coverUrl', 'thumbnailUrl', 'audioUrls',\n        'sunoAudioUrl', 'sunoCoverUrl', 'sunoImageUrl', 'sunoArtworkUrl',\n        'sunoLinks', 'sunoShareLinks', 'mainSunoIndex',\n        'sunoShareUrl', 'sunoUrl', 'sunoSongUrl', 'sunoTitle',\n        'sunoDurationSeconds', 'sunoDurationText', 'sunoShareUrlUpdatedAt', 'sunoCoverFetchedAt',\n      ] as const;\n      const favoriteMediaPayload = Object.fromEntries(\n        favoriteMediaKeys\n          .filter((key) => {\n            const value = (song as any)?.[key];\n            return value !== undefined && value !== null && value !== '';\n          })\n          .map((key) => [key, (song as any)[key]]),\n      );\n      const favoritePayload = sanitizeForFirestore({"""
a = replace_once(a, media_anchor, media_insert, 'app favorite media anchor')
a = replace_once(
    a,
    """        situationSummary: song.situationSummary || (song.appliedKeywords as any)?.situationSummary || '',\n        isLocked: false,""",
    """        situationSummary: song.situationSummary || (song.appliedKeywords as any)?.situationSummary || '',\n        ...favoriteMediaPayload,\n        isLocked: false,""",
    'app favorite media payload spread',
)
a = replace_once(
    a,
    "setDoc(favoriteDocRef, favoritePayload, { merge: false }),",
    "setDoc(favoriteDocRef, favoritePayload, { merge: true }),",
    'app deterministic favorite merge',
)
APP.write_text(a, encoding='utf-8')

# ---------------------------------------------------------------------------
# Music Note list snapshot is intentionally summary-only. Hydrate the canonical
# Firestore document only for detail/apply/share actions, never for list paging.
# ---------------------------------------------------------------------------
f = FAVORITES.read_text(encoding='utf-8')
hydrate_anchor = """  const executeFavoriteMenuAction = (action: 'details' | 'select' | 'apply' | 'share' | 'sunoOpen' | 'sunoUrl' | 'sunoRemove' | 'favorite' | 'folder' | 'saveSharedNote' | 'delete' | 'restore' | 'permanentDelete' | 'selectAll' | 'clearSelection' | 'lock' | 'unlock' | 'lockSelected' | 'unlockSelected' | 'shareSelected' | 'favoriteSelected' | 'unfavoriteSelected' | 'folderSelected' | 'deleteSelected' | 'restoreSelected' | 'permanentDeleteSelected', song: any) => {"""
hydrate_insert = """  const hydrateCatalogFavorite = async (song: any): Promise<any> => {\n    if (!song?.__catalogSummary || !user?.uid || isSharedMusicNoteItem(song) || isMusicNoteSharedView) return song;\n    const sourceId = getFavoriteDocumentId(song);\n    if (!sourceId) return song;\n    try {\n      const snapshot = await getDoc(doc(db, 'favorites', sourceId));\n      if (!snapshot.exists()) return song;\n      return {\n        ...song,\n        ...(snapshot.data() || {}),\n        id: sourceId,\n        firestoreId: sourceId,\n        __catalogSummary: false,\n      };\n    } catch (error) {\n      console.warn('music note detail hydration failed:', error);\n      return song;\n    }\n  };\n\n  const openFavoriteDetail = async (song: any) => {\n    const hydrated = await hydrateCatalogFavorite(song);\n    setSelectedSong(hydrated);\n  };\n\n  const executeFavoriteMenuAction = (action: 'details' | 'select' | 'apply' | 'share' | 'sunoOpen' | 'sunoUrl' | 'sunoRemove' | 'favorite' | 'folder' | 'saveSharedNote' | 'delete' | 'restore' | 'permanentDelete' | 'selectAll' | 'clearSelection' | 'lock' | 'unlock' | 'lockSelected' | 'unlockSelected' | 'shareSelected' | 'favoriteSelected' | 'unfavoriteSelected' | 'folderSelected' | 'deleteSelected' | 'restoreSelected' | 'permanentDeleteSelected', song: any) => {"""
f = replace_once(f, hydrate_anchor, hydrate_insert, 'favorites hydrate insert')
f = replace_once(
    f,
    """    if (action === 'details') {\n      setSelectedSong(song);\n      return;\n    }""",
    """    if (action === 'details') {\n      void openFavoriteDetail(song);\n      return;\n    }""",
    'favorites menu detail hydrate',
)
f = replace_once(
    f,
    """    if (action === 'apply') {\n      applyKeywordsToNext(song);\n      return;\n    }\n\n    if (action === 'share') {\n      shareFavoriteSong(song);\n      return;\n    }""",
    """    if (action === 'apply') {\n      void hydrateCatalogFavorite(song).then((hydrated) => applyKeywordsToNext(hydrated));\n      return;\n    }\n\n    if (action === 'share') {\n      void hydrateCatalogFavorite(song).then((hydrated) => shareFavoriteSong(hydrated));\n      return;\n    }""",
    'favorites apply share hydrate',
)
card_anchor = """                    setSelectedSong(song);\n                  }}\n                  className={cn(\n                    \"soridraw-musicnote-song-card""" 
card_replace = """                    void openFavoriteDetail(song);\n                  }}\n                  className={cn(\n                    \"soridraw-musicnote-song-card"""
f = replace_once(f, card_anchor, card_replace, 'favorites card detail hydrate')
FAVORITES.write_text(f, encoding='utf-8')

# Guards
final_worker = WORKER.read_text(encoding='utf-8')
final_app = APP.read_text(encoding='utf-8')
final_fav = FAVORITES.read_text(encoding='utf-8')
for required in [
    'SORIDRAW_COMMON_USER_DATA_ENGINE_1035',
    "catalog/v2/${encodeURIComponent(uid)}",
    "X-Soridraw-Known-Revision",
    "firestoreCatalogQuery",
    "getOrBuildCatalog",
    "route.action === 'delta'",
]:
    if required not in final_worker:
        raise SystemExit(f'worker guard missing: {required}')
for required in ['favoriteMediaPayload', 'setDoc(favoriteDocRef, favoritePayload, { merge: true })']:
    if required not in final_app:
        raise SystemExit(f'app guard missing: {required}')
for required in ['hydrateCatalogFavorite', 'void openFavoriteDetail(song)', '__catalogSummary: false']:
    if required not in final_fav:
        raise SystemExit(f'favorites guard missing: {required}')
print('SORIDRAW_1035_CATALOG_BOOTSTRAP_MEDIA_RECOVERY=PASS')
