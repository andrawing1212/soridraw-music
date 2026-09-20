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
