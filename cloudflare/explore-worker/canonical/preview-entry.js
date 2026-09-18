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
// 105 PREVIEW test cadence: a successful non-empty like batch schedules exactly
// one alarm one minute later. More batches joining the same window do not move
// the deadline. No likes means no alarm and no periodic aggregate execution.
//
// 108: first-page Feed cache recovery reads the already-materialized R2 snapshot
// directly. It never opens D1. The R2 ETag/revision is part of the edge key, so
// many clients recovering the same snapshot share one edge body without polling.
const REVISION_HEAD_CACHE_SECONDS_077 = 60;
const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105 = 1 * 60 * 1000;
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

export class ExploreLikeBatchScheduler103 extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/schedule') {
      return new Response('Not found', { status: 404 });
    }

    const currentAlarm = await this.ctx.storage.getAlarm();
    if (currentAlarm != null) {
      return Response.json({ ok: true, scheduledAt: currentAlarm, newlyScheduled: false });
    }

    const scheduledAt = Date.now() + EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105;
    await this.ctx.storage.setAlarm(scheduledAt);
    return Response.json({ ok: true, scheduledAt, newlyScheduled: true });
  }

  async alarm() {
    if (typeof baseWorker?.scheduled !== 'function') {
      throw new Error('Canonical Explore like aggregate handler unavailable');
    }

    // Durable Object alarms are at-least-once. The existing aggregate lease and
    // desired-state canonical mutation make a retry safe if an execution fails.
    await baseWorker.scheduled({
      scheduledTime: Date.now(),
      cron: 'event-like-batch-1m-105',
      type: 'scheduled',
    }, this.env, this.ctx);

    // Normal windows drain completely and stop here. Under an unusually large
    // burst, only one indexed row is checked; if work remains, schedule one more
    // one-minute window. A concurrently scheduled alarm is never pushed later.
    const pending = await this.env.DB.prepare(
      'SELECT batch_id FROM explore_like_batches_069 ORDER BY created_at ASC, batch_id ASC LIMIT 1',
    ).first();
    if (pending) {
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm == null) {
        await this.ctx.storage.setAlarm(Date.now() + EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105);
      }
    }
  }
}

export default {
  async scheduled(controller, env, ctx) {
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
    const response = await baseWorker.fetch(request, env, ctx);
    return ensureQueuedLikeBatchScheduled103(request, env, response);
  },
};
