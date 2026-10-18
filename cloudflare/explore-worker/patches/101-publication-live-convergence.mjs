import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[101/432] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_432_20261019';
if (source.includes(marker)) {
  console.log('[101/432] already applied');
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
  'handleMusicNotePublicationSingleWrite016',
  'handleMusicNotePrivate017Core045',
  'handleMusicNotePublicationOptions017',
  'handleMusicNotePublicationBatch048',
]) {
  if (!source.includes(required)) throw new Error('[101/432] prerequisite missing: ' + required);
}

function functionRange(name) {
  const candidates = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const prefix of candidates) {
    start = source.indexOf(prefix);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[101/432] function missing: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i], n = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error('[101/432] unterminated function: ' + name);
}

function replaceFunction(name, nextText) {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
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
  if (!id || !status || !bucket) return 0;
  const card = status === 'public' ? normalizeSharedTrackCard062(state?.card) : null;
  if (status === 'public' && !card) return 0;
  const ownerUid = String(state?.ownerUid || card?.ownerUid || '').trim();
  if (!ownerUid) return 0;
  const updatedAt = Date.now();
  await bucket.put(publicationStateKey429(id), JSON.stringify({
    schemaVersion: 1, trackId: id, ownerUid, status, updatedAt, ...(card ? { card } : {}),
  }), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { soridrawPublicationState: '432', updatedAt: String(updatedAt) },
  });
  return updatedAt;
}

const publicationEncoder431 = new TextEncoder();
const publicationHex431 = (bytes) => [...new Uint8Array(bytes)]
  .map((value) => value.toString(16).padStart(2, '0')).join('');
const publicationEndpoint431 = (value) => {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !(url.hostname.endsWith('.cloudfunctions.net') || url.hostname.endsWith('.run.app'))) {
    throw new Error('431_PUBLICATION_RELEASE_TARGET_REFUSED');
  }
  return url.toString();
};
const publicationSign431 = async (raw, secret) => {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('431_PUBLICATION_RELEASE_SECRET_MISSING');
  }
  const key = await crypto.subtle.importKey(
    'raw', publicationEncoder431.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return publicationHex431(await crypto.subtle.sign(
    'HMAC', key, publicationEncoder431.encode(raw),
  ));
};

// app432: send only the display fields needed to paint a new public card.
// Prompt, lyrics and shareBundle never enter the shared realtime signal.
const publicationLiveText432 = (value, max) => {
  const text = String(value ?? '').trim();
  return text.length <= max ? text : text.slice(0, max);
};
const publicationLiveUrl432 = (value) => {
  const text = String(value ?? '').trim();
  return text.length <= 512 ? text : '';
};
const publicationLiveCard432 = (state) => {
  if (state?.status !== 'public') return '';
  const card = normalizeSharedTrackCard062(state?.card);
  if (!card) throw new Error('432_PUBLICATION_LIVE_CARD_MISSING');
  const live = {
    id: publicationLiveText432(card.id, 512),
    ownerUid: publicationLiveText432(card.ownerUid, 128),
    ownerHandle: publicationLiveText432(card.ownerHandle ?? card.owner_handle, 64),
    ownerNickname: publicationLiveText432(card.ownerNickname ?? card.owner_nickname, 80),
    ownerAvatarUrl: publicationLiveUrl432(card.ownerAvatarUrl ?? card.owner_avatar_url),
    title: publicationLiveText432(card.title, 512),
    coverUrl: publicationLiveUrl432(card.coverUrl ?? card.cover_url),
    sunoUrlPrimary: publicationLiveUrl432(card.sunoUrlPrimary ?? card.suno_url_primary),
    durationSeconds: Number.isFinite(Number(card.durationSeconds ?? card.duration_seconds))
      ? Math.max(0, Number(card.durationSeconds ?? card.duration_seconds)) : 0,
    style: publicationLiveText432(card.style, 160),
    primaryGenre: publicationLiveText432(card.primaryGenre ?? card.primary_genre, 80),
    allowNextSongApply: Boolean(card.allowNextSongApply ?? card.allow_next_song_apply),
    allowFollowerSave: Boolean(card.allowFollowerSave ?? card.allow_follower_save),
    likeCount: Math.max(0, Math.floor(Number(card.likeCount ?? card.stats?.likeCount ?? 0))),
    publishedAt: Math.max(0, Math.floor(Number(card.publishedAt ?? card.published_at ?? 0))),
    profilePinned: Boolean(card.profilePinned ?? card.profile_pinned),
  };
  if (!live.id || !live.ownerUid || live.id !== String(state?.trackId || '').trim() ||
      live.ownerUid !== String(state?.ownerUid || '').trim()) {
    throw new Error('432_PUBLICATION_LIVE_CARD_IDENTITY_MISMATCH');
  }
  const json = JSON.stringify(live);
  if (json.length > 4096) throw new Error('432_PUBLICATION_LIVE_CARD_TOO_LARGE');
  return live;
};

async function publishPublicationInvalidation431(env, state, stateUpdatedAt) {
  const trackId = String(state?.trackId || '').trim();
  const ownerUid = String(state?.ownerUid || '').trim();
  const status = state?.status === 'public' ? 'public' : state?.status === 'private' ? 'private' : '';
  if (!trackId || !ownerUid || !status || !Number.isSafeInteger(stateUpdatedAt) || stateUpdatedAt <= 0 ||
      !trackId.startsWith('music_note_' + ownerUid + '_')) {
    throw new Error('431_PUBLICATION_RELEASE_CLAIM_INVALID');
  }
  const endpoint = publicationEndpoint431(env?.SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT);
  const signedAtMs = Date.now();
  const raw = JSON.stringify({
    schemaVersion: 1, trackId, ownerUid, status, stateUpdatedAt, signedAtMs,
  });
  const signature = await publicationSign431(raw, env?.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Soridraw-431-Publication-Signature': signature,
    },
    body: raw,
  });
  const payload = await response.json().catch(() => null);
  const releaseStatus = String(payload?.data?.status || '');
  if (!response.ok || payload?.ok !== true ||
      !['PUBLISHED', 'DUPLICATE', 'STALE'].includes(releaseStatus)) {
    throw new Error('431_PUBLICATION_RELEASE_CALLBACK_NOT_CONFIRMED');
  }
  return releaseStatus;
}
async function writeAndPublishPublicationState431(env, state) {
  const stateUpdatedAt = await writePublicationState429(env, state);
  if (!stateUpdatedAt) return 0;
  try {
    await publishPublicationInvalidation431(env, state, stateUpdatedAt);
  } catch (error) {
    // Canonical mutation + exact R2 projection already succeeded. Keep user
    // mutation successful; existing revision/resume recovery handles callback
    // outages without client-side public RTDB write authority.
    console.warn('[432] publication server invalidation deferred:', String(error?.message || error || 'unknown'));
  }
  return stateUpdatedAt;
}

const PUBLICATION_LIVE_CARD_ROUTE_432 = '/v1/publication-live-card';
const publicationLiveEdgeKey432 = (request, trackId, updatedAt) => {
  const url = new URL('/__soridraw/publication-live-card-v432/' +
    encodeURIComponent(trackId) + '/' + String(updatedAt), new URL(request.url).origin);
  return new Request(url.toString(), { method: 'GET' });
};

async function handlePublicationLiveCard432(request, env, cors) {
  await requireExploreAuth(request.clone());
  const url = new URL(request.url);
  const trackId = String(url.searchParams.get('trackId') || '').trim();
  const updatedAt = Math.floor(Number(url.searchParams.get('updatedAt') || 0));
  if (!trackId || trackId.length > 512 || !Number.isSafeInteger(updatedAt) || updatedAt <= 0) {
    return new Response(JSON.stringify({ ok:false, error:'Invalid live-card request' }), {
      status:400, headers:publicationStateHeaders429(cors,0),
    });
  }
  const edgeKey = publicationLiveEdgeKey432(request, trackId, updatedAt);
  try {
    const hit = await caches.default.match(edgeKey);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set('X-SORIDRAW-Publication-Live-Cache','HIT');
      headers.set('X-SORIDRAW-R2-B','0');
      return new Response(hit.clone().body, { status:200, headers });
    }
  } catch {}

  const state = await readPublicationState429(env, trackId);
  if (!state || state.status !== 'public' || state.updatedAt !== updatedAt || !state.card) {
    return new Response(JSON.stringify({ ok:false, error:'Live card is stale or unavailable' }), {
      status:404, headers:publicationStateHeaders429(cors,1),
    });
  }
  const card = publicationLiveCard432(state);
  const body = JSON.stringify({ ok:true, data:{ item:{ ...card, updatedAt } } });
  const headers = publicationStateHeaders429(cors,1);
  headers.set('Cache-Control','private, no-store');
  headers.set('X-SORIDRAW-Publication-Live-Cache','MISS');
  const response = new Response(body,{status:200,headers});
  try {
    const storedHeaders = new Headers(headers);
    storedHeaders.set('Cache-Control','public, max-age=300, immutable');
    storedHeaders.set('X-SORIDRAW-Publication-Live-Cache','EDGE');
    await caches.default.put(edgeKey,new Response(body,{status:200,headers:storedHeaders}));
  } catch {}
  return response;
}

function publicationStateHeaders429(cors, r2Reads) {
  const headers = new Headers(cors || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '432');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, Number(r2Reads || 0))));
  headers.set('Access-Control-Expose-Headers',
    'X-SORIDRAW-CF-Diagnostics, X-SORIDRAW-D1-Read, X-SORIDRAW-D1-Write, X-SORIDRAW-R2-B');
  return headers;
}

async function handlePublicationStates429(request, env, cors) {
  await requireExploreAuth(request.clone());
  const url = new URL(request.url);
  const ids = [...new Set(String(url.searchParams.get('trackIds') || '')
    .split(',').map((value) => value.trim()).filter(Boolean))];
  if (!ids.length || ids.length > PUBLICATION_STATE_LIMIT_429 || ids.some((id) => id.length > 512)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid changed-track request' }), {
      status: 400, headers: publicationStateHeaders429(cors, 0),
    });
  }
  if (!env?.PROFILE_MEDIA) {
    return new Response(JSON.stringify({ ok: false, error: 'Shared public cache unavailable' }), {
      status: 503, headers: publicationStateHeaders429(cors, 0),
    });
  }
  const items = (await Promise.all(ids.map((id) => readPublicationState429(env, id)))).filter(Boolean);
  return new Response(JSON.stringify({ ok: true, data: { items } }), {
    status: 200, headers: publicationStateHeaders429(cors, ids.length),
  });
}

`;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

{
  const range = functionRange('handleMusicNotePublicationSingleWrite016');
  let body = range.text;
  const lastReturn = body.lastIndexOf('  return json({');
  if (lastReturn < 0) throw new Error('[101/432] public final response missing');
  const projection = `  try {
    await writeAndPublishPublicationState431(env, {
      trackId: source.id,
      ownerUid: authContext.uid,
      status: 'public',
      card: feedItem,
    });
  } catch (error) {
    console.warn('[432] publication-state public projection unavailable:', String(error?.message || error || 'unknown'));
  }
`;
  body = body.slice(0, lastReturn) + projection + body.slice(lastReturn);
  replaceFunction('handleMusicNotePublicationSingleWrite016', body);
}

{
  const range = functionRange('handleMusicNotePrivate017Core045');
  let body = range.text;
  const finalReturn = body.lastIndexOf('  return json({ ok: true, data:');
  if (finalReturn < 0) throw new Error('[101/432] private final response missing');
  const projection = `  try {
    await writeAndPublishPublicationState431(env, {
      trackId: row.id,
      ownerUid: authContext.uid,
      status: 'private',
    });
  } catch (error) {
    console.warn('[432] publication-state private projection unavailable:', String(error?.message || error || 'unknown'));
  }
`;
  body = body.slice(0, finalReturn) + projection + body.slice(finalReturn);
  replaceFunction('handleMusicNotePrivate017Core045', body);
}

{
  const range = functionRange('handleMusicNotePublicationOptions017');
  let body = range.text;
  const finalReturn = body.lastIndexOf('  return json({ ok: true, data: {');
  if (finalReturn < 0) throw new Error('[101/432] option final response missing');
  const projection = `  try {
    if (Number(row.is_public || 0) === 1) {
      const card429 = await readSharedTrackCard062(env, row.id);
      if (card429) await writeAndPublishPublicationState431(env, {
        trackId: row.id,
        ownerUid: authContext.uid,
        status: 'public',
        card: card429,
      });
    } else {
      await writeAndPublishPublicationState431(env, {
        trackId: row.id,
        ownerUid: authContext.uid,
        status: 'private',
      });
    }
  } catch (error) {
    console.warn('[432] publication-state option projection unavailable:', String(error?.message || error || 'unknown'));
  }
`;
  body = body.slice(0, finalReturn) + projection + body.slice(finalReturn);
  replaceFunction('handleMusicNotePublicationOptions017', body);
}

{
  const range = functionRange('handleMusicNotePublicationBatch048');
  let body = range.text;
  const derivedAnchor = `            } catch (error) {
              console.warn('[SORIDRAW 049] derived R2 patch deferred to self-heal:', String(error?.message || error || 'unknown'));
            }

            publicationTransitions.push({`;
  if (body.split(derivedAnchor).length !== 2) throw new Error('[101/432] direct batch derived anchor changed');
  body = body.replace(derivedAnchor, `            } catch (error) {
              console.warn('[SORIDRAW 049] derived R2 patch deferred to self-heal:', String(error?.message || error || 'unknown'));
            }

            if (changed) {
              try {
                await writeAndPublishPublicationState431(env, next.isPublic ? {
                  trackId: row.id,
                  ownerUid: authContext.uid,
                  status: 'public',
                  card: snapshotItem,
                } : {
                  trackId: row.id,
                  ownerUid: authContext.uid,
                  status: 'private',
                });
              } catch (error) {
                console.warn('[431] batch publication-state projection unavailable:', String(error?.message || error || 'unknown'));
              }
            }

            publicationTransitions.push({`);
  replaceFunction('handleMusicNotePublicationBatch048', body);
}

const routeAnchor = `    if (url.pathname === "/v1/me/liked-tracks" && request.method === "POST") {
      return await handleMyLikedTracks052(request, env, cors);
    }`;
if (source.split(routeAnchor).length !== 2) throw new Error('[101/432] route anchor changed');
source = source.replace(routeAnchor, `    if (url.pathname === PUBLICATION_LIVE_CARD_ROUTE_432 && request.method === "GET") {
      return await handlePublicationLiveCard432(request, env, cors);
    }
    if (url.pathname === PUBLICATION_STATE_ROUTE_429 && request.method === "GET") {
      return await handlePublicationStates429(request, env, cors);
    }
${routeAnchor}`);

for (const required of [
  marker,
  'PUBLICATION_STATE_ROUTE_429',
  'readPublicationState429',
  'handlePublicationLiveCard432',
  'writeAndPublishPublicationState431',
  'X-Soridraw-431-Publication-Signature',
  'SORIDRAW_PUBLICATION_RELEASE431_ENDPOINT',
  'await requireExploreAuth(request.clone())',
]) {
  if (!source.includes(required)) throw new Error('[101/432] final runtime missing: ' + required);
}
const handler = functionRange('handlePublicationStates429').text;
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(handler)) {
  throw new Error('[101/432] exact publication-state read must remain D1-free');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[101/432] tiny RTDB invalidation + shared Edge live-card cache; exact routes D1 R0/W0.');
