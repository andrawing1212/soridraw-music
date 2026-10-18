import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[101/430] Worker directory missing');
const workerPath = join(dir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_PUBLICATION_LIVE_CONVERGENCE_430_20261019';
if (source.includes(marker)) {
  console.log('[101/430] already applied');
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
  if (!source.includes(required)) throw new Error('[101/430] prerequisite missing: ' + required);
}

function functionRange(name) {
  const candidates = ['async function ' + name + '(', 'function ' + name + '('];
  let start = -1;
  for (const prefix of candidates) {
    start = source.indexOf(prefix);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error('[101/430] function missing: ' + name);
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
  throw new Error('[101/430] unterminated function: ' + name);
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
    customMetadata: { soridrawPublicationState: '430', updatedAt: String(updatedAt) },
  });
  return updatedAt;
}

function publicationStateHeaders429(cors, r2Reads) {
  const headers = new Headers(cors || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '430');
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
  if (lastReturn < 0) throw new Error('[101/430] public final response missing');
  const proof = `  let publicationStateUpdatedAt429 = 0;
  try {
    publicationStateUpdatedAt429 = await writePublicationState429(env, {
      trackId: source.id,
      ownerUid: authContext.uid,
      status: 'public',
      card: feedItem,
    });
  } catch (error) {
    console.warn('[430] publication-state public proof unavailable:', String(error?.message || error || 'unknown'));
  }
`;
  body = body.slice(0, lastReturn) + proof + body.slice(lastReturn);
  const anchor = '      snapshotItem: feedItem,\n      mutation:';
  if (body.split(anchor).length !== 2) throw new Error('[101/430] public snapshot response anchor changed');
  body = body.replace(anchor,
    "      snapshotItem: feedItem,\n      ...(publicationStateUpdatedAt429 > 0 ? { publicationStateUpdatedAt429 } : {}),\n      mutation:");
  replaceFunction('handleMusicNotePublicationSingleWrite016', body);
}

{
  const range = functionRange('handleMusicNotePrivate017Core045');
  let body = range.text;
  const finalReturn = body.lastIndexOf('  return json({ ok: true, data:');
  if (finalReturn < 0) throw new Error('[101/430] private final response missing');
  const proof = `  let publicationStateUpdatedAt429 = 0;
  try {
    publicationStateUpdatedAt429 = await writePublicationState429(env, {
      trackId: row.id,
      ownerUid: authContext.uid,
      status: 'private',
    });
  } catch (error) {
    console.warn('[430] publication-state private proof unavailable:', String(error?.message || error || 'unknown'));
  }
`;
  body = body.slice(0, finalReturn) + proof + body.slice(finalReturn);
  const oldReturn='  return json({ ok: true, data: { trackId: row.id, isPublic: false, mutation: "written" } }, 200, cors);';
  const newReturn='  return json({ ok: true, data: { trackId: row.id, isPublic: false, ...(publicationStateUpdatedAt429 > 0 ? { publicationStateUpdatedAt429 } : {}), mutation: "written" } }, 200, cors);';
  if (!body.includes(oldReturn)) throw new Error('[101/430] private response anchor changed');
  body=body.replace(oldReturn,newReturn);
  replaceFunction('handleMusicNotePrivate017Core045', body);
}

{
  const range = functionRange('handleMusicNotePublicationOptions017');
  let body = range.text;
  const finalReturn = body.lastIndexOf('  return json({ ok: true, data: {');
  if (finalReturn < 0) throw new Error('[101/430] option final response missing');
  const proof = `  let publicationStateUpdatedAt429 = 0;
  try {
    if (Number(row.is_public || 0) === 1) {
      const card429 = await readSharedTrackCard062(env, row.id);
      if (card429) publicationStateUpdatedAt429 = await writePublicationState429(env, {
        trackId: row.id,
        ownerUid: authContext.uid,
        status: 'public',
        card: card429,
      });
    } else {
      publicationStateUpdatedAt429 = await writePublicationState429(env, {
        trackId: row.id,
        ownerUid: authContext.uid,
        status: 'private',
      });
    }
  } catch (error) {
    console.warn('[430] publication-state option proof unavailable:', String(error?.message || error || 'unknown'));
  }
`;
  body = body.slice(0, finalReturn) + proof + body.slice(finalReturn);
  const anchor='      profilePinned: next.profilePinned === 1,\n      mutation: "written"';
  if (body.split(anchor).length !== 2) throw new Error('[101/430] option response anchor changed');
  body=body.replace(anchor,
    '      profilePinned: next.profilePinned === 1,\n      ...(publicationStateUpdatedAt429 > 0 ? { publicationStateUpdatedAt429 } : {}),\n      mutation: "written"');
  replaceFunction('handleMusicNotePublicationOptions017', body);
}

{
  const range = functionRange('handleMusicNotePublicationBatch048');
  let body = range.text;
  const responseAnchor='        snapshotItem: data?.snapshotItem || null,\n        mutation:';
  const responseCount=body.split(responseAnchor).length-1;
  if (responseCount < 1 || responseCount > 2) throw new Error('[101/430] batch nested response anchor count=' + responseCount);
  body = body.replaceAll(
    responseAnchor,
    '        snapshotItem: data?.snapshotItem || null,\n        ...(Number(data?.publicationStateUpdatedAt429 || 0) > 0 ? { publicationStateUpdatedAt429: Number(data.publicationStateUpdatedAt429) } : {}),\n        mutation:',
  );
  const derivedAnchor = `            } catch (error) {
              console.warn('[SORIDRAW 049] derived R2 patch deferred to self-heal:', String(error?.message || error || 'unknown'));
            }

            publicationTransitions.push({`;
  if (body.split(derivedAnchor).length !== 2) throw new Error('[101/430] direct batch derived anchor changed');
  body = body.replace(derivedAnchor, `            } catch (error) {
              console.warn('[SORIDRAW 049] derived R2 patch deferred to self-heal:', String(error?.message || error || 'unknown'));
            }

            let publicationStateUpdatedAt429 = 0;
            if (changed) {
              try {
                publicationStateUpdatedAt429 = await writePublicationState429(env, next.isPublic ? {
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
                console.warn('[430] batch publication-state proof unavailable:', String(error?.message || error || 'unknown'));
              }
            }

            publicationTransitions.push({`);
  const directResultAnchor="              snapshotItem,\n              mutation: changed ? 'written' : 'idempotent',";
  if (body.split(directResultAnchor).length !== 2) throw new Error('[101/430] direct batch result anchor changed');
  body=body.replace(directResultAnchor,
    "              snapshotItem,\n              ...(publicationStateUpdatedAt429 > 0 ? { publicationStateUpdatedAt429 } : {}),\n              mutation: changed ? 'written' : 'idempotent',");
  replaceFunction('handleMusicNotePublicationBatch048', body);
}

const routeAnchor = `    if (url.pathname === "/v1/me/liked-tracks" && request.method === "POST") {
      return await handleMyLikedTracks052(request, env, cors);
    }`;
if (source.split(routeAnchor).length !== 2) throw new Error('[101/430] route anchor changed');
source = source.replace(routeAnchor, `    if (url.pathname === PUBLICATION_STATE_ROUTE_429 && request.method === "GET") {
      return await handlePublicationStates429(request, env, cors);
    }
${routeAnchor}`);

for (const required of [
  marker,
  'PUBLICATION_STATE_ROUTE_429',
  'readPublicationState429',
  'writePublicationState429',
  'handlePublicationStates429',
  'publicationStateUpdatedAt429',
  'await requireExploreAuth(request.clone())',
]) {
  if (!source.includes(required)) throw new Error('[101/430] final runtime missing: ' + required);
}
const handler = functionRange('handlePublicationStates429').text;
if (/env\?*\.DB|env\.DB|\.prepare\s*\(/.test(handler)) {
  throw new Error('[101/430] exact publication-state read must remain D1-free');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[101/430] relevant-only publication live sync requires exact post-mutation R2 proof; route D1 R0/W0.');
