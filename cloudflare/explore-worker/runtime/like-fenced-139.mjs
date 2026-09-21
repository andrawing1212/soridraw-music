// SORIDRAW_LIKE_FENCED_CORE_139_20260921
// Candidate protocol core. NOT wired to a deployed Worker or live D1.
// The caller MUST authenticate uid, route every writer for that UID through
// the SAME serialized durable owner, and provide an atomic D1 adapter.
// A separate storage system is never described as a D1 transaction.
const safeId = (value, max) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;

export class LikeFencedProcessor139 {
  constructor({ ledger, canonical, publish }) {
    if (!ledger?.get || !ledger?.put || !canonical?.readMembership || !canonical?.applyAtomically || !publish) {
      throw new TypeError('Durable ledger, canonical D1 adapter and post-commit publisher required');
    }
    this.ledger = ledger;
    this.canonical = canonical;
    this.publish = publish;
  }

  key(uid, trackId) { return JSON.stringify([uid, trackId]); }

  async load(uid, trackId) {
    const key = this.key(uid, trackId);
    let value = await this.ledger.get(key);
    if (!value) {
      const canonicalLiked = await this.canonical.readMembership(uid, trackId);
      if (typeof canonicalLiked !== 'boolean') throw new Error('Cannot initialize without canonical membership');
      value = { uid, trackId, revision: 0, liked: canonicalLiked, last: null, pending: null, publication: null };
      await this.ledger.put(key, value);
    }
    if (value.uid !== uid || value.trackId !== trackId) throw new Error('Durable ownership mismatch');
    return value;
  }

  async persist(value) { await this.ledger.put(this.key(value.uid, value.trackId), value); }

  async flush(value) {
    if (value.pending) {
      const intent = value.pending;
      const applied = await this.canonical.applyAtomically(value.uid, value.trackId, intent.liked);
      // This adapter must return only after the likes relation AND public
      // count have committed together. An intake queue ACK is insufficient.
      if (applied?.canonicalCommitted !== true || applied?.liked !== intent.liked) {
        throw new Error('Canonical D1 final settlement not proven');
      }
      value = {
        ...value, revision: intent.revision, liked: intent.liked,
        last: { id: intent.id, revision: intent.revision, liked: intent.liked },
        pending: null,
        publication: { revision: intent.revision, liked: intent.liked, id: intent.id },
      };
      await this.persist(value);
    }
    if (value.publication) {
      const event = value.publication;
      // Publisher must enforce a monotonic revision/CAS on the SHARED per-UID
      // personal cache, not an environment-local or unconditional R2 write.
      const published = await this.publish({ uid: value.uid, trackId: value.trackId, ...event });
      if (published?.settled !== true) throw new Error('Post-commit publication not confirmed');
      value = { ...value, publication: null };
      await this.persist(value);
    }
    return value;
  }

  async mutate({ uid, trackId, id, baseRevision, liked }) {
    if (!safeId(uid, 256) || !safeId(trackId, 512) || !safeId(id, 128) ||
        !Number.isSafeInteger(baseRevision) || baseRevision < 0 || typeof liked !== 'boolean') {
      throw new TypeError('Invalid authenticated like request');
    }
    // Invocation must already be serialized for (uid,trackId) by a durable
    // coordinator; a process-local mutex is NOT sufficient across Workers.
    let value = await this.load(uid, trackId);
    try { value = await this.flush(value); }
    catch { return { state: 'pending', revision: value.revision }; }

    if (value.last?.id === id) {
      // Reusing an operation ID with a different payload is not an idempotent
      // retry. Never acknowledge an unrelated click under an old token.
      if (value.last.liked !== liked || value.last.revision !== baseRevision + 1) {
        return { state: 'conflict', revision: value.revision, liked: value.liked };
      }
      return { state: 'settled', duplicate: true, revision: value.revision, liked: value.liked };
    }
    if (value.revision !== baseRevision) return { state: 'stale', revision: value.revision, liked: value.liked };

    // Durable intent first. On crash, recover this exact operation before a
    // newer one; never derive order from the client clock or receive time.
    value = { ...value, pending: { id, revision: value.revision + 1, liked } };
    await this.persist(value);
    try { value = await this.flush(value); }
    catch { return { state: 'pending', revision: value.revision }; }
    return { state: 'settled', revision: value.revision, liked: value.liked };
  }
}


// SORIDRAW_LIKE_D1_ADAPTER_140_20260921
// Candidate for an isolated D1 only. NOT wired to any production request.
// Cloudflare D1 batch() runs these prepared statements atomically. Unlike a
// queue ACK, completion of this batch proves the canonical relation commit.
// Pricing/trigger/index fan-out MUST still be measured with meta.rows_written.
// A shared single-writer fence MUST guard this adapter across all environments.
export function createLikeD1Canonical140(db) {
  if (!db?.prepare || !db?.batch) throw new TypeError('Cloudflare D1 batch binding required');
  const eligible = `EXISTS (
    SELECT 1 FROM tracks t
    JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1
    JOIN track_stats s ON s.track_id = t.id
    WHERE t.id = ? AND t.is_public = 1 AND t.status = 'published'
  )`;
  return {
    async readMembership(uid, trackId) {
      const row = await db.prepare(
        'SELECT 1 AS liked FROM likes WHERE track_id = ? AND user_uid = ? LIMIT 1'
      ).bind(trackId, uid).first();
      return Boolean(row?.liked);
    },
    async applyAtomically(uid, trackId, liked) {
      const now = Date.now();
      const change = liked
        ? db.prepare(`INSERT OR IGNORE INTO likes(track_id, user_uid, created_at)
            SELECT ?, ?, ? WHERE ${eligible}`).bind(trackId, uid, now, trackId)
        : db.prepare(`DELETE FROM likes
            WHERE track_id = ? AND user_uid = ? AND ${eligible}`).bind(trackId, uid, trackId);
      const stat = db.prepare(
        `UPDATE track_stats SET like_count = MAX(0, like_count + ?), updated_at = ?
         WHERE track_id = ? AND changes() = 1`
      ).bind(liked ? 1 : -1, now, trackId);
      const outcome = await db.batch([
        db.prepare(`SELECT ${eligible} AS eligible`).bind(trackId),
        change,
        stat,
        db.prepare(`SELECT EXISTS(
           SELECT 1 FROM likes WHERE track_id = ? AND user_uid = ?
         ) AS liked`).bind(trackId, uid),
      ]);
      const first = outcome?.[0]?.results?.[0];
      const final = outcome?.[3]?.results?.[0];
      const confirmed = Number(first?.eligible) === 1 && Number(final?.liked) === Number(liked);
      if (!confirmed) throw new Error('Canonical D1 settlement not proven');
      const rowsWritten = outcome.reduce(
        (sum, row) => sum + Number(row?.meta?.rows_written || 0), 0
      );
      // Do not mark a deployment W2-PASS based on these values: the actual
      // target's triggers and indexes may charge additional writes.
      return { canonicalCommitted: true, liked, rowsWritten };
    },
  };
}
