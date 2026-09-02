import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PROFILE_REVISION_REVALIDATION_007';
if (source.includes(marker)) {
  console.log('[SORIDRAW Worker] profile revision revalidation already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needle = `async function ${name}(`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`007 function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`007 function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
    }
  }
  throw new Error(`007 unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const edgeAnchor = 'async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {';
if (!source.includes(edgeAnchor)) throw new Error('007 first-view edge anchor missing');
if (!source.includes('readPublicProfileFirstViewRowByPrimaryKey')) throw new Error('007 requires profile PK patch 005');

const helpers = `// ${marker}
function normalizePublicProfileRevision(value) {
  const normalized = String(value ?? '').trim();
  return /^\\d+$/.test(normalized) ? normalized : '';
}

async function readPublicProfileFirstViewRevisionOnly(env, profileRef) {
  const normalized = String(profileRef || '').trim().replace(/^@+/, '');
  if (!normalized) return null;
  let row = await env.DB.prepare(\`
    SELECT uid, handle, revision, updated_at
    FROM public_profile_first_views
    WHERE uid = ?
    LIMIT 1
  \`).bind(normalized).first();
  if (row) return row;
  return await env.DB.prepare(\`
    SELECT uid, handle, revision, updated_at
    FROM public_profile_first_views
    WHERE handle = ? COLLATE NOCASE
    LIMIT 1
  \`).bind(normalized).first();
}

async function readPublicProfileFirstViewRevisionFromResponse(response) {
  const headerRevision = normalizePublicProfileRevision(response?.headers?.get('X-SORIDRAW-Profile-Revision'));
  if (headerRevision) return headerRevision;
  try {
    const payload = await response.clone().json();
    return normalizePublicProfileRevision(payload?.data?.revision ?? payload?.data?.snapshot?.revision);
  } catch {
    return '';
  }
}

function withPublicProfileRevisionHeaders(response, revision, validationMode) {
  const normalizedRevision = normalizePublicProfileRevision(revision);
  const headers = new Headers(response.headers);
  if (normalizedRevision) {
    headers.set('X-SORIDRAW-Profile-Revision', normalizedRevision);
    headers.set('ETag', '"soridraw-profile-' + normalizedRevision + '"');
  }
  if (validationMode) headers.set('X-SORIDRAW-Profile-Validation', String(validationMode));
  const expose = new Set(String(headers.get('Access-Control-Expose-Headers') || '').split(',').map((item) => item.trim()).filter(Boolean));
  expose.add('X-SORIDRAW-Profile-Revision');
  expose.add('X-SORIDRAW-Profile-Validation');
  expose.add('ETag');
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function makePublicProfileFirstViewNotModified(baseResponse, revision, edgeStatus, validationMode, cors) {
  const headers = new Headers(baseResponse?.headers || cors || {});
  headers.delete('Content-Length');
  headers.delete('Content-Type');
  const empty = new Response(null, { status: 304, headers });
  return withPublicProfileRevisionHeaders(
    withPublicProfileFirstViewEdgeHeader(empty, edgeStatus),
    revision,
    validationMode
  );
}

`;
source = source.replace(edgeAnchor, helpers + edgeAnchor);

replaceFunction('handlePublicProfileFirstViewWithEdgeCache', `async function handlePublicProfileFirstViewWithEdgeCache(request, profileRef, env, cors) {
  const cache = caches.default;
  const requestOrigin = request.headers.get('Origin') || '';
  const requestUrl = new URL(request.url);
  const knownRevision = normalizePublicProfileRevision(requestUrl.searchParams.get('knownRevision'));
  const key = getPublicProfileFirstViewEdgeCacheKey(request.url, profileRef, requestOrigin);
  const cached = await cache.match(key);

  if (cached) {
    const cachedRevision = await readPublicProfileFirstViewRevisionFromResponse(cached);
    if (knownRevision && cachedRevision && knownRevision === cachedRevision) {
      return makePublicProfileFirstViewNotModified(cached, cachedRevision, 'HIT', 'NOT_MODIFIED_EDGE', cors);
    }
    const knownNumber = Number(knownRevision || 0);
    const cachedNumber = Number(cachedRevision || 0);
    if (!knownRevision || !cachedRevision || cachedNumber >= knownNumber) {
      return withPublicProfileRevisionHeaders(
        withPublicProfileFirstViewEdgeHeader(cached, 'HIT'),
        cachedRevision,
        knownRevision ? 'UPDATED_EDGE' : 'FULL_EDGE'
      );
    }
    // A client can occasionally know a newer revision than a stale POP cache.
    // In that case never downgrade the client: bypass the cached payload.
  }

  if (knownRevision) {
    try {
      const revisionRow = await readPublicProfileFirstViewRevisionOnly(env, profileRef);
      const liveRevision = normalizePublicProfileRevision(revisionRow?.revision);
      if (liveRevision && liveRevision === knownRevision) {
        return makePublicProfileFirstViewNotModified(null, liveRevision, 'MISS', 'NOT_MODIFIED_D1_REVISION', cors);
      }
    } catch (error) {
      const message = String(error?.message || error || '');
      if (!message.includes('no such table') && !message.includes('public_profile_first_views')) throw error;
    }
  }

  const live = await handlePublicProfileFirstViewSnapshot(profileRef, env, cors);
  if (!live.ok) return live;
  const liveRevision = await readPublicProfileFirstViewRevisionFromResponse(live);
  const cacheable = withPublicProfileRevisionHeaders(
    withPublicProfileFirstViewEdgeHeader(live, 'MISS'),
    liveRevision,
    knownRevision ? 'UPDATED_D1' : 'FULL_D1'
  );
  await cache.put(key, cacheable.clone());
  return cacheable;
}`);

writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] profile revision/ETag revalidation patch applied.');
