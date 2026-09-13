import baseWorker from './preview-worker.js';

// SORIDRAW_EXPLORE_REVISION_HEAD_ONLY_036_20260911
// SORIDRAW_EXPLORE_REVISION_HEAD_LOW_READ_037_20260911
// SORIDRAW_EXPLORE_FEED_DELTA_068_20260912
// SORIDRAW_EXPLORE_R2_REVISION_HEAD_077_20260913
//
// 077: revision checks never open D1. The first-page Feed R2 object's ETag is the
// revision. A mutation that changes the cached Feed changes the ETag; unchanged
// reconnects are one tiny R2 HEAD (or edge hit) and D1 R0/W0.
const REVISION_HEAD_CACHE_SECONDS_077 = 60;
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
      if (revision) return { revision, r2ClassB: 0, source: 'EDGE-R2-HEAD-077' };
    }
  } catch {}

  const bucket = feedCacheBucket077(env);
  if (!bucket) return { revision: '', r2ClassB: 0, source: 'R2-BINDING-MISSING-077' };
  let head = null;
  try { head = await bucket.head(feedR2Key077(sort)); } catch {}
  if (!head) return { revision: '', r2ClassB: 1, source: 'R2-MISSING-077' };
  const revision = String(
    head.httpEtag
    || head.etag
    || head.customMetadata?.updatedAt
    || (head.uploaded && typeof head.uploaded.getTime === 'function' ? head.uploaded.getTime() : '')
    || '',
  ).trim();
  if (!revision) return { revision: '', r2ClassB: 1, source: 'R2-REVISION-MISSING-077' };
  try {
    await caches.default.put(edgeKey, new Response(revision, {
      headers: { 'Cache-Control': `public, max-age=${REVISION_HEAD_CACHE_SECONDS_077}` },
    }));
  } catch {}
  return { revision, r2ClassB: 1, source: 'R2-HEAD-077' };
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

export default {
  async scheduled(controller, env, ctx) {
    if (typeof baseWorker?.scheduled === 'function') {
      return baseWorker.scheduled(controller, env, ctx);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/v1/feed-revision') {
      return handleFeedRevisionHeadOnly077(request, env);
    }
    return baseWorker.fetch(request, env, ctx);
  },
};
