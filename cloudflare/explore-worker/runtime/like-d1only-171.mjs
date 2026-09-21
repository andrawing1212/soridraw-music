// SORIDRAW_LIKE_D1ONLY_CANONICAL_171_20260921
// SOURCE-ONLY CANDIDATE. Not wired into the product Worker yet.
//
// After a coordinated all-environment cutover:
// - legacy likes is an immutable membership baseline,
// - legacy track_stats.like_count is an immutable public-count baseline,
// - explore_like_overrides_171 stores only the latest post-cutover user/track state,
// - explore_like_count_deltas_171 stores only the per-track delta/generation.
//
// One actual relation change mutates exactly TWO WITHOUT ROWID rows in the
// tested schema: override W1 + count-delta W1. A duplicate/no-op is W0.
// The expectedRevision gate prevents an older PC/mobile request from silently
// overwriting a newer canonical state. operationId is stable across retries.

const safeId171 = (value, max) =>
  typeof value === 'string' && value.trim() === value &&
  value.length > 0 && value.length <= max;

const effectiveLiked171 = `COALESCE((
  SELECT o.liked FROM explore_like_overrides_171 o
  WHERE o.user_uid = ? AND o.track_id = ?
), EXISTS(
  SELECT 1 FROM likes l WHERE l.track_id = ? AND l.user_uid = ?
))`;

const revision171 = `COALESCE((
  SELECT o.revision FROM explore_like_overrides_171 o
  WHERE o.user_uid = ? AND o.track_id = ?
), 0)`;

const operation171 = `COALESCE((
  SELECT o.last_operation_id FROM explore_like_overrides_171 o
  WHERE o.user_uid = ? AND o.track_id = ?
), '')`;

const effectiveCount171 = `COALESCE((
  SELECT s.like_count FROM track_stats s WHERE s.track_id = ?
), 0) + COALESCE((
  SELECT d.delta FROM explore_like_count_deltas_171 d WHERE d.track_id = ?
), 0)`;

const generation171 = `COALESCE((
  SELECT d.generation FROM explore_like_count_deltas_171 d
  WHERE d.track_id = ?
), 0)`;

const eligible171 = `EXISTS(
  SELECT 1
  FROM tracks t
  JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
  WHERE t.id = ? AND t.is_public = 1 AND t.status = 'published'
)`;

const snapshotSql171 = `SELECT
  ${eligible171} AS eligible,
  ${effectiveLiked171} AS liked,
  ${revision171} AS revision,
  ${operation171} AS operation_id,
  ${effectiveCount171} AS like_count,
  ${generation171} AS generation`;

const snapshotBindings171 = (uid, trackId) => [
  trackId,
  uid, trackId, trackId, uid,
  uid, trackId,
  uid, trackId,
  trackId, trackId,
  trackId,
];

const normalizeSnapshot171 = (row) => {
  const revision = Number(row?.revision);
  const likeCount = Number(row?.like_count);
  const generation = Number(row?.generation);
  if ((Number(row?.eligible) !== 0 && Number(row?.eligible) !== 1) ||
      (Number(row?.liked) !== 0 && Number(row?.liked) !== 1) ||
      !Number.isSafeInteger(revision) || revision < 0 ||
      !Number.isSafeInteger(likeCount) || likeCount < 0 ||
      !Number.isSafeInteger(generation) || generation < 0 ||
      typeof row?.operation_id !== 'string') {
    throw new Error('171 canonical snapshot unavailable or invalid');
  }
  return {
    eligible: Number(row.eligible) === 1,
    liked: Number(row.liked) === 1,
    revision,
    operationId: row.operation_id,
    likeCount,
    generation,
  };
};

export function createLikeD1OnlyCanonical171(db, options = {}) {
  if (!db?.prepare || !db?.batch) {
    throw new TypeError('171 D1 prepare/batch binding required');
  }
  if (options.cutoverVerified !== true) {
    throw new Error('171 writer blocked until all legacy writers are frozen and schema is verified');
  }

  const readSnapshot = async (uid, trackId) => {
    if (!safeId171(uid, 256) || !safeId171(trackId, 512)) {
      throw new TypeError('171 invalid membership identity');
    }
    const result = await db.prepare(snapshotSql171)
      .bind(...snapshotBindings171(uid, trackId)).first();
    return normalizeSnapshot171(result);
  };

  return {
    readSnapshot,

    async applyAtomically(uid, trackId, liked, context = {}) {
      const expectedRevision = Number(context.expectedRevision);
      const operationId = String(context.operationId || '').trim();
      const now = Number.isSafeInteger(context.now) && context.now > 0
        ? context.now : Date.now();

      if (!safeId171(uid, 256) || !safeId171(trackId, 512) ||
          typeof liked !== 'boolean' ||
          !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 ||
          !safeId171(operationId, 128) ||
          !Number.isSafeInteger(now) || now <= 0) {
        throw new TypeError('171 expected revision and stable operation ID required');
      }

      const before = db.prepare(snapshotSql171)
        .bind(...snapshotBindings171(uid, trackId));

      const mutation = db.prepare(`
        INSERT INTO explore_like_overrides_171(
          user_uid, track_id, liked, revision, last_operation_id, updated_at
        )
        SELECT ?, ?, ?, 1, ?, ?
        WHERE ${eligible171}
          AND ${effectiveLiked171} != ?
          AND ${revision171} = ?
        ON CONFLICT(user_uid, track_id) DO UPDATE SET
          liked = excluded.liked,
          revision = explore_like_overrides_171.revision + 1,
          last_operation_id = excluded.last_operation_id,
          updated_at = excluded.updated_at
        WHERE explore_like_overrides_171.revision = ?
          AND explore_like_overrides_171.liked != excluded.liked
      `).bind(
        uid, trackId, Number(liked), operationId, now,
        trackId,
        uid, trackId, trackId, uid, Number(liked),
        uid, trackId, expectedRevision,
        expectedRevision,
      );

      const delta = liked ? 1 : -1;
      const count = db.prepare(`
        INSERT INTO explore_like_count_deltas_171(
          track_id, delta, generation, updated_at
        )
        SELECT ?, ?, 1, ?
        WHERE changes() = 1
        ON CONFLICT(track_id) DO UPDATE SET
          delta = explore_like_count_deltas_171.delta + excluded.delta,
          generation = explore_like_count_deltas_171.generation + 1,
          updated_at = excluded.updated_at
      `).bind(trackId, delta, now);

      const final = db.prepare(snapshotSql171)
        .bind(...snapshotBindings171(uid, trackId));

      const results = await db.batch([before, mutation, count, final]);
      if (!Array.isArray(results) || results.length !== 4 ||
          results.some((result) => result?.success === false ||
            !Number.isSafeInteger(result?.meta?.rows_written) ||
            result.meta.rows_written < 0)) {
        throw new Error('171 D1 transaction receipt missing; retry same operation ID');
      }

      const relationChanges = Number(results[1]?.meta?.changes);
      const countChanges = Number(results[2]?.meta?.changes);
      if (![relationChanges, countChanges].every((value) =>
            Number.isSafeInteger(value) && value >= 0 && value <= 1) ||
          relationChanges !== countChanges) {
        throw new Error('171 relation/count transaction changed asymmetrically');
      }

      const prior = normalizeSnapshot171(results[0]?.results?.[0]);
      const settled = normalizeSnapshot171(results[3]?.results?.[0]);
      const rowsWritten = results.reduce(
        (sum, result) => sum + result.meta.rows_written, 0
      );

      if (relationChanges === 1) {
        if (!prior.eligible || prior.revision !== expectedRevision ||
            prior.liked === liked || settled.liked !== liked ||
            settled.revision !== expectedRevision + 1 ||
            settled.operationId !== operationId ||
            settled.likeCount !== prior.likeCount + delta ||
            settled.generation !== prior.generation + 1 ||
            rowsWritten !== 2) {
          throw new Error('171 applied transition did not satisfy W2/revision/generation contract');
        }
        return {
          status: 'applied',
          liked: settled.liked,
          likeCount: settled.likeCount,
          revision: settled.revision,
          generation: settled.generation,
          operationId,
          rowsWritten,
        };
      }

      if (rowsWritten !== 0) {
        throw new Error('171 no-op unexpectedly caused billable writes');
      }
      if (!settled.eligible) {
        return { status: 'ineligible', ...settled, rowsWritten: 0 };
      }
      if (settled.liked === liked) {
        return {
          status: settled.operationId === operationId ? 'duplicate' : 'already-desired',
          liked: settled.liked,
          likeCount: settled.likeCount,
          revision: settled.revision,
          generation: settled.generation,
          operationId: settled.operationId,
          rowsWritten: 0,
        };
      }
      if (settled.revision !== expectedRevision) {
        return {
          status: 'revision-conflict',
          liked: settled.liked,
          likeCount: settled.likeCount,
          revision: settled.revision,
          generation: settled.generation,
          operationId: settled.operationId,
          rowsWritten: 0,
        };
      }
      throw new Error('171 unchanged transaction has no safe settlement reason');
    },
  };
}
