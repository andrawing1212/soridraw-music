import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_PUBLICATION_POSTWRITE_500_RETRY_COST_018_20260905';
if (source.includes(marker)) {
  console.log('[018] publication post-write 500/retry-cost patch already applied.');
  process.exit(0);
}

const functionRange = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) throw new Error(`[018] function missing: ${name}`);
  const brace = source.indexOf('{', start);
  if (brace < 0) throw new Error(`[018] function body missing: ${name}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return { start, end: i + 1, text: source.slice(start, i + 1) };
  }
  throw new Error(`[018] unterminated function: ${name}`);
};

const replaceFunction = (name, nextText) => {
  const range = functionRange(name);
  source = source.slice(0, range.start) + nextText + source.slice(range.end);
};

const replaceOnceInFunction = (name, before, after, label) => {
  const range = functionRange(name);
  const count = range.text.split(before).length - 1;
  if (count !== 1) throw new Error(`[018] ${label} anchor count=${count}`);
  const next = range.text.replace(before, after);
  source = source.slice(0, range.start) + next + source.slice(range.end);
};

for (const required of [
  'handleMusicNotePublicationSingleWrite016',
  'publicationReadState016',
  'invalidateExploreFeedEdgeCache',
  'invalidatePublicProfileFirstViewEdgeCache',
  'syncExploreFeedR2Publication012',
]) {
  if (!source.includes(required)) throw new Error(`[018] required Stage3 runtime missing: ${required}`);
}

// The live 500 was proven to happen *after* the canonical publication succeeded:
// invalidateExploreFeedEdgeCache deleted two keys for every ALLOWED_ORIGIN and
// exhausted the Worker subrequest budget. Feed cache keys are origin-scoped, so a
// mutation only needs to invalidate the caller's origin. Never let cache cleanup
// reverse a successful mutation into HTTP 500.
replaceFunction('invalidateExploreFeedEdgeCache', `async function invalidateExploreFeedEdgeCache(request) {
  try {
    const cache = caches.default;
    const base = new URL(request.url).origin;
    const origin = request.headers.get("Origin") || "";
    const paths = [
      "/v1/feed?sort=latest&limit=40",
      "/v1/feed?sort=popular&limit=40"
    ];
    await Promise.allSettled(
      paths.map((path) => cache.delete(getExploreFeedEdgeCacheKey(new URL(path, base), origin)))
    );
  } catch (error) {
    console.warn("[SORIDRAW stage3.1] feed edge invalidation skipped after successful mutation:", String(error?.message || error || "unknown"));
  }
}`);

// Profile first-view invalidation had the same fan-out pattern (all origins x uid/
// @handle variants) and was already logging Too many subrequests in the real trace.
// Restrict it to the current origin and make every delete best-effort.
replaceFunction('invalidatePublicProfileFirstViewEdgeCache', `async function invalidatePublicProfileFirstViewEdgeCache(request, refs) {
  try {
    const uniqueRefs = [...new Set((refs || []).map((value) => String(value || "").trim()).filter(Boolean))];
    if (!uniqueRefs.length) return;
    const cache = caches.default;
    const origin = request.headers.get("Origin") || "";
    const deletions = [];
    for (const ref of uniqueRefs) {
      const normalized = ref.replace(/^@+/, "");
      const variants = [...new Set([normalized, normalized ? "@" + normalized : ""].filter(Boolean))];
      for (const variant of variants) {
        deletions.push(cache.delete(getPublicProfileFirstViewEdgeCacheKey(request.url, variant, origin)));
      }
    }
    await Promise.allSettled(deletions);
  } catch (error) {
    console.warn("[SORIDRAW stage3.1] profile edge invalidation skipped:", String(error?.message || error || "unknown"));
  }
}`);

// Publication only needs the canonical track state and the author's public profile.
// track_stats is unrelated to publishing and made every attempt read extra D1 rows.
// Keep the two required key-addressed reads in one D1 batch and synthesize zero stats;
// the R2 feed merge preserves existing social counts when the item already exists.
replaceFunction('publicationReadState016', `async function publicationReadState016(env, uid, trackId) {
  const results = await env.DB.batch([
    env.DB.prepare(\`
      SELECT *
      FROM tracks
      WHERE id = ? AND owner_uid = ?
      LIMIT 1
    \`).bind(trackId, uid),
    env.DB.prepare(\`
      SELECT uid, nickname, avatar_url, handle, is_public
      FROM public_profiles
      WHERE uid = ?
      LIMIT 1
    \`).bind(uid)
  ]);
  const track = results?.[0]?.results?.[0] || null;
  const profile = results?.[1]?.results?.[0] || null;
  return {
    ...(track || {}),
    like_count: 0,
    comment_count: 0,
    play_count: 0,
    profile_uid: profile?.uid || null,
    profile_nickname: profile?.nickname || null,
    profile_avatar_url: profile?.avatar_url || null,
    profile_handle: profile?.handle || null,
    profile_is_public: profile?.is_public ?? null
  };
}`);

// A retry of an already identical public row must be the cheapest possible success:
// after the two bounded identity/profile reads, return 200 immediately. Do not rewrite
// D1, re-read/rewrite R2 bundles, or invalidate caches again.
const idempotentAnchor = '  const unchanged = publicationCanonicalUnchanged016(previous, source, resolvedOptions, primaryGenre);\n  if (!unchanged) {';
const idempotentBlock = `  const unchanged = publicationCanonicalUnchanged016(previous, source, resolvedOptions, primaryGenre);
  if (unchanged) {
    return json({
      ok: true,
      data: {
        trackId: source.id,
        published: true,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        sourceSubTrackKey: source.sourceSubTrackKey,
        sunoUrlPrimary: source.sunoUrlPrimary,
        allowNextSongApply: resolvedOptions.allowNextSongApply === 1,
        allowFollowerSave: resolvedOptions.allowFollowerSave === 1,
        profilePinned: resolvedOptions.profilePinned === 1,
        mutation: "idempotent"
      }
    }, 200, cors);
  }
  if (!unchanged) {`;
replaceOnceInFunction(
  'handleMusicNotePublicationSingleWrite016',
  idempotentAnchor,
  idempotentBlock,
  'idempotent early return',
);

const markerAnchor = functionRange('invalidateExploreFeedEdgeCache').start;
source = source.slice(0, markerAnchor) + `// ${marker}\n` + source.slice(markerAnchor);

const feedInvalidation = functionRange('invalidateExploreFeedEdgeCache').text;
if (feedInvalidation.includes('ALLOWED_ORIGINS')) throw new Error('[018] feed invalidation still fans out to all allowed origins');
if (!feedInvalidation.includes('Promise.allSettled')) throw new Error('[018] feed invalidation is not best-effort');
const profileInvalidation = functionRange('invalidatePublicProfileFirstViewEdgeCache').text;
if (profileInvalidation.includes('ALLOWED_ORIGINS')) throw new Error('[018] profile invalidation still fans out to all allowed origins');
if (!profileInvalidation.includes('Promise.allSettled')) throw new Error('[018] profile invalidation is not best-effort');
const readState = functionRange('publicationReadState016').text;
if (readState.includes('track_stats')) throw new Error('[018] publication read still touches track_stats');
if (!readState.includes('env.DB.batch')) throw new Error('[018] publication identity/profile reads are not batched');
const hot = functionRange('handleMusicNotePublicationSingleWrite016').text;
const unchangedIndex = hot.indexOf('mutation: "idempotent"');
const feedIndex = hot.indexOf('syncExploreFeedR2Publication012');
if (unchangedIndex < 0 || feedIndex < 0 || unchangedIndex > feedIndex) {
  throw new Error('[018] idempotent retry does not return before derived R2 work');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[018] Proven post-write subrequest 500 fixed; mutation cache invalidation is current-origin/best-effort, publication reads no longer touch track_stats, and identical retries skip all derived work.');
