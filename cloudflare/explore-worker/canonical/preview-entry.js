import baseWorker from './preview-worker.js';

// SORIDRAW_EXPLORE_REVISION_HEAD_ONLY_036_20260911
// SORIDRAW_EXPLORE_REVISION_HEAD_LOW_READ_037_20260911
// Release-compatible entry wrapper. The feed revision endpoint is a version check only:
// it must never replay the derived change journal or rebuild the R2 feed.
// 037 also removes the journal-head lookup from the revision hot path. A single
// explore_derived_state row is enough because every feed-relevant derived-track
// change advances its monotonic seq. The tiny head is edge-cached for 60 seconds.
const REVISION_HEAD_CACHE_SECONDS_036 = 60;
const REVISION_HEAD_CACHE_PATH_036 = '/__soridraw/feed-revision-head-037';
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

function revisionDiagnosticHeaders036(cors, rowsRead, readQueries) {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '037');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', String(Math.max(0, Number(rowsRead || 0))));
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', String(Math.max(0, Number(readQueries || 0))));
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', '0');
  headers.set('X-SORIDRAW-Revision-Mode', 'HEAD-ONLY-036');
  headers.set('X-SORIDRAW-Revision-Source', 'STATE-SEQ-037');
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

async function handleFeedRevisionHeadOnly036(request, env) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const cors = revisionCors036(request);
  const cacheKeyUrl = new URL(REVISION_HEAD_CACHE_PATH_036, url.origin);
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });
  const cached = await caches.default.match(cacheKey);

  if (cached) {
    const revision = String(await cached.text());
    return new Response(JSON.stringify({ ok: true, data: { sort, revision } }), {
      status: 200,
      headers: revisionDiagnosticHeaders036(cors, 0, 0),
    });
  }

  // 037: one row only. Do not inspect explore_derived_changes here.
  // This keeps a cold revision check bounded to the single state row and
  // prevents journal size from affecting entry/re-entry cost.
  const result = await env.DB.prepare(
    'SELECT seeded, seq FROM explore_derived_state WHERE id=1'
  ).all();
  const row = Array.isArray(result?.results) ? result.results[0] : null;
  if (!row?.seeded) {
    return new Response(JSON.stringify({ ok: false, error: 'Explore derived state unavailable' }), {
      status: 503,
      headers: revisionDiagnosticHeaders036(cors, Number(result?.meta?.rows_read || 0), 1),
    });
  }

  const revision = String(Math.max(0, Number(row.seq || 0)));
  await caches.default.put(cacheKey, new Response(revision, {
    headers: { 'Cache-Control': `public, max-age=${REVISION_HEAD_CACHE_SECONDS_036}` },
  }));

  return new Response(JSON.stringify({ ok: true, data: { sort, revision } }), {
    status: 200,
    headers: revisionDiagnosticHeaders036(cors, Number(result?.meta?.rows_read || 0), 1),
  });
}

export default {
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker?.scheduled === 'function') {
      return baseWorker.scheduled(controller, env, ctx);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/v1/feed-revision') {
      return handleFeedRevisionHeadOnly036(request, env);
    }
    return baseWorker.fetch(request, env, ctx);
  },
};
