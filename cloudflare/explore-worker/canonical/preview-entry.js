import { DurableObject } from 'cloudflare:workers';
import baseWorker from './preview-worker.js';

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
async function syncCuratedPublicationResults307(request, env, results) {
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

  try {
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

  const selected = await readCuratedObject307(request, env, ctx);
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

async function scheduleExploreLikeAggregate103(env) {
  const namespace = env?.EXPLORE_LIKE_BATCH_SCHEDULER;
  if (!namespace) throw new Error('Explore like scheduler binding unavailable');
  const id = namespace.idFromName(EXPLORE_LIKE_BATCH_SCHEDULER_NAME_103);
  const stub = namespace.get(id);
  const response = await stub.fetch('https://soridraw.internal/schedule', { method: 'POST' });
  if (!response.ok) throw new Error(`Explore like scheduler rejected: ${response.status}`);
  return response.json().catch(() => ({}));
}

async function ensureQueuedLikeBatchScheduled103(request, env, response) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.pathname !== EXPLORE_LIKE_BATCH_ROUTE_103 || !response.ok) return response;
  const payload = await response.clone().json().catch(() => null);
  if (!payload?.data?.queued) return response;

  try {
    await scheduleExploreLikeAggregate103(env);
    return response;
  } catch (error) {
    // The canonical queue may already contain the desired-state mutation. Returning
    // retryable 503 keeps the client outbox instead of acknowledging work that has
    // no durable wake-up. Replays are safe because canonical likes are set semantics.
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
  async runAggregate194() {
    if (typeof baseWorker?.scheduled !== 'function') {
      throw new Error('Canonical Explore like aggregate handler unavailable');
    }

    await baseWorker.scheduled({
      scheduledTime: Date.now(),
      cron: 'event-like-batch-1m-105',
      type: 'scheduled',
    }, this.env, this.ctx);
    // One bounded recovery check per actual changed-data window, never per user
    // or page view. Canonical mutation stays authoritative; this only repairs
    // the bounded public R2 projections for the changed window.
    await repairSharedPublicLikeCounts191(this.env);
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
      return null;
    }

    // A new request may already have claimed the next window after the marker
    // delete. Never push its deadline later or create a second owner.
    const now = Date.now();
    const claimedAt = Number(await this.ctx.storage.get(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194) || 0);
    if (Number.isFinite(claimedAt) && claimedAt > 0 &&
        claimedAt >= now - EXPLORE_LIKE_ACTIVE_GRACE_MS_194) {
      return pending;
    }

    const nextAt = now + EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105;
    await this.ctx.storage.put(EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194, nextAt);
    await this.ctx.storage.setAlarm(nextAt);
    return pending;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return new Response('Not found', { status: 404 });
    }

    const now = Date.now();
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
      await this.runAggregate194();
      const pending = await this.finalizeAggregate195();
      return Response.json({ ok: true, scheduledAt, newlyScheduled: true, settled: !pending, activeRecovery194: true });
    } catch (error) {
      // Keep the fallback alarm. If Cloudflare delays or loses that retry, the
      // active marker ages out and the next real batch takes over instead of
      // trusting a stale alarm forever.
      console.warn('[SORIDRAW 194] active like aggregate deferred to alarm fallback:', String(error?.message || error || 'unknown'));
      throw error;
    }
  }

  async alarm() {
    try {
      await this.runAggregate194();
      await this.finalizeAggregate195();
    } catch (error) {
      // Durable Object alarms are at-least-once. Preserve the active marker for
      // the short grace window; the next real batch can recover afterwards.
      console.warn('[SORIDRAW 194] alarm retry failed:', String(error?.message || error || 'unknown'));
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
        dirty = true;
        changed.set(id, expected);
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
      await repairSharedPublicLikeCounts191(env);
      return;
    }

    // A temporary PREVIEW cron is the sole authorized repair trigger. Never
    // put an R2 HEAD or canonical D1 read on routine like-batch alarms.
    if (controller?.cron === '* * * * *') {
      const repair191 = await repairSharedPublicLikeCounts191(env, { oneTime: true });
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
      return handleCuratedRevision307(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/v1/curated' && curatedCollection307 === SORIDRAW_CURATED_COLLECTION_307) {
      return handleCuratedPublic307(request, env, ctx);
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
    let response = await baseWorker.fetch(request, env, ctx);

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
        await syncCuratedPublicationResults307(request, env, results307);
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
    const scheduledResponse = await ensureQueuedLikeBatchScheduled103(request, env, response);
    return attachPublicLikeAcceptedAt193(request, scheduledResponse, publicLikeAcceptedAt193);
  },
};
