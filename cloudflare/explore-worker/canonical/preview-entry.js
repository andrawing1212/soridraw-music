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

  const changed = new Map();
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
    const response = await baseWorker.fetch(request, env, ctx);
    const publicLikeAcceptedAt193 = Date.now();
    const scheduledResponse = await ensureQueuedLikeBatchScheduled103(request, env, response);
    return attachPublicLikeAcceptedAt193(request, scheduledResponse, publicLikeAcceptedAt193);
  },
};
