import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_PAGE_EXIT_PUBLICATION_BATCH_048_20260914';
if (source.includes(MARKER)) {
  console.log('[048] publication page-exit batch already applied.');
  process.exit(0);
}
for (const required of [
  'SORIDRAW_PUBLICATION_STATE_TRANSITION_047_20260913',
  'async function handlePublication(',
  'async function handleVisibility(',
  'invalidateExploreFeedEdgeCache',
  'musicNotePublicationR2Key',
]) {
  if (!source.includes(required)) throw new Error(`[048] prerequisite missing: ${required}`);
}

const helperAnchor = 'async function handleLikeBatch034(request, env, cors) {';
if (!source.includes(helperAnchor)) throw new Error('[048] helper anchor missing');

const helper = String.raw`
function pageSyncPublicationOptions048(value) {
  return {
    allowNextSongApply: Boolean(value?.allowNextSongApply),
    allowFollowerSave: Boolean(value?.allowFollowerSave),
    profilePinned: Boolean(value?.profilePinned),
  };
}

function pageSyncPublicationRequest048(request, method, payload) {
  const headers = new Headers(request.headers);
  headers.set('Content-Type', 'application/json');
  return new Request(request.url, {
    method,
    headers,
    body: JSON.stringify(payload),
  });
}

async function handleMusicNotePublicationBatch048(request, env, cors) {
  const authContext = await requireExploreAuth(request.clone());
  let body = null;
  try { body = await request.json(); } catch { throwApi('INVALID_BODY', '공개상태 묶음 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.mutations) ? body.mutations : [];
  if (!raw.length) return json({ ok: true, data: { results: [], revision: null } }, 200, cors);
  if (raw.length > 50) throwApi('TOO_MANY_PUBLICATIONS', '한 번에 처리할 수 있는 공개상태 변경 수를 초과했습니다.', 400);

  const bySource = new Map();
  for (const value of raw) {
    const sourceId = String(value?.sourceId || '').trim();
    const trackId = String(value?.trackId || '').trim();
    const status = value?.status === 'public' ? 'public' : 'private';
    const registered = value?.registered === true;
    const mutationAt = Math.max(0, Math.floor(Number(value?.mutationAt || 0)));
    if (!sourceId || !trackId) throwApi('INVALID_PUBLICATION', '공개상태 변경 대상이 올바르지 않습니다.', 400);
    bySource.set(sourceId, {
      sourceId,
      trackId,
      status,
      registered,
      mutationAt,
      options: pageSyncPublicationOptions048(value?.options),
    });
  }

  const results = [];
  let changedAny = false;
  for (const mutation of bySource.values()) {
    if (!mutation.registered && mutation.status === 'private') {
      results.push({
        ok: true,
        sourceId: mutation.sourceId,
        trackId: mutation.trackId,
        status: 'private',
        registered: false,
        ...mutation.options,
        mutation: 'net-zero',
      });
      continue;
    }

    try {
      let response;
      if (!mutation.registered) {
        response = await handlePublication(
          pageSyncPublicationRequest048(request, 'POST', {
            sourceType: 'music_note',
            sourceId: mutation.sourceId,
            ...mutation.options,
          }),
          env,
          cors,
        );
      } else {
        response = await handleVisibility(
          pageSyncPublicationRequest048(request, 'PATCH', {
            isPublic: mutation.status === 'public',
            ...mutation.options,
          }),
          env,
          cors,
          mutation.trackId,
        );
      }
      const payload = await response.clone().json().catch(() => null);
      if (!response.ok) {
        results.push({
          ok: false,
          sourceId: mutation.sourceId,
          trackId: mutation.trackId,
          status: mutation.status,
          registered: mutation.registered,
          error: String(payload?.message || payload?.error?.message || payload?.error || ('HTTP_' + response.status)),
        });
        continue;
      }
      const data = payload?.data || {};
      const status = mutation.registered
        ? (Boolean(data?.isPublic) ? 'public' : 'private')
        : 'public';
      results.push({
        ok: true,
        sourceId: mutation.sourceId,
        trackId: String(data?.trackId || mutation.trackId),
        status,
        registered: true,
        allowNextSongApply: Boolean(data?.allowNextSongApply ?? mutation.options.allowNextSongApply),
        allowFollowerSave: Boolean(data?.allowFollowerSave ?? mutation.options.allowFollowerSave),
        profilePinned: Boolean(data?.profilePinned ?? mutation.options.profilePinned),
        snapshotItem: data?.snapshotItem || null,
        mutation: String(data?.mutation || 'written'),
      });
      changedAny = changedAny || String(data?.mutation || 'written') !== 'idempotent';
    } catch (error) {
      results.push({
        ok: false,
        sourceId: mutation.sourceId,
        trackId: mutation.trackId,
        status: mutation.status,
        registered: mutation.registered,
        error: String(error?.message || error || 'PUBLICATION_BATCH_FAILED'),
      });
    }
  }

  if (changedAny) {
    try { await invalidateExploreFeedEdgeCache(request); } catch (error) {
      console.warn('[SORIDRAW 048] feed edge invalidation skipped:', String(error?.message || error || 'unknown'));
    }
  }

  let revision = null;
  try {
    if (env?.PROFILE_MEDIA) {
      const object = await env.PROFILE_MEDIA.head(musicNotePublicationR2Key(authContext.uid));
      revision = object
        ? String(object.httpEtag || object.etag || object.customMetadata?.updatedAt || '') || null
        : null;
    }
  } catch (error) {
    console.warn('[SORIDRAW 048] publication revision head skipped:', String(error?.message || error || 'unknown'));
  }

  return json({ ok: true, data: { results, revision } }, 200, cors);
}
`;
source = source.replace(helperAnchor, helper + '\n' + helperAnchor);

const routeAnchor = `    if (url.pathname === "/v1/me/likes/batch" && request.method === "POST") {\n      return await handleLikeBatch034(request, env, cors);\n    }`;
if (!source.includes(routeAnchor)) throw new Error('[048] dispatch anchor missing');
source = source.replace(routeAnchor, `    if (url.pathname === "/v1/me/music-note-publications/batch" && request.method === "POST") {\n      return await handleMusicNotePublicationBatch048(request, env, cors);\n    }\n${routeAnchor}`);

source += `\n// ${MARKER}\n`;
writeFileSync(workerPath, source, 'utf8');
console.log('[048] one external page-exit request now batches final Music Note publication states.');
