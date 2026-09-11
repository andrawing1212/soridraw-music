import baseWorker from './preview-worker.js';

// SORIDRAW_EXPLORE_REVISION_HEAD_ONLY_036_20260911
// SORIDRAW_EXPLORE_REVISION_HEAD_LOW_READ_037_20260911
// SORIDRAW_EXPLORE_FEED_DELTA_068_20260912
// Release-compatible entry wrapper. A plain feed revision check stays head-only.
// When the client supplies its known revision, 068 may additionally return a
// bounded list of changed existing tracks from the already-maintained 032 journal.
// No canonical Feed scan/rebuild is performed here.
const REVISION_HEAD_CACHE_SECONDS_036 = 60;
const REVISION_HEAD_CACHE_PATH_036 = '/__soridraw/feed-revision-head-037';
const REVISION_DELTA_MAX_068 = 64;
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

function revisionDiagnosticHeaders036(cors, rowsRead, readQueries, mode = 'HEAD-ONLY-036') {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-SORIDRAW-CF-Diagnostics', '068');
  headers.set('X-SORIDRAW-CF-Worker', '1');
  headers.set('X-SORIDRAW-D1-Read', String(Math.max(0, Number(rowsRead || 0))));
  headers.set('X-SORIDRAW-D1-Write', '0');
  headers.set('X-SORIDRAW-D1-Read-Queries', String(Math.max(0, Number(readQueries || 0))));
  headers.set('X-SORIDRAW-D1-Write-Queries', '0');
  headers.set('X-SORIDRAW-D1-Other-Queries', '0');
  headers.set('X-SORIDRAW-R2-A', '0');
  headers.set('X-SORIDRAW-R2-B', '0');
  headers.set('X-SORIDRAW-Revision-Mode', mode);
  headers.set('X-SORIDRAW-Revision-Source', mode === 'HEAD-DELTA-068' ? 'DERIVED-CHANGES-068' : 'STATE-SEQ-037');
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

const rowsRead068 = (result) => Math.max(0, Number(result?.meta?.rows_read || 0));
const parseJson068 = (value) => {
  try { return value ? JSON.parse(String(value)) : {}; } catch { return {}; }
};

async function readRevisionHead068(url, env) {
  const cacheKeyUrl = new URL(REVISION_HEAD_CACHE_PATH_036, url.origin);
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });
  const cached = await caches.default.match(cacheKey);
  if (cached) {
    return { ok: true, revision: Math.max(0, Number(await cached.text() || 0)), rowsRead: 0, readQueries: 0 };
  }

  const result = await env.DB.prepare(
    'SELECT seeded, seq FROM explore_derived_state WHERE id=1'
  ).all();
  const row = Array.isArray(result?.results) ? result.results[0] : null;
  if (!row?.seeded) {
    return { ok: false, revision: 0, rowsRead: rowsRead068(result), readQueries: 1 };
  }

  const revision = Math.max(0, Number(row.seq || 0));
  await caches.default.put(cacheKey, new Response(String(revision), {
    headers: { 'Cache-Control': `public, max-age=${REVISION_HEAD_CACHE_SECONDS_036}` },
  }));
  return { ok: true, revision, rowsRead: rowsRead068(result), readQueries: 1 };
}

async function readFeedDelta068(env, knownRevision, revision) {
  if (!(knownRevision >= 0) || knownRevision >= revision) {
    return { complete: true, fromRevision: String(knownRevision), toRevision: String(revision), changes: [], removedIds: [], rowsRead: 0, readQueries: 0 };
  }

  const journal = await env.DB.prepare(`
    SELECT kind,id,seq
    FROM explore_derived_changes
    WHERE scope='feed' AND seq>? AND seq<=?
    ORDER BY seq
    LIMIT ?
  `).bind(knownRevision, revision, REVISION_DELTA_MAX_068 + 1).all();
  const events = Array.isArray(journal?.results) ? journal.results : [];
  let rowsRead = rowsRead068(journal);
  let readQueries = 1;

  // A global state revision can advance for non-feed scopes. Without an explicit
  // feed journal event we cannot prove that a local Feed patch is complete, so
  // preserve the old full-feed fallback instead of guessing.
  if (!events.length || events.length > REVISION_DELTA_MAX_068 || events.some((event) => String(event.kind || '') !== 'track')) {
    return {
      complete: false,
      fromRevision: String(knownRevision),
      toRevision: String(revision),
      changes: [],
      removedIds: [],
      rowsRead,
      readQueries,
    };
  }

  const ids = [...new Set(events.map((event) => String(event.id || '').trim()).filter(Boolean))];
  if (!ids.length) {
    return { complete: false, fromRevision: String(knownRevision), toRevision: String(revision), changes: [], removedIds: [], rowsRead, readQueries };
  }

  const placeholders = ids.map(() => '?').join(',');
  const state = await env.DB.prepare(`
    SELECT
      t.id,t.owner_uid,t.active,t.published_at,t.pinned,t.likes,t.row_json,
      p.active AS profile_active,p.row_json AS profile_json
    FROM explore_derived_tracks t
    LEFT JOIN explore_derived_profiles p ON p.uid=t.owner_uid
    WHERE t.id IN (${placeholders})
  `).bind(...ids).all();
  rowsRead += rowsRead068(state);
  readQueries += 1;
  const stateRows = Array.isArray(state?.results) ? state.results : [];
  const found = new Set(stateRows.map((row) => String(row.id || '')));
  const removedIds = ids.filter((id) => !found.has(id));
  const changes = stateRows.map((row) => {
    const track = parseJson068(row.row_json);
    const profile = Number(row.profile_active || 0) === 1 ? parseJson068(row.profile_json) : {};
    return {
      id: String(row.id || ''),
      active: Number(row.active || 0) === 1,
      ownerUid: String(row.owner_uid || ''),
      publishedAt: Math.max(0, Number(row.published_at || 0)),
      profilePinned: Number(row.pinned || 0) === 1,
      likeCount: Math.max(0, Number(row.likes || 0)),
      title: String(track.title || ''),
      coverUrl: String(track.cover_url || '') || null,
      sunoUrlPrimary: String(track.suno_url_primary || '') || null,
      sunoUrlSecondary: String(track.suno_url_secondary || '') || null,
      ownerNickname: String(profile.nickname || ''),
      ownerAvatarUrl: String(profile.avatar_url || '') || null,
      ownerHandle: String(profile.handle || ''),
    };
  });

  return {
    complete: true,
    fromRevision: String(knownRevision),
    toRevision: String(revision),
    changes,
    removedIds,
    rowsRead,
    readQueries,
  };
}

async function handleFeedRevisionHeadOnly036(request, env) {
  const url = new URL(request.url);
  const sort = url.searchParams.get('sort') === 'popular' ? 'popular' : 'latest';
  const cors = revisionCors036(request);
  const head = await readRevisionHead068(url, env);
  if (!head.ok) {
    return new Response(JSON.stringify({ ok: false, error: 'Explore derived state unavailable' }), {
      status: 503,
      headers: revisionDiagnosticHeaders036(cors, head.rowsRead, head.readQueries),
    });
  }

  const knownRaw = url.searchParams.get('knownRevision');
  const knownRevision = knownRaw !== null && /^\d+$/.test(knownRaw) ? Number(knownRaw) : null;
  if (knownRevision === null) {
    return new Response(JSON.stringify({ ok: true, data: { sort, revision: String(head.revision) } }), {
      status: 200,
      headers: revisionDiagnosticHeaders036(cors, head.rowsRead, head.readQueries, 'HEAD-ONLY-036'),
    });
  }

  const delta = await readFeedDelta068(env, knownRevision, head.revision);
  return new Response(JSON.stringify({
    ok: true,
    data: {
      sort,
      revision: String(head.revision),
      delta: {
        complete: delta.complete,
        fromRevision: delta.fromRevision,
        toRevision: delta.toRevision,
        changes: delta.changes,
        removedIds: delta.removedIds,
      },
    },
  }), {
    status: 200,
    headers: revisionDiagnosticHeaders036(
      cors,
      head.rowsRead + delta.rowsRead,
      head.readQueries + delta.readQueries,
      'HEAD-DELTA-068',
    ),
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
