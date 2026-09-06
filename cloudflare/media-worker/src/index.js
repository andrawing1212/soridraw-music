import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  importX509,
  jwtVerify,
} from 'jose';
import {
  appendCatalogJournalDelta,
  buildCatalogJournalSyncResponse,
  createCompactedCatalogJournal,
  createEmptyCatalogJournal,
  isValidCatalogJournal,
  materializeCatalogJournal,
  shouldCompactCatalogJournal,
} from './catalogJournal.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const APP_CHECK_JWKS = createRemoteJWKSet(new URL('https://firebaseappcheck.googleapis.com/v1/jwks'));

let authCertState = {
  expiresAt: 0,
  certs: {},
  keys: new Map(),
};

const text = (value) => typeof value === 'string' ? value.trim() : '';

const jsonResponse = (payload, status = 200, origin = '') => {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  applyCors(headers, origin);
  return new Response(JSON.stringify(payload), { status, headers });
};

const allowedOrigins = (env) => new Set(
  text(env.ALLOWED_ORIGINS)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const isAllowedOrigin = (env, origin) => !origin || allowedOrigins(env).has(origin);

const applyCors = (headers, origin) => {
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag, Accept-Ranges');
};

const handleOptions = (request, env) => {
  const origin = text(request.headers.get('Origin'));
  if (!isAllowedOrigin(env, origin)) return new Response(null, { status: 403 });
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Firebase-AppCheck,X-Soridraw-Known-Revision,X-Soridraw-Require-Revision',
    'Access-Control-Max-Age': '86400',
  });
  applyCors(headers, origin);
  return new Response(null, { status: 204, headers });
};

const extractBearer = (request) => {
  const value = text(request.headers.get('Authorization'));
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
};

const parseMaxAgeMs = (cacheControl) => {
  const match = String(cacheControl || '').match(/max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : 3600;
  return Math.max(60, Math.min(seconds || 3600, 6 * 60 * 60)) * 1000;
};

const refreshAuthCerts = async () => {
  const now = Date.now();
  if (authCertState.expiresAt > now && Object.keys(authCertState.certs).length > 0) return;
  const response = await fetch(AUTH_CERT_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!response.ok) throw new Error(`Firebase auth cert fetch failed: ${response.status}`);
  const certs = await response.json();
  authCertState = {
    expiresAt: now + parseMaxAgeMs(response.headers.get('Cache-Control')),
    certs,
    keys: new Map(),
  };
};

const verifyFirebaseIdToken = async (token, env) => {
  if (!token) throw new Error('AUTH_TOKEN_MISSING');
  const header = decodeProtectedHeader(token);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('AUTH_TOKEN_HEADER_INVALID');
  await refreshAuthCerts();
  const cert = authCertState.certs[header.kid];
  if (!cert) {
    authCertState.expiresAt = 0;
    await refreshAuthCerts();
  }
  const refreshedCert = authCertState.certs[header.kid];
  if (!refreshedCert) throw new Error('AUTH_TOKEN_KID_UNKNOWN');

  let key = authCertState.keys.get(header.kid);
  if (!key) {
    key = await importX509(refreshedCert, 'RS256');
    authCertState.keys.set(header.kid, key);
  }

  const { payload } = await jwtVerify(token, key, {
    algorithms: ['RS256'],
    audience: env.FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
  });

  const uid = text(payload.sub);
  if (!uid) throw new Error('AUTH_UID_MISSING');
  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.iat || 0) > now || Number(payload.auth_time || 0) > now) {
    throw new Error('AUTH_TOKEN_TIME_INVALID');
  }
  return { uid, payload };
};

const verifyAppCheckToken = async (token, env) => {
  if (!token) throw new Error('APP_CHECK_TOKEN_MISSING');
  const header = decodeProtectedHeader(token);
  if (header.alg !== 'RS256' || header.typ !== 'JWT') throw new Error('APP_CHECK_HEADER_INVALID');
  const { payload } = await jwtVerify(token, APP_CHECK_JWKS, {
    algorithms: ['RS256'],
    audience: `projects/${env.FIREBASE_PROJECT_NUMBER}`,
    issuer: `https://firebaseappcheck.googleapis.com/${env.FIREBASE_PROJECT_NUMBER}`,
  });
  if (env.FIREBASE_WEB_APP_ID && text(payload.sub) !== env.FIREBASE_WEB_APP_ID) {
    throw new Error('APP_CHECK_APP_MISMATCH');
  }
  return payload;
};

const requireClientIdentity = async (request, env) => {
  const idToken = extractBearer(request);
  const appCheckToken = text(request.headers.get('X-Firebase-AppCheck'));
  const [auth] = await Promise.all([
    verifyFirebaseIdToken(idToken, env),
    verifyAppCheckToken(appCheckToken, env),
  ]);
  return { uid: auth.uid, idToken, appCheckToken };
};

const requireCatalogReadIdentity = async (request, env) => {
  const idToken = extractBearer(request);
  const auth = await verifyFirebaseIdToken(idToken, env);
  const suppliedAppCheckToken = text(request.headers.get('X-Firebase-AppCheck'));
  let appCheckToken = '';
  if (suppliedAppCheckToken) {
    try {
      await verifyAppCheckToken(suppliedAppCheckToken, env);
      appCheckToken = suppliedAppCheckToken;
    } catch {
      // Existing private R2 catalogs remain readable by their authenticated owner.
      // An invalid App Check token is never forwarded to canonical Firestore rebuilds.
      appCheckToken = '';
    }
  }
  return { uid: auth.uid, idToken, appCheckToken };
};

const decodeFirestoreValue = (value) => {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('arrayValue' in value) {
    return Array.isArray(value.arrayValue?.values)
      ? value.arrayValue.values.map(decodeFirestoreValue)
      : [];
  }
  if ('mapValue' in value) {
    const out = {};
    for (const [key, child] of Object.entries(value.mapValue?.fields || {})) {
      out[key] = decodeFirestoreValue(child);
    }
    return out;
  }
  return null;
};

const decodeFirestoreDocument = (document) => {
  const out = {};
  for (const [key, value] of Object.entries(document?.fields || {})) {
    out[key] = decodeFirestoreValue(value);
  }
  return out;
};

const fetchOwnedTrack = async (uid, trackId, idToken, env) => {
  const path = [
    'suno_tracks', uid, 'tracks', trackId,
  ].map(encodeURIComponent).join('/');
  const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${path}`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${idToken}` },
    cf: { cacheTtl: 0 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`FIRESTORE_READ_${response.status}`);
  return decodeFirestoreDocument(await response.json());
};

const toMs = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === 'object') {
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value._seconds === 'number') return value._seconds * 1000;
  }
  return 0;
};

const AUDIO_KEYS = [
  'sourceAudioUrl', 'source_audio_url',
  'audioUrl', 'audio_url',
  'sourceStreamAudioUrl', 'source_stream_audio_url',
  'streamAudioUrl', 'stream_audio_url',
  'downloadUrl', 'download_url',
  'playUrl', 'play_url',
  'mediaUrl', 'media_url',
  'mp3Url', 'mp3_url',
  'url',
];

const collectAudioUrls = (source) => {
  if (!source || typeof source !== 'object') return [];
  const urls = [];
  for (const key of AUDIO_KEYS) {
    const value = text(source[key]);
    if (value && !urls.includes(value)) urls.push(value);
  }
  return urls;
};

const getTrackAudioCandidates = (track, index) => {
  const ordered = [];
  const pushAll = (values) => {
    for (const value of values) if (value && !ordered.includes(value)) ordered.push(value);
  };
  const sunoData = Array.isArray(track?.sunoData) ? track.sunoData : [];
  if (sunoData[index]) pushAll(collectAudioUrls(sunoData[index]));
  if (index === 0) pushAll(collectAudioUrls(track));
  return ordered.slice(0, 12);
};

const isAllowedSourceHost = (hostname) => {
  const host = String(hostname || '').toLowerCase();
  return host === 'suno.ai'
    || host.endsWith('.suno.ai')
    || host === 'file.removeai.org'
    || host === 'tempfile.aiquickdraw.com';
};

const isAcceptableAudioContentType = (contentType) => {
  const value = String(contentType || '').toLowerCase();
  if (!value) return true;
  return value.startsWith('audio/') || value.includes('octet-stream');
};

const safePathPart = (value, fallback = 'unknown') => {
  const normalized = text(value).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
  return normalized || fallback;
};

const objectKeyFor = (uid, trackId, index) => `u/${safePathPart(uid)}/${safePathPart(trackId)}/${index}.mp3`;

const bytesToBase64Url = (bytes) => {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const signValue = async (secret, value) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
};

const constantTimeEqual = (left, right) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
};

const makeSignedMediaUrl = async (request, env, key) => {
  if (!text(env.MEDIA_SIGNING_SECRET)) throw new Error('MEDIA_SIGNING_SECRET_MISSING');
  const ttl = Math.max(60, Math.min(3600, Number(env.SIGNED_URL_TTL_SECONDS) || 1800));
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = await signValue(env.MEDIA_SIGNING_SECRET, `GET\n${key}\n${exp}`);
  const url = new URL(`/v1/media/${key}`, request.url);
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);
  return { url: url.toString(), exp };
};

const tryArchiveCandidate = async (env, key, sourceUrl, createdAtMs) => {
  let parsed;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !isAllowedSourceHost(parsed.hostname)) return null;

  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'Accept': 'audio/*,application/octet-stream;q=0.9,*/*;q=0.1',
      'User-Agent': 'SORIDRAW-R2-archive/1.0',
    },
    cf: { cacheTtl: 0 },
  });

  let finalUrl;
  try { finalUrl = new URL(response.url); } catch { finalUrl = parsed; }
  if (!isAllowedSourceHost(finalUrl.hostname)) return null;
  if (!response.ok || !response.body) return null;
  if (!isAcceptableAudioContentType(response.headers.get('Content-Type'))) return null;
  if (response.headers.get('Content-Length') === '0') return null;

  const [probeStream, storeStream] = response.body.tee();
  const reader = probeStream.getReader();
  const firstChunk = await reader.read();
  try { await reader.cancel(); } catch {}
  if (firstChunk.done || !firstChunk.value || firstChunk.value.byteLength <= 0) return null;

  const uploaded = await env.MEDIA.put(key, storeStream, {
    httpMetadata: {
      contentType: response.headers.get('Content-Type') || 'audio/mpeg',
      cacheControl: 'private, max-age=31536000, immutable',
    },
    customMetadata: {
      kind: 'soridraw-lazy-mp3',
      sourceHost: finalUrl.hostname,
      sourceCreatedAt: createdAtMs ? new Date(createdAtMs).toISOString() : '',
      archivedAt: new Date().toISOString(),
    },
  });

  if (!uploaded || uploaded.size <= 0) {
    try { await env.MEDIA.delete(key); } catch {}
    return null;
  }
  return uploaded;
};

const handleArchiveResolve = async (request, env, origin) => {
  let identity;
  try {
    identity = await requireClientIdentity(request, env);
  } catch (error) {
    return jsonResponse({ ok: false, code: text(error?.message) || 'UNAUTHENTICATED' }, 401, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: 'INVALID_JSON' }, 400, origin);
  }

  const trackId = text(body?.trackId);
  const indexNumber = Number(body?.index ?? 0);
  const index = Number.isInteger(indexNumber) && indexNumber >= 0 && indexNumber <= 16 ? indexNumber : -1;
  if (!trackId || index < 0) return jsonResponse({ ok: false, code: 'INVALID_TRACK_CONTEXT' }, 400, origin);

  const key = objectKeyFor(identity.uid, trackId, index);
  const existing = await env.MEDIA.head(key);
  if (existing && existing.size > 0) {
    const signed = await makeSignedMediaUrl(request, env, key);
    return jsonResponse({
      ok: true,
      archived: true,
      reused: true,
      storage: 'r2',
      playbackUrl: signed.url,
      expiresAt: signed.exp,
      bytes: existing.size,
    }, 200, origin);
  }

  let track;
  try {
    track = await fetchOwnedTrack(identity.uid, trackId, identity.idToken, env);
  } catch (error) {
    return jsonResponse({ ok: false, code: text(error?.message) || 'TRACK_READ_FAILED' }, 502, origin);
  }
  if (!track) return jsonResponse({ ok: false, code: 'TRACK_NOT_FOUND' }, 404, origin);

  const createdAtMs = toMs(track.createdAt);
  const minAgeDays = Math.max(1, Number(env.ARCHIVE_MIN_AGE_DAYS) || 14);
  const ageMs = createdAtMs ? Date.now() - createdAtMs : -1;
  if (!createdAtMs || ageMs < minAgeDays * DAY_MS) {
    return jsonResponse({
      ok: false,
      code: 'TRACK_NOT_ARCHIVE_ELIGIBLE',
      archiveMinAgeDays: minAgeDays,
      ageDays: createdAtMs ? Math.max(0, Math.floor(ageMs / DAY_MS)) : null,
    }, 409, origin);
  }

  const candidates = getTrackAudioCandidates(track, index);
  if (candidates.length === 0) {
    return jsonResponse({ ok: false, code: 'NO_STORED_MP3_SOURCE' }, 404, origin);
  }

  let uploaded = null;
  for (const candidate of candidates) {
    try {
      uploaded = await tryArchiveCandidate(env, key, candidate, createdAtMs);
    } catch {
      uploaded = null;
    }
    if (uploaded) break;
  }

  if (!uploaded) {
    return jsonResponse({
      ok: false,
      code: 'STORED_MP3_SOURCE_UNAVAILABLE',
      message: 'No existing provider MP3 bytes were available. No WAV generation or paid Music API request was attempted.',
    }, 410, origin);
  }

  const signed = await makeSignedMediaUrl(request, env, key);
  return jsonResponse({
    ok: true,
    archived: true,
    reused: false,
    storage: 'r2',
    playbackUrl: signed.url,
    expiresAt: signed.exp,
    bytes: uploaded.size,
    archiveMinAgeDays: minAgeDays,
  }, 201, origin);
};


// SORIDRAW_COMMON_USER_DATA_ENGINE_1035
// V2: R2 holds one compact private catalog object per user/kind. A missing or
// stale object is materialized server-side from canonical Firestore exactly when
// needed; normal devices then read R2/IndexedDB and mutations send only deltas.
const CATALOG_SCHEMA_VERSION = 4;
const CATALOG_MAX_ITEMS = 100000;
const CATALOG_MAX_BYTES = 24 * 1024 * 1024;
const CATALOG_DELTA_MAX_CHANGES = 5000;
const CATALOG_JOURNAL_ENGINE_1053 = true;
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

const catalogObjectKey = (uid, kind) => `catalog/v4/${encodeURIComponent(uid)}/${kind}.json`;
const catalogJournalKey = (uid, kind) => `catalog/v4/${encodeURIComponent(uid)}/${kind}/journal.json`;
const catalogCompactedBaseKey = (uid, kind, revision) => `catalog/v4/${encodeURIComponent(uid)}/${kind}/bases/${revision}.json`;

const catalogKnownRevision = (request) => {
  const value = Math.floor(Number(request.headers.get('X-Soridraw-Known-Revision') || 0));
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const catalogRequiredRevision = (request) => {
  const value = Math.floor(Number(request.headers.get('X-Soridraw-Require-Revision') || 0));
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
  if (payload.schemaVersion !== CATALOG_SCHEMA_VERSION || payload.authority !== 'server' || payload.kind !== kind || payload.complete !== true) return false;
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
    authority: 'server',
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

const putCatalogObjectAtKey = async (env, key, uid, payload) => {
  const encoded = JSON.stringify(payload);
  if (new TextEncoder().encode(encoded).length > CATALOG_MAX_BYTES) throw new Error('CATALOG_TOO_LARGE');
  return env.MEDIA.put(key, encoded, {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' },
    customMetadata: {
      uid,
      kind: payload.kind,
      revision: String(payload.revision),
      itemCount: String(payload.itemCount),
      schemaVersion: String(payload.schemaVersion),
      authority: 'server',
    },
  });
};

const putCatalogObject = async (env, uid, payload) => (
  putCatalogObjectAtKey(env, catalogObjectKey(uid, payload.kind), uid, payload)
);

const readCatalogObjectAtKey = async (env, key, kind) => {
  const object = await env.MEDIA.get(key);
  if (!object) return null;
  try {
    const payload = JSON.parse(await object.text());
    return validateCatalogPayload(payload, kind) ? payload : null;
  } catch {
    return null;
  }
};

const readCatalogObject = async (env, uid, kind) => (
  readCatalogObjectAtKey(env, catalogObjectKey(uid, kind), kind)
);

const readCatalogJournalObject = async (env, uid, kind) => {
  const object = await env.MEDIA.get(catalogJournalKey(uid, kind));
  if (!object) return null;
  try {
    const payload = JSON.parse(await object.text());
    return isValidCatalogJournal(payload, kind) ? { object, payload } : null;
  } catch {
    return null;
  }
};

const putCatalogJournalHead = async (env, uid, kind, head, currentObject = null) => {
  const encoded = JSON.stringify(head);
  const options = {
    httpMetadata: { contentType: 'application/json; charset=utf-8', cacheControl: 'private, no-store' },
    customMetadata: {
      uid,
      kind,
      baseRevision: String(head.baseRevision),
      revision: String(head.headRevision),
      itemCount: String(head.itemCount),
      deltaCount: String(head.deltas.length),
      authority: 'server',
    },
    onlyIf: currentObject?.etag
      ? { etagMatches: currentObject.etag }
      : { etagDoesNotMatch: '*' },
  };
  return env.MEDIA.put(catalogJournalKey(uid, kind), encoded, options);
};

const getCatalogState = async (identity, kind, requiredRevision, env) => {
  const journalRecord = await readCatalogJournalObject(env, identity.uid, kind);
  if (journalRecord) {
    const base = await readCatalogObjectAtKey(env, journalRecord.payload.baseKey, kind);
    if (base && base.revision === journalRecord.payload.baseRevision && base.itemCount === journalRecord.payload.baseItemCount) {
      if (journalRecord.payload.headRevision >= requiredRevision) {
        return { base, head: journalRecord.payload, journalObject: journalRecord.object };
      }
    }
  }

  const legacyBase = await readCatalogObject(env, identity.uid, kind);
  if (legacyBase && legacyBase.revision >= requiredRevision && !journalRecord) {
    return {
      base: legacyBase,
      head: createEmptyCatalogJournal({
        kind,
        baseKey: catalogObjectKey(identity.uid, kind),
        baseRevision: legacyBase.revision,
        itemCount: legacyBase.itemCount,
      }),
      journalObject: null,
    };
  }

  const rebuilt = await buildCanonicalCatalog(identity, kind, requiredRevision, env);
  await putCatalogObject(env, identity.uid, rebuilt);
  try { await env.MEDIA.delete(catalogJournalKey(identity.uid, kind)); } catch {}
  return {
    base: rebuilt,
    head: createEmptyCatalogJournal({
      kind,
      baseKey: catalogObjectKey(identity.uid, kind),
      baseRevision: rebuilt.revision,
      itemCount: rebuilt.itemCount,
    }),
    journalObject: null,
  };
};

const materializeCatalogState = (state, kind) => {
  const payload = materializeCatalogJournal({
    baseSnapshot: state.base,
    head: state.head,
    projectItem: (item, id) => projectCatalogFields(kind, item, id),
    sortItems: sortCatalogItems,
  });
  if (!payload || !validateCatalogPayload(payload, kind)) throw new Error('CATALOG_JOURNAL_MATERIALIZE_INVALID');
  return payload;
};

const getOrBuildCatalog = async (identity, kind, requiredRevision, env) => {
  const state = await getCatalogState(identity, kind, requiredRevision, env);
  return materializeCatalogState(state, kind);
};

const validateCatalogDelta = (payload, kind) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.schemaVersion !== CATALOG_SCHEMA_VERSION || payload.kind !== kind) return false;
  if (!text(payload.mutationId)) return false;
  if (!Number.isInteger(payload.baseRevision) || payload.baseRevision <= 0) return false;
  if (!Number.isInteger(payload.revision) || payload.revision <= payload.baseRevision) return false;
  if (!Number.isInteger(payload.baseItemCount) || payload.baseItemCount < 0) return false;
  if (!Number.isInteger(payload.nextItemCount) || payload.nextItemCount < 0) return false;
  if (!Array.isArray(payload.upserts) || !Array.isArray(payload.deletedIds)) return false;
  if (payload.upserts.length + payload.deletedIds.length > CATALOG_DELTA_MAX_CHANGES) return false;
  return payload.deletedIds.every((id) => Boolean(text(id)))
    && payload.upserts.every((item) => Boolean(item && typeof item === 'object' && text(item.id)));
};

const compactCatalogJournal = async (env, uid, kind) => {
  const journalRecord = await readCatalogJournalObject(env, uid, kind);
  if (!journalRecord || journalRecord.payload.deltas.length === 0) return false;
  const base = await readCatalogObjectAtKey(env, journalRecord.payload.baseKey, kind);
  if (!base) return false;
  const materialized = materializeCatalogState({ base, head: journalRecord.payload }, kind);
  const newBaseKey = catalogCompactedBaseKey(uid, kind, materialized.revision);
  await putCatalogObjectAtKey(env, newBaseKey, uid, materialized);
  const compactedHead = createCompactedCatalogJournal({ head: journalRecord.payload, baseKey: newBaseKey });
  const stored = await putCatalogJournalHead(env, uid, kind, compactedHead, journalRecord.object);
  return Boolean(stored);
};

const applyCatalogDelta = async (identity, kind, delta, env, executionCtx = null) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = await getCatalogState(identity, kind, 0, env);
    const head = state.head;
    const sanitizedDeletedIds = new Set(delta.deletedIds.map((id) => text(id)).filter(Boolean));
    const sanitizedUpserts = [];
    for (const rawItem of delta.upserts) {
      const id = text(rawItem?.id);
      if (!id) continue;
      const projected = projectCatalogFields(kind, rawItem, id);
      if (!projected) sanitizedDeletedIds.add(id);
      else sanitizedUpserts.push(projected);
    }
    const normalizedDelta = { ...delta, upserts: sanitizedUpserts, deletedIds: Array.from(sanitizedDeletedIds) };
    const serverRevision = Math.max(Date.now(), Number(delta.revision || 0), Number(head.headRevision || 0) + 1);
    const appended = appendCatalogJournalDelta({ head, delta: normalizedDelta, serverRevision });
    if (appended.ok && appended.duplicate) {
      return { conflict: false, duplicate: true, revision: appended.revision, itemCount: appended.itemCount, deltaCount: head.deltas.length };
    }
    if (!appended.ok && appended.reason === 'CONFLICT') {
      return { conflict: true, revision: head.headRevision, itemCount: head.itemCount, deltaCount: head.deltas.length };
    }
    if (!appended.ok && appended.reason === 'COMPACT_REQUIRED') {
      const compacted = await compactCatalogJournal(env, identity.uid, kind);
      if (compacted) continue;
      return { conflict: true, revision: head.headRevision, itemCount: head.itemCount, deltaCount: head.deltas.length };
    }
    if (!appended.ok) throw new Error(`CATALOG_DELTA_${appended.reason || 'INVALID'}`);
    const stored = await putCatalogJournalHead(env, identity.uid, kind, appended.head, state.journalObject);
    if (!stored) continue;
    if (shouldCompactCatalogJournal(appended.head)) {
      const compaction = compactCatalogJournal(env, identity.uid, kind).catch((error) => {
        console.warn('catalog journal compaction deferred', { kind, error: String(error?.message || error) });
        return false;
      });
      if (executionCtx?.waitUntil) executionCtx.waitUntil(compaction);
      else await compaction;
    }
    return { conflict: false, duplicate: false, revision: appended.revision, itemCount: appended.itemCount, deltaCount: appended.head.deltas.length };
  }
  const latest = await getCatalogState(identity, kind, 0, env);
  return { conflict: true, revision: latest.head.headRevision, itemCount: latest.head.itemCount, deltaCount: latest.head.deltas.length };
};

const handleCatalog = async (request, env, origin, url, executionCtx = null) => {
  const route = catalogRouteFromPath(url.pathname);
  if (!route || !CATALOG_KINDS.has(route.kind)) return jsonResponse({ ok: false, code: 'INVALID_CATALOG_KIND' }, 404, origin);
  let identity;
  try {
    const isCatalogRead = request.method === 'GET' && route.action === 'base';
    identity = isCatalogRead
      ? await requireCatalogReadIdentity(request, env)
      : await requireClientIdentity(request, env);
  } catch (error) {
    return jsonResponse({ ok: false, code: text(error?.message) || 'UNAUTHENTICATED' }, 401, origin);
  }

  try {
    if (request.method === 'GET' && route.action === 'base') {
      const state = await getCatalogState(identity, route.kind, catalogRequiredRevision(request), env);
      const knownRevision = catalogKnownRevision(request);
      const syncPayload = knownRevision > 0 ? buildCatalogJournalSyncResponse({ head: state.head, knownRevision }) : null;
      const payload = syncPayload || materializeCatalogState(state, route.kind);
      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Soridraw-Catalog-Revision': String(payload.revision),
        'X-Soridraw-Catalog-Mode': String(payload.mode || 'full'),
      });
      applyCors(headers, origin);
      return new Response(JSON.stringify(payload), { status: 200, headers });
    }

    if (request.method === 'POST' && route.action === 'delta') {
      const declaredLength = Number(request.headers.get('content-length') || 0);
      if (declaredLength > 2 * 1024 * 1024) return jsonResponse({ ok: false, code: 'CATALOG_DELTA_TOO_LARGE' }, 413, origin);
      const delta = await request.json();
      if (!validateCatalogDelta(delta, route.kind)) return jsonResponse({ ok: false, code: 'INVALID_CATALOG_DELTA' }, 400, origin);
      const next = await applyCatalogDelta(identity, route.kind, delta, env, executionCtx);
      if (next.conflict) {
        return jsonResponse({ ok: false, code: 'CATALOG_DELTA_CONFLICT', kind: route.kind, revision: next.revision, itemCount: next.itemCount }, 409, origin);
      }
      return jsonResponse({ ok: true, kind: route.kind, revision: next.revision, itemCount: next.itemCount, deltaCount: next.deltaCount, duplicate: next.duplicate === true }, 200, origin);
    }

    // 1039: a browser may publish only deltas. It can never self-declare a complete catalog.
    if (request.method === 'POST' && route.action === 'base') {
      return jsonResponse({ ok: false, code: 'CLIENT_FULL_CATALOG_DISABLED' }, 405, origin);
    }

    return jsonResponse({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, origin);
  } catch (error) {
    console.error('catalog request failed', { kind: route.kind, action: route.action, error: String(error?.message || error) });
    return jsonResponse({ ok: false, code: text(error?.message) || 'CATALOG_FAILED' }, 503, origin);
  }
};

const handleMedia = async (request, env, origin, url) => {
  const prefix = '/v1/media/';
  const key = decodeURIComponent(url.pathname.slice(prefix.length));
  const exp = Number(url.searchParams.get('exp'));
  const sig = text(url.searchParams.get('sig'));
  if (!key.startsWith('u/') || !Number.isFinite(exp) || !sig) return new Response('Unauthorized', { status: 401 });
  if (Math.floor(Date.now() / 1000) > exp) return new Response('Expired', { status: 401 });
  if (!text(env.MEDIA_SIGNING_SECRET)) return new Response('Unavailable', { status: 503 });

  const expected = await signValue(env.MEDIA_SIGNING_SECRET, `GET\n${key}\n${exp}`);
  if (!constantTimeEqual(expected, sig)) return new Response('Unauthorized', { status: 401 });

  if (request.method === 'HEAD') {
    const object = await env.MEDIA.head(key);
    if (!object) return new Response('Not Found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Content-Length', String(object.size));
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'private, max-age=300');
    applyCors(headers, origin);
    return new Response(null, { status: 200, headers });
  }

  const object = await env.MEDIA.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!object) return new Response('Not Found', { status: 404 });
  if (!('body' in object)) return new Response(null, { status: 412 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=300');
  if (url.searchParams.get('download') === '1') {
    headers.set('Content-Disposition', 'attachment; filename="SORIDRAW.mp3"');
  }
  let status = 200;
  if (object.range && typeof object.range.offset === 'number' && typeof object.range.length === 'number') {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(object.range.length));
    status = 206;
  } else {
    headers.set('Content-Length', String(object.size));
  }
  applyCors(headers, origin);
  return new Response(object.body, { status, headers });
};

export default {
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);
    const origin = text(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') return handleOptions(request, env);
    if (!isAllowedOrigin(env, origin)) return new Response('Forbidden origin', { status: 403 });

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: 'soridraw-media-preview',
        r2Binding: Boolean(env.MEDIA),
        archiveMinAgeDays: Number(env.ARCHIVE_MIN_AGE_DAYS) || 14,
        automaticWavGeneration: false,
        catalogSchemaVersion: CATALOG_SCHEMA_VERSION,
        catalogDeltaMode: 'base+journal',
        catalogCompactionAfter: 200,
      }, 200, origin);
    }

    if (request.method === 'POST' && url.pathname === '/v1/archive/resolve') {
      return handleArchiveResolve(request, env, origin);
    }

    if ((request.method === 'GET' || request.method === 'POST') && url.pathname.startsWith('/v1/catalog/')) {
      return handleCatalog(request, env, origin, url, executionCtx);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/v1/media/')) {
      return handleMedia(request, env, origin, url);
    }

    return jsonResponse({ ok: false, code: 'NOT_FOUND' }, 404, origin);
  },
};
