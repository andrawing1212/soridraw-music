// SORIDRAW_CURATED_SHARED_CANONICAL_V466 — source candidate, inactive until
// SORIDRAW_CURATED_SHARED_V466=1 and independent review / release approval.
// Shared D1 is the authority. This R2 object is max-40 derived data only.
export const CURATED_SHARED_KEY_466 = 'internal/explore/shared-curated-v466/soridraw-40.json';
export const CURATED_SHARED_MAX_466 = 40;
const COLLECTION = 'soridraw';

export const sharedCuratedEnabled466 = (env) =>
  String(env?.SORIDRAW_CURATED_SHARED_V466 || '') === '1';

// Independent release fence: only switch this on after all TEST/PRODUCTION
// legacy writers and visibility publishers are updated and verified.
export const curatedAllWritersReady466 = (env) =>
  String(env?.SORIDRAW_CURATED_ALL_WRITERS_READY466 || '') === '1';

export const canonicalCuratedIds466 = (rows) => rows
  .map((row) => String(row?.track_id || '').trim()).filter(Boolean);

export const canonicalCuratedRowVersions466 = (rows) => rows.map((row) => [
  String(row?.track_id || '').trim(), Number(row?.updated_at || 0),
  String(row?.curator_role || ''), Number(row?.sort_order || 0),
  row?.starts_at ?? null, row?.ends_at ?? null,
]);

export const visibleCuratedIds466 = (rows) => rows
  .filter((row) => Number(row?.is_public) === 1 && String(row?.status || '').toLowerCase() === 'published')
  .map((row) => String(row?.track_id || '').trim()).filter(Boolean);

export function matchesCanonicalCurated466(rows, snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 466 || snapshot.collection !== COLLECTION) return false;
  const memberIds = canonicalCuratedIds466(rows);
  const actualMemberIds = Array.isArray(snapshot.memberIds) ? snapshot.memberIds : [];
  const visibleIds = visibleCuratedIds466(rows);
  const payloadItems = snapshot.payload?.data?.items || [];
  const actualVisibleIds = payloadItems.map((x) => String(x?.track?.id || '').trim());
  return JSON.stringify(memberIds) === JSON.stringify(actualMemberIds)
    && JSON.stringify(visibleIds) === JSON.stringify(actualVisibleIds)
    && JSON.stringify(canonicalCuratedRowVersions466(rows)) === JSON.stringify(snapshot.rowVersions);
}

export async function readCanonicalCurated466(env, now = Date.now()) {
  const sql = 'SELECT cp.track_id,cp.curator_uid,cp.curator_role,cp.sort_order,cp.starts_at,cp.ends_at,'
    + 'cp.updated_at,t.is_public,t.status FROM curated_picks cp LEFT JOIN tracks t ON t.id=cp.track_id '
    + 'WHERE cp.collection_key=? AND (cp.starts_at IS NULL OR cp.starts_at<=?) '
    + 'AND (cp.ends_at IS NULL OR cp.ends_at>?) '
    + 'ORDER BY cp.sort_order ASC,cp.updated_at DESC,cp.track_id ASC LIMIT 40';
  const result = await env.DB.prepare(sql).bind(COLLECTION, now, now).all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  if (rows.length > CURATED_SHARED_MAX_466) throw Error('CURATED_466_UNBOUNDED');
  const ids = canonicalCuratedIds466(rows);
  if (new Set(ids).size !== ids.length) throw Error('CURATED_466_DUPLICATE_ID');
  return rows;
}

export function curatedSnapshotRevision466(object) {
  return String(object?.httpEtag || object?.etag || '').trim();
}

async function parseExisting466(object) {
  if (!object) return null;
  try {
    const stored = JSON.parse(await object.text());
    return stored?.schemaVersion === 466 && stored?.collection === COLLECTION
      && Array.isArray(stored.memberIds) && Array.isArray(stored?.payload?.data?.items)
      ? stored : null;
  } catch {
    return null;
  }
}

export async function getCuratedShared466(env) {
  if (!env?.PROFILE_MEDIA) return { object: null, snapshot: null };
  const object = await env.PROFILE_MEDIA.get(CURATED_SHARED_KEY_466);
  return { object, snapshot: await parseExisting466(object) };
}

async function buildSnapshot466(rows, resolveTrack, previous = null, forceTrackIds = new Set()) {
  const items = [];
  const previousById = new Map((previous?.payload?.data?.items || [])
    .map((item) => [String(item?.track?.id || '').trim(),item]));
  for (const row of rows) {
    if (Number(row?.is_public) !== 1 || String(row?.status || '').toLowerCase() !== 'published') continue;
    const trackId = String(row.track_id || '').trim();
    const previousItem = previousById.get(trackId);
    const priorRow = (previous?.rowVersions || []).find((x) => x[0] === trackId);
    const currentRow = canonicalCuratedRowVersions466([row])[0];
    const reusable = previousItem && !forceTrackIds.has(trackId)
      && JSON.stringify(priorRow) === JSON.stringify(currentRow);
    const track = reusable ? previousItem.track : await resolveTrack(trackId);
    if (!track || String(track.id || '').trim() !== trackId) throw Error('CURATED_466_DETAIL_NOT_READY');
    items.push({
      track,
      curation: {
        curatorUid: String(row.curator_uid || ''),
        curatorRole: String(row.curator_role || ''),
        sortOrder: Number(row.sort_order || 0),
        startsAt: row.starts_at ?? null,
        endsAt: row.ends_at ?? null,
      },
    });
  }
  return {
    schemaVersion: 466,
    collection: COLLECTION,
    memberIds: canonicalCuratedIds466(rows),
    rowVersions: canonicalCuratedRowVersions466(rows),
    payload: { ok: true, data: { collection: COLLECTION, items } },
    updatedAt: Date.now(),
  };
}

// HEAD/GET occurs *before* the fresh bounded D1 SELECT; conditional R2 PUT
// prevents two writers from blindly overwriting their simultaneous snapshots.
// A CAS conflict retries BOTH the R2 GET and canonical D1 SELECT.
export async function reconcileCuratedShared466(env, resolveTrack, {
  attempts = 5,
  readRows = () => readCanonicalCurated466(env),
  forceTrackIds = [],
} = {}) {
  const forced = new Set(forceTrackIds.map((x) => String(x || '').trim()).filter(Boolean));
  if (!env?.PROFILE_MEDIA || !env?.DB) return { ok: false, reason: 'BINDING_MISSING', reads: 0 };
  const bucket = env.PROFILE_MEDIA;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const before = await getCuratedShared466(env);
    if (before.object && !before.snapshot)
      return { ok: false, reason: 'INVALID_EXISTING_SHARED_OBJECT', reads: attempt + 1 };
    const rows = await readRows();
    if (before.snapshot && !forced.size && matchesCanonicalCurated466(rows, before.snapshot))
      return { ok: true, snapshot: before.snapshot, object: before.object, unchanged: true, reads: attempt + 1 };
    const next = await buildSnapshot466(rows, resolveTrack, before.snapshot, forced);
    const onlyIf = before.object
      ? { etagMatches: String(before.object.etag || '').trim() }
      : new Headers({ 'If-None-Match': '*' });
    if (before.object && !onlyIf.etagMatches) throw Error('CURATED_466_MISSING_ETAG');
    const stored = await bucket.put(CURATED_SHARED_KEY_466, JSON.stringify(next), {
      onlyIf,
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { updatedAt: String(next.updatedAt) },
    });
    if (stored === null) continue;
    if (!stored?.etag && !stored?.httpEtag) throw Error('CURATED_466_PUT_UNCONFIRMED');
    const after = await getCuratedShared466(env);
    if (!after.object || !after.snapshot) continue;
    if (matchesCanonicalCurated466(rows, after.snapshot)) {
      // A different environment can commit another curator mutation *after*
      // our bounded SELECT but before this successful R2 CAS. In that case
      // no R2 conflict is guaranteed yet: the other writer may still be
      // running, may be on an older Worker, or may fail after its D1 commit.
      // Confirm canonical again before claiming success; retry with fresh
      // rows when membership/visibility/order has advanced in the meantime.
      const confirmedRows = await readRows();
      if (matchesCanonicalCurated466(confirmedRows, after.snapshot))
        return { ok: true, snapshot: after.snapshot, object: after.object, reads: attempt + 1 };
    }
  }
  return { ok: false, reason: 'CAS_RETRY_EXHAUSTED', reads: attempts };
}
