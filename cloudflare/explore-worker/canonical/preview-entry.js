import { DurableObject } from 'cloudflare:workers';
import {
  CURATED_SHARED_KEY_466, sharedCuratedEnabled466 as curatedFlagEnabled466, curatedAllWritersReady466, curatedSnapshotRevision466,
  getCuratedShared466, reconcileCuratedShared466, readCanonicalCurated466,
} from '../runtime/curated-shared-canonical-466.mjs';
import {
  CURATED_REPAIR_KEY_468, reserveCuratedRepair468, confirmCuratedRepair468,
  acknowledgeCuratedRepair468, drainCuratedRepair468, armCuratedRepairAlarm468,
  CURATED_REPAIR_WAKE_MS_468,
} from '../runtime/curated-projection-repair-468.mjs';
import baseWorker from './preview-worker.js';
import {verifyPrivateHmac416,validatePrivateHandoff416,acceptPrivateHandoff416} from '../runtime/like-private-batch-handoff-416.mjs';
import {finalizePrivateHandoff416} from '../runtime/like-private-finalize-416.mjs';
import {ackPublicLikeEventStorage416,registerPublicLikeEventStorage416,
 PUBLIC_LIKE_WINDOW_KEY_416,stagePublicLikeOpenPayload416,
 joinPublicLikeChangedTracks416,mergePendingPublicLikeOpen416}
 from '../runtime/public-like-window-416.mjs';
import {releaseDuePublicLikeWindow416}
 from '../runtime/public-like-release-416.mjs';
import {releaseDueCommonPublicLikeWindow448}
 from '../runtime/common-public-like-release-448.mjs';
import {PUBLIC_LIKE_MANIFEST_ROUTE_416,validatePublicLikeManifestMetadata416,
 readPublicLikeManifest416,intersectPublicLikeManifest416}
 from '../runtime/public-like-manifest-416.mjs';
import {registerPrivateClick416,commitPrivateWindow416} from '../runtime/private-like-d1-writer-416.mjs';
import { createCandidateLikeBatch422 } from '../runtime/like-batch-composition-422.mjs';
import { readAuthoritativeLikeIntents433 } from '../runtime/like-legacy-intent-reconcile-433.mjs';
import { verifyGuardedLikeBatch420 } from '../runtime/like-guard-permit-420.mjs';

// SORIDRAW_EXPLORE_REVISION_HEAD_ONLY_036_20260911
// SORIDRAW_EXPLORE_REVISION_HEAD_LOW_READ_037_20260911
// SORIDRAW_EXPLORE_FEED_DELTA_068_20260912
// SORIDRAW_EXPLORE_R2_REVISION_HEAD_077_20260913
// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_103_20260916
// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_105_20260916
// SORIDRAW_EXPLORE_R2_SNAPSHOT_BOOTSTRAP_108_20260916
// SORIDRAW_SHARED_FEED_R2_READ_112_20260917
//
// 077: revision checks never open D1. The first-page Feed R2 object's ETag is the
// revision. A mutation that changes the cached Feed changes the ETag; unchanged
// reconnects are one tiny R2 HEAD (or edge hit) and D1 R0/W0.
//
// 103: the fixed 10-minute cron was replaced by one shared Durable Object alarm.
// 192: the existing client already batches likes for 30 seconds. Once that W1
// batch is accepted, settle the shared public projection five seconds later so
// another account's event-driven changed-card refresh does not wait a full minute.
// More batches joining the same window do not move the deadline. No likes means
// no alarm and no periodic aggregate execution.
//
// 108: first-page Feed cache recovery reads the already-materialized R2 snapshot
// directly. It never opens D1. The R2 ETag/revision is part of the edge key, so
// many clients recovering the same snapshot share one edge body without polling.
const REVISION_HEAD_CACHE_SECONDS_077 = 60;
const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 5 * 1000;
const COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448 = true;
const COMMON_PUBLIC_LIKE_CONFIG_ENDPOINT_448 =
  'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicLikeWindowConfig448Candidate';
const COMMON_PUBLIC_LIKE_MINUTES_448 = new Set([1, 3, 5, 10, 20]);
const EXPLORE_LIKE_BATCH_ROUTE_103 = '/v1/me/likes/batch';
const EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103 = 'shared-like-batch';
const EXPLORE_FEED_R2_SNAPSHOT_QUERY_108 = '__soridraw_r2_only';
const EXPLORE_FEED_R2_SNAPSHOT_REVISION_QUERY_108 = '__soridraw_r2_revision';
const EXPLORE_FEED_R2_SNAPSHOT_VERSION_108 = '108';
const EXPLORE_FEED_R2_SNAPSHOT_EDGE_SECONDS_108 = 5 * 60;
const EXPLORE_SHARED_FEED_R2_VERSION_112 = '112';
const sharedFeedR2Key112 = (sort) => `internal/explore/shared-feed-v112/${sort === 'popular' ? 'popular' : 'latest'}-40.json`;

// SORIDRAW_EXPLICIT_CURATED_MANAGEMENT_307_20261003
// SORIDRAW_CURATED_R2_LOCAL_FIRST_307_20261003
const SORIDRAW_CURATED_COLLECTION_307 = 'soridraw';
const SORIDRAW_CURATED_R2_KEY_307 = 'internal/explore/curated-v307/soridraw-40.json';
const SORIDRAW_CURATED_EDGE_SECONDS_307 = 5 * 60;
const SORIDRAW_FIREBASE_PROJECT_307 = 'soridraw-app-866a5';

function curationCors307(request) {
  const origin = String(request.headers.get('Origin') || '');
  if (!RELEASE_ALLOWED_ORIGINS_036.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck',
    'Vary': 'Origin',
  };
}

function curationHeaders307(request, {
  d1Read = 0,
  d1Write = 0,
  r2A = 0,
  r2B = 0,
  revision = '',
  source = 'CURATION-307',
} = {}) {
  const headers = new Headers(curationCors307(request));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '307');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', String(Math.max(0, d1Read)));
  headers.set('X-SORIDRAW-D1-Write', String(Math.max(0, d1Write)));
  headers.set('X-SORIDRAW-D1-Read-Queries', String(d1Read > 0 ? 1 : 0));
  headers.set('X-SORIDRAW-D1-Write-Queries', String(d1Write > 0 ? 1 : 0));
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', String(Math.max(0, r2A)));
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, r2B)));
  if (revision) headers.set('X-SORIDRAW-Curated-Revision', revision);
  headers.set('X-SORIDRAW-Curated-Source', source);
  headers.set('Access-Control-Expose-Headers', [
    'X-SORIDRAW-CF-Diagnostics','X-SORIDRAW-CF-Worker',
    'X-SORIDRAW-D1-Read','X-SORIDRAW-D1-Write',
    'X-SORIDRAW-D1-Read-Queries','X-SORIDRAW-D1-Write-Queries','X-SORIDRAW-D1-Other-Queries',
    'X-SORIDRAW-R2-A','X-SORIDRAW-R2-B','X-SORIDRAW-Curated-Revision','X-SORIDRAW-Curated-Source',
  ].join(', '));
  return headers;
}

// SORIDRAW_CURATED_PRODUCTION_R2_FALLBACK_356_20261006
// PREVIEW/TEST have an environment-local EXPLORE_CACHE binding. PRODUCTION
// intentionally uses PROFILE_MEDIA as its derived Explore-cache fallback.
const curatedBucket307 = (env) => env?.EXPLORE_CACHE || env?.PROFILE_MEDIA || null;
const curatedRevision307 = (object) => String(
  object?.httpEtag
  || object?.etag
  || object?.customMetadata?.updatedAt
  || (object?.uploaded && typeof object.uploaded.getTime === 'function' ? object.uploaded.getTime() : '')
  || '',
).trim();
const curatedRevisionEdgeKey307 = (url) =>
  new Request(new URL('/__soridraw/curated-revision-v307/soridraw', url.origin).toString(), { method: 'GET' });
const curatedBodyEdgeKey307 = (url, revision, limit) => {
  const edge = new URL('/__soridraw/curated-body-v307/soridraw', url.origin);
  edge.searchParams.set('revision', String(revision || 'none'));
  edge.searchParams.set('limit', String(limit));
  return new Request(edge.toString(), { method: 'GET' });
};
const curatedStableBodyEdgeKey307 = (url) =>
  new Request(new URL('/__soridraw/curated-body-v307/soridraw-20', url.origin).toString(), { method: 'GET' });

async function clearCuratedEdge307(url) {
  try { await caches.default.delete(curatedRevisionEdgeKey307(url)); } catch {}
  try { await caches.default.delete(curatedStableBodyEdgeKey307(url)); } catch {}
}

// Source-only compatibility fence for a mixed-runtime three-origin release.
// An app377 Worker can still mutate D1 without updating the new v466 shared
// R2 key; v466 must not become readable on PREVIEW during that period.
// This separate value is an operator ATTESTATION after all three actual
// writers (including visibility/publication) are upgraded and verified.
// It is never checked into wrangler config or auto-enabled by a code deploy.
// Keep this guard on ALL v466 read AND mutation routes.
const sharedCuratedEnabled466 = (env) =>
  curatedFlagEnabled466(env)
  && curatedAllWritersReady466(env);

// SORIDRAW_CURATED_CROSS_ENV_SHARED_V466 — OFF until reviewed release configuration.
// v307 environment-local caches stay intact and untouched. When enabled, public
// revision/list, manager list and mutation repair use the same versioned R2
// snapshot in PROFILE_MEDIA. Old TEST/PRODUCTION read their untouched v307 key.
// Do NOT enable during a mixed-version release without a parity/rollback plan.
const curatedRevisionEdgeKey466 = (url) =>
  new Request(new URL('/__soridraw/curated-revision-v466/soridraw', url.origin), { method: 'GET' });
const curatedBodyEdgeKey466 = (url, revision, limit) => {
  const u = new URL('/__soridraw/curated-body-v466/soridraw', url.origin);
  u.searchParams.set('revision', String(revision || 'none'));
  u.searchParams.set('limit', String(limit));
  return new Request(u, { method: 'GET' });
};

async function clearCuratedSharedEdge466(url) {
  try { await caches.default.delete(curatedRevisionEdgeKey466(url)); } catch {}
}

async function resolveSharedCuratedTrack466(request, env, ctx, id) {
  const detailUrl = new URL('/v1/tracks/' + encodeURIComponent(id), request.url);
  const res = await baseWorker.fetch(new Request(detailUrl, {
    method: 'GET', headers: { Origin: request.headers.get('Origin') || '' },
  }), env, ctx);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.data?.track || null;
}

async function refreshCuratedShared466(request, env, ctx, forceTrackIds = []) {
  const result = await reconcileCuratedShared466(
    env, (id) => resolveSharedCuratedTrack466(request, env, ctx, id),
    { forceTrackIds },
  );
  if (result.ok) await clearCuratedSharedEdge466(new URL(request.url));
  return result;
}

async function readCuratedShared466(request, env, ctx) {
  let selected = await getCuratedShared466(env);
  if (!selected.object) {
    const refreshed = await refreshCuratedShared466(request, env, ctx);
    if (!refreshed.ok)
      return { object: null, payload: null, memberIds: [], r2Reads: 1, d1Read: 0, source: 'CURATED-SHARED-UNAVAILABLE-466' };
    selected = { object: refreshed.object, snapshot: refreshed.snapshot };
  }
  if (!selected.snapshot)
    return { object: null, payload: null, memberIds: [], r2Reads: 1, d1Read: 0, source: 'CURATED-SHARED-CORRUPT-466' };
  return {
    object: selected.object, payload: selected.snapshot.payload,
    memberIds: selected.snapshot.memberIds, r2Reads: 1, d1Read: 0,
    source: 'SHARED-R2-CURATED-466',
  };
}

async function handleCuratedSharedRevision466(request, env) {
  if (!env?.PROFILE_MEDIA || !env?.DB) {
    return new Response(JSON.stringify({
      ok: false, error: 'Shared curated binding missing',
    }), { status: 503, headers: curationHeaders307(request, { source: 'SHARED-BINDING-MISSING-466' }) });
  }
  const url = new URL(request.url);
  const edgeKey = curatedRevisionEdgeKey466(url);
  try {
    const cached = await caches.default.match(edgeKey);
    if (cached) {
      const revision = String(await cached.text() || '').trim();
      if (revision) return new Response(JSON.stringify({
        ok: true, data: { collection: SORIDRAW_CURATED_COLLECTION_307, revision, exists: true },
      }), { status: 200, headers: curationHeaders307(request, { revision, source: 'EDGE-SHARED-CURATED-466' }) });
    }
  } catch {}
  const head = await env.PROFILE_MEDIA.head(CURATED_SHARED_KEY_466);
  const revision = curatedSnapshotRevision466(head);
  if (revision) {
    try {
      await caches.default.put(edgeKey, new Response(revision, {
        headers: { 'Cache-Control': 'public, max-age=5' },
      }));
    } catch {}
  }
  return new Response(JSON.stringify({
    ok: true, data: { collection: SORIDRAW_CURATED_COLLECTION_307, revision, exists: Boolean(revision) },
  }), {
    status: 200, headers: curationHeaders307(request, {
      r2B: 1, revision, source: revision ? 'SHARED-R2-CURATED-HEAD-466' : 'SHARED-R2-CURATED-COLD-466',
    }),
  });
}

async function handleCuratedSharedPublic466(request, env, ctx) {
  const url = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || 20)));
  // v466 reads the small Edge-cached shared revision before opening the R2
  // body. Healthy unchanged repeat visits are Edge body hits, not R2 GETs.
  const signal = await handleCuratedSharedRevision466(request, env);
  if (!signal.ok) return signal;
  const signalPayload = await signal.json().catch(() => null);
  const signalRevision = String(signalPayload?.data?.revision || '').trim();
  if (signalRevision) {
    const cachedKey = curatedBodyEdgeKey466(url, signalRevision, limit);
    try {
      const cached = await caches.default.match(cachedKey);
      if (cached) return new Response(await cached.text(), {
        status: 200, headers: curationHeaders307(request, {
          revision: signalRevision, source: 'EDGE-SHARED-CURATED-BODY-466',
        }),
      });
    } catch {}
  }
  const selected = await readCuratedShared466(request, env, ctx);
  if (!Array.isArray(selected.payload?.data?.items))
    return new Response(JSON.stringify({ ok: false, error: 'SORIDRAW 추천곡이 동기화되지 않았습니다.' }), {
      status: 503, headers: curationHeaders307(request, { source: selected.source }),
    });
  const revision = curatedSnapshotRevision466(selected.object);
  const key = curatedBodyEdgeKey466(url, revision, limit);
  try {
    const cached = await caches.default.match(key);
    if (cached) return new Response(await cached.text(), {
      status: 200, headers: curationHeaders307(request, { revision, source: 'EDGE-SHARED-CURATED-466' }),
    });
  } catch {}
  const body = JSON.stringify({
    ...selected.payload,
    data: {
      ...selected.payload.data, revision, collection: SORIDRAW_CURATED_COLLECTION_307,
      items: selected.payload.data.items.slice(0, limit),
    },
  });
  try {
    await caches.default.put(key, new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-SORIDRAW-Curated-Revision': revision,
      },
    }));
  } catch {}
  return new Response(body, {
    status: 200, headers: curationHeaders307(request, {
      revision, source: selected.source, r2B: selected.r2Reads,
    }),
  });
}

async function validateExploreAuth307(request, env, ctx) {
  const authUrl = new URL('/auth-test', request.url);
  const authRequest = new Request(authUrl.toString(), { method: 'POST', headers: request.headers });
  const response = await baseWorker.fetch(authRequest, env, ctx);
  const payload = await response.clone().json().catch(() => null);
  if (!response.ok || payload?.authenticated !== true || !payload?.uid) {
    return {
      ok: false,
      response: new Response(JSON.stringify({
        ok: false,
        error: { code: 'AUTHENTICATION_REQUIRED', message: '인증이 필요합니다.' },
      }), {
        status: response.status === 403 ? 403 : 401,
        headers: curationHeaders307(request, { source: 'AUTH-REJECTED-307' }),
      }),
    };
  }
  return {
    ok: true,
    uid: String(payload.uid),
    idToken: String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim(),
    appCheckToken: String(request.headers.get('X-Firebase-AppCheck') || '').trim(),
  };
}

async function readOwnStaffProfile307(actor) {
  const url = `https://firestore.googleapis.com/v1/projects/${SORIDRAW_FIREBASE_PROJECT_307}/databases/(default)/documents/users/${encodeURIComponent(actor.uid)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${actor.idToken}`,
      'X-Firebase-AppCheck': actor.appCheckToken,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return { role: '', staffRole: '' };
  const doc = await response.json().catch(() => null);
  const fields = doc?.fields || {};
  return {
    role: String(fields?.role?.stringValue || '').trim().toLowerCase(),
    staffRole: String(fields?.staffRole?.stringValue || '').trim().toLowerCase(),
  };
}

async function resolveExploreManagementAccess307(request, env, ctx) {
  const actor = await validateExploreAuth307(request, env, ctx);
  if (!actor.ok) return actor;
  const profile = await readOwnStaffProfile307(actor);
  const isMaster = profile.staffRole === 'master';
  const isAdmin = isMaster || profile.staffRole === 'admin' || profile.role === 'admin';
  if (isMaster) return { ...actor, canCurate: true, curatorRole: 'master', isMaster: true, d1Read: 0 };
  if (!isAdmin) return { ...actor, canCurate: false, curatorRole: null, isMaster: false, d1Read: 0 };

  const row = await env.DB.prepare(
    `SELECT role,is_active,created_by_uid FROM explore_curators WHERE uid=? LIMIT 1`
  ).bind(actor.uid).first();
  // Legacy automatic rows used role='admin'. Only an explicit Master grant uses
  // role='master', so ordinary admins never inherit curation access automatically.
  const explicitlyGranted = row?.is_active === 1 && row?.role === 'master';
  return {
    ...actor,
    canCurate: explicitlyGranted,
    curatorRole: explicitlyGranted ? 'admin' : null,
    isMaster: false,
    d1Read: 1,
  };
}

async function handleExploreManagementAccess307(request, env, ctx) {
  const access = await resolveExploreManagementAccess307(request, env, ctx);
  if (!access.ok) return access.response;
  return new Response(JSON.stringify({
    ok: true,
    data: { uid: access.uid, canCurate: access.canCurate === true, curatorRole: access.curatorRole || null },
  }), {
    status: 200,
    headers: curationHeaders307(request, { d1Read: access.d1Read, source: 'MANAGEMENT-ACCESS-307' }),
  });
}

async function requireMaster307(request, env, ctx) {
  const access = await resolveExploreManagementAccess307(request, env, ctx);
  if (!access.ok) return access;
  if (!access.isMaster) {
    return {
      ok: false,
      response: new Response(JSON.stringify({
        ok: false,
        error: { code: 'MASTER_REQUIRED', message: '마스터 권한이 필요합니다.' },
      }), { status: 403, headers: curationHeaders307(request, { d1Read: access.d1Read, source: 'MASTER-REQUIRED-307' }) }),
    };
  }
  return access;
}

async function handleExploreManagerList307(request, env, ctx) {
  const actor = await requireMaster307(request, env, ctx);
  if (!actor.ok) return actor.response;
  const url = new URL(request.url);
  const uids = [...new Set(String(url.searchParams.get('uids') || '')
    .split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 100);
  if (!uids.length) {
    return new Response(JSON.stringify({ ok: true, data: { permissions: {} } }), {
      status: 200,
      headers: curationHeaders307(request, { source: 'MANAGER-LIST-EMPTY-307' }),
    });
  }
  const placeholders = uids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT uid,role,is_active FROM explore_curators WHERE uid IN (${placeholders})`
  ).bind(...uids).all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  const enabled = new Set(rows
    .filter((row) => row?.role === 'master' && row?.is_active === 1)
    .map((row) => String(row.uid || '').trim())
    .filter(Boolean));
  const permissions = Object.fromEntries(uids.map((uid) => [uid, enabled.has(uid)]));
  return new Response(JSON.stringify({ ok: true, data: { permissions } }), {
    status: 200,
    headers: curationHeaders307(request, { d1Read: rows.length, source: 'MANAGER-LIST-307' }),
  });
}

async function handleExploreManagerMutation307(request, env, ctx, targetUid, enabled) {
  const actor = await requireMaster307(request, env, ctx);
  if (!actor.ok) return actor.response;
  const uid = String(targetUid || '').trim();
  if (!uid || uid.length > 256) {
    return new Response(JSON.stringify({
      ok: false,
      error: { code: 'INVALID_UID', message: '관리자 UID가 올바르지 않습니다.' },
    }), { status: 400, headers: curationHeaders307(request, { source: 'MANAGER-INVALID-307' }) });
  }
  const now = Date.now();
  if (enabled) {
    await env.DB.prepare(`
      INSERT INTO explore_curators(uid,role,is_active,created_by_uid,created_at,updated_at)
      VALUES (?,'master',1,?,?,?)
      ON CONFLICT(uid) DO UPDATE SET
        role='master',is_active=1,created_by_uid=excluded.created_by_uid,updated_at=excluded.updated_at
    `).bind(uid, actor.uid, now, now).run();
  } else {
    await env.DB.prepare(
      `UPDATE explore_curators SET is_active=0,updated_at=? WHERE uid=?`
    ).bind(now, uid).run();
  }
  return new Response(JSON.stringify({ ok: true, data: { uid, enabled } }), {
    status: 200,
    headers: curationHeaders307(request, { d1Write: 1, source: 'MANAGER-MUTATION-307' }),
  });
}

async function materializeCuratedR2FromBase307(request, env, ctx) {
  // SORIDRAW_CURATED_BOUNDED_BOOTSTRAP_356_20261006
  // EXPLORE_CACHE is intentionally environment-local. If one environment loses
  // this derived object, rebuild only the explicit curated membership (max 40)
  // from the shared canonical D1 and resolve only those exact track details.
  // Never call the wrapper-only /v1/curated route through baseWorker: the base
  // Worker does not own that route and would return 404/503 on a cold environment.
  const bucket = curatedBucket307(env);
  if (!bucket) return { object: null, payload: null, memberIds: [], d1Read: 0, source: 'R2-BINDING-MISSING-307' };
  if (!env?.DB) return { object: null, payload: null, memberIds: [], d1Read: 0, source: 'D1-BINDING-MISSING-356' };

  const now = Date.now();
  let rows = [];
  try {
    const result = await env.DB.prepare(`
      SELECT track_id,curator_uid,curator_role,sort_order,starts_at,ends_at,created_at,updated_at
      FROM curated_picks
      WHERE collection_key=?
        AND (starts_at IS NULL OR starts_at<=?)
        AND (ends_at IS NULL OR ends_at>?)
      ORDER BY sort_order ASC, updated_at DESC, track_id ASC
      LIMIT 40
    `).bind(SORIDRAW_CURATED_COLLECTION_307, now, now).all();
    rows = Array.isArray(result?.results) ? result.results : [];
  } catch (error) {
    console.warn('[app356] curated bounded bootstrap membership read failed:', String(error?.message || error || 'unknown'));
    return { object: null, payload: null, memberIds: [], d1Read: 0, source: 'D1-BOOTSTRAP-FAILED-356' };
  }

  const memberIds = rows
    .map((row) => String(row?.track_id || '').trim())
    .filter(Boolean);
  const items = [];
  let d1Read = rows.length;

  for (const row of rows) {
    const trackId = String(row?.track_id || '').trim();
    if (!trackId) continue;
    const detailUrl = new URL(`/v1/tracks/${encodeURIComponent(trackId)}`, request.url);
    let detailResponse = null;
    try {
      detailResponse = await baseWorker.fetch(new Request(detailUrl.toString(), {
        method: 'GET',
        headers: { Origin: request.headers.get('Origin') || '' },
      }), env, ctx);
    } catch {
      continue;
    }
    const detailD1Read = Number(detailResponse.headers.get('X-SORIDRAW-D1-Read') || 0);
    if (Number.isFinite(detailD1Read) && detailD1Read > 0) d1Read += detailD1Read;
    if (!detailResponse.ok) continue;
    const detail = await detailResponse.clone().json().catch(() => null);
    const track = detail?.data?.track;
    if (!track?.id) continue;
    items.push({
      track,
      curation: {
        curatorUid: String(row?.curator_uid || ''),
        curatorRole: String(row?.curator_role || ''),
        sortOrder: Number(row?.sort_order || 0),
        startsAt: row?.starts_at ?? null,
        endsAt: row?.ends_at ?? null,
      },
    });
  }

  const payload = {
    ok: true,
    data: {
      collection: SORIDRAW_CURATED_COLLECTION_307,
      items,
    },
  };
  const stored = {
    schemaVersion: 1,
    collection: SORIDRAW_CURATED_COLLECTION_307,
    memberIds,
    payload,
    updatedAt: Date.now(),
  };
  await bucket.put(SORIDRAW_CURATED_R2_KEY_307, JSON.stringify(stored), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { updatedAt: String(stored.updatedAt) },
  });
  await clearCuratedEdge307(new URL(request.url));
  const object = await bucket.get(SORIDRAW_CURATED_R2_KEY_307);
  return {
    object,
    payload,
    memberIds,
    d1Read,
    source: 'D1-BOUNDED-BOOTSTRAP-356',
  };
}

async function readCuratedObject307(request, env, ctx) {
  const bucket = curatedBucket307(env);
  if (!bucket) return { object: null, payload: null, memberIds: [], r2Reads: 0, d1Read: 0, source: 'R2-BINDING-MISSING-307' };
  let object = null;
  try { object = await bucket.get(SORIDRAW_CURATED_R2_KEY_307); } catch {}
  if (!object) {
    const boot = await materializeCuratedR2FromBase307(request, env, ctx);
    return { object: boot.object, payload: boot.payload, memberIds: boot.memberIds || [], r2Reads: boot.object ? 1 : 0, d1Read: boot.d1Read, source: boot.source };
  }
  let stored = null;
  try { stored = JSON.parse(await object.text()); } catch {}
  const payload = stored?.payload;
  if (stored?.schemaVersion !== 1 || payload?.ok !== true || !Array.isArray(payload?.data?.items)) {
    try { await bucket.delete(SORIDRAW_CURATED_R2_KEY_307); } catch {}
    const boot = await materializeCuratedR2FromBase307(request, env, ctx);
    return { object: boot.object, payload: boot.payload, memberIds: boot.memberIds || [], r2Reads: boot.object ? 1 : 0, d1Read: boot.d1Read, source: boot.source };
  }
  const memberIds = Array.isArray(stored?.memberIds)
    ? stored.memberIds.map((value) => String(value || '').trim()).filter(Boolean)
    : payload.data.items.map((item) => String(item?.track?.id || '').trim()).filter(Boolean);
  return { object, payload, memberIds, r2Reads: 1, d1Read: 0, source: 'R2-CURATED-307' };
}

async function handleCuratedRevision307(request, env) {
  const bucket = curatedBucket307(env);
  if (!bucket) {
    return new Response(JSON.stringify({ ok: false, error: 'Curated cache unavailable' }), {
      status: 503,
      headers: curationHeaders307(request, { source: 'R2-BINDING-MISSING-307' }),
    });
  }
  const url = new URL(request.url);
  const edgeKey = curatedRevisionEdgeKey307(url);
  try {
    const cached = await caches.default.match(edgeKey);
    if (cached) {
      const revision = String(await cached.text() || '').trim();
      if (revision) {
        return new Response(JSON.stringify({
          ok: true,
          data: { collection: SORIDRAW_CURATED_COLLECTION_307, revision, exists: true },
        }), {
          status: 200,
          headers: curationHeaders307(request, { revision, source: 'EDGE-CURATED-HEAD-307' }),
        });
      }
    }
  } catch {}
  let head = null;
  try { head = await bucket.head(SORIDRAW_CURATED_R2_KEY_307); } catch {}
  const revision = curatedRevision307(head);
  if (!revision) {
    return new Response(JSON.stringify({
      ok: true,
      data: { collection: SORIDRAW_CURATED_COLLECTION_307, revision: '', exists: false },
    }), {
      status: 200,
      headers: curationHeaders307(request, { r2B: 1, source: 'R2-CURATED-MISSING-307' }),
    });
  }
  try {
    await caches.default.put(edgeKey, new Response(revision, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    }));
  } catch {}
  return new Response(JSON.stringify({
    ok: true,
    data: { collection: SORIDRAW_CURATED_COLLECTION_307, revision, exists: true },
  }), {
    status: 200,
    headers: curationHeaders307(request, { r2B: 1, revision, source: 'R2-CURATED-HEAD-307' }),
  });
}

async function handleCuratedPublic307(request, env, ctx) {
  const url = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit') || 20)));
  if (limit === 20) {
    try {
      const cached = await caches.default.match(curatedStableBodyEdgeKey307(url));
      if (cached) {
        const revision = String(cached.headers.get('X-SORIDRAW-Curated-Revision') || '').trim();
        return new Response(await cached.text(), {
          status: 200,
          headers: curationHeaders307(request, { revision, source: 'EDGE-CURATED-BODY-307' }),
        });
      }
    } catch {}
  }
  const selected = await readCuratedObject307(request, env, ctx);
  if (!selected.payload?.data?.items) {
    return new Response(JSON.stringify({ ok: false, error: 'SORIDRAW 추천곡을 불러오지 못했습니다.' }), {
      status: 503,
      headers: curationHeaders307(request, {
        d1Read: selected.d1Read,
        r2B: selected.r2Reads,
        source: selected.source,
      }),
    });
  }
  const revision = curatedRevision307(selected.object);
  const edgeKey = curatedBodyEdgeKey307(url, revision, limit);
  try {
    const cached = await caches.default.match(edgeKey);
    if (cached) {
      return new Response(await cached.text(), {
        status: 200,
        headers: curationHeaders307(request, { revision, source: 'EDGE-CURATED-BODY-307' }),
      });
    }
  } catch {}
  const body = JSON.stringify({
    ...selected.payload,
    data: {
      ...selected.payload.data,
      collection: SORIDRAW_CURATED_COLLECTION_307,
      items: selected.payload.data.items.slice(0, limit),
      revision,
    },
  });
  try {
    const cachedHeaders307 = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${SORIDRAW_CURATED_EDGE_SECONDS_307}`,
      'X-SORIDRAW-Curated-Revision': revision,
    };
    await caches.default.put(edgeKey, new Response(body, { headers: cachedHeaders307 }));
    if (limit === 20) {
      await caches.default.put(curatedStableBodyEdgeKey307(url), new Response(body, { headers: cachedHeaders307 }));
    }
  } catch {}
  return new Response(body, {
    status: 200,
    headers: curationHeaders307(request, {
      d1Read: selected.d1Read,
      r2B: selected.r2Reads,
      revision,
      source: selected.source,
    }),
  });
}

async function writeCuratedSnapshot307(request, env, ctx, trackId, promoted, curatorRole) {
  const bucket = curatedBucket307(env);
  if (!bucket) return;
  const selected = await readCuratedObject307(request, env, ctx);
  if (!selected.payload?.data?.items) return;
  let memberIds = [...new Set((selected.memberIds || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))].filter((value) => value !== trackId);
  let items = selected.payload.data.items.filter((item) => String(item?.track?.id || '').trim() !== trackId);
  if (promoted) {
    memberIds = [trackId, ...memberIds].slice(0, 40);
    const detailUrl = new URL(`/v1/tracks/${encodeURIComponent(trackId)}`, request.url);
    const detailResponse = await baseWorker.fetch(new Request(detailUrl.toString(), {
      method: 'GET',
      headers: { Origin: request.headers.get('Origin') || '' },
    }), env, ctx);
    const detail = await detailResponse.clone().json().catch(() => null);
    const track = detail?.data?.track;
    if (detailResponse.ok && track?.id) {
      items.unshift({
        track,
        curation: {
          curatorUid: '',
          curatorRole,
          sortOrder: 0,
          startsAt: null,
          endsAt: null,
        },
      });
    }
  }
  const payload = {
    ok: true,
    data: { collection: SORIDRAW_CURATED_COLLECTION_307, items: items.slice(0, 40) },
  };
  const stored = {
    schemaVersion: 1,
    collection: SORIDRAW_CURATED_COLLECTION_307,
    memberIds,
    payload,
    updatedAt: Date.now(),
  };
  await bucket.put(SORIDRAW_CURATED_R2_KEY_307, JSON.stringify(stored), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { updatedAt: String(stored.updatedAt) },
  });
  await clearCuratedEdge307(new URL(request.url));
}

// SORIDRAW_CURATED_PUBLICATION_TARGETED_SYNC_307_20261003
async function syncCuratedPublicationResults307(request, env, results, ctx) {
  if (sharedCuratedEnabled466(env)) {
    if (!Array.isArray(results) || !results.some((item) => item?.ok === true)) return;
    const current = await getCuratedShared466(env);
    const memberSet = new Set(current.snapshot?.memberIds || []);
    if (!results.some((item) => memberSet.has(String(item?.trackId || '').trim()))) return;
    const changedIds = results.filter((item) => item?.ok === true)
      .map((item) => String(item?.trackId || '').trim())
      .filter((id) => memberSet.has(id));
    const next = await refreshCuratedShared466(request, env, ctx, changedIds);
    if (!next.ok) throw Error('CURATED_SHARED_PUBLICATION_REPAIR_FAILED_466');
    return;
  }
  const bucket = curatedBucket307(env);
  if (!bucket || !Array.isArray(results) || !results.length) return;
  let object = null;
  try { object = await bucket.get(SORIDRAW_CURATED_R2_KEY_307); } catch {}
  if (!object) return;

  let stored = null;
  try { stored = JSON.parse(await object.text()); } catch {}
  const payload = stored?.payload;
  if (stored?.schemaVersion !== 1 || payload?.ok !== true || !Array.isArray(payload?.data?.items)) return;

  const memberIds = Array.isArray(stored?.memberIds)
    ? stored.memberIds.map((value) => String(value || '').trim()).filter(Boolean)
    : payload.data.items.map((item) => String(item?.track?.id || '').trim()).filter(Boolean);
  const memberSet = new Set(memberIds);
  if (!memberSet.size) return;

  const itemByTrackId = new Map(
    payload.data.items
      .map((item) => [String(item?.track?.id || '').trim(), item])
      .filter(([trackId]) => Boolean(trackId)),
  );
  let changed = false;

  for (const result of results) {
    if (result?.ok !== true) continue;
    const trackId = String(result?.trackId || '').trim();
    if (!trackId || !memberSet.has(trackId)) continue;
    const status = result?.status === 'public' ? 'public' : 'private';
    if (status === 'private') {
      if (itemByTrackId.delete(trackId)) changed = true;
      continue;
    }
    const track = result?.snapshotItem;
    if (!track?.id) continue;
    const previous = itemByTrackId.get(trackId);
    itemByTrackId.set(trackId, {
      track,
      curation: previous?.curation || {
        curatorUid: '',
        curatorRole: '',
        sortOrder: memberIds.indexOf(trackId),
        startsAt: null,
        endsAt: null,
      },
    });
    changed = true;
  }

  if (!changed) return;
  const items = memberIds.map((trackId) => itemByTrackId.get(trackId)).filter(Boolean).slice(0, 40);
  const nextPayload = {
    ...payload,
    data: {
      ...payload.data,
      collection: SORIDRAW_CURATED_COLLECTION_307,
      items,
    },
  };
  const nextStored = {
    schemaVersion: 1,
    collection: SORIDRAW_CURATED_COLLECTION_307,
    memberIds,
    payload: nextPayload,
    updatedAt: Date.now(),
  };
  await bucket.put(SORIDRAW_CURATED_R2_KEY_307, JSON.stringify(nextStored), {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { updatedAt: String(nextStored.updatedAt) },
  });
  await clearCuratedEdge307(new URL(request.url));
}

// app469: protect the direct curator PUT/DELETE D1 mutation too, not only
// publication/visibility routes. The ticket is durably reserved before D1,
// and only retired after the changed R2 projection is verified.
async function reserveDirectCuratedRepair469(env, trackId) {
  const namespace = env?.EXPLORE_LIKE_BATCH_SCHEDULER;
  if (!namespace) throw Error('CURATED_DIRECT_REPAIR_DO_MISSING_469');
  const stub = namespace.get(namespace.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103));
  const response = await stub.fetch('https://soridraw.internal/curated-repair-468/reserve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackIds: [trackId] }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.data?.reserved !== true)
    throw Error('CURATED_DIRECT_REPAIR_RESERVE_FAILED_469');
  return { stub, generation: Number(data.data.generation || 0) };
}

async function finalizeDirectCuratedRepair469(ticket, route) {
  if (!ticket) return;
  try {
    const result = await ticket.stub.fetch('https://soridraw.internal/curated-repair-468/' + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generation: ticket.generation }),
    });
    if (!result.ok) throw Error('CURATED_DIRECT_REPAIR_' + route.toUpperCase() + '_FAILED_469');
  } catch (error) {
    // Never replay a committed D1 curator mutation because an auxiliary
    // notification failed. The reserved ticket survives for alarm recovery.
    console.warn('[app469] curator derived repair journal deferred:', String(error?.message || error));
  }
}

async function handleCurationMutation307(request, env, ctx, trackId, promoted) {
  const access = await resolveExploreManagementAccess307(request, env, ctx);
  if (!access.ok) return access.response;
  if (!access.canCurate) {
    return new Response(JSON.stringify({
      ok: false,
      error: { code: 'EXPLORE_MANAGEMENT_REQUIRED', message: '익스플로어 관리 권한이 필요합니다.' },
    }), {
      status: 403,
      headers: curationHeaders307(request, { d1Read: access.d1Read, source: 'CURATION-DENIED-307' }),
    });
  }
  const id = String(trackId || '').trim();
  if (!id) {
    return new Response(JSON.stringify({
      ok: false,
      error: { code: 'INVALID_TRACK', message: '추천곡 대상이 없습니다.' },
    }), { status: 400, headers: curationHeaders307(request, { source: 'CURATION-INVALID-307' }) });
  }
  const now = Date.now();
  let d1Read = access.d1Read;
  let directCuratedTicket469 = null;
  if (sharedCuratedEnabled466(env)) {
    // Must reserve before either INSERT/UPDATE or DELETE: a CAS failure after
    // a successful canonical D1 mutation otherwise has no durable repair.
    try {
      directCuratedTicket469 = await reserveDirectCuratedRepair469(env, id);
    } catch (error) {
      console.warn('[app469] curator repair reservation unavailable:', String(error?.message || error));
      return Response.json({
        ok: false, error: {
          code: 'CURATED_DIRECT_REPAIR_PREFLIGHT_469',
          message: '추천곡 동기화 준비가 완료되지 않아 변경을 저장하지 않았습니다.',
        },
      }, { status: 503 });
    }
  }
  if (promoted) {
    const track = await env.DB.prepare(
      `SELECT id FROM tracks WHERE id=? AND is_public=1 AND status='published' LIMIT 1`
    ).bind(id).first();
    d1Read += 1;
    if (!track) {
      return new Response(JSON.stringify({
        ok: false,
        error: { code: 'NOT_FOUND', message: '공개 곡을 찾을 수 없습니다.' },
      }), {
        status: 404,
        headers: curationHeaders307(request, { d1Read, source: 'CURATION-TRACK-MISSING-307' }),
      });
    }
    await env.DB.prepare(`
      INSERT INTO curated_picks(collection_key,track_id,curator_uid,curator_role,sort_order,starts_at,ends_at,created_at,updated_at)
      VALUES (?,?,?,?,0,NULL,NULL,?,?)
      ON CONFLICT(collection_key,track_id) DO UPDATE SET
        curator_uid=excluded.curator_uid,curator_role=excluded.curator_role,sort_order=0,
        starts_at=NULL,ends_at=NULL,updated_at=excluded.updated_at
    `).bind(SORIDRAW_CURATED_COLLECTION_307, id, access.uid, access.curatorRole, now, now).run();
  } else {
    await env.DB.prepare(
      `DELETE FROM curated_picks WHERE collection_key=? AND track_id=?`
    ).bind(SORIDRAW_CURATED_COLLECTION_307, id).run();
  }

  if (directCuratedTicket469) {
    await finalizeDirectCuratedRepair469(directCuratedTicket469, 'confirm');
  }
  if (sharedCuratedEnabled466(env)) {
    // D1 mutation has committed. Do not lie about a successful public snapshot
    // when R2 conditional write cannot converge. No automatic D1 rollback.
    try {
      const updated = await refreshCuratedShared466(request, env, ctx, [id]);
      if (!updated.ok) throw Error('CURATED_SHARED_CAS_INCOMPLETE_466');
      // Opposite actions on one track may commit while our CAS is retrying.
      // Never return a misleading promoted:true after another curator removed
      // or hid it. The R2 outcome must match our requested visibility.
      const visible = updated.snapshot?.payload?.data?.items?.some(
        (item) => String(item?.track?.id || '').trim() === id,
      ) === true;
      if (visible !== promoted) {
        return new Response(JSON.stringify({
          ok: false, error: {
            code: 'CURATED_SHARED_CONCURRENT_CHANGE_466',
            message: '다른 변경이 먼저 적용되어 추천곡 상태가 달라졌습니다.',
          },
        }), {
          status: 409, headers: curationHeaders307(request, {
            d1Read, d1Write: 1, source: 'CURATED-SHARED-CONFLICT-466',
          }),
        });
      }
      await finalizeDirectCuratedRepair469(directCuratedTicket469, 'ack');
    } catch {
      return new Response(JSON.stringify({
        ok: false, error: {
          code: 'CURATED_SHARED_SETTLEMENT_PENDING_466',
          message: '승격 기록은 저장되었으나 추천곡 표시 갱신 확인이 필요합니다.',
        },
      }), {
        status: 503, headers: curationHeaders307(request, {
          d1Read: d1Read, d1Write: 1, source: 'CURATED-SHARED-REPAIR-FAILED-466',
        }),
      });
    }
  } else try {
    await writeCuratedSnapshot307(request, env, ctx, id, promoted, access.curatorRole);
  } catch (error) {
    console.warn('[app307] curated R2 patch failed; next public read repairs:', String(error?.message || error || 'unknown'));
    try { await curatedBucket307(env)?.delete(SORIDRAW_CURATED_R2_KEY_307); } catch {}
    await clearCuratedEdge307(new URL(request.url));
  }

  return new Response(JSON.stringify({
    ok: true,
    data: { collection: SORIDRAW_CURATED_COLLECTION_307, trackId: id, recommended: promoted },
  }), {
    status: 200,
    headers: curationHeaders307(request, {
      d1Read,
      d1Write: 1,
      source: promoted ? 'CURATION-PROMOTE-307' : 'CURATION-REMOVE-307',
    }),
  });
}

// SORIDRAW_CURATED_MANAGER_R2_READ_310_20261003
// The manager page must reuse the already-materialized curated R2 snapshot.
// App/version changes must not turn a management-page visit into a D1 list scan.
async function handleManagedCurated307(request, env, ctx) {
  const access = await resolveExploreManagementAccess307(request, env, ctx);
  if (!access.ok) return access.response;
  if (!access.canCurate) {
    return new Response(JSON.stringify({
      ok: false,
      error: { code: 'EXPLORE_MANAGEMENT_REQUIRED', message: '익스플로어 관리 권한이 필요합니다.' },
    }), {
      status: 403,
      headers: curationHeaders307(request, { d1Read: access.d1Read, source: 'MANAGED-LIST-DENIED-307' }),
    });
  }

  const selected = sharedCuratedEnabled466(env)
    ? await readCuratedShared466(request, env, ctx)
    : await readCuratedObject307(request, env, ctx);
  if (!selected.payload?.data?.items) {
    return new Response(JSON.stringify({
      ok: false,
      error: { code: 'CURATED_CACHE_UNAVAILABLE', message: '승격 곡 목록을 불러오지 못했습니다.' },
    }), {
      status: 503,
      headers: curationHeaders307(request, {
        d1Read: Number(access.d1Read || 0) + Number(selected.d1Read || 0),
        r2B: selected.r2Reads,
        source: selected.source || 'MANAGED-R2-MISSING-310',
      }),
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(40, Math.max(1, Number(url.searchParams.get('limit') || 40)));
  const revision = curatedRevision307(selected.object);
  const body = JSON.stringify({
    ...selected.payload,
    data: {
      ...selected.payload.data,
      collection: SORIDRAW_CURATED_COLLECTION_307,
      items: selected.payload.data.items.slice(0, limit),
      revision,
    },
  });
  return new Response(body, {
    status: 200,
    headers: curationHeaders307(request, {
      d1Read: Number(access.d1Read || 0) + Number(selected.d1Read || 0),
      r2B: selected.r2Reads,
      revision,
      source: 'MANAGED-R2-310',
    }),
  });
}

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
const RELEASE_ALLOWED_ORIGINS_036 = new Set([
  'https://preview.soridraw.com',
  'https://soridraw-preview.web.app',
  'https://soridraw-preview.firebaseapp.com',
  'https://test.soridraw.com',
  'https://soridraw-test.web.app',
  'https://soridraw-test.firebaseapp.com',
  'https://soridraw.com',
  'https://www.soridraw.com',
  'https://soridraw.web.app',
  'https://soridraw.firebaseapp.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function revisionCors036(request) {
  const origin = String(request.headers.get('Origin') || '');
  if (!RELEASE_ALLOWED_ORIGINS_036.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function revisionDiagnosticHeaders077(cors, r2ClassB = 0, source = 'R2-HEAD-077') {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '077');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', '0');
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, Number(r2ClassB || 0))));
  headers.set('X-SORIDRAW-Revision-Mode', 'HEAD-ONLY-036');
  headers.set('X-SORIDRAW-Revision-Source', source);
  headers.set('Access-Control-Expose-Headers', [
    'X-SORIDRAW-CF-Diagnostics',
    'X-SORIDRAW-CF-Worker',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
    'X-SORIDRAW-D1-Other-Queries',
    'X-SORIDRAW-R2-A',
    'X-SORIDRAW-R2-B',
    'X-SORIDRAW-Revision-Mode',
    'X-SORIDRAW-Revision-Source',
  ].join(', '));
  return headers;
}

const feedR2Key077 = (sort) => `internal/explore/feed-v1/${sort === 'popular' ? 'popular' : 'latest'}-40.json`;
const feedCacheBucket077 = (env) => env?.EXPLORE_CACHE || env?.PROFILE_MEDIA || null;

async function readFeedR2Revision077(url, env, sort) {
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
}

async function handleFeedRevisionHeadOnly077(request, env) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const cors = revisionCors036(request);
  const head = await readFeedR2Revision077(url, env, sort);
  if (!head.revision) {
    return new Response(JSON.stringify({ ok: false, error: 'Explore Feed snapshot unavailable' }), {
      status: 503,
      headers: revisionDiagnosticHeaders077(cors, head.r2ClassB, head.source),
    });
  }
  return new Response(JSON.stringify({ ok: true, data: { sort, revision: head.revision } }), {
    status: 200,
    headers: revisionDiagnosticHeaders077(cors, head.r2ClassB, head.source),
  });
}

function feedSnapshotEdgeKey108(url, sort, revision) {
  const edgeUrl = new URL(`/__soridraw/feed-r2-snapshot-108/${sort}`, url.origin);
  edgeUrl.searchParams.set('revision', revision);
  return new Request(edgeUrl.toString(), { method: 'GET' });
}

function feedSnapshotHeaders108(request, revision, source, r2ClassB = 0) {
  const headers = new Headers(revisionCors036(request));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '108');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', '0');
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, Number(r2ClassB || 0))));
  headers.set('X-SORIDRAW-Feed-Revision', String(revision || ''));
  headers.set('X-SORIDRAW-Feed-Snapshot', source);
  headers.set('Access-Control-Expose-Headers', [
    'X-SORIDRAW-CF-Diagnostics',
    'X-SORIDRAW-CF-Worker',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
    'X-SORIDRAW-D1-Other-Queries',
    'X-SORIDRAW-R2-A',
    'X-SORIDRAW-R2-B',
    'X-SORIDRAW-Feed-Revision',
    'X-SORIDRAW-Feed-Snapshot',
  ].join(', '));
  return headers;
}

async function handleFeedR2Snapshot108(request, env) {
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
}

// SORIDRAW_EXPLORE_PUBLIC_LIKE_CARD_READ_192_20260924
// Event-driven public-count delivery reads only the exact changed-track shared
// R2 cards. It never opens D1 and never trusts the RTDB invalidation as count data.
const PUBLIC_LIKE_CARD_ROUTE_192 = '/v1/public-like-cards';
const PUBLIC_LIKE_CARD_MAX_192 = 50;
const publicLikeCardKey192 = (trackId) =>
  `internal/explore/shared-track-card-v115/${encodeURIComponent(String(trackId || '').trim())}.json`;

function publicLikeCardHeaders192(request, r2Reads = 0) {
  const headers = new Headers(revisionCors036(request));
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '192');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', '0');
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, Number(r2Reads || 0))));
  headers.set('Access-Control-Expose-Headers', [
    'X-SORIDRAW-CF-Diagnostics',
    'X-SORIDRAW-CF-Worker',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-D1-Read-Queries',
    'X-SORIDRAW-D1-Write-Queries',
    'X-SORIDRAW-D1-Other-Queries',
    'X-SORIDRAW-R2-A',
    'X-SORIDRAW-R2-B',
  ].join(', '));
  return headers;
}

async function handlePublicLikeCards192(request, env) {
  const url = new URL(request.url);
  const raw = String(url.searchParams.get('trackIds') || '');
  const rawIds = raw.split(',').map((value) => value.trim()).filter(Boolean);
  const ids = [...new Set(rawIds)];
  if (!ids.length || ids.length > PUBLIC_LIKE_CARD_MAX_192 ||
      ids.some((id) => id.length > 512)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid changed-track request' }), {
      status: 400,
      headers: publicLikeCardHeaders192(request, 0),
    });
  }
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket) {
    return new Response(JSON.stringify({ ok: false, error: 'Shared public cache unavailable' }), {
      status: 503,
      headers: publicLikeCardHeaders192(request, 0),
    });
  }

  const items = [];
  await Promise.all(ids.map(async (trackId) => {
    let object = null;
    try { object = await bucket.get(publicLikeCardKey192(trackId)); } catch {}
    if (!object) return;
    let bundle = null;
    try { bundle = JSON.parse(await object.text()); } catch {}
    const card = bundle?.card;
    const id = String(card?.id || card?.trackId || '').trim();
    if (Number(bundle?.schemaVersion || 0) !== 1 || id !== trackId) return;
    const count = Number(card?.likeCount ?? card?.stats?.likeCount ?? 0);
    if (!Number.isFinite(count) || count < 0) return;
    items.push({
      trackId: id,
      ownerUid: String(card?.ownerUid || card?.owner_uid || '').trim(),
      likeCount: Math.floor(count),
      updatedAt: Math.max(0, Math.floor(Number(bundle?.updatedAt || object?.customMetadata?.updatedAt || 0))),
    });
  }));

  return new Response(JSON.stringify({ ok: true, data: { items } }), {
    status: 200,
    headers: publicLikeCardHeaders192(request, ids.length),
  });
}

// SORIDRAW_CANONICAL_ATOMIC_DRAIN_RECEIPT_418_20261009
// Queue intake is NOT final state. Only an atomic D1.batch DELETE RETURNING
// identifying the exact accepted batch can prove canonical completion.
async function readCommonPublicLikeMinutes448(http=fetch) {
  try {
    const response=await http(COMMON_PUBLIC_LIKE_CONFIG_ENDPOINT_448,{
      method:'GET',headers:{'Accept':'application/json'}});
    const payload=await response.json().catch(()=>null);
    const minutes=Number(payload?.data?.publicMinutes);
    if(response.ok&&payload?.ok===true&&COMMON_PUBLIC_LIKE_MINUTES_448.has(minutes))
      return minutes;
  } catch {}
  throw new Error('448_PUBLIC_CONFIG_UNAVAILABLE');
}

async function scheduleExploreLikeAggregate103(
  env, expectedBatchId418 = '', expectedTrackIds448 = [],
) {
  const namespace = env?.EXPLORE_LIKE_BATCH_SCHEDULER;
  if (!namespace) throw new Error('Explore like scheduler binding unavailable');
  const id = namespace.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103);
  const stub = namespace.get(id);
  const response = await stub.fetch('https://soridraw.internal/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedBatchId418, expectedTrackIds448 }),
  });
  if (!response.ok) throw new Error(`Explore like scheduler rejected: ${response.status}`);
  return response.json().catch(() => ({}));
}

// SORIDRAW_APP413_EXACT_SETTLED_LIKE_COUNT_20261013
// Only after the exact 069 batch is proven settled, read the canonical public
// count for those changed track IDs. This is one bounded changed-data SELECT
// (max 50 IDs), never a Feed/profile/account scan and never a page-entry read.
async function readExactSettledLikeCounts413(env, rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (!sourceRows.length || sourceRows.length > 50 || !env?.DB?.prepare) return null;
  const ids = [...new Set(sourceRows.map((row) => String(row?.trackId || '').trim()))];
  if (ids.length !== sourceRows.length || ids.some((id) => !id || id.length > 512)) return null;
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    'SELECT t.id,COALESCE(s.like_count,0) AS like_count FROM tracks t ' +
    'LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id IN (' + placeholders + ')'
  ).bind(...ids).all();
  const countById = new Map();
  for (const row of result?.results || []) {
    const id = String(row?.id || '').trim();
    const count = Number(row?.like_count);
    if (!ids.includes(id) || !Number.isSafeInteger(count) || count < 0 || countById.has(id)) return null;
    countById.set(id, count);
  }
  if (countById.size !== ids.length) return null;
  return sourceRows.map((row) => ({ ...row, likeCount: countById.get(String(row.trackId)) }));
}

async function ensureQueuedLikeBatchScheduled103(request, env, response, ctx) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== EXPLORE_LIKE_BATCH_ROUTE_103 || !response.ok) return response;
  const payload = await response.clone().json().catch(() => null);
  if (!payload?.data?.queued) return response;

  // A new 069 primary-key queue row + an exact changed-track R2 CAS are
  // prerequisites for zero-extra-SELECT settlement. Legacy/partial/duplicate
  // intake paths retain the old guarded behavior. This flag is NOT authority.
  const rows418 = payload?.data?.results;
  const id418 = String(payload?.data?.batchId || '');
  const expectedBatchId418 =
    payload?.data?.queue === '069' &&
    payload?.data?.batchInserted418 === true &&
    payload?.data?.canonicalD1 === 'queued' &&
    payload?.data?.personalLikeSnapshot === 'changed-track-r2' &&
    /^l069_[0-9]{13}_[0-9a-f]{64}$/.test(id418) &&
    Array.isArray(rows418) && rows418.length > 0 && rows418.length <= 50 &&
    rows418.every((row) =>
      row && typeof row.trackId === 'string' && row.trackId.length > 0 &&
      row.trackId.length <= 512 && typeof row.liked === 'boolean' &&
      row.status === 'legacy-queued')
      ? id418 : '';

  const expectedTrackIds448 =
    payload?.data?.queue === '069' &&
    payload?.data?.canonicalD1 === 'queued' &&
    Array.isArray(rows418) && rows418.length > 0 && rows418.length <= 50 &&
    rows418.every((row) =>
      row && typeof row.trackId === 'string' && row.trackId.length > 0 &&
      row.trackId.length <= 512 && typeof row.liked === 'boolean')
      ? [...new Set(rows418.map((row) => row.trackId.trim()))] : [];

  try {
    const schedule = await scheduleExploreLikeAggregate103(
      env, expectedBatchId418, expectedTrackIds448);
    if (expectedBatchId418 &&
        schedule?.newlyScheduled === true &&
        schedule?.settled === true &&
        schedule?.settledBatchId418 === expectedBatchId418) {
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      headers.set('Cache-Control', 'no-store');
      // app413: relation/count settlement is already final. Read only these
      // changed IDs so the client never treats a stale local empty heart as an
      // extra public +1. If this bounded read fails, keep the successful ACK
      // (never 5xx/replay an already-settled mutation); the client holds the
      // pre-click public count until normal changed-card convergence.
      let exactRows413 = null;
      try {
        exactRows413 = await readExactSettledLikeCounts413(env, rows418);
      } catch (error) {
        console.warn('[413] exact settled like-count read deferred:', String(error?.message || error || 'unknown'));
      }
      return new Response(JSON.stringify({
        ...payload,
        data: {
          ...payload.data,
          results: exactRows413 || rows418,
          canonicalD1: 'settled',
          canonicalProof: 'atomic-drain-batch-418',
          ...(exactRows413 ? { canonicalLikeCountProof: 'track-stats-exact-413' } : {}),
        },
      }), { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  } catch (error) {
    const headers = new Headers(response.headers);
    headers.set('Content-Type', 'application/json; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    const message = String(error?.message || error || '좋아요 묶음 예약에 실패했습니다.');
    return new Response(JSON.stringify({
      ok: false,
      message,
      error: { code: 'LIKE_BATCH_SCHEDULER_UNAVAILABLE', message },
      data: { queued: true, retryable: true },
    }), { status: 503, headers });
  }
}

// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_ACTIVE_RECOVERY_194_20260924
const EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194 = 'active-scheduled-at-194';
const EXPLORE_LIKE_ACTIVE_GRACE_MS_194 = 20 * 1000;
const EXPLORE_LIKE_ALARM_FALLBACK_MS_194 = 15 * 1000;
const waitExploreLikeDelay194 = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

export class ExploreLikeBatchScheduler103 extends DurableObject {
  // One global durable curated repair journal for this Worker environment.
  // No periodic polling. The alarm is armed only by a real relevant mutation.
  async runCuratedRepair468() {
    if (!sharedCuratedEnabled466(this.env)) return;
    const result = await drainCuratedRepair468(
      this.ctx.storage,
      async (trackIds) => reconcileCuratedShared466(
        this.env,
        async (id) => {
          const url = 'https://soridraw.internal/v1/tracks/' + encodeURIComponent(id);
          const res = await baseWorker.fetch(new Request(url), this.env, this.ctx);
          if (!res.ok) return null;
          const data = await res.json().catch(() => null);
          return data?.data?.track || null;
        },
        { forceTrackIds: trackIds },
      ),
    );
    if (result.retrying) {
      console.warn('[app468] derived curated repair deferred', result.failures);
    }
  }

  async runAggregate194() {
    if (typeof baseWorker?.scheduled !== 'function') {
      throw new Error('Canonical Explore like aggregate handler unavailable');
    }

    const publicWindowActive416=STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE===true;
    const commonPublicActive448=COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448===true;
    const now448=Date.now();
    const currentPublicWindow416=(publicWindowActive416||commonPublicActive448)
      ?await this.ctx.storage.get(PUBLIC_LIKE_WINDOW_KEY_416)
      :null;
    const deferExistingPublic416=Boolean(currentPublicWindow416?.windowId);
    const currentCommonOpen448=commonPublicActive448&&
      currentPublicWindow416?.windowId&&currentPublicWindow416?.sealed!==true&&
      Number(currentPublicWindow416?.deadlineAtMs)>now448&&
      COMMON_PUBLIC_LIKE_MINUTES_448.has(Number(currentPublicWindow416?.publicMinutes));
    // Fail closed BEFORE canonical D1 settlement. A config outage must never
    // silently turn a Master 20-minute window into the old 5-minute default.
    const preflightPublicMinutes448=commonPublicActive448
      ?(currentCommonOpen448
        ?Number(currentPublicWindow416.publicMinutes)
        :await readCommonPublicLikeMinutes448())
      :0;
    const preregisterCommonPublicLikeTracks448=async(rawIds)=>{
      const ids=[...new Set((Array.isArray(rawIds)?rawIds:[])
        .map((id)=>String(id||'').trim()).filter(Boolean))];
      if(!ids.length)return {registered:false,trackCount:0};
      if(ids.length>50000||ids.some((id)=>id.length>512))
        throw new Error('448_PUBLIC_075_PREREGISTER_INVALID');
      const at=Date.now();
      const existing=await this.ctx.storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
      const open=existing?.windowId&&existing?.sealed!==true&&
        Number(existing?.deadlineAtMs)>at&&
        COMMON_PUBLIC_LIKE_MINUTES_448.has(Number(existing?.publicMinutes));
      const minutes=open?Number(existing.publicMinutes):preflightPublicMinutes448;
      const result=await joinPublicLikeChangedTracks416(
        this.ctx.storage,ids,at,minutes);
      if(result?.joined!==true&&result?.staged!==true)
        throw new Error('448_PUBLIC_075_PREREGISTER_FAILED');
      return {registered:true,trackCount:ids.length};
    };
    const aggregateEnv448=(publicWindowActive416||commonPublicActive448)
      ?new Proxy(this.env,{get:(target,prop)=>{
        if(publicWindowActive416&&prop==='__SORIDRAW_STAGE416_PUBLIC_WINDOW_ACTIVE')return true;
        if(commonPublicActive448&&prop==='__SORIDRAW_COMMON_PUBLIC_LIKE_WINDOW_ACTIVE')return true;
        if(commonPublicActive448&&
           prop==='__SORIDRAW_COMMON_PUBLIC_LIKE_PREREGISTER_448')
          return preregisterCommonPublicLikeTracks448;
        return Reflect.get(target,prop);
      }}):this.env;

    const settledAggregate418 = await baseWorker.scheduled({
      scheduledTime: Date.now(),
      cron: 'event-like-batch-1m-105',
      type: 'scheduled',
    }, aggregateEnv448, this.ctx);

    const changedTrackIds416=[...new Set(
      (Array.isArray(settledAggregate418?.changedTrackIds416)
        ?settledAggregate418.changedTrackIds416:[])
      .map((id)=>String(id||'').trim()).filter(Boolean))];

    if(publicWindowActive416&&(
       settledAggregate418?.stage416Changed416===true||
       settledAggregate418?.publicDeferred416===true)){
      if(changedTrackIds416.length){
        if(deferExistingPublic416){
          await joinPublicLikeChangedTracks416(
            this.ctx.storage,changedTrackIds416,Date.now(),
            Number(currentPublicWindow416.publicMinutes));
        }else if(settledAggregate418?.stage416Changed416===true){
          await stagePublicLikeOpenPayload416(
            this.ctx.storage,changedTrackIds416,Date.now());
        }
      }
      return {...settledAggregate418,publicWindowDeferred416:true,
        changedTrackIds416};
    }

    if(commonPublicActive448){
      const ids448=[...new Set(
        (Array.isArray(settledAggregate418?.commonPublicChangedTrackIds448)
          ?settledAggregate418.commonPublicChangedTrackIds448:[])
        .map((id)=>String(id||'').trim()).filter(Boolean))];
      if(ids448.length){
        const now448=Date.now();
        const existingWindow448=await this.ctx.storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
        const currentOpen448=existingWindow448?.windowId&&
          existingWindow448?.sealed!==true&&
          Number(existingWindow448?.deadlineAtMs)>now448;
        const minutes448=currentOpen448&&
          COMMON_PUBLIC_LIKE_MINUTES_448.has(Number(existingWindow448?.publicMinutes))
          ?Number(existingWindow448.publicMinutes)
          :preflightPublicMinutes448;
        await joinPublicLikeChangedTracks416(
          this.ctx.storage,ids448,now448,minutes448);
        return {...settledAggregate418,publicWindowDeferred448:true,
          commonPublicChangedTrackIds448:ids448,publicMinutes448:minutes448};
      }
    }

    if(!publicWindowActive416)await repairSharedPublicLikeCounts191(this.env);
    return {...settledAggregate418,changedTrackIds416};
  }

  // SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_JOIN_RACE_195_20260924
  async finalizeAggregate195() {
    // Remove this window's ownership BEFORE the final indexed queue check.
    // A batch that joined while runAggregate194 was finishing either:
    // 1) arrived before this delete and therefore already exists in 069 when
    //    the query below runs, or
    // 2) arrives after this delete and becomes the next active owner itself.
    // This closes the tiny "pending=false -> joined batch -> marker delete"
    // orphan window that could otherwise recreate the cross-account stall.
    await this.ctx.storage.delete(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194).catch(() => {});

    const pending = await this.env.DB.prepare(
      'SELECT batch_id FROM explore_like_batches_069 ORDER BY created_at ASC, batch_id ASC LIMIT 1',
    ).first();
    if (!pending) {
      await this.ctx.storage.deleteAlarm().catch(() => {});
      await this.ensurePublicAlarm416();
      return null;
    }

    // A new request may already have claimed the next window after the marker
    // delete. Never push its deadline later or create a second owner.
    const now = Date.now();
    const claimedAt = Number(await this.ctx.storage.get(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194) || 0);
    if (Number.isFinite(claimedAt) && claimedAt > 0 &&
        claimedAt >= now - EXPLORE_LIKE_ACTIVE_GRACE_MS_194) {
      await this.ensurePublicAlarm416();
      return pending;
    }

    const nextAt = now + EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105;
    await this.ctx.storage.put(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194, nextAt);
    await this.ctx.storage.setAlarm(nextAt);
    await this.ensurePublicAlarm416();
    return pending;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.startsWith('/curated-repair-468/')) {
      if (!sharedCuratedEnabled466(this.env)) {
        return Response.json({ ok: false, error: 'CURATED_REPAIR_DISABLED_468' }, { status: 503 });
      }
      const body = await request.json().catch(() => null);
      try {
        if (url.pathname === '/curated-repair-468/reserve') {
          const result = await this.ctx.storage.transaction((tx) =>
            reserveCuratedRepair468(tx, body?.trackIds));
          if (result.reserved)
            await armCuratedRepairAlarm468(this.ctx.storage, Date.now() + CURATED_REPAIR_WAKE_MS_468);
          return Response.json({ ok: result.reserved === true, data: result },
            { status: result.reserved ? 200 : 400 });
        }
        if (url.pathname === '/curated-repair-468/confirm') {
          const result = await this.ctx.storage.transaction((tx) =>
            confirmCuratedRepair468(tx, Number(body?.generation || 0)));
          if (result.confirmed)
            await armCuratedRepairAlarm468(this.ctx.storage, Date.now() + CURATED_REPAIR_WAKE_MS_468);
          return Response.json({ ok: true, data: result });
        }
        if (url.pathname === '/curated-repair-468/ack') {
          const result = await this.ctx.storage.transaction((tx) =>
            acknowledgeCuratedRepair468(tx, Number(body?.generation || 0)));
          return Response.json({ ok: true, data: result });
        }
      } catch (error) {
        return Response.json({
          ok: false, error: String(error?.message || 'CURATED_REPAIR_JOURNAL_FAILED_468'),
        }, { status: 503 });
      }
      return Response.json({ ok: false, error: 'CURATED_REPAIR_UNKNOWN_ROUTE_468' },
        { status: 404 });
    }
    if(request.method==='POST'&&url.pathname==='/public-release'){
      const body=await request.json().catch(()=>null);
      try{
        const data=await releaseDuePublicLikeWindow416({
          db:this.env.DB,r2:this.env.PROFILE_MEDIA,storage:this.ctx.storage,
          releaseEndpoint:this.env.SORIDRAW_PUBLIC_RELEASE416_ENDPOINT,
          secret:this.env.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET,nowMs:Date.now(),
          expectedWindowId:String(body?.windowId||''),
          expectedDeadlineAtMs:Number(body?.deadlineAtMs||0),
        });
        if(data.status==='NOT_DUE')return Response.json({ok:false,
          error:{code:'416_PUBLIC_RELEASE_NOT_DUE'},data},{status:425});
        return Response.json({ok:true,data});
      }catch(error){
        const code=String(error?.message||'416_PUBLIC_RELEASE_FAILED');
        return Response.json({ok:false,error:{code}},
          {status:code==='416_PUBLIC_RELEASE_REGISTRATION_PENDING'?409:503});
      }
    }
    if(request.method==='POST'&&url.pathname==='/public-register'){
      const body=await request.json().catch(()=>null);
      try{
        const data=await registerPublicLikeEventStorage416(this.ctx.storage,body,Date.now());
        if(data.needsRelease)return Response.json({ok:false,
          error:{code:'416_PUBLIC_WINDOW_DUE'},data},{status:409});
        const pending416=await mergePendingPublicLikeOpen416(
          this.ctx.storage,Date.now());
        return Response.json({ok:true,data:{...data,
          pendingMergedTrackCount416:Number(pending416?.trackCount||0)}});
      }catch(error){
        return Response.json({ok:false,error:{code:String(error?.message||'416_PUBLIC_BAD_EVENT')}},
          {status:400});
      }
    }
    if(request.method==='POST'&&url.pathname==='/public-ack'){
      const body=await request.json().catch(()=>null);
      try{
        const data=await ackPublicLikeEventStorage416(
          this.ctx.storage,String(body?.eventId||''),Date.now());
        return Response.json({ok:true,data});
      }catch(error){
        return Response.json({ok:false,error:{code:String(error?.message||'416_PUBLIC_BAD_ACK')}},
          {status:409});
      }
    }
    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return new Response('Not found', { status: 404 });
    }

    const body418 = await request.json().catch(() => null);
    const expectedBatchId418 = String(body418?.expectedBatchId418 || '');
    const expectedTrackIds448=[...new Set(
      (Array.isArray(body418?.expectedTrackIds448)?body418.expectedTrackIds448:[])
        .map((id)=>String(id||'').trim()).filter(Boolean))];
    if(expectedTrackIds448.length>50||
       expectedTrackIds448.some((id)=>id.length>512))
      return Response.json({ok:false,error:{code:'448_PUBLIC_TRACKS_INVALID'}},
        {status:400});
    const now = Date.now();

    // Register the candidate track set durably BEFORE any D1 queue drain. If
    // this storage/config step fails, the personal queue stays intact and the
    // next retry can safely try again instead of losing the public change.
    if(COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448===true&&expectedTrackIds448.length){
      const current448=await this.ctx.storage.get(PUBLIC_LIKE_WINDOW_KEY_416);
      const open448=current448?.windowId&&current448?.sealed!==true&&
        Number(current448?.deadlineAtMs)>now&&
        COMMON_PUBLIC_LIKE_MINUTES_448.has(Number(current448?.publicMinutes));
      const minutes448=open448
        ?Number(current448.publicMinutes)
        :await readCommonPublicLikeMinutes448();
      const registered448=await joinPublicLikeChangedTracks416(
        this.ctx.storage,expectedTrackIds448,now,minutes448);
      if(registered448?.joined!==true&&registered448?.staged!==true)
        throw new Error('448_PUBLIC_PREREGISTER_FAILED');
    }

    const activeAt = Number(await this.ctx.storage.get(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194) || 0);
    if (
      Number.isFinite(activeAt)
      && activeAt > 0
      && activeAt >= now - EXPLORE_LIKE_ACTIVE_GRACE_MS_194
    ) {
      return Response.json({ ok: true, scheduledAt: activeAt, newlyScheduled: false, activeRecovery194: true });
    }

    // An old failed alarm must never poison every future like batch. Worker192
    // could leave accepted 069 rows waiting while all new requests merely saw
    // an existing alarm. A new active window takes ownership, clears any stale
    // alarm and keeps one fallback alarm only until this window settles.
    await this.ctx.storage.delete(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194).catch(() => {});
    await this.ctx.storage.deleteAlarm().catch(() => {});

    const scheduledAt = Date.now() + EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105;
    await this.ctx.storage.put(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194, scheduledAt);
    await this.ctx.storage.setAlarm(
      scheduledAt + EXPLORE_LIKE_ALARM_FALLBACK_MS_194,
    );

    // Keep the first scheduling request alive for the five-second coalescing
    // window, then execute the existing set-based aggregate directly in this
    // single Durable Object. Other requests in the same window return above and
    // are drained by this run. This preserves event-driven batching and adds no
    // periodic D1 polling or per-viewer server work.
    await waitExploreLikeDelay194(scheduledAt - Date.now());
    try {
      const aggregate418 = await this.runAggregate194();
      const pending = await this.finalizeAggregate195();
      const settledBatchId418 =
        !pending &&
        expectedBatchId418 &&
        /^l069_[0-9]{13}_[0-9a-f]{64}$/.test(expectedBatchId418) &&
        aggregate418?.w1Processed === 1 &&
        aggregate418?.processedBatches === 1 &&
        aggregate418?.oldProcessed === 0 &&
        aggregate418?.compactProcessed === 0 &&
        aggregate418?.processedUserWaves === 0 &&
        aggregate418?.userQueue === false &&
        Array.isArray(aggregate418?.settledBatchIds418) &&
        aggregate418.settledBatchIds418.length === 1 &&
        aggregate418.settledBatchIds418[0] === expectedBatchId418
          ? expectedBatchId418 : '';
      return Response.json({
        ok: true, scheduledAt, newlyScheduled: true, settled: !pending,
        activeRecovery194: true, settledBatchId418,
      });
    } catch (error) {
      // Keep the fallback alarm. If Cloudflare delays or loses that retry, the
      // active marker ages out and the next real batch takes over instead of
      // trusting a stale alarm forever.
      console.warn('[SORIDRAW 194] active like aggregate deferred to alarm fallback:', String(error?.message || error || 'unknown'));
      throw error;
    }
  }

  async ensurePublicAlarm416() {
    if(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE!==true&&
       COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448!==true)return;
    await this.ctx.storage.transaction(async tx=>{
      const current=await tx.get(PUBLIC_LIKE_WINDOW_KEY_416);
      if(!current)return;
      const at=Math.max(Date.now()+1000,Number(current.deadlineAtMs));
      const alarm=await tx.getAlarm();
      if(!alarm||alarm<=Date.now()||alarm>at)await tx.setAlarm(at);
    });
  }

  async alarm() {
    try {
      const publicWindowEnabled448=
        STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE===true||
        COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448===true;
      const activeLikeMarker469 = await this.ctx.storage.get(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194);
      const curatedOnlyAlarm469 = sharedCuratedEnabled466(this.env) &&
        Boolean(await this.ctx.storage.get(CURATED_REPAIR_KEY_468)) &&
        !activeLikeMarker469;
      const publicOnly448 = publicWindowEnabled448 && !activeLikeMarker469;
      // Cloudflare permits only ONE alarm per Durable Object. An app468
      // curation-only wake must NOT drain/repair unrelated Explore likes when
      // no like batch owns this alarm. Preserve existing like-owned and public
      // 416/448 alarm behavior unchanged.
      if (!publicOnly448 && !curatedOnlyAlarm469) {
        await this.runAggregate194();
        await this.finalizeAggregate195();
      }
      if(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE===true){
        await releaseDuePublicLikeWindow416({
          db:this.env.DB,r2:this.env.PROFILE_MEDIA,storage:this.ctx.storage,
          releaseEndpoint:this.env.SORIDRAW_PUBLIC_RELEASE416_ENDPOINT,
          secret:this.env.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET,nowMs:Date.now(),
        });
      }else if(COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448===true){
        await releaseDueCommonPublicLikeWindow448({
          db:this.env.DB,r2:this.env.PROFILE_MEDIA,storage:this.ctx.storage,
          releaseEndpoint:this.env.SORIDRAW_PUBLIC_RELEASE416_ENDPOINT,
          releaseSecret:this.env.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET,
          nowMs:Date.now(),
        });
      }
      if(publicWindowEnabled448)await this.ensurePublicAlarm416();
      // Process the separately persisted curated dirty record only when an
      // actual curated change enqueued it; normal healthy pages never run this.
      if (sharedCuratedEnabled466(this.env) &&
          await this.ctx.storage.get(CURATED_REPAIR_KEY_468)) {
        await this.runCuratedRepair468();
      }
    } catch (error) {
      console.warn('[SORIDRAW 448] alarm retry failed:', String(error?.message || error || 'unknown'));
      throw error;
    }
  }
}

// SORIDRAW_BOUNDED_CANONICAL_PUBLIC_LIKE_CONVERGENCE_191_20260924
// The old 075 path can consume a D1 queue despite a failed shared R2 projection.
// Repair only the 40 already-published first-page cards per sort, once per actual
// batch alarm (plus the explicitly gated one-time historic repair). D1 is never
// consulted by ordinary GET, page entry, revision checks, or an app update.
const PUBLIC_LIKE_REPAIR_MARKER_191 = 'internal/explore/repair-v191/bounded-first40.json';
const PUBLIC_LIKE_CARD_KEY_191 = (trackId) =>
  `internal/explore/shared-track-card-v115/${encodeURIComponent(trackId)}.json`;
const PUBLIC_LIKE_PROFILE_KEY_191 = (uid) =>
  `internal/explore/shared-profile-v113/${encodeURIComponent(uid)}.json`;

async function repairSharedPublicLikeCounts191(env, { oneTime = false } = {}) {
  // Stage426: legacy first-80 track_stats count is NOT canonical after
  // the globally verified 171 overlay cutover. In that mode exact changed
  // tracks are already published through 421 R2 CAS. Never roll them back.
  if(STAGE426_COMPILED_OPEN&&env?.SORIDRAW_LIKE_171_READY==='1') {
    await proveLikeBatchCutover426(env);
    return {skippedForCanonical171:true,changedTracks:0};
  }
  const shared = env?.PROFILE_MEDIA;
  if (!shared || !env?.DB) throw new Error('[191] shared R2 or canonical D1 binding unavailable');
  if (oneTime && await shared.head(PUBLIC_LIKE_REPAIR_MARKER_191)) {
    return { alreadyRepaired: true, changedTracks: 0 };
  }

  const snapshots = new Map();
  const candidateIds = new Set();
  for (const sort of ['latest', 'popular']) {
    const key = sharedFeedR2Key112(sort);
    const object = await shared.get(key);
    if (!object) throw new Error('[191] missing shared Feed: ' + sort);
    const bundle = JSON.parse(await object.text());
    const items = bundle?.payload?.data?.items;
    if (!Array.isArray(items) || items.length > 40) {
      throw new Error('[191] invalid bounded shared Feed: ' + sort);
    }
    for (const row of items) {
      const id = String(row?.id || row?.trackId || '').trim();
      if (id) candidateIds.add(id);
    }
    snapshots.set(sort, { key, object, bundle });
  }
  if (candidateIds.size > 80) throw new Error('[191] too many first-page ids');
  const ids = [...candidateIds];
  const canonical = new Map();
  if (ids.length) {
    const sql = 'SELECT t.id,t.owner_uid,COALESCE(s.like_count,0) AS like_count ' +
      'FROM tracks t LEFT JOIN track_stats s ON s.track_id=t.id ' +
      `WHERE t.id IN (${ids.map(() => '?').join(',')}) ` +
      "AND t.is_public=1 AND t.status='published'";
    const result = await env.DB.prepare(sql).bind(...ids).all();
    for (const row of result?.results || []) {
      const id = String(row?.id || '').trim();
      const count = Number(row?.like_count);
      if (!id || !Number.isSafeInteger(count) || count < 0) throw new Error('[191] invalid canonical count');
      canonical.set(id, { count, ownerUid: String(row?.owner_uid || '').trim() });
    }
  }
  // A disappeared/private track is not a license to replace the whole public Feed.
  // Fail closed and let the existing publication path handle the visibility change.
  if (canonical.size !== ids.length) throw new Error('[191] canonical public membership changed during repair');

  // SORIDRAW_191_REPLAY_SAFE_ORDER_408: choose only cards whose published
  // Feed projection differs. Stage selection uses already-loaded R2 snapshots,
  // so healthy waves still perform zero per-card R2 reads and no new D1 reads.
  const changed = new Map();
  for (const snapshot of snapshots.values()) {
    for (const item of snapshot.bundle.payload.data.items) {
      const id = String(item?.id || item?.trackId || '').trim();
      const expected = canonical.get(id);
      if (!expected) throw new Error('[191] Feed membership raced: ' + id);
      const count = Number(item?.likeCount ?? item?.stats?.likeCount ?? 0);
      const nested = item?.stats && typeof item.stats === 'object'
        ? Number(item.stats.likeCount ?? expected.count) : expected.count;
      if (count !== expected.count || nested !== expected.count) changed.set(id, expected);
    }
  }

  // Finish changed-card/profile R2 repairs BEFORE marking a Feed as current.
  // A failed CAS/PUT leaves at least one old Feed entry to select on retry.
  // Never scan cards not selected by a mismatched Feed.
  // Update only corresponding profile and track-card projections. If a CAS
  // fails, the alarm retries; canonical user data is never written here.
  for (const [id, state] of changed) {
    const cardKey = PUBLIC_LIKE_CARD_KEY_191(id);
    const profileKey = state.ownerUid ? PUBLIC_LIKE_PROFILE_KEY_191(state.ownerUid) : '';
    for (const [key, kind] of [[cardKey, 'card'], ...(profileKey ? [[profileKey, 'profile']] : [])]) {
      let complete = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const object = await shared.get(key);
        if (!object) { complete = true; break; } // cold cache remains cold
        const bundle = JSON.parse(await object.text());
        let next = null;
        if (kind === 'card') {
          if (String(bundle?.card?.id || bundle?.card?.trackId || '') !== id) {
            throw new Error('[191] shared card identity mismatch');
          }
          const card = bundle.card;
          const count = Number(card?.likeCount ?? card?.stats?.likeCount ?? 0);
          if (count === state.count && (!card?.stats || Number(card.stats.likeCount) === state.count)) {
            complete = true; break;
          }
          next = { ...bundle, updatedAt: Date.now(),
            card: { ...card, likeCount: state.count,
              ...(card.stats ? { stats: { ...card.stats, likeCount: state.count } } : {}) } };
        } else {
          const data = bundle?.body?.data;
          if (!Array.isArray(data?.items)) throw new Error('[191] invalid shared profile');
          let dirty = false;
          const items = data.items.map(item => {
            if (String(item?.id || item?.trackId || '') !== id) return item;
            if (Number(item?.likeCount ?? item?.stats?.likeCount ?? 0) === state.count) return item;
            dirty = true;
            return { ...item, likeCount: state.count,
              ...(item?.stats ? { stats: { ...item.stats, likeCount: state.count } } : {}) };
          });
          if (!dirty) { complete = true; break; }
          const revision = Math.max(Number(bundle.revision || 0), Number(data.revision || 0)) + 1;
          next = { ...bundle, revision, updatedAt: Date.now(),
            body: { ...bundle.body, data: { ...data, items, revision } } };
        }
        const now = Date.now();
        const saved = await shared.put(key, JSON.stringify(next), {
          onlyIf: { etagMatches: object.etag },
          httpMetadata: { contentType: 'application/json; charset=utf-8' },
          customMetadata: { ...(object.customMetadata || {}), targetedLikeRepair: '191',
            updatedAt: String(now) },
        });
        if (saved) { complete = true; break; }
      }
      if (!complete) throw new Error('[191] derived CAS contention: ' + kind);
    }
  }

  // Publish Feed last: no completed-feed marker before dependent cards settle.
  for (const [sort, snapshot] of snapshots) {
    let complete = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const object = attempt === 0 ? snapshot.object : await shared.get(snapshot.key);
      if (!object) throw new Error('[191] shared Feed disappeared: ' + sort);
      const bundle = attempt === 0 ? snapshot.bundle : JSON.parse(await object.text());
      const data = bundle?.payload?.data;
      if (!Array.isArray(data?.items) || data.items.length > 40) throw new Error('[191] invalid concurrent Feed');
      let dirty = false;
      const items = data.items.map(item => {
        const id = String(item?.id || item?.trackId || '').trim();
        const expected = canonical.get(id);
        if (!expected) throw new Error('[191] Feed membership raced: ' + sort);
        const count = Number(item?.likeCount ?? item?.stats?.likeCount ?? 0);
        const nested = item?.stats && typeof item.stats === 'object'
          ? Number(item.stats.likeCount ?? expected.count) : expected.count;
        if (count === expected.count && nested === expected.count) return item;
        // Stage410: a mismatch discovered after dependent R2 projections were
        // repaired must not be marked complete in Feed. Replay in the next alarm.
        if (!changed.has(id)) {
          throw new Error('[191] concurrent Feed drift requires replay: ' + sort);
        }
        dirty = true;
        return { ...item, likeCount: expected.count,
          ...(item?.stats && typeof item.stats === 'object'
            ? { stats: { ...item.stats, likeCount: expected.count } } : {}) };
      });
      if (!dirty) { complete = true; break; }
      const now = Date.now();
      const saved = await shared.put(snapshot.key, JSON.stringify({
        ...bundle, updatedAt: now,
        payload: { ...bundle.payload, data: { ...data, items } },
      }), {
        onlyIf: { etagMatches: object.etag },
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: { ...(object.customMetadata || {}), targetedLikeRepair: '191',
          mirroredAt: String(now) },
      });
      if (saved) { complete = true; break; }
    }
    if (!complete) throw new Error('[191] shared Feed CAS contention: ' + sort);
  }

  if (oneTime) {
    const marker = await shared.put(PUBLIC_LIKE_REPAIR_MARKER_191,
      JSON.stringify({ schemaVersion: 1, repairedAt: Date.now(), changedTracks: changed.size }), {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
      });
    if (!marker && !(await shared.head(PUBLIC_LIKE_REPAIR_MARKER_191))) {
      throw new Error('[191] one-time repair marker not saved');
    }
  }
  return { changedTracks: changed.size, sampled: ids.length, oneTime };
}

// SORIDRAW_VERIFIED_SHARED_LIKE_SNAPSHOT_REPAIR_156_20260924
// One-time bounded derived R2 repair, not a canonical user-data migration.
// D1 is consulted only once for four confirmed public tracks. All shared R2
// writes use conditional ETags and update only those tracks' public likeCount.
// The marker is committed only after both public first-page snapshots agree.
const VERIFIED_LIKE_REPAIR_MARKER_156 = 'internal/explore/repair-v156/verified-first-page.json';
const VERIFIED_LIKE_REPAIR_TITLES_156 = [
  'Leaving One Step Open', 'Left Unsaid', 'Through the Night', 'Just Stay Here Awhile',
];
async function repairVerifiedSharedLikeSnapshots156(env) {
  const bucket = env?.PROFILE_MEDIA;
  if (!bucket || !env?.DB) throw new Error('[156] missing shared R2 or canonical DB');
  if (await bucket.head(VERIFIED_LIKE_REPAIR_MARKER_156)) return { alreadyRepaired: true };

  const latestKey = sharedFeedR2Key112('latest');
  const latestObject = await bucket.get(latestKey);
  if (!latestObject) throw new Error('[156] shared latest snapshot missing');
  const latestBundle = JSON.parse(await latestObject.text());
  const items = latestBundle?.payload?.data?.items;
  if (!Array.isArray(items)) throw new Error('[156] invalid shared latest snapshot');
  const targetById = new Map();
  for (const titlePart of VERIFIED_LIKE_REPAIR_TITLES_156) {
    const matches = items.filter(item => String(item?.title || '').includes(titlePart));
    if (matches.length !== 1) throw new Error('[156] expected exactly one title: ' + titlePart);
    const id = String(matches[0]?.id || matches[0]?.trackId || '').trim();
    if (!id || targetById.has(id)) throw new Error('[156] invalid/duplicate target id');
    targetById.set(id, null);
  }
  const ids = [...targetById.keys()];
  const sql = 'SELECT t.id, COALESCE(s.like_count,0) AS like_count FROM tracks t ' +
    'LEFT JOIN track_stats s ON s.track_id=t.id WHERE t.id IN (?,?,?,?) ' +
    "AND t.is_public=1 AND t.status='published'";
  const result = await env.DB.prepare(sql).bind(...ids).all();
  const rows = result?.results || [];
  if (rows.length !== ids.length) throw new Error('[156] canonical track mismatch');
  for (const row of rows) {
    const id = String(row?.id || '');
    const count = Number(row?.like_count);
    if (!targetById.has(id) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('[156] invalid canonical count');
    }
    targetById.set(id, count);
  }

  const results = [];
  for (const sort of ['latest', 'popular']) {
    const key = sharedFeedR2Key112(sort);
    let done = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const object = await bucket.get(key);
      if (!object) throw new Error('[156] shared snapshot unavailable: ' + sort);
      const bundle = JSON.parse(await object.text());
      const data = bundle?.payload?.data;
      if (!Array.isArray(data?.items)) throw new Error('[156] invalid shared snapshot: ' + sort);
      const observed = new Set();
      let changed = false;
      const nextItems = data.items.map(item => {
        const id = String(item?.id || item?.trackId || '').trim();
        if (!targetById.has(id)) return item;
        observed.add(id);
        const likeCount = targetById.get(id);
        if (Number(item.likeCount ?? item.stats?.likeCount ?? 0) === likeCount &&
            (!item.stats || Number(item.stats.likeCount ?? likeCount) === likeCount)) return item;
        changed = true;
        return {
          ...item,
          likeCount,
          ...(item.stats && typeof item.stats === 'object'
            ? { stats: { ...item.stats, likeCount } } : {}),
        };
      });
      if (observed.size !== ids.length) throw new Error('[156] target missing in shared ' + sort);
      if (!changed) { done = true; results.push(sort + ':already-current'); break; }
      const saved = await bucket.put(key, JSON.stringify({
        ...bundle, updatedAt: Date.now(),
        payload: { ...bundle.payload, data: { ...data, items: nextItems } },
      }), {
        onlyIf: { etagMatches: object.etag },
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: {
          ...(object.customMetadata || {}),
          targetedLikeRepair: '156',
          mirroredAt: String(Date.now()),
        },
      });
      if (saved) { done = true; results.push(sort + ':patched'); break; }
    }
    if (!done) throw new Error('[156] CAS contention: ' + sort);
  }
  const marker = await bucket.put(VERIFIED_LIKE_REPAIR_MARKER_156,
    JSON.stringify({ schemaVersion: 1, repairedAt: Date.now(), tracks: ids.length }), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
  if (!marker && !(await bucket.head(VERIFIED_LIKE_REPAIR_MARKER_156))) {
    throw new Error('[156] repair marker not persisted');
  }
  return { repaired: true, rows: ids.length, results };
}

// SORIDRAW_PROFILE_SOCIAL_EXTRA_244_20260930
// YouTube is additive public-profile user data stored in the existing shared
// PROFILE_MEDIA bucket. TEST/PRODUCTION code can ignore the object until promoted.
// Reads use the Cache API first, so warm public-profile revisits add no D1 work and
// normally no R2 body read.
const PROFILE_SOCIAL_EXTRA_PREFIX_244 = 'internal/explore/profile-social-extra-v1';
const PROFILE_SOCIAL_EXTRA_EDGE_SECONDS_244 = 60 * 60;

const profileSocialExtraR2Key244 = (uid) => (
  `${PROFILE_SOCIAL_EXTRA_PREFIX_244}/${encodeURIComponent(String(uid || '').trim())}.json`
);

const profileSocialExtraEdgeKey244 = (uid) => new Request(
  `https://soridraw.internal/${profileSocialExtraR2Key244(uid)}`,
  { method: 'GET' },
);

function normalizeProfileExternalUrl244(value) {
  const raw = String(value || '').trim().slice(0, 500);
  if (!raw) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function profileSocialExtraProfileRow244(payload) {
  const data = payload?.data;
  if (data?.profile && typeof data.profile === 'object') return data.profile;
  if (data?.snapshot?.profile && typeof data.snapshot.profile === 'object') return data.snapshot.profile;
  if (data?.uid && typeof data === 'object') return data;
  return null;
}

async function readProfileSocialExtra244(env, uid) {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid || !env?.PROFILE_MEDIA) return { youtubeUrl: '' };
  const edgeKey = profileSocialExtraEdgeKey244(normalizedUid);

  try {
    const hit = await caches.default.match(edgeKey);
    if (hit) {
      const cached = await hit.json();
      return { youtubeUrl: normalizeProfileExternalUrl244(cached?.youtubeUrl) };
    }
  } catch {}

  let stored = { youtubeUrl: '' };
  try {
    const object = await env.PROFILE_MEDIA.get(profileSocialExtraR2Key244(normalizedUid));
    if (object) {
      const parsed = JSON.parse(await object.text());
      stored = { youtubeUrl: normalizeProfileExternalUrl244(parsed?.youtubeUrl) };
    }
  } catch (error) {
    console.warn('[244] profile social extra read skipped:', String(error?.message || error || 'unknown'));
  }

  try {
    await caches.default.put(edgeKey, new Response(JSON.stringify(stored), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${PROFILE_SOCIAL_EXTRA_EDGE_SECONDS_244}`,
      },
    }));
  } catch {}
  return stored;
}

async function writeProfileSocialExtra244(env, uid, youtubeUrl) {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid || !env?.PROFILE_MEDIA) {
    throw new Error('shared PROFILE_MEDIA unavailable');
  }
  const payload = {
    schemaVersion: 1,
    uid: normalizedUid,
    youtubeUrl: normalizeProfileExternalUrl244(youtubeUrl),
    updatedAt: Date.now(),
  };
  await env.PROFILE_MEDIA.put(
    profileSocialExtraR2Key244(normalizedUid),
    JSON.stringify(payload),
    {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { schemaVersion: '1', userData: 'profile-social-extra' },
    },
  );
  try {
    await caches.default.put(profileSocialExtraEdgeKey244(normalizedUid), new Response(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${PROFILE_SOCIAL_EXTRA_EDGE_SECONDS_244}`,
      },
    }));
  } catch {}
  return payload;
}

async function attachProfileSocialExtra244(response, env, youtubeOverride) {
  if (!response?.ok || response.status === 204 || response.status === 304) return response;
  let payload = null;
  try { payload = await response.clone().json(); } catch { return response; }
  const profile = profileSocialExtraProfileRow244(payload);
  const uid = String(profile?.uid || '').trim();
  if (!profile || !uid) return response;

  const extra = youtubeOverride === undefined
    ? await readProfileSocialExtra244(env, uid)
    : { youtubeUrl: normalizeProfileExternalUrl244(youtubeOverride) };
  profile.socialLinks = {
    ...(profile.socialLinks && typeof profile.socialLinks === 'object' ? profile.socialLinks : {}),
    youtube: extra.youtubeUrl || '',
  };

  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('X-SORIDRAW-Profile-Social-Extra', '244');
  const expose = new Set(
    String(headers.get('Access-Control-Expose-Headers') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  expose.add('X-SORIDRAW-Profile-Social-Extra');
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));

  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function profileSocialExtraSaveFailure244(response) {
  const headers = new Headers(response?.headers || {});
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({
    ok: false,
    code: 'PROFILE_SOCIAL_EXTRA_SAVE_FAILED',
    message: 'YouTube 링크를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
  }), { status: 503, headers });
}

// SORIDRAW_EXPLORE_PUBLIC_LIKE_SERVER_ACCEPTED_AT_193_20260924
// Cross-account freshness must compare timestamps from the same clock domain.
// The browser previously published its local Date.now(), then compared it with
// Cloudflare/R2 updatedAt. A skewed device clock could reject the settled card
// on every retry. Add the Worker ACK time to the already-successful batch
// response; this is response metadata only and adds no D1/R2/user-data work.
async function attachPublicLikeAcceptedAt193(request, response, acceptedAt) {
  const url = new URL(request.url);
  if (
    request.method !== 'POST'
    || url.pathname !== EXPLORE_LIKE_BATCH_ROUTE_103
    || !response?.ok
  ) return response;

  let payload = null;
  try { payload = await response.clone().json(); } catch { return response; }
  if (!payload || payload.ok !== true || !payload.data || typeof payload.data !== 'object') {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  return new Response(JSON.stringify({
    ...payload,
    data: {
      ...payload.data,
      publicSignalAcceptedAt: Math.max(1, Math.floor(Number(acceptedAt || Date.now()))),
    },
  }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}


// SORIDRAW_CROSS_ORIGIN_PROFILE_LIKE_CONVERGENCE_358_20261006
// A retained same-account change signal is allowed to spend one bounded shared-R2
// reconciliation. Ordinary profile/likes revisits remain local and never enter
// these routes.
const PROFILE_PUBLICATION_SIGNAL_QUERY_358 = '__soridraw_publication_signal';
const PERSONAL_LIKE_REPAIR_QUERY_358 = '__soridraw_cross_origin_repair';
const SHARED_PROFILE_PREFIX_358 = 'internal/explore/shared-profile-v113';
const SHARED_PROFILE_ALIAS_PREFIX_358 = 'internal/explore/shared-profile-alias-v113';
const SHARED_LIKES_PREFIX_358 = 'internal/explore/shared-social-v114/likes';
const LIKE_CUTOVER_KEY_358 = 'internal/explore/like-cutover-v162/active.json';

const sharedProfileKey358 = (uid) =>
  `${SHARED_PROFILE_PREFIX_358}/${encodeURIComponent(String(uid || '').trim())}.json`;
const sharedProfileAliasKey358 = (handle) =>
  `${SHARED_PROFILE_ALIAS_PREFIX_358}/${encodeURIComponent(String(handle || '').trim().replace(/^@+/, '').toLowerCase())}.json`;
const sharedLikesKey358 = (uid) =>
  `${SHARED_LIKES_PREFIX_358}/${encodeURIComponent(String(uid || '').trim())}.json`;

function validSharedProfileBundle358(bundle) {
  const data = bundle?.body?.data;
  const profile = data?.profile || data?.snapshot?.profile;
  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.tracks?.items)
      ? data.tracks.items
      : Array.isArray(data?.snapshot?.items)
        ? data.snapshot.items
        : null;
  return Boolean(profile?.uid) && Array.isArray(items);
}

async function readSharedProfileSignal358(env, profileRef) {
  const bucket = env?.PROFILE_MEDIA || null;
  const normalized = String(profileRef || '').trim().replace(/^@+/, '');
  if (!bucket || !normalized) return { bundle: null, r2Reads: 0 };

  let r2Reads = 0;
  const directObject = await bucket.get(sharedProfileKey358(normalized));
  r2Reads += 1;
  if (directObject) {
    try {
      const direct = JSON.parse(await directObject.text());
      if (validSharedProfileBundle358(direct)) return { bundle: direct, r2Reads };
    } catch {}
  }

  const aliasObject = await bucket.get(sharedProfileAliasKey358(normalized));
  r2Reads += 1;
  if (!aliasObject) return { bundle: null, r2Reads };
  let alias = null;
  try { alias = JSON.parse(await aliasObject.text()); } catch {}
  const uid = String(alias?.uid || '').trim();
  if (!uid) return { bundle: null, r2Reads };

  const targetObject = await bucket.get(sharedProfileKey358(uid));
  r2Reads += 1;
  if (!targetObject) return { bundle: null, r2Reads };
  try {
    const bundle = JSON.parse(await targetObject.text());
    return { bundle: validSharedProfileBundle358(bundle) ? bundle : null, r2Reads };
  } catch {
    return { bundle: null, r2Reads };
  }
}

function profileSignalHeaders358(request, revision, r2Reads) {
  const origin = String(request.headers.get('Origin') || '');
  const headers = new Headers();
  if (RELEASE_ALLOWED_ORIGINS_036.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', '0');
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-R2-B', String(Math.max(0, Number(r2Reads || 0))));
  headers.set('X-SORIDRAW-Profile-Edge-Cache', 'SHARED-SIGNAL-358');
  if (revision) headers.set('X-SORIDRAW-Profile-Revision', revision);
  headers.set('Access-Control-Expose-Headers', [
    'X-SORIDRAW-CF-Worker',
    'X-SORIDRAW-D1-Read',
    'X-SORIDRAW-D1-Write',
    'X-SORIDRAW-R2-B',
    'X-SORIDRAW-Profile-Edge-Cache',
    'X-SORIDRAW-Profile-Revision',
  ].join(', '));
  return headers;
}

async function handlePublicationSignalProfile358(request, env) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/v1\/profiles\/([^/]+)\/first-view$/);
  if (!match) return null;
  const ref = decodeURIComponent(match[1] || '');
  const selected = await readSharedProfileSignal358(env, ref);
  if (!selected.bundle) return null;

  const revision = String(
    selected.bundle?.revision
    || selected.bundle?.body?.data?.revision
    || selected.bundle?.body?.data?.snapshot?.revision
    || '',
  ).trim();
  const knownRevision = String(url.searchParams.get('knownRevision') || '').trim();
  const headers = profileSignalHeaders358(request, revision, selected.r2Reads);
  if (knownRevision && revision && knownRevision === revision) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(JSON.stringify(selected.bundle.body), { status: 200, headers });
}

function isExactSharedLike358(bundle, uid) {
  const normalized = String(uid || '').trim();
  if (!normalized || !bundle || Number(bundle.schemaVersion) !== 1
      || String(bundle.uid || '').trim() !== normalized
      || !Array.isArray(bundle.likedTrackIds)) return false;
  const ids = bundle.likedTrackIds.map((id) => String(id || '').trim()).filter(Boolean);
  return bundle.canonicalComplete156 === true
    && Boolean(String(bundle.canonicalSource156 || '').trim())
    && Number.isSafeInteger(Number(bundle.exactLikeCount156))
    && Number(bundle.exactLikeCount156) === ids.length
    && new Set(ids).size === ids.length;
}

async function readLikeCutoverMode358(env) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket) return 'unavailable';
  const object = await bucket.get(LIKE_CUTOVER_KEY_358);
  if (!object) return 'legacy';
  try {
    const value = JSON.parse(await object.text());
    const mode = String(value?.relationMode || '').trim();
    if (mode === 'overlay157' || mode === 'd1only171') return mode;
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

async function repairSharedPersonalLike358(env, uid) {
  const normalizedUid = String(uid || '').trim();
  const bucket = env?.PROFILE_MEDIA || null;
  if (!normalizedUid || !bucket || !env?.DB) return 'unavailable';

  const key = sharedLikesKey358(normalizedUid);
  const object = await bucket.get(key);
  let previous = null;
  if (object) {
    try { previous = JSON.parse(await object.text()); } catch {}
  }
  if (isExactSharedLike358(previous, normalizedUid)) return 'already-exact';

  // The current live product is still on the proven legacy relation authority.
  // Never guess across a future overlay/D1-only cutover from this compatibility
  // repair path; a future cutover must ship its own exact catalog reader.
  const cutoverMode = await readLikeCutoverMode358(env);
  if (cutoverMode !== 'legacy') return 'cutover-not-supported';

  const queued = await env.DB.prepare(
    'SELECT ' +
    '(SELECT COUNT(*) FROM explore_like_batches_069 WHERE user_uid=?) AS q069, ' +
    '(SELECT COUNT(*) FROM explore_like_user_queue_075 q ' +
      'CROSS JOIN explore_like_user_queue_state_075 s ' +
      'WHERE q.user_uid=? AND ' +
      '(q.updated_at>s.processed_at OR ' +
       '(q.updated_at=s.processed_at AND q.user_uid>s.processed_uid))) AS q075'
  ).bind(normalizedUid, normalizedUid).first();
  if (!queued || Number(queued.q069 || 0) || Number(queued.q075 || 0)) return 'pending';

  const raw = await env.DB.prepare(
    'SELECT l.track_id FROM likes l JOIN tracks t ON t.id=l.track_id ' +
    "WHERE l.user_uid=? AND t.is_public=1 AND t.status='published' " +
    'ORDER BY l.created_at DESC LIMIT 2001'
  ).bind(normalizedUid).all();
  if (!Array.isArray(raw?.results) || raw.results.length > 2000) return 'unverifiable';

  const actual = raw.results.map((row) => String(row?.track_id || '').trim()).filter(Boolean);
  if (actual.length !== raw.results.length || new Set(actual).size !== actual.length) return 'unverifiable';

  const next = {
    ...(previous && typeof previous === 'object' ? previous : {}),
    schemaVersion: 1,
    uid: normalizedUid,
    likedTrackIds: actual,
    canonicalComplete156: true,
    canonicalSource156: 'verified-cross-origin-d1-358',
    exactLikeCount156: actual.length,
    updatedAt: Date.now(),
  };
  const options = {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: {
      ...(object?.customMetadata || {}),
      metadataRepair: '358',
      updatedAt: String(next.updatedAt),
    },
  };
  const saved = object
    ? await bucket.put(key, JSON.stringify(next), {
        ...options,
        onlyIf: { etagMatches: object.etag },
      })
    : await bucket.put(key, JSON.stringify(next), {
        ...options,
        onlyIf: { etagDoesNotMatch: '*' },
      });
  return saved ? 'canonical-repaired' : 'concurrent-change';
}

async function handleCrossOriginPersonalLikeRepair358(request, env, ctx) {
  const actor = await validateExploreAuth307(request, env, ctx);
  if (!actor.ok) return baseWorker.fetch(request, env, ctx);

  let repairStatus = 'skipped';
  try {
    repairStatus = await repairSharedPersonalLike358(env, actor.uid);
  } catch (error) {
    console.warn('[358] bounded personal-like repair deferred:', String(error?.message || error || 'unknown'));
    repairStatus = 'error';
  }

  const response = await baseWorker.fetch(request, env, ctx);
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('X-SORIDRAW-Personal-Like-Repair', repairStatus);
  const expose = new Set(
    String(headers.get('Access-Control-Expose-Headers') || '')
      .split(',').map((item) => item.trim()).filter(Boolean),
  );
  expose.add('X-SORIDRAW-Personal-Like-Repair');
  headers.set('Access-Control-Expose-Headers', Array.from(expose).join(', '));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// STAGE420_ALTERNATIVE_GUARD_EXISTING_075_069_CANONICAL_BATCH
// Security-first, cost-focused alternative to the 426/D1-only migration.
// This path preserves the existing healthy baseWorker like write/scheduler/
// R2 publication and does NOT require the absent 174 or 419 D1 tables.
// It is hard OFF until a coordinated old-client force-refresh/Rules/Functions
// release has been independently audited and explicitly approved.
// It must never be enabled alongside the 426 replacement writer.
const STAGE420_SIGNED_LEGACY_INTAKE_OPEN = false;
async function verifySignedLegacyLikeIntake420(request, env, ctx) {
  const headers = like426Headers(request);
  const failure = (status, code) => new Response(JSON.stringify({
    ok:false, error:{code, message:
      '좋아요 승인 상태를 확인하지 못했습니다. 기기에 보관한 변경을 유지해 주세요.'},
  }), {status, headers});
  try {
    // Reject unverified account claims BEFORE consulting the existing Worker
    // queue. A valid HMAC alone is not proof of the calling Firebase user.
    const identity = await validateExploreAuth307(request,env,ctx);
    if (!identity.ok) return identity.response;
    if (typeof env?.SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET !== 'string' ||
        !env.SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET) {
      return failure(503,'420_SIGNED_LEGACY_KEY_UNAVAILABLE');
    }
    const body=await request.clone().json().catch(()=>null);
    // An authenticated old app has no server-issued HMAC certificate.
    // During the coordinated cutover it must update before another like is
    // accepted. No canonical/queue D1 or R2 work happens on this 409 path.
    // Its old durable local outbox is not mutated by this Worker response.
    if (body && Array.isArray(body.mutations) &&
        body.mutations.length > 0 && body.mutations.length <= 50 &&
        body.mutations.some(row => !row || typeof row.guardPermit420 !== 'string' ||
          row.guardPermit420.length === 0)) {
      return new Response(JSON.stringify({
        ok:false,error:{code:'420_APP_UPGRADE_REQUIRED',
          message:'좋아요 저장을 계속하려면 최신 앱 업데이트를 적용해 주세요. 미전송 변경은 기기에 보관됩니다.'},
      }),{status:409,headers});
    }
    await verifyGuardedLikeBatch420({
      authenticatedUid:identity.uid,
      body,secretBase64Url:env.SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET,
      nowMs:Date.now(),
    });
    // The caller continues through the SAME existing legacy baseWorker
    // canonical path, 069 queue scheduler, 127 personal state and R2
    // projections; no new 171 relation schema is introduced by this guard.
    return null;
  } catch {
    return failure(403,'420_SIGNED_LEGACY_PROOF_DENIED');
  }
}

// SORIDRAW_426_DORMANT_LIKE_BATCH_V171_ROUTE_20261009
// Fail-closed only. Wrangler does NOT define SORIDRAW_LIKE_171_READY.
// Legacy /v1/me/likes/batch remains the EXACT previous Worker path.
// Even with the explicit var, all 3 environment/DB/manifest/legacy-fence
// proofs must agree before accepting a canonical mutation.
const STAGE426_COMPILED_OPEN = false; // explicit later release commit required
const likeCutoverManifestKey426='internal/explore/like-cutover-v162/active.json';
async function proveLikeBatchCutover426(env) {
  if (!STAGE426_COMPILED_OPEN||env?.SORIDRAW_LIKE_171_READY!=='1')
    throw new Error('426_FLAG_NOT_ENABLED');
  if(!env?.DB?.prepare||!env?.PROFILE_MEDIA?.get)throw new Error('426_BINDINGS_MISSING');
  const manifest=await env.PROFILE_MEDIA.get(likeCutoverManifestKey426);
  if(!manifest)throw new Error('426_CUTOVER_MANIFEST_ABSENT');
  let value;
  try{value=JSON.parse(await manifest.text());}catch{throw new Error('426_CUTOVER_MANIFEST_INVALID');}
  const proof=value?.preCutoverProof172;
  const names=['preview','test','production'];
  const sha=String(proof?.approvedWorkerSha256||'').toLowerCase();
  const validSha=/^[0-9a-f]{64}$/.test(sha)&&names.every(name=>
    String(proof?.workerSha256ByEnvironment?.[name]||'').toLowerCase()===sha&&
    Boolean(proof?.workerVersionByEnvironment?.[name])&&
    proof?.workerMarkerReadyByEnvironment?.[name]===true);
  const drained=['035','066','069','075'].every(name=>
    proof?.legacyQueueRows?.[name]===0);
  if(value?.schemaVersion!==2||value?.relationMode!=='d1only171'||
     value?.ownerProtocol!=='d1-only-171'||
     value?.legacyRelationWritersFrozen!==true||
     value?.legacyCountWritersFrozen!==true||
     value?.allEnvironmentReadersReady!==true||
     value?.allEnvironmentWritersReady!==true||
     proof?.schemaVersion!==1||
     proof?.proofAuthority!=='release-controller-174'||
     proof?.legacyIntakeClosed!==true||
     proof?.legacyProcessorIdle!==true||
     proof?.allEnvironmentWorkerShaVerified!==true||
     proof?.d1AtomicFenceReady!==true||
     proof?.d1FenceTable!=='explore_like_cutover_control_174'||
     proof?.d1FencePhase!=='frozen'||
     proof?.d1OnlySchemaOwnerReady!==true||
     proof?.d1OnlySchemaOwner!=='shared-d1'||
     proof?.relationTable!=='explore_like_overrides_171'||
     proof?.countTable!=='explore_like_count_deltas_171'||
     proof?.ownerProtocol!=='d1-only-171'||!validSha||!drained) {
    throw new Error('426_CUTOVER_MANIFEST_NOT_FULLY_ARMED');
  }
  const [phase,legacyFence,schema]=await Promise.all([
    env.DB.prepare('SELECT phase FROM explore_like_writer_phase_419 WHERE id=1').first(),
    env.DB.prepare('SELECT phase,approved_worker_sha256,drain_token_hash FROM explore_like_cutover_control_174 WHERE id=1').first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='table' AND name IN ('explore_like_overrides_171','explore_like_count_deltas_171')").first(),
  ]);
  if(phase?.phase!=='overlay'||legacyFence?.phase!=='frozen'||
     String(legacyFence?.approved_worker_sha256||'').toLowerCase()!==sha||
     String(legacyFence?.drain_token_hash||'').toLowerCase()!==
       String(proof?.drainTokenHash||'').toLowerCase()||
     Number(schema?.n)!==2) {
    throw new Error('426_SHARED_D1_FENCE_OR_SCHEMA_NOT_READY');
  }
  return true;
}

function like426Headers(request) {
  const origin=request.headers.get('Origin')||'';
  const headers=new Headers({
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    Vary:'Origin',
  });
  if(['https://preview.soridraw.com','https://test.soridraw.com',
      'https://soridraw.com','http://localhost:5173'].includes(origin)){
    headers.set('Access-Control-Allow-Origin',origin);
  }
  return headers;
}

// Stage433: only upgraded clients with legacy pending intents ask for these
// exact server revisions; never invoked during normal Feed/page re-entry.
async function handleLikeReconcile433(request,env,ctx) {
  const headers=like426Headers(request);
  headers.set('Access-Control-Allow-Methods','GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers','Authorization, X-Firebase-AppCheck, Content-Type');
  try {
    const actor=await validateExploreAuth307(request,env,ctx);
    if(!actor.ok)return actor.response;
    const raw=new URL(request.url).searchParams.get('trackIds')||'';
    const ids=raw.split(',').map(x=>x.trim()).filter(Boolean);
    if(ids.length<1||ids.length>10||ids.some(x=>x.length>512)||
       new Set(ids).size!==ids.length)
      return new Response(JSON.stringify({ok:false,error:{code:'433_INVALID_TARGETS'}}),
        {status:400,headers});
    if(!env?.LIKE_RATE_LIMITER?.limit)
      throw new Error('433_RATE_LIMITER_UNAVAILABLE');
    const quota=await env.LIKE_RATE_LIMITER.limit({key:actor.uid});
    if(quota?.success!==true)throw new Error('433_RATE_LIMIT_REACHED');
    await proveLikeBatchCutover426(env);
    const payload=await readAuthoritativeLikeIntents433({
      db:env.DB,uid:actor.uid,trackIds:ids,
      allEnvironmentCutoverVerified:true,
    });
    return new Response(JSON.stringify(payload),{status:200,headers});
  }catch(error){
    return new Response(JSON.stringify({ok:false,error:{
      code:'433_AUTHORITATIVE_RECONCILIATION_UNAVAILABLE',
      message:'기존 좋아요 상태를 안전하게 확인하지 못했습니다. 이전 변경 기록은 유지합니다.',
    }}),{status:503,headers});
  }
}

async function handleVerifiedLikeBatch426(request,env,ctx) {
  const headers=like426Headers(request);
  try {
    // Authorize FIRST: an unauthenticated POST must never touch D1 or R2.
    const actor=await validateExploreAuth307(request,env,ctx);
    if(!actor.ok)return actor.response;
    // Stage420: this entire 171 writer remains HARD-DORMANT at compile time.
    // When a separately audited 3-environment cutover eventually enables it,
    // every mutation MUST carry a short-lived permit from the authenticated
    // Firebase server. Invalid/missing/other-UID permits are rejected before
    // any Worker R2 proof, D1 read/write or queue enqueue.
    // No Firebase read is added to a successfully authorized Worker batch.
    const body=await request.json().catch(()=>null);
    if (!env?.SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET)
      throw new Error('420_GUARD_SIGNING_KEY_MISSING');
    await verifyGuardedLikeBatch420({
      authenticatedUid:actor.uid,body,
      secretBase64Url:env.SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET,
      nowMs:Date.now(),
    });
    // The existing legacy Worker limits accepted like batches. The new
    // branch must preserve a bounded per-UID cost, not bypass abuse limits.
    if(!env?.LIKE_RATE_LIMITER?.limit)
      throw new Error('426_LIKE_RATE_LIMITER_UNAVAILABLE');
    const quota=await env.LIKE_RATE_LIMITER.limit({key:actor.uid});
    if(quota?.success!==true)
      throw new Error('426_AUTHENTICATED_LIKE_RATE_LIMIT_REACHED');
    await proveLikeBatchCutover426(env);
    const router=createCandidateLikeBatch422({
      db:env.DB,sharedR2:env.PROFILE_MEDIA,allEnvironmentCutoverVerified:true,
      authenticatedUid:actor.uid,firebaseIdToken:actor.idToken,
      firebaseTokenVerified:true,
      resolveOwnerUid:async id=>{
        const row=await env.DB.prepare(
          "SELECT owner_uid FROM tracks WHERE id=? AND is_public=1 AND status='published' LIMIT 1"
        ).bind(id).first();
        return String(row?.owner_uid||'');
      },
    });
    const result=await router.acceptAuthenticatedBatch(actor.uid,body);
    return new Response(JSON.stringify({
      ...result,data:{...result.data,publicSignalAcceptedAt:Date.now()},
    }),{status:200,headers});
  } catch(error) {
    const code=String(error?.code||error?.message||'426_SETTLEMENT_UNAVAILABLE');
    const status=code==='420_GUARD_PERMIT_DENIED'?403:
      code.includes('INVALID')||code.includes('NEEDS_COMPATIBILITY')||
      code.includes('AUTH_UID_MISMATCH')?409:503;
    return new Response(JSON.stringify({
      ok:false,error:{code:'LIKE_426_SAFE_RETRY',message:
        '좋아요 저장을 확인 중입니다. 변경 상태를 유지하고 다시 시도해 주세요.'},
    }),{status,headers});
  }
}


// Stage416: AUTHENTICATED real shared-D1 route candidate; HARD OFF until
// 3-environment writer migration, Master policy, R2/RTDB and costs are proven.
const STAGE416_SHARED_D1_INTAKE_ACTIVE = false;
const STAGE416_CLICK_ROUTE = '/v1/me/likes/private-click-416';
async function handlePrivateLikeRoute416(request,env,ctx,url) {
  const headers=like426Headers(request);
  headers.set('Access-Control-Allow-Methods','POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers','Authorization, X-Firebase-AppCheck, Content-Type, X-Soridraw-Private-Clock');
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  if(STAGE420_SIGNED_LEGACY_INTAKE_OPEN||STAGE426_COMPILED_OPEN)
    return reply(503,{ok:false,error:{code:'416_MULTIPLE_WRITERS_BLOCKED'}});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.headers.get('X-Soridraw-Private-Clock')!=='416')
    return reply(409,{ok:false,error:{code:'416_CLIENT_UPGRADE_REQUIRED'}});
  if(!env?.DB?.prepare||!env?.DB?.batch)
    return reply(503,{ok:false,error:{code:'416_SHARED_D1_UNAVAILABLE'}});
  const minutes=Number(env?.STAGE416_PRIVATE_CANONICAL_MINUTES);
  if(![1,3,5,10,20].includes(minutes))
    return reply(503,{ok:false,error:{code:'416_MASTER_TIMING_UNAVAILABLE'}});
  const actor=await validateExploreAuth307(request,env,ctx);
  if(!actor.ok)return actor.response;
  if(url.pathname===STAGE416_CLICK_ROUTE){
    if(!env?.LIKE_RATE_LIMITER?.limit)
      return reply(503,{ok:false,error:{code:'416_RATE_GUARD_UNAVAILABLE'}});
    const limited=await env.LIKE_RATE_LIMITER.limit({key:actor.uid});
    if(!limited?.success)return reply(429,{ok:false,error:{code:'416_TOO_MANY_CLICKS'}});
    const body=await request.json().catch(()=>null);
    try{
      const result=await registerPrivateClick416(env.DB,actor.uid,body,Date.now(),minutes);
      return reply(200,{ok:true,data:{...result,canonicalD1:'private-pending-416'}});
    }catch(error){
      if(String(error?.message||'').startsWith('416_BAD_'))
        return reply(400,{ok:false,error:{code:'416_INVALID_CLICK'}});
      console.error('[416] private click failed',String(error?.message||error));
      return reply(503,{ok:false,error:{code:'416_PRIVATE_CLICK_UNAVAILABLE'}});
    }
  }
  try{
    const result=await commitPrivateWindow416(env.DB,actor.uid,Date.now());
    if(!result.committed)return reply(200,{ok:true,data:{...result,queued:false}});
    // Queue rows and versioned deletion committed atomically in SAME D1.batch.
    // Scheduling failure cannot reinsert an already-claimed window.
    try{await scheduleExploreLikeAggregate103(env);}
    catch(error){
      console.error('[416] durable queued batch not scheduled',String(error?.message||error));
      return reply(503,{ok:false,error:{code:'416_SCHEDULER_RETRY_NEEDED'},
        data:{queued:true,batchIds:result.batchIds}});
    }
    return reply(200,{ok:true,data:{...result,queued:true,canonicalD1:'queued'}});
  }catch(error){
    console.error('[416] shared-D1 handoff failed',String(error?.message||error));
    return reply(503,{ok:false,error:{code:'416_PRIVATE_COMMIT_UNAVAILABLE'}});
  }
}


// Stage416 signed RTDB-sealed Function handoff: deliberately HARD OFF.
// A signed claim is the only authorized new writer. Direct legacy /batch
// remains unchanged until all shared-data environments move together.
const STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE=true;
const STAGE416_SIGNED_PRIVATE_HANDOFF_ROUTE='/v1/internal/private-like-handoff-416';
// PREVIEW controlled release only. TEST/PRODUCTION use separate Workers and
// remain unchanged. The canonical bundle below defers only signed Stage416 IDs.
const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE=false;
const STAGE416_PUBLIC_WINDOW_ROUTE='/v1/internal/public-like-window-416';
const STAGE416_PUBLIC_WINDOW_ACK_ROUTE='/v1/internal/public-like-window-416/ack';
const STAGE416_PUBLIC_RELEASE_ROUTE='/v1/internal/public-like-release-416';
async function handleSignedPrivateHandoff416(request,env){
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store'});
 const fail=(code,status=503)=>new Response(JSON.stringify({ok:false,
   error:{code}}),{status,headers});
 if(STAGE420_SIGNED_LEGACY_INTAKE_OPEN||STAGE426_COMPILED_OPEN||
    STAGE416_SHARED_D1_INTAKE_ACTIVE)return fail('416_MULTIPLE_CANONICAL_WRITERS');
 const secret=env?.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET;
 if(typeof secret!=='string'||secret.length<32||!env?.DB?.batch)
   return fail('416_PRIVATE_HANDOFF_BINDING_UNAVAILABLE');
 const raw=await request.text();
 if(!await verifyPrivateHmac416(raw,request.headers.get('X-Soridraw-416-Signature'),secret))
   return fail('416_PRIVATE_HANDOFF_SIGNATURE_DENIED',403);
 let claim;
 try{claim=validatePrivateHandoff416(JSON.parse(raw),Date.now());}
 catch{return fail('416_PRIVATE_HANDOFF_INVALID',400);}
 try{
   const result=await acceptPrivateHandoff416(env.DB,claim);
   if(!result.accepted)return fail('416_STALE_OR_DIFFERENT_BATCH',409);
   try{await scheduleExploreLikeAggregate103(env);}
   catch(error){
     console.error('[416] saved handoff awaiting scheduler',String(error?.message||error));
     return new Response(JSON.stringify({ok:false,
       error:{code:'416_DURABLE_QUEUE_SCHEDULER_PENDING'},
       data:{queued:true,version:result.version,batchIds:result.batchIds}}),
       {status:503,headers});
   }
   const final=await finalizePrivateHandoff416({
     db:env.DB,r2:env.PROFILE_MEDIA,uid:claim.uid,windowId:claim.windowId,
     version:claim.version,batchIds:result.batchIds,rows:claim.rows,
     finalEndpoint:env.SORIDRAW_PRIVATE_FINAL416_ENDPOINT,secret,
   });
   return new Response(JSON.stringify({ok:true,data:{...result,
     queued:true,canonicalD1:'settled',canonicalProof:'atomic-drain-batch-418',
     personalLikeSnapshot:'changed-track-r2',finalReceipt:final.receiptStatus}}),
     {status:200,headers});
 }catch(error){
   console.error('[416] private signed handoff failed',String(error?.message||error));
   return fail('416_PRIVATE_HANDOFF_UNAVAILABLE');
 }
}

async function registerPublicLikeWindowOnSharedDo416(env,event){
 const namespace=env?.EXPLORE_LIKE_BATCH_SCHEDULER;
 if(!namespace)throw Error('416_PUBLIC_DO_BINDING_UNAVAILABLE');
 const id=namespace.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103);
 const response=await namespace.get(id).fetch('https://soridraw.internal/public-register',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),
 });
 const payload=await response.json().catch(()=>null);
 if(response.status===409&&payload?.error?.code==='416_PUBLIC_WINDOW_DUE')
   return {registered:false,needsRelease:true};
 if(!response.ok||payload?.ok!==true||payload?.data?.registered!==true)
   throw Error('416_PUBLIC_DO_REGISTER_FAILED');
 return payload.data;
}
async function handleSignedPublicLikeWindow416(request,env){
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store'});
 const fail=(code,status=503)=>new Response(JSON.stringify({ok:false,error:{code}}),
   {status,headers});
 const secret=env?.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET;
 if(typeof secret!=='string'||secret.length<32)return fail('416_PUBLIC_BINDING_UNAVAILABLE');
 const raw=await request.text();
 if(!await verifyPrivateHmac416(raw,request.headers.get('X-Soridraw-416-Public-Signature'),secret))
   return fail('416_PUBLIC_SIGNATURE_DENIED',403);
 let body;
 try{body=JSON.parse(raw);}catch{return fail('416_PUBLIC_BAD_JSON',400);}
 const signedAtMs=Number(body?.signedAtMs||0),now=Date.now();
 if(!Number.isSafeInteger(signedAtMs)||signedAtMs<now-15*60_000||signedAtMs>now+30_000)
   return fail('416_PUBLIC_STALE_SIGNATURE',409);
 try{
   const data=await registerPublicLikeWindowOnSharedDo416(env,body);
   if(data?.needsRelease)return fail('416_PUBLIC_WINDOW_DUE',409);
   return new Response(JSON.stringify({ok:true,data}),{status:200,headers});
 }catch(error){
   console.error('[416] public window register failed',String(error?.message||error));
   return fail('416_PUBLIC_REGISTER_UNAVAILABLE');
 }
}

async function handlePublicLikeManifestIntersect416(request,env){
 const origin=String(request.headers.get('Origin')||'');
 const headers=new Headers();
 if(RELEASE_ALLOWED_ORIGINS_036.has(origin)){
   headers.set('Access-Control-Allow-Origin',origin);
   headers.set('Access-Control-Allow-Methods','POST, OPTIONS');
   headers.set('Access-Control-Allow-Headers','Content-Type');
   headers.set('Vary','Origin');
 }
 headers.set('Content-Type','application/json; charset=utf-8');
 headers.set('Cache-Control','no-store');
 headers.set('X-SORIDRAW-CF-Diagnostics','416-MANIFEST');
 headers.set('X-SORIDRAW-D1-Read','0');
 headers.set('X-SORIDRAW-D1-Write','0');
 headers.set('X-SORIDRAW-D1-Read-Queries','0');
 headers.set('X-SORIDRAW-D1-Write-Queries','0');
 headers.set('X-SORIDRAW-R2-B','0');
 headers.set('Access-Control-Expose-Headers',
   'X-SORIDRAW-CF-Diagnostics, X-SORIDRAW-D1-Read, X-SORIDRAW-D1-Write, X-SORIDRAW-D1-Read-Queries, X-SORIDRAW-D1-Write-Queries, X-SORIDRAW-R2-B');
 const fail=(status,code)=>new Response(JSON.stringify({ok:false,error:{code}}),
   {status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return fail(405,'416_PUBLIC_MANIFEST_METHOD');
 const url=new URL(request.url);
 const body=await request.json().catch(()=>null);
 const requested=[...new Set(Array.isArray(body?.trackIds)
   ?body.trackIds.map(x=>String(x||'').trim()).filter(Boolean):[])];
 let meta;
 try{
   meta=validatePublicLikeManifestMetadata416({
     schemaVersion:1,windowId:String(body?.windowId||''),
     deadlineAtMs:Number(body?.deadlineAtMs),
     digest:String(body?.digest||''),
     count:Number(body?.count),
     slot:Number(body?.slot),
   });
   if(!requested.length||requested.length>200||
      requested.some(id=>!id||id.length>512))
     throw Error('416_PUBLIC_MANIFEST_INTERSECT_BAD_TRACK');
 }catch{return fail(400,'416_PUBLIC_MANIFEST_REQUEST_INVALID');}
 if(!env?.PROFILE_MEDIA)return fail(503,'416_PUBLIC_MANIFEST_R2_UNAVAILABLE');

 const cacheUrl=new URL('/__soridraw/public-like-manifest-v416/'+
   meta.slot+'/'+meta.digest,url.origin);
 const cacheKey=new Request(cacheUrl.toString(),{method:'GET'});
 let manifest=null,r2Reads=0;
 try{
   const cached=await caches.default.match(cacheKey);
   if(cached){
     manifest=await cached.json();
   }else{
     const loaded=await readPublicLikeManifest416(env.PROFILE_MEDIA,meta);
     r2Reads=Number(loaded?.r2Reads||0);
     if(!loaded?.rows)return fail(409,'416_PUBLIC_MANIFEST_SUPERSEDED');
     manifest={meta:loaded.meta,rows:loaded.rows};
     await caches.default.put(cacheKey,new Response(JSON.stringify(manifest),{
       headers:{'Content-Type':'application/json; charset=utf-8',
         'Cache-Control':'public, max-age=240'},
     }));
   }
   const rows=intersectPublicLikeManifest416(manifest?.rows,requested);
   headers.set('X-SORIDRAW-R2-B',String(r2Reads));
   return new Response(JSON.stringify({ok:true,data:{rows,
     windowId:meta.windowId,deadlineAtMs:meta.deadlineAtMs,digest:meta.digest}}),
     {status:200,headers});
 }catch(error){
   console.warn('[416] public manifest intersect failed',
     String(error?.message||error||'unknown'));
   return fail(503,'416_PUBLIC_MANIFEST_UNAVAILABLE');
 }
}

async function handleSignedPublicLikeRelease416(request,env){
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store'});
 const fail=(code,status=503)=>new Response(JSON.stringify({ok:false,error:{code}}),
   {status,headers});
 const secret=env?.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET;
 if(typeof secret!=='string'||secret.length<32)return fail('416_PUBLIC_BINDING_UNAVAILABLE');
 const raw=await request.text();
 if(!await verifyPrivateHmac416(raw,
    request.headers.get('X-Soridraw-416-Public-Task-Signature'),secret))
   return fail('416_PUBLIC_TASK_SIGNATURE_DENIED',403);
 let body;
 try{body=JSON.parse(raw);}catch{return fail('416_PUBLIC_BAD_JSON',400);}
 const signedAtMs=Number(body?.signedAtMs||0),deadlineAtMs=Number(body?.deadlineAtMs||0);
 const windowId=String(body?.windowId||''),now=Date.now();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(windowId)||
    !Number.isSafeInteger(deadlineAtMs)||deadlineAtMs<=0||
    !Number.isSafeInteger(signedAtMs)||signedAtMs<now-15*60_000||signedAtMs>now+30_000)
   return fail('416_PUBLIC_TASK_INVALID',400);
 try{
   const namespace=env?.EXPLORE_LIKE_BATCH_SCHEDULER;
   if(!namespace)throw Error('416_PUBLIC_DO_BINDING_UNAVAILABLE');
   const id=namespace.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103);
   const response=await namespace.get(id).fetch('https://soridraw.internal/public-release',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({windowId,deadlineAtMs}),
   });
   const payload=await response.json().catch(()=>null);
   if(response.status===425||response.status===409)
     return fail(payload?.error?.code||'416_PUBLIC_RELEASE_RETRY',503);
   if(!response.ok||payload?.ok!==true)
     throw Error(payload?.error?.code||'416_PUBLIC_RELEASE_FAILED');
   return new Response(JSON.stringify({ok:true,data:payload.data}),{status:200,headers});
 }catch(error){
   console.error('[416] public release task failed',String(error?.message||error));
   return fail('416_PUBLIC_RELEASE_UNAVAILABLE');
 }
}

async function handleSignedPublicLikeWindowAck416(request,env){
 const headers=new Headers({'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store'});
 const fail=(code,status=503)=>new Response(JSON.stringify({ok:false,error:{code}}),
   {status,headers});
 const secret=env?.SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET;
 if(typeof secret!=='string'||secret.length<32)return fail('416_PUBLIC_BINDING_UNAVAILABLE');
 const raw=await request.text();
 if(!await verifyPrivateHmac416(raw,request.headers.get('X-Soridraw-416-Public-Signature'),secret))
   return fail('416_PUBLIC_SIGNATURE_DENIED',403);
 let body;
 try{body=JSON.parse(raw);}catch{return fail('416_PUBLIC_BAD_JSON',400);}
 const signedAtMs=Number(body?.signedAtMs||0),now=Date.now();
 if(!Number.isSafeInteger(signedAtMs)||signedAtMs<now-15*60_000||signedAtMs>now+30_000)
   return fail('416_PUBLIC_STALE_SIGNATURE',409);
 try{
   const namespace=env?.EXPLORE_LIKE_BATCH_SCHEDULER;
   if(!namespace)throw Error('416_PUBLIC_DO_BINDING_UNAVAILABLE');
   const id=namespace.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103);
   const response=await namespace.get(id).fetch('https://soridraw.internal/public-ack',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({eventId:String(body?.eventId||'')}),
   });
   const payload=await response.json().catch(()=>null);
   if(!response.ok||payload?.ok!==true||payload?.data?.acked!==true)
     throw Error('416_PUBLIC_ACK_FAILED');
   return new Response(JSON.stringify({ok:true,data:payload.data}),{status:200,headers});
 }catch(error){
   console.error('[416] public window ack failed',String(error?.message||error));
   return fail('416_PUBLIC_ACK_UNAVAILABLE');
 }
}

export default {
  async scheduled(controller, env, ctx) {
    // SORIDRAW_PREDEPLOY_PENDING_LIKE_DRAIN_192_20260924
    // Release-only escape hatch for a queue row accepted by the previous Worker
    // but left without a live alarm. No production cron uses this label.
    // Settle that already-accepted user action, then repair only the bounded
    // public first-page derived R2 projection before a Worker version swap.
    if (controller?.cron === 'soridraw-preview-pending-like-drain-192') {
      if (typeof baseWorker?.scheduled !== 'function') {
        throw new Error('[192] canonical like aggregate handler unavailable');
      }
      await baseWorker.scheduled(controller, env, ctx);
      // Do not expose private Stage416 counts via the legacy 191 R2 repair.
      if(!STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE)await repairSharedPublicLikeCounts191(env);
      return;
    }

    // A temporary PREVIEW cron is the sole authorized repair trigger. Never
    // put an R2 HEAD or canonical D1 read on routine like-batch alarms.
    if (controller?.cron === '* * * * *') {
      const repair191 = STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE
        ? {changedTracks:0,skippedForStage416PublicWindow:true}
        : await repairSharedPublicLikeCounts191(env, { oneTime: true });
      if (repair191?.changedTracks) console.log('[SORIDRAW 191] bounded public like repair:', JSON.stringify(repair191));
      const repair156 = await repairVerifiedSharedLikeSnapshots156(env);
      if (repair156?.repaired) console.log('[SORIDRAW 156] verified shared R2 like snapshot repair:', JSON.stringify(repair156));
      return;
    }
    if (typeof baseWorker?.scheduled === 'function') {
      return baseWorker.scheduled(controller, env, ctx);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE&&
       url.pathname===PUBLIC_LIKE_MANIFEST_ROUTE_416){
      return handlePublicLikeManifestIntersect416(request,env);
    }
    if(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE&&request.method==='POST'&&
       url.pathname===STAGE416_PUBLIC_RELEASE_ROUTE){
      return handleSignedPublicLikeRelease416(request,env);
    }
    if(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE&&request.method==='POST'&&
       url.pathname===STAGE416_PUBLIC_WINDOW_ACK_ROUTE){
      return handleSignedPublicLikeWindowAck416(request,env);
    }
    if(STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE&&request.method==='POST'&&
       url.pathname===STAGE416_PUBLIC_WINDOW_ROUTE){
      return handleSignedPublicLikeWindow416(request,env);
    }
    if(STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE&&
       request.method==='POST'&&url.pathname===STAGE416_SIGNED_PRIVATE_HANDOFF_ROUTE){
      return handleSignedPrivateHandoff416(request,env);
    }
    if(STAGE416_SHARED_D1_INTAKE_ACTIVE&&
      (url.pathname===STAGE416_CLICK_ROUTE||url.pathname===EXPLORE_LIKE_BATCH_ROUTE_103)&&
      (request.method==='POST'||request.method==='OPTIONS')){
      return handlePrivateLikeRoute416(request,env,ctx,url);
    }
    // Both experimental writers cannot own one canonical endpoint. If a
    // later release accidentally enables both, fail BEFORE any D1 work.
    if (request.method==='POST' && url.pathname===EXPLORE_LIKE_BATCH_ROUTE_103 &&
        STAGE420_SIGNED_LEGACY_INTAKE_OPEN) {
      if (STAGE426_COMPILED_OPEN)
        return new Response(JSON.stringify({ok:false,
          error:{code:'420_MULTIPLE_WRITERS_REFUSED'}}),{status:503});
      const rejected = await verifySignedLegacyLikeIntake420(request, env, ctx);
      if (rejected) return rejected;
    }
    // Stage426: only an explicitly armed all-environment DB cutover takes
    // this path. Ordinary PREVIEW and ALL existing TEST/PRODUCTION requests
    // retain the previous Worker implementation byte-for-byte.
    if(request.method==='POST'&&url.pathname===EXPLORE_LIKE_BATCH_ROUTE_103&&
       STAGE426_COMPILED_OPEN&&env?.SORIDRAW_LIKE_171_READY==='1'){
      return handleVerifiedLikeBatch426(request,env,ctx);
    }
    // Dormant upgrade-only read route: never changes an old client request,
    // and cannot open until the SAME verified three-environment freeze.
    if(request.method==='OPTIONS'&&url.pathname==='/v1/me/likes/reconcile'&&
       STAGE426_COMPILED_OPEN&&env?.SORIDRAW_LIKE_171_READY==='1'){
      const headers=like426Headers(request);
      headers.set('Access-Control-Allow-Methods','GET, OPTIONS');
      headers.set('Access-Control-Allow-Headers','Authorization, X-Firebase-AppCheck, Content-Type');
      headers.set('Access-Control-Max-Age','600');
      return new Response(null,{status:204,headers});
    }
    if(request.method==='GET'&&url.pathname==='/v1/me/likes/reconcile'&&
       STAGE426_COMPILED_OPEN&&env?.SORIDRAW_LIKE_171_READY==='1'){
      return handleLikeReconcile433(request,env,ctx);
    }


    // app358: only a real retained publication signal may bypass an origin-local
    // positive profile Edge entry. Shared PROFILE_MEDIA is the cross-environment
    // derived authority, so this path remains D1 R0/W0.
    if (
      request.method === 'GET'
      && /^\/v1\/profiles\/[^/]+\/first-view$/.test(url.pathname)
      && url.searchParams.get(PROFILE_PUBLICATION_SIGNAL_QUERY_358) === '358'
    ) {
      const sharedSignalResponse358 = await handlePublicationSignalProfile358(request, env);
      if (sharedSignalResponse358) {
        return attachProfileSocialExtra244(sharedSignalResponse358, env);
      }
    }

    // app358: one authenticated, account-scoped canonical repair may rebuild a
    // legacy partial personal-like R2 catalog. The client persists the retained
    // signal attempt, so tab/page navigation cannot repeat this bounded read.
    if (
      request.method === 'GET'
      && url.pathname === '/v1/me/social-snapshot'
      && url.searchParams.get(PERSONAL_LIKE_REPAIR_QUERY_358) === '358'
    ) {
      return handleCrossOriginPersonalLikeRepair358(request, env, ctx);
    }
    if (
      request.method === 'GET'
      && url.pathname === '/v1/feed'
      && url.searchParams.get(EXPLORE_FEED_R2_SNAPSHOT_QUERY_108) === EXPLORE_FEED_R2_SNAPSHOT_VERSION_108
    ) {
      return handleFeedR2Snapshot108(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/v1/feed-revision') {
      return handleFeedRevisionHeadOnly077(request, env);
    }
    if (request.method === 'GET' && url.pathname === PUBLIC_LIKE_CARD_ROUTE_192) {
      return handlePublicLikeCards192(request, env);
    }
    const segments307 = url.pathname.split('/').filter(Boolean);
    const curatedCollection307 = String(url.searchParams.get('collection') || '').trim().toLowerCase();
    if (request.method === 'GET' && url.pathname === '/v1/curated-revision' && curatedCollection307 === SORIDRAW_CURATED_COLLECTION_307) {
      return sharedCuratedEnabled466(env)
        ? handleCuratedSharedRevision466(request, env)
        : handleCuratedRevision307(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/v1/curated' && curatedCollection307 === SORIDRAW_CURATED_COLLECTION_307) {
      return sharedCuratedEnabled466(env)
        ? handleCuratedSharedPublic466(request, env, ctx)
        : handleCuratedPublic307(request, env, ctx);
    }
    if (request.method === 'GET' && url.pathname === '/v1/me/explore-management-access') {
      return handleExploreManagementAccess307(request, env, ctx);
    }
    if (request.method === 'GET' && url.pathname === '/v1/explore-managers') {
      return handleExploreManagerList307(request, env, ctx);
    }
    if (
      (request.method === 'PUT' || request.method === 'DELETE')
      && segments307.length === 3
      && segments307[0] === 'v1'
      && segments307[1] === 'explore-managers'
    ) {
      return handleExploreManagerMutation307(
        request, env, ctx, decodeURIComponent(segments307[2]), request.method === 'PUT',
      );
    }
    if (
      (request.method === 'PUT' || request.method === 'DELETE')
      && segments307.length === 4
      && segments307[0] === 'v1'
      && segments307[1] === 'curation'
      && decodeURIComponent(segments307[2]).toLowerCase() === SORIDRAW_CURATED_COLLECTION_307
    ) {
      return handleCurationMutation307(
        request, env, ctx, decodeURIComponent(segments307[3]), request.method === 'PUT',
      );
    }
    if (request.method === 'GET' && url.pathname === '/v1/manage/curated' && curatedCollection307 === SORIDRAW_CURATED_COLLECTION_307) {
      return handleManagedCurated307(request, env, ctx);
    }

    const isProfileUpdate244 = request.method === 'PATCH' && url.pathname === '/v1/me/profile';
    const isUnifiedProfileSave252 = request.method === 'PUT' && url.pathname === '/v1/me/profile-save';
    const isPublicProfileRead244 = request.method === 'GET'
      && /^\/v1\/profiles\/[^/]+(?:\/first-view)?$/.test(url.pathname);
    const profileUpdateRequest244 = (isProfileUpdate244 || isUnifiedProfileSave252) ? request.clone() : null;

    const isTrackVisibilityMutation307 = request.method === 'PATCH'
      && /^\/v1\/tracks\/[^/]+\/visibility$/.test(url.pathname);
    const isPublicationBatch307 = request.method === 'POST'
      && url.pathname === '/v1/me/music-note-publications/batch';
    // app468: reserve an event-only, persisted repair BEFORE the canonical
    // publication call. If this guard cannot persist, do NOT write user
    // originals: otherwise an R2 failure after commit has no replay owner.
    // A healthy unrelated track does not enter the repair path.
    let curatedRepairTicket468 = null;
    if (sharedCuratedEnabled466(env) &&
        (isTrackVisibilityMutation307 || isPublicationBatch307)) {
      try {
        const current468 = await getCuratedShared466(env);
        if (current468.object && !current468.snapshot)
          throw Error('CURATED_REPAIR_CORRUPT_SHARED_OBJECT_468');
        let actor468 = null;
        if (!current468.snapshot) {
          // Never let an unauthenticated caller cause even a cold bounded D1
          // lookup. Warm unrelated publication requests still use R2 only.
          actor468 = await validateExploreAuth307(request, env, ctx);
          if (!actor468.ok) return actor468.response;
        }
        const memberIds468 = current468.snapshot
          ? current468.snapshot.memberIds
          : (await readCanonicalCurated466(env)).map((row) => String(row.track_id || '').trim());
        const membership468 = new Set(memberIds468);
        const candidates468 = isTrackVisibilityMutation307
          ? [decodeURIComponent(url.pathname.split('/')[3] || '')]
          : (await request.clone().json().catch(() => null))?.mutations
            ?.map((item) => String(item?.trackId || '').trim()) || [];
        const affected468 = [...new Set(candidates468
          .filter((id) => membership468.has(String(id || '').trim())))]
          .slice(0, 40);
        if (affected468.length) {
          // Public requests may reach the Worker before baseWorker validates
          // them. Never allocate a durable alarm for an unauthenticated actor.
          if (!actor468) {
            actor468 = await validateExploreAuth307(request, env, ctx);
            if (!actor468.ok) return actor468.response;
          }
          const space468 = env?.EXPLORE_LIKE_BATCH_SCHEDULER;
          if (!space468) throw Error('CURATED_REPAIR_SCHEDULER_MISSING_468');
          const id468 = space468.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103);
          const stub468 = space468.get(id468);
          const journal468 = await stub468.fetch('https://soridraw.internal/curated-repair-468/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackIds: affected468 }),
          });
          const payload468 = await journal468.json().catch(() => null);
          if (!journal468.ok || payload468?.data?.reserved !== true)
            throw Error('CURATED_REPAIR_RESERVATION_UNAVAILABLE_468');
          curatedRepairTicket468 = {
            stub: stub468,
            generation: Number(payload468.data.generation || 0),
          };
        }
      } catch (error) {
        console.warn('[app468] curated repair preflight blocked canonical mutation:',
          String(error?.message || error || 'unknown'));
        return Response.json({
          ok: false, error: {
            code: 'CURATED_REPAIR_PREFLIGHT_REQUIRED_468',
            message: '추천곡 동기화 준비에 실패했습니다. 원본 변경은 실행되지 않았습니다.',
          },
        }, { status: 503 });
      }
    }
    let response = await baseWorker.fetch(request, env, ctx);
    if (response.ok && curatedRepairTicket468) {
      try {
        await curatedRepairTicket468.stub.fetch('https://soridraw.internal/curated-repair-468/confirm', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generation: curatedRepairTicket468.generation }),
        });
      } catch {
        // The pre-commit reservation survives; its 3-minute fallback can still
        // read the latest canonical D1 even if this completion signal is lost.
      }
    }

    if ((isTrackVisibilityMutation307 || isPublicationBatch307) && response.ok) {
      try {
        const mutationPayload307 = await response.clone().json();
        const results307 = isPublicationBatch307
          ? (Array.isArray(mutationPayload307?.data?.results) ? mutationPayload307.data.results : [])
          : [{
              ok: mutationPayload307?.ok === true,
              trackId: String(mutationPayload307?.data?.trackId || decodeURIComponent(url.pathname.split('/')[3] || '')).trim(),
              status: mutationPayload307?.data?.isPublic === true ? 'public' : 'private',
              snapshotItem: mutationPayload307?.data?.snapshotItem || null,
            }];
        await syncCuratedPublicationResults307(request, env, results307, ctx);
        if (curatedRepairTicket468) {
          // Acknowledge only AFTER the shared R2 has been verified. A stale
          // generation ack cannot erase a newer reserved change.
          const ack468 = await curatedRepairTicket468.stub.fetch(
            'https://soridraw.internal/curated-repair-468/ack', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ generation: curatedRepairTicket468.generation }),
            });
          if (!ack468.ok) throw Error('CURATED_REPAIR_ACK_DEFERRED_468');
        }
      } catch (error) {
        console.warn('[app307] curated publication sync skipped:', String(error?.message || error || 'unknown'));
      }
    }

    if ((isProfileUpdate244 || isUnifiedProfileSave252) && response.ok) {
      let requestBody = null;
      try {
        if (isUnifiedProfileSave252) {
          const form252 = await profileUpdateRequest244?.formData();
          const rawProfile252 = form252?.get('profile');
          requestBody = typeof rawProfile252 === 'string' ? JSON.parse(rawProfile252) : null;
        } else {
          requestBody = await profileUpdateRequest244?.json();
        }
      } catch {}
      let responsePayload = null;
      try { responsePayload = await response.clone().json(); } catch {}
      const profile = profileSocialExtraProfileRow244(responsePayload);
      const uid = String(profile?.uid || '').trim();
      const hasYoutubeField = Boolean(
        requestBody
        && typeof requestBody === 'object'
        && Object.prototype.hasOwnProperty.call(requestBody, 'youtubeUrl')
      );

      if (uid && hasYoutubeField) {
        try {
          // SORIDRAW_PROFILE_SOCIAL_EXTRA_NOOP_247_20260930
          // SORIDRAW_PROFILE_SOCIAL_CHANGED_ONLY_252_20260930
          const nextYoutubeUrl247 = normalizeProfileExternalUrl244(requestBody.youtubeUrl);
          const explicitYoutubeChanged252 = Number(requestBody?.profileMutationVersion || 0) === 252
            && requestBody?.youtubeChanged === true;
          if (explicitYoutubeChanged252) {
            const saved = await writeProfileSocialExtra244(env, uid, nextYoutubeUrl247);
            response = await attachProfileSocialExtra244(response, env, saved.youtubeUrl);
          } else {
            const currentExtra247 = await readProfileSocialExtra244(env, uid);
            if (currentExtra247.youtubeUrl === nextYoutubeUrl247) {
              response = await attachProfileSocialExtra244(response, env, currentExtra247.youtubeUrl);
            } else {
              const saved = await writeProfileSocialExtra244(env, uid, nextYoutubeUrl247);
              response = await attachProfileSocialExtra244(response, env, saved.youtubeUrl);
            }
          }
        } catch (error) {
          console.error('[252] YouTube profile link save failed:', String(error?.message || error || 'unknown'));
          return profileSocialExtraSaveFailure244(response);
        }
      } else if (Number(requestBody?.profileMutationVersion || 0) !== 252) {
        response = await attachProfileSocialExtra244(response, env);
      }
    } else if (isPublicProfileRead244) {
      response = await attachProfileSocialExtra244(response, env);
    }

    const publicLikeAcceptedAt193 = Date.now();
    const scheduledResponse = await ensureQueuedLikeBatchScheduled103(request, env, response, ctx);
    return attachPublicLikeAcceptedAt193(request, scheduledResponse, publicLikeAcceptedAt193);
  },
};
