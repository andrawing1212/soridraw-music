import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[101/429] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_429_20261019';
if (source.includes(marker)) {
  console.log('[101/429] already applied');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_SHARED_TRACK_CARD_R2_062_20260917',
  'SORIDRAW_MUSIC_NOTE_LEGACY_NEXT_SONG_PARITY_427_20261018',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'readSharedTrackCard062',
  'normalizeSharedTrackCard062',
]) if (!source.includes(required)) throw new Error('[101/429] prerequisite missing: ' + required);

function functionRange(name) {
  const candidates = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const prefix of candidates) { start = source.indexOf(prefix); if (start >= 0) break; }
  if (start < 0) throw new Error('[101/429] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[101/429] unterminated function: ' + name);
}
function wrapAsync(name, suffix, builder) {
  const range = functionRange(name);
  const coreName = name + suffix;
  const renamed = range.text.replace(new RegExp('^async\\s+function\\s+' + name + '\\('), 'async function ' + coreName + '(');
  if (renamed === range.text) throw new Error('[101/429] cannot wrap: ' + name);
  source = source.slice(0, range.start) + renamed + '\n\n' + builder(coreName) + source.slice(range.end);
}

const helperAnchor = functionRange('syncExploreFeedR2Publication043').start;
const helpers=`// ${marker}
const PUBLICATION_STATE_ROUTE_429 = '/v1/publication-cards';
const PUBLICATION_STATE_LIMIT_429 = 50;
const publicationStateKey429 = (trackId) =>
  \`internal/explore/publication-state-v429/\${encodeURIComponent(String(trackId || '').trim())}.json\`;

async function readPublicationState429(env, trackId) {
  const id = String(trackId || '').trim();
  const bucket = env?.PROFILE_MEDIA || null;
  if (!id || !bucket) return null;
  try {
    const object = await bucket.get(publicationStateKey429(id));
    if (!object) return null;
    const bundle = JSON.parse(await object.text());
    if (Number(bundle?.schemaVersion || 0) !== 1 || String(bundle?.trackId || '') !== id) return null;
    const status = bundle?.status === 'public' ? 'public' : bundle?.status === 'private' ? 'private' : '';
    if (!status) return null;
    return {
      trackId: id,
      ownerUid: String(bundle?.ownerUid || '').trim(),
      status,
      updatedAt: Math.max(0, Math.floor(Number(bundle?.updatedAt || 0))),
      card: status === 'public' && bundle?.card && typeof bundle.card === 'object' ? bundle.card : null,
    };
  } catch { return null; }
}
async function writePublicationState429(env, state) {
  const id = String(state?.trackId || '').trim();
  const status = state?.status === 'public' ? 'public' : state?.status === 'private' ? 'private' : '';
  const bucket = env?.PROFILE_MEDIA || null;
  if (!id || !status || !bucket) return false;
  const card = status === 'public' ? normalizeSharedTrackCard062(state?.card) : null;
  if (status === 'public' && !card) return false;
  const ownerUid = String(state?.ownerUid || card?.ownerUid || '').trim();
  const updatedAt = Date.now();
  await bucket.put(publicationStateKey429(id), JSON.stringify({
    schemaVersion: 1, trackId: id, ownerUid, status, updatedAt, ...(card ? { card } : {}),
  }), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawPublicationState: '429', updatedAt: String(updatedAt) },
  });
  return true;
}
function publicationStateHeaders429(cors, r2Reads) {
  const headers = new Headers(cors || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '429');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, Number(r2Reads || 0))));
  headers.set('Access-Control-Expose-Headers',
    'X-SORIDRAW-CF-Diagnostics, X-SORIDRAW-D1-Read, X-SORIDRAW-D1-Write, X-SORIDRAW-R2-B');
  return headers;
}
async function handlePublicationStates429(request, env, cors) {
  const url = new URL(request.url);
  const ids = [...new Set(String(url.searchParams.get('trackIds') || '').split(',').map((value) => value.trim()).filter(Boolean))];
  if (!ids.length || ids.length > PUBLICATION_STATE_LIMIT_429 || ids.some((id) => id.length > 512)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid changed-track request' }), {
      status: 400, headers: publicationStateHeaders429(cors, 0),
    });
  }
  if (!env?.PROFILE_MEDIA) return new Response(JSON.stringify({ ok: false, error: 'Shared public cache unavailable' }), {
    status: 503, headers: publicationStateHeaders429(cors, 0),
  });
  const items = (await Promise.all(ids.map((id) => readPublicationState429(env, id)))).filter(Boolean);
  return new Response(JSON.stringify({ ok: true, data: { items } }), {
    status: 200, headers: publicationStateHeaders429(cors, ids.length),
  });
}

`;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

wrapAsync('syncExploreFeedR2Publication043', 'Core429', (coreName) => `async function syncExploreFeedR2Publication043(env, incomingItem) {
  const result = await ${coreName}(env, incomingItem);
  try {
    const card429 = normalizeSharedTrackCard062(incomingItem);
    if (card429) await writePublicationState429(env, {
      trackId: card429.id, ownerUid: card429.ownerUid, status: 'public', card: card429,
    });
  } catch (error) { console.warn('[429] publication state R2 publish deferred:', String(error?.message || error || 'unknown')); }
  return result;
}`);
wrapAsync('syncExploreFeedR2Private043', 'Core429', (coreName) => `async function syncExploreFeedR2Private043(env, trackId) {
  let priorCard429 = null;
  try { priorCard429 = await readSharedTrackCard062(env, trackId); } catch {}
  const result = await ${coreName}(env, trackId);
  try { await writePublicationState429(env, {
    trackId, ownerUid: String(priorCard429?.ownerUid || ''), status: 'private',
  }); } catch (error) { console.warn('[429] publication private tombstone deferred:', String(error?.message || error || 'unknown')); }
  return result;
}`);
wrapAsync('syncExploreFeedR2OptionPatch043', 'Core429', (coreName) => `async function syncExploreFeedR2OptionPatch043(env, trackId, patch) {
  const result = await ${coreName}(env, trackId, patch);
  try {
    const card429 = await readSharedTrackCard062(env, trackId);
    if (card429) await writePublicationState429(env, {
      trackId: card429.id, ownerUid: card429.ownerUid, status: 'public', card: card429,
    });
  } catch (error) { console.warn('[429] publication option state patch deferred:', String(error?.message || error || 'unknown')); }
  return result;
}`);

const routeAnchor=`    if (url.pathname === "/v1/me/liked-tracks" && request.method === "POST") {
      return await handleMyLikedTracks052(request, env, cors);
    }`;
if (source.split(routeAnchor).length !== 2) throw new Error('[101/429] route anchor changed');
source = source.replace(routeAnchor, `    if (url.pathname === PUBLICATION_STATE_ROUTE_429 && request.method === "GET") {
      return await handlePublicationStates429(request, env, cors);
    }
${routeAnchor}`);
for (const required of [marker,'PUBLICATION_STATE_ROUTE_429','readPublicationState429','writePublicationState429',
  'handlePublicationStates429','syncExploreFeedR2Publication043Core429','syncExploreFeedR2Private043Core429',
  'syncExploreFeedR2OptionPatch043Core429']) if (!source.includes(required)) throw new Error('[101/429] missing: '+required);
const handler = functionRange('handlePublicationStates429').text;
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(handler)) throw new Error('[101/429] route must remain D1-free');
writeFileSync(workerPath, source, 'utf8');
console.log('[101/429] changed-ID RTDB + exact shared-R2 publication state; D1 R0/W0.');
