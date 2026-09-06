import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  importX509,
  jwtVerify,
} from 'jose';

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
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Firebase-AppCheck',
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
  return { uid: auth.uid, idToken };
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
  async fetch(request, env) {
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
      }, 200, origin);
    }

    if (request.method === 'POST' && url.pathname === '/v1/archive/resolve') {
      return handleArchiveResolve(request, env, origin);
    }

    if ((request.method === 'GET' || request.method === 'POST') && url.pathname.startsWith('/v1/catalog/')) {
      return handleCatalog(request, env, origin, url);
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/v1/media/')) {
      return handleMedia(request, env, origin, url);
    }

    return jsonResponse({ ok: false, code: 'NOT_FOUND' }, 404, origin);
  },
};
