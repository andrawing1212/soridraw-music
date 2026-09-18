import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_LOCAL_FIRST_COST_HOTPATH_044_20260913';
if (source.includes(MARKER)) {
  console.log('[044] local-first cost hotpath already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[044] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[044] function body missing: ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return { start, end: index + 1, text: source.slice(start, index + 1) };
  }
  throw new Error(`[044] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const wrapAsyncFunction = (name, wrapperBuilder) => {
  const range = functionRange(name);
  const coreName = `${name}Core044`;
  const renamed = range.text.replace(
    new RegExp(`^async\\s+function\\s+${name}\\(`),
    `async function ${coreName}(`,
  );
  if (renamed === range.text) throw new Error(`[044] could not wrap ${name}`);
  source = source.slice(0, range.start) + renamed + '\n\n' + wrapperBuilder(coreName) + source.slice(range.end);
};

for (const required of [
  'SORIDRAW_EXPLORE_SOCIAL_SNAPSHOT_WRITE_COMPACTION_042_20260913',
  'handleLikeBatch034',
  'enqueueExploreLikeUserQueue075',
  'syncExploreLikeR2AfterBatch034',
  'exploreLikeUserAggregateCte075',
  'processExploreLikeUserQueueWave075',
  'handleMusicNotePublicationR2Bundle',
  'musicNotePublicationR2Key',
  'readMusicNotePublicationR2Payload',
  'writeMusicNotePublicationR2Payload',
  'buildMusicNotePublicationR2Payload',
  'invalidatePublicationProfileCaches017',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'patchExploreProfileR2Publication043',
  'mutateExploreR2Cache052',
]) {
  if (!source.includes(required)) throw new Error(`[044] prerequisite missing: ${required}`);
}

// Derived R2 failures must never turn a successful canonical publication mutation
// into an HTTP 500. A later cache repair may recover a derived miss; canonical D1
// remains authoritative.
for (const name of [
  'syncMusicNotePublicationR2AfterMutation',
  'syncExploreFeedR2Publication043',
  'syncExploreFeedR2Private043',
  'syncExploreFeedR2OptionPatch043',
  'patchExploreProfileR2Publication043',
]) {
  wrapAsyncFunction(name, (coreName) => `async function ${name}(...args) {\n  try {\n    return await ${coreName}(...args);\n  } catch (error) {\n    console.warn('[SORIDRAW 044] derived publication patch deferred:', ${JSON.stringify(name)}, String(error?.message || error || 'unknown'));\n    return { ok: false, repairNeeded: true };\n  }\n}`);
}

replaceFunction('syncMusicNotePublicationR2AfterMutation', `async function syncMusicNotePublicationR2AfterMutation(...args) {
  const [env, uid] = args;
  try {
    return await syncMusicNotePublicationR2AfterMutationCore044(...args);
  } catch (error) {
    console.warn('[SORIDRAW 044] derived publication patch deferred:', 'syncMusicNotePublicationR2AfterMutation', String(error?.message || error || 'unknown'));
    try {
      if (env?.PROFILE_MEDIA && uid) await env.PROFILE_MEDIA.delete(musicNotePublicationR2Key(uid));
    } catch (repairError) {
      console.warn('[SORIDRAW 044] publication R2 repair marker failed:', String(repairError?.message || repairError || 'unknown'));
    }
    return { ok: false, repairNeeded: true };
  }
}`);

// 043 now updates the profile R2 object in place. Do not delete that newly-patched
// snapshot afterwards; only clear the HTTP edge shell.
replaceFunction('invalidatePublicationProfileCaches017', `async function invalidatePublicationProfileCaches017(request, env, uid, handle) {
  try {
    await invalidatePublicProfileFirstViewEdgeCache(request, [uid, handle].filter(Boolean));
  } catch (error) {
    console.warn('[SORIDRAW 044] profile edge invalidation skipped:', String(error?.message || error || 'unknown'));
  }
}`);

async function readMusicNotePublicationRevision044(env, uid) {
  try {
    if (!env?.PROFILE_MEDIA) return '';
    const object = await env.PROFILE_MEDIA.head(musicNotePublicationR2Key(uid));
    if (!object) return '';
    return String(
      object.httpEtag
      || object.etag
      || object.customMetadata?.updatedAt
      || (object.uploaded && typeof object.uploaded.getTime === 'function' ? object.uploaded.getTime() : '')
      || '',
    );
  } catch (error) {
    console.warn('[SORIDRAW 044] publication revision head failed:', String(error?.message || error || 'unknown'));
    return '';
  }
}

async function handleMusicNotePublicationRevision044(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  const revision = await readMusicNotePublicationRevision044(env, authContext.uid);
  return json({ ok: true, data: { revision: revision || null, exists: Boolean(revision) } }, 200, cors);
}

async function handleMusicNotePublicationR2Bundle044(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let cached = await readMusicNotePublicationR2Payload(env, authContext.uid);
  let recovered = false;
  if (!cached) {
    cached = await buildMusicNotePublicationR2Payload(env, authContext.uid);
    // A genuinely cold/missing derived object may pay one owner snapshot read once.
    // Persist the recovered R2 snapshot immediately so reconnects never repeat it.
    await writeMusicNotePublicationR2Payload(env, authContext.uid, cached);
    recovered = true;
  }
  const revision = await readMusicNotePublicationRevision044(env, authContext.uid);
  return json({ ok: true, data: { ...cached, revision: revision || null }, recovery: recovered }, 200, cors);
}

replaceFunction('handleMusicNotePublicationR2Bundle', handleMusicNotePublicationR2Bundle044.toString().replace('handleMusicNotePublicationR2Bundle044', 'handleMusicNotePublicationR2Bundle'));

const publicationRoute = '    if (url.pathname === "/v1/me/music-note-publications-bundle" && request.method === "GET") {';
if (!source.includes(publicationRoute)) throw new Error('[044] publication bundle route anchor missing');
source = source.replace(
  publicationRoute,
  `    if (url.pathname === "/v1/me/music-note-publications-revision" && request.method === "GET") {\n      return await handleMusicNotePublicationRevision044(request, env, cors);\n    }\n${publicationRoute}`,
);

replaceFunction('syncExploreLikeR2AfterBatch034', `async function syncExploreLikeR2AfterBatch034(env, uid, results) {
  let likedIds = await readExploreLikeR2Bundle(env, uid);
  if (!likedIds) {
    await rebuildExploreLikeR2Bundle(env, uid);
    likedIds = await readExploreLikeR2Bundle(env, uid);
  }
  if (!likedIds) return { ok: false, repairNeeded: true };
  for (const result of results) {
    const trackId = String(result?.trackId || '').trim();
    if (!trackId) continue;
    if (result?.liked) likedIds.add(trackId);
    else likedIds.delete(trackId);
  }
  await writeExploreR2Json(env, exploreLikeR2Key(uid), {
    schemaVersion: EXPLORE_R2_LIKE_SCHEMA_VERSION,
    uid: String(uid || ''),
    updatedAt: Date.now(),
    likedTrackIds: [...likedIds].filter(Boolean).slice(0, 2000)
  });
  return { ok: true };
}`);

// One actual like batch must not re-read tracks/profile/stats/likes merely to echo
// the optimistic state the browser already knows. Validation and canonical delta
// application move to the scheduled aggregate, where work is proportional only to
// actual queued mutations.
replaceFunction('handleLikeBatch034', `async function handleLikeBatch034(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let body = null;
  try { body = await request.json(); } catch { throwApi('INVALID_BODY', '좋아요 묶음 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.mutations) ? body.mutations : [];
  if (!raw.length) return json({ ok: true, data: { results: [], queued: false } }, 200, cors);
  if (raw.length > EXPLORE_LIKE_BATCH_MAX_034) throwApi('TOO_MANY_LIKES', '한 번에 처리할 수 있는 좋아요 수를 초과했습니다.', 400);

  const receivedAt = Date.now();
  const byTrack = new Map();
  for (const row of raw) {
    const trackId = String(row?.trackId || '').trim();
    if (!trackId || trackId.length > 512 || typeof row?.liked !== 'boolean') {
      throwApi('INVALID_TRACK_ID', '좋아요 묶음에 올바르지 않은 곡이 있습니다.', 400);
    }
    const rawMutationAt = Math.floor(Number(row?.mutationAt || 0));
    const mutationAt = Number.isFinite(rawMutationAt) && rawMutationAt > 0 && rawMutationAt <= receivedAt + 5 * 60 * 1000
      ? rawMutationAt
      : receivedAt;
    const baseLiked = typeof row?.baseLiked === 'boolean' ? row.baseLiked : null;
    const likeCount = clampExploreSocialCount(row?.likeCount);
    byTrack.set(trackId, { trackId, liked: row.liked, baseLiked, mutationAt, likeCount });
  }
  const mutations = [...byTrack.values()];
  await enforceExploreLikeBatchRateLimit034(env, authContext.uid, mutations.length);

  // Do not discard an intent because this device's baseLiked happens to match it.
// Another device may already have changed canonical state. The scheduled aggregate
// is the authoritative idempotent comparison against canonical likes.
const effectiveMutations = mutations;
  const results = mutations.map((mutation) => ({
    trackId: mutation.trackId,
    liked: mutation.liked,
    likeCount: mutation.likeCount,
  }));

  let queued = { batchId: '', inserted: false, queue: 'none' };
  if (effectiveMutations.length) {
    try {
      queued = await enqueueExploreLikeUserQueue075(env, authContext.uid, effectiveMutations, receivedAt);
    } catch (error) {
      const message = String(error?.message || error || '');
      if (!/no such table:\\s*explore_like_user_queue_075/i.test(message)) throw error;
      queued = await enqueueExploreLikeBatch035(env, authContext.uid, effectiveMutations, receivedAt);
    }
  }

  await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);
  return json({
    ok: true,
    data: {
      results,
      queued: Boolean(effectiveMutations.length),
      batchId: queued.batchId || null,
      queue: queued.queue || '075'
    }
  }, 200, cors);
}`);

replaceFunction('exploreLikeUserAggregateCte075', `function exploreLikeUserAggregateCte075() {
  return \`
    WITH cursor AS (
      SELECT processed_at, processed_uid
      FROM explore_like_user_queue_state_075
      WHERE id = 1
    ),
    ordered AS (
      SELECT q.user_uid, q.updated_at, q.pending_count, q.mutations_json,
        SUM(q.pending_count) OVER (
          ORDER BY q.updated_at ASC, q.user_uid ASC
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_mutations,
        ROW_NUMBER() OVER (ORDER BY q.updated_at ASC, q.user_uid ASC) AS queue_row
      FROM (
        SELECT q.user_uid, q.updated_at, q.pending_count, q.mutations_json
        FROM explore_like_user_queue_075 q, cursor c
        WHERE (
          q.updated_at > c.processed_at
          OR (q.updated_at = c.processed_at AND q.user_uid > c.processed_uid)
        )
          AND q.updated_at <= ?
        ORDER BY q.updated_at ASC, q.user_uid ASC
        LIMIT 50000
      ) q
    ),
    eligible AS (
      SELECT user_uid, updated_at, pending_count, mutations_json
      FROM ordered
      WHERE running_mutations <= ? OR queue_row = 1
    ),
    expanded AS (
      SELECT
        e.user_uid,
        e.updated_at,
        TRIM(CAST(j.key AS TEXT)) AS track_id,
        CASE WHEN CAST(json_extract(j.value, '$.liked') AS INTEGER) <> 0 THEN 1 ELSE 0 END AS desired_liked,
        COALESCE(CAST(json_extract(j.value, '$.mutationAt') AS INTEGER), e.updated_at) AS mutation_at
      FROM eligible e, json_each(e.mutations_json) AS j
      WHERE TRIM(CAST(j.key AS TEXT)) <> ''
    ),
    valid AS (
      SELECT expanded.*, t.owner_uid
      FROM expanded
      JOIN tracks t
        ON t.id = expanded.track_id
       AND t.is_public = 1
       AND t.status = 'published'
      JOIN public_profiles p
        ON p.uid = t.owner_uid
       AND p.is_public = 1
    ),
    deltas AS (
      SELECT valid.*,
        CASE
          WHEN valid.desired_liked = 1 AND existing.user_uid IS NULL THEN 1
          WHEN valid.desired_liked = 0 AND existing.user_uid IS NOT NULL THEN -1
          ELSE 0
        END AS delta
      FROM valid
      LEFT JOIN likes existing
        ON existing.track_id = valid.track_id
       AND existing.user_uid = valid.user_uid
    )
  \`;
}`);

async function patchExploreFeedR2Like044(env, trackId, likeCount) {
  const normalizedTrackId = String(trackId || '').trim();
  const count = Math.max(0, Number(likeCount || 0));
  if (!normalizedTrackId) return { ok: false, skipped: true };
  const results = await Promise.all(['latest', 'popular'].map((sort) => (
    mutateExploreR2Cache052(env, exploreFeedR2Key(sort), (bundle) => {
      const data = bundle?.payload?.data;
      if (!data || !Array.isArray(data.items)) return null;
      let changed = false;
      const patched = data.items.map((item) => {
        if (getExploreFeedItemId012(item) !== normalizedTrackId) return item;
        changed = true;
        return { ...item, likeCount: count, stats: { ...(item?.stats || {}), likeCount: count } };
      });
      if (!changed) return null;
      const items = sortExploreFeedItems012(patched, sort).slice(0, EXPLORE_R2_FEED_LIMIT);
      return { ...bundle, payload: { ...bundle.payload, data: { ...data, items } }, updatedAt: Date.now() };
    })
  )));
  return { ok: results.every((result) => result?.ok !== false), results };
}

async function patchExploreProfileR2Like044(env, ownerUid, trackId, likeCount) {
  const uid = String(ownerUid || '').trim();
  const normalizedTrackId = String(trackId || '').trim();
  const count = Math.max(0, Number(likeCount || 0));
  if (!uid || !normalizedTrackId) return { ok: false, skipped: true };
  return await mutateExploreR2Cache052(env, exploreProfileR2Key(uid), (bundle) => {
    if (!validExploreProfileR2Bundle020(bundle)) return null;
    const data = bundle.body.data;
    let changed = false;
    const items = data.items.map((item) => {
      if (getProfileTrackId019(item) !== normalizedTrackId) return item;
      changed = true;
      return { ...item, likeCount: count, stats: { ...(item?.stats || {}), likeCount: count } };
    });
    if (!changed) return null;
    const nextRevision = Math.max(1, Number(bundle.revision || data.revision || 0) + 1);
    const nextData = { ...data, items, revision: nextRevision, updatedAt: Date.now() };
    return { ...bundle, revision: nextRevision, updatedAt: Date.now(), body: { ...bundle.body, data: nextData } };
  });
}

replaceFunction('processExploreLikeUserQueueWave075', `async function processExploreLikeUserQueueWave075(env, cutoff, now) {
  const cte = exploreLikeUserAggregateCte075();
  const max = EXPLORE_LIKE_USER_QUEUE_MAX_MUTATIONS_075;

  const projection = await env.DB.prepare(cte + \`
    SELECT d.track_id, d.owner_uid,
      MAX(0, COALESCE(s.like_count, 0) + SUM(d.delta)) AS next_like_count
    FROM deltas d
    LEFT JOIN track_stats s ON s.track_id = d.track_id
    GROUP BY d.track_id, d.owner_uid, s.like_count
    HAVING SUM(d.delta) <> 0
  \`).bind(cutoff, max).all();
  const changedRows = Array.isArray(projection?.results) ? projection.results : [];

  const result = await env.DB.batch([
    env.DB.prepare(cte + \`
      INSERT INTO track_stats(track_id, like_count, comment_count, play_count, updated_at)
      SELECT track_id, SUM(delta), 0, 0, ?
      FROM deltas
      GROUP BY track_id
      HAVING SUM(delta) > 0
      ON CONFLICT(track_id) DO UPDATE SET
        like_count = track_stats.like_count + excluded.like_count,
        updated_at = excluded.updated_at
    \`).bind(cutoff, max, now),
    env.DB.prepare(cte + \`
      UPDATE track_stats
      SET like_count = MAX(0, like_count + COALESCE((
            SELECT SUM(d.delta) FROM deltas d WHERE d.track_id = track_stats.track_id
          ), 0)),
          updated_at = ?
      WHERE track_id IN (
        SELECT track_id FROM deltas GROUP BY track_id HAVING SUM(delta) < 0
      )
    \`).bind(cutoff, max, now),
    env.DB.prepare(cte + \`
      INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
      SELECT track_id, user_uid, mutation_at
      FROM valid
      WHERE desired_liked = 1
    \`).bind(cutoff, max),
    env.DB.prepare(cte + \`
      DELETE FROM likes
      WHERE (track_id, user_uid) IN (
        SELECT track_id, user_uid FROM valid WHERE desired_liked = 0
      )
    \`).bind(cutoff, max),
    env.DB.prepare(cte + \`
      UPDATE explore_like_user_queue_state_075
      SET processed_at = COALESCE((
            SELECT updated_at FROM eligible ORDER BY updated_at DESC, user_uid DESC LIMIT 1
          ), processed_at),
          processed_uid = COALESCE((
            SELECT user_uid FROM eligible ORDER BY updated_at DESC, user_uid DESC LIMIT 1
          ), processed_uid)
      WHERE id = 1 AND EXISTS (SELECT 1 FROM eligible)
    \`).bind(cutoff, max),
  ]);

  await Promise.allSettled(changedRows.flatMap((row) => {
    const trackId = String(row?.track_id || '').trim();
    const ownerUid = String(row?.owner_uid || '').trim();
    const likeCount = Math.max(0, Number(row?.next_like_count || 0));
    return [
      patchExploreFeedR2Like044(env, trackId, likeCount),
      patchExploreProfileR2Like044(env, ownerUid, trackId, likeCount),
    ];
  }));

  return {
    positiveTracks: Number(result?.[0]?.meta?.changes || 0),
    negativeTracks: Number(result?.[1]?.meta?.changes || 0),
    insertedLikes: Number(result?.[2]?.meta?.changes || 0),
    deletedLikes: Number(result?.[3]?.meta?.changes || 0),
    advanced: Number(result?.[4]?.meta?.changes || 0) > 0,
  };
}`);

const helperAnchor = functionRange('handleLikeBatch034').start;
const helpers = `// ${MARKER}\n${[
  readMusicNotePublicationRevision044,
  handleMusicNotePublicationRevision044,
  patchExploreFeedR2Like044,
  patchExploreProfileR2Like044,
].map((fn) => fn.toString()).join('\n\n')}\n\n`;
source = source.slice(0, helperAnchor) + helpers + source.slice(helperAnchor);

const likeHandler = functionRange('handleLikeBatch034').text;
if (likeHandler.includes('readExploreLikeBatchStates035') || likeHandler.includes('canonical_liked')) {
  throw new Error('[044] like intake still performs canonical D1 state reads');
}
if (!likeHandler.includes('likeCount: mutation.likeCount')) {
  throw new Error('[044] like intake optimistic count contract missing');
}
for (const name of ['syncExploreFeedR2Publication043', 'syncExploreFeedR2Private043', 'syncExploreFeedR2OptionPatch043', 'patchExploreProfileR2Publication043']) {
  const text = functionRange(name).text;
  if (!text.includes('Core044')) throw new Error(`[044] publication derived safety wrapper missing: ${name}`);
}
if (!source.includes('/v1/me/music-note-publications-revision')) throw new Error('[044] publication revision route missing');
if (!source.includes('patchExploreFeedR2Like044') || !source.includes('patchExploreProfileR2Like044')) {
  throw new Error('[044] aggregate targeted R2 like patch missing');
}

if (!likeHandler.includes('const effectiveMutations = mutations;')) {
  throw new Error('[044] stale-device intents can still be discarded before canonical aggregate');
}
const socialR2Sync = functionRange('syncExploreLikeR2AfterBatch034').text;
if ((socialR2Sync.match(/readExploreLikeR2Bundle\(env, uid\)/g) || []).length < 2) {
  throw new Error('[044] cold personal-like R2 recovery does not re-read and apply current intent');
}
const publicationStateSync = functionRange('syncMusicNotePublicationR2AfterMutation').text;
if (!publicationStateSync.includes('PROFILE_MEDIA.delete(musicNotePublicationR2Key(uid))')) {
  throw new Error('[044] failed publication-state patch cannot force bounded R2 recovery');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[044] Local-first publication snapshot, D1-free like intake, aggregate validation, and targeted R2 propagation applied.');
