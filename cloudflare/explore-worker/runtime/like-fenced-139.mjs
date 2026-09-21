// SORIDRAW_LIKE_FENCED_CORE_139_20260921
// Candidate protocol core. NOT wired to a deployed Worker or live D1.
// The caller MUST authenticate uid, route every writer for that UID through
// the SAME serialized durable owner, and provide an atomic D1 adapter.
// A separate storage system is never described as a D1 transaction.
const safeId = (value, max) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;

export class LikeFencedProcessor139 {
  constructor({ ledger, canonical, publish }) {
    if (!ledger?.get || !ledger?.put || !ledger?.nextPublicationSeq || !canonical?.readMembership || !canonical?.applyAtomically || !publish) {
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
      const applied = await this.canonical.applyAtomically(value.uid, value.trackId, intent.liked, {
        previousLiked: value.liked, id: intent.id, revision: intent.revision, seq: intent.seq,
      });
      // 140 can atomically commit relation + count in one D1 batch. The 146
      // proposal instead confirms D1 relation, then retries an independent
      // durable per-track counter and its public cache until acknowledged.
      // Neither route treats an intake queue ACK as canonical settlement.
      if (applied?.canonicalCommitted !== true || applied?.liked !== intent.liked) {
        throw new Error('Canonical D1 final settlement not proven');
      }
      value = {
        ...value, revision: intent.revision, liked: intent.liked,
        last: { id: intent.id, revision: intent.revision, liked: intent.liked },
        pending: null,
        publication: { revision: intent.revision, liked: intent.liked, id: intent.id, seq: intent.seq },
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
    // The durable, atomic per-UID counter is owned by the SAME serialized
    // actor as this account's entire like stream. Gaps from a crash between
    // allocation and pending persistence are harmless; reuse is not.
    const seq = await this.ledger.nextPublicationSeq(uid);
    if (!Number.isSafeInteger(seq) || seq <= 0) throw new Error('Invalid durable publication sequence');
    value = { ...value, pending: { id, revision: value.revision + 1, liked, seq } };
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


// SORIDRAW_LIKE_POSTCOMMIT_R2_141_20260921
// Post-D1 canonical publication only. Must be invoked by 139 AFTER its D1
// adapter commits. No intake handler may call this publisher. The caller owns
// authentication and a cross-environment single-writer fence.
// This revision field is additive: preserve all existing v114 fields. Older
// unconditional shared-R2 writers must be cut over before this can be live.
export function createLikeSharedR2Publisher141(bucket, notify) {
  if (!bucket?.get || !bucket?.put || typeof notify !== 'function') {
    throw new TypeError('Shared R2 bucket and reliable authenticated notifier required');
  }
  const maxExactSnapshotBytes = 16 * 1024 * 1024;
  // No fixed 128-track history: one globally monotonic per-UID durable
  // sequence allows a single cursor, provided ALL writers use the same owner.
  return async function publishCanonicalLike141({ uid, trackId, id, revision, liked, seq }) {
    if (!safeId(uid, 256) || !safeId(trackId, 512) || !safeId(id, 128) ||
        !Number.isSafeInteger(revision) || revision <= 0 ||
        !Number.isSafeInteger(seq) || seq <= 0 || typeof liked !== 'boolean') {
      throw new TypeError('Invalid post-commit like event');
    }
    const key = 'internal/explore/shared-social-v114/likes/' + encodeURIComponent(uid) + '.json';
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const object = await bucket.get(key);
      // Cold or truncated user bundles cannot prove an absence. Never build
      // a new snapshot from one changed track or delete 2,000 existing likes.
      if (!object?.etag) throw new Error('Shared like snapshot unavailable; canonical rebuild required');
      let previous;
      try { previous = JSON.parse(await object.text()); } catch { throw new Error('Invalid shared like snapshot'); }
      if (Number(previous?.schemaVersion) !== 1 || previous?.uid !== uid ||
          !Array.isArray(previous.likedTrackIds)) {
        throw new Error('Shared like snapshot missing or invalid');
      }
      const ids = previous.likedTrackIds;
      const exactExtended = previous.canonicalComplete156 === true &&
        previous.canonicalSource156 === 'explore_likes_153' &&
        Number.isSafeInteger(previous.exactLikeCount156) &&
        previous.exactLikeCount156 === ids.length;
      // Any legacy v114 snapshot is only a cache, not proof of canonical
      // completeness. The old path could have been truncated at 2,000 in a
      // previous state and later fallen below 2,000. New fenced publication
      // must therefore start only after the 156 exact cold rebuild marks the
      // snapshot complete against explore_likes_153.
      if (!exactExtended) {
        throw new Error('Legacy shared like snapshot completeness unverified; exact canonical rebuild required');
      }
      const likedIds = new Set(ids);
      if (likedIds.size !== ids.length || ids.some((x) => !safeId(x, 512))) {
        throw new Error('Shared like snapshot contains invalid or duplicated IDs');
      }
      const priorSeq = previous.lastPublishedSeq141 == null ? 0 : previous.lastPublishedSeq141;
      if (!Number.isSafeInteger(priorSeq) || priorSeq < 0) throw new Error('Invalid shared publication sequence');
      if (priorSeq > seq) return { settled: false, superseded: true };
      if (priorSeq === seq) {
        const last = previous.lastPublishedEvent141;
        if (last?.id !== id || last?.trackId !== trackId ||
            last?.revision !== revision || last?.liked !== liked ||
            likedIds.has(trackId) !== liked) {
          throw new Error('Conflicting publication sequence or shared snapshot');
        }
        // Retry only the notifier; the R2 CAS was already committed.
        await notify({ uid, trackId, id, revision, liked, seq });
        return { settled: true, duplicate: true };
      }
      if (liked) likedIds.add(trackId); else likedIds.delete(trackId);
      const next = {
        ...previous, schemaVersion: 1, uid,
        likedTrackIds: [...likedIds],
        ...(exactExtended ? {
          canonicalComplete156: true,
          canonicalSource156: 'explore_likes_153',
          exactLikeCount156: likedIds.size,
          canonicalPublicationSeq156: seq,
        } : {}),
        lastPublishedSeq141: seq,
        lastPublishedEvent141: { trackId, id, revision, liked },
        updatedAt: Date.now(),
      };
      const body = JSON.stringify(next);
      if (exactExtended && new TextEncoder().encode(body).byteLength > maxExactSnapshotBytes) {
        throw new Error('Exact shared like snapshot exceeds safe single-object size; paged R2 migration required');
      }
      const result = await bucket.put(key, body, {
        onlyIf: { etagMatches: object.etag },
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: { soridrawSharedLikes: '114', updatedAt: String(Date.now()) },
      });
      // R2 may reject conditional PUT because another user action updated
      // the object. Re-read only this UID and retry; never blind overwrite.
      if (!result) continue;
      await notify({ uid, trackId, id, revision, liked, seq });
      return { settled: true, attempts: attempt + 1 };
    }
    throw new Error('Shared like R2 CAS contention; pending retry required');
  };
}


// SORIDRAW_LIKE_EXACT_R2_REBUILD_156_20260921
// One-time/cold repair only. Build an exact v114-compatible shared snapshot
// from the bounded 155 canonical pager while the SAME per-UID durable owner
// holds a publication barrier. Normal revisit must use local/R2 cache and must
// never run this full canonical scan. This helper does no D1 writes.
export function createLikeExactR2Rebuilder156(bucket, listPage155, readPublicationSeq) {
  if (!bucket?.get || !bucket?.put || typeof listPage155 !== 'function' ||
      typeof readPublicationSeq !== 'function') {
    throw new TypeError('Shared R2, bounded canonical pager and durable sequence reader required');
  }
  const maxPages = 1024; // 131,072 likes at 128/page; fail closed, never truncate.
  const maxExactSnapshotBytes = 16 * 1024 * 1024;
  return async function rebuildExactLikes156(uid) {
    if (!safeId(uid, 256)) throw new TypeError('Invalid exact like rebuild UID');
    const startSeq = await readPublicationSeq(uid);
    if (!Number.isSafeInteger(startSeq) || startSeq < 0) {
      throw new Error('Invalid durable publication barrier');
    }
    const ids = [];
    const seen = new Set();
    let cursor = null;
    for (let pageNo = 0; pageNo < maxPages; pageNo += 1) {
      const page = await listPage155(uid, cursor, 128);
      if (!Array.isArray(page?.items) || page.items.length > 128) {
        throw new Error('Invalid canonical like rebuild page');
      }
      for (const item of page.items) {
        const trackId = item?.trackId;
        if (!safeId(trackId, 512) || seen.has(trackId)) {
          throw new Error('Duplicate or invalid canonical like during rebuild');
        }
        seen.add(trackId);
        ids.push(trackId);
      }
      if (page.nextCursor == null) { cursor = null; break; }
      cursor = page.nextCursor;
      if (pageNo === maxPages - 1) {
        throw new Error('Exact like rebuild exceeds safe page budget; paged R2 migration required');
      }
    }
    const endSeq = await readPublicationSeq(uid);
    if (endSeq !== startSeq) {
      throw new Error('Concurrent like mutation during exact rebuild');
    }
    const key = 'internal/explore/shared-social-v114/likes/' + encodeURIComponent(uid) + '.json';
    const object = await bucket.get(key);
    let previous = {};
    let onlyIf;
    if (object?.etag) {
      try { previous = JSON.parse(await object.text()); }
      catch { throw new Error('Existing shared like snapshot unreadable'); }
      if (previous?.uid != null && previous.uid !== uid) {
        throw new Error('Existing shared like snapshot UID mismatch');
      }
      onlyIf = { etagMatches: object.etag };
    } else {
      onlyIf = { etagDoesNotMatch: '*' };
    }
    const now = Date.now();
    const next = {
      ...previous,
      schemaVersion: 1,
      uid,
      likedTrackIds: ids,
      canonicalComplete156: true,
      canonicalSource156: 'explore_likes_153',
      exactLikeCount156: ids.length,
      canonicalPublicationSeq156: startSeq,
      lastPublishedSeq141: startSeq,
      updatedAt: now,
    };
    // A rebuild is a barrier, not a retry of a specific prior event.
    delete next.lastPublishedEvent141;
    const body = JSON.stringify(next);
    if (new TextEncoder().encode(body).byteLength > maxExactSnapshotBytes) {
      throw new Error('Exact shared like snapshot exceeds safe single-object size; paged R2 migration required');
    }
    const stored = await bucket.put(key, body, {
      onlyIf,
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { soridrawSharedLikes: '114', updatedAt: String(now), exactLikes: '156' },
    });
    if (!stored) throw new Error('Exact shared like rebuild CAS conflict; retry under UID owner');
    return { rebuilt: true, count: ids.length, publicationSeq: startSeq };
  };
}


// SORIDRAW_LIKE_DURABLE_OWNER_143_20260921
// Glue for one Durable Object instance per authenticated UID, shared by ALL
// SORIDRAW environments through one service binding. This module does not
// create that binding, authenticate the caller, or migrate shared user data.
// The queue is per DO instance, not a cross-Worker global mutex: every legacy
// writer must be cut over before enabling this route.
export function createLikeDurableOwner143({ uid, storage, canonical, publish }) {
  if (!safeId(uid, 256) || !storage?.get || !storage?.put ||
      !storage?.transaction || !canonical || !publish) {
    throw new TypeError('Authenticated UID, durable storage and canonical adapters required');
  }
  const sequenceKey = 'soridraw:account-like-seq:143:' + uid;
  const ledger = {
    get: (key) => storage.get(key),
    put: (key, value) => storage.put(key, value),
    async nextPublicationSeq(requestUid) {
      if (requestUid !== uid) throw new Error('UID owner mismatch');
      return storage.transaction(async (txn) => {
        const prior = (await txn.get(sequenceKey)) ?? 0;
        if (!Number.isSafeInteger(prior) || prior < 0 || prior >= Number.MAX_SAFE_INTEGER) {
          throw new Error('Durable like publication counter invalid or exhausted');
        }
        const next = prior + 1;
        await txn.put(sequenceKey, next);
        return next;
      });
    },
  };
  const processor = new LikeFencedProcessor139({ ledger, canonical, publish });
  let tail = Promise.resolve();
  return {
    mutate(input) {
      if (input?.uid !== uid) return Promise.reject(new Error('UID owner mismatch'));
      // Coalesce DO event concurrency into a single ordered stream; a thrown
      // operation must not poison the queue for later retries.
      const job = tail.then(() => processor.mutate(input));
      tail = job.catch(() => {});
      return job;
    },
  };
}


// SORIDRAW_LIKE_RELATION_ONLY_146_20260921
// Isolated W1-W2 D1 candidate, NOT wired into any live Worker.
// This adapter writes ONLY likes. A separate durable and idempotent per-track
// aggregate MUST confirm the count/rank projection before the 139 processor
// may publish the user's personal heart. Audit live D1 schema first.
// A persisted pre-mutation membership keeps the SAME delta after an
// ambiguous D1 commit and retry.
export function createLikeRelationOnly146(db, commitAggregate, options = {}) {
  if (!db?.prepare || !db?.batch || typeof commitAggregate !== 'function') {
    throw new TypeError('D1 batch and durable idempotent track aggregation required');
  }
  // 153 is an UNAPPLIED additive schema. Never auto-create or seed at runtime.
  // Do not switch until all shared-data readers/writers have been cut over.
  const table = options.relationTable ?? 'likes';
  if (table !== 'likes' && table !== 'explore_likes_153') {
    throw new TypeError('Unknown canonical likes table');
  }
  if (table === 'explore_likes_153' && options.cutoverVerified !== true) {
    throw new Error('153 shared-user baseline and legacy writer cutover unverified');
  }
  const userFirst = table === 'explore_likes_153';
  const eligible = 'EXISTS (SELECT 1 FROM tracks t ' +
    'JOIN public_profiles p ON p.uid = t.owner_uid AND p.is_public = 1 ' +
    'JOIN track_stats s ON s.track_id = t.id ' +
    "WHERE t.id = ? AND t.is_public = 1 AND t.status = 'published')";
  return {
    async readMembership(uid, trackId) {
      const row = userFirst
        ? await db.prepare('SELECT 1 AS liked FROM explore_likes_153 ' +
            'WHERE user_uid = ? AND track_id = ? LIMIT 1').bind(uid, trackId).first()
        : await db.prepare('SELECT 1 AS liked FROM likes ' +
            'WHERE track_id = ? AND user_uid = ? LIMIT 1').bind(trackId, uid).first();
      return Boolean(row?.liked);
    },
    async applyAtomically(uid, trackId, liked, context) {
      const { previousLiked, id, revision, seq } = context || {};
      if (!safeId(uid, 256) || !safeId(trackId, 512) ||
          !safeId(id, 128) || typeof previousLiked !== 'boolean' ||
          typeof liked !== 'boolean' || !Number.isSafeInteger(revision) ||
          revision <= 0 || !Number.isSafeInteger(seq) || seq <= 0) {
        throw new TypeError('Durable pre-mutation intent required');
      }
      const now = Date.now();
      const mutation = liked
        ? db.prepare('INSERT OR IGNORE INTO ' + table + '(track_id,user_uid,created_at) ' +
            'SELECT ?, ?, ? WHERE ' + eligible).bind(trackId, uid, now, trackId)
        : userFirst
          ? db.prepare('DELETE FROM explore_likes_153 WHERE user_uid = ? AND track_id = ? ' +
              'AND ' + eligible).bind(uid, trackId, trackId)
          : db.prepare('DELETE FROM likes WHERE track_id = ? AND user_uid = ? ' +
              'AND ' + eligible).bind(trackId, uid, trackId);
      const results = await db.batch([
        db.prepare('SELECT ' + eligible + ' AS eligible').bind(trackId),
        mutation,
        userFirst
          ? db.prepare('SELECT EXISTS(SELECT 1 FROM explore_likes_153 ' +
              'WHERE user_uid = ? AND track_id = ?) AS liked').bind(uid, trackId)
          : db.prepare('SELECT EXISTS(SELECT 1 FROM likes ' +
              'WHERE track_id = ? AND user_uid = ?) AS liked').bind(trackId, uid),
      ]);
      const permitted = Number(results?.[0]?.results?.[0]?.eligible) === 1;
      const finalLiked = Number(results?.[2]?.results?.[0]?.liked) === 1;
      if (!permitted || finalLiked !== liked) throw new Error('Canonical likes relation not proven');
      const relationChanges = Number(results?.[1]?.meta?.changes);
      if (!Number.isSafeInteger(relationChanges) || relationChanges < 0 ||
          relationChanges > 1 || (previousLiked === liked && relationChanges !== 0)) {
        throw new Error('Unexpected canonical relation change; do not aggregate');
      }
      // A missing/invalid D1 receipt must NEVER count as zero writes. In
      // particular, the 153 W2 release gate is not satisfied by an absent
      // meta.rows_written or a synthetic response with no billing metadata.
      if (!Array.isArray(results) || results.length !== 3 ||
          results.some((result) => !Number.isSafeInteger(result?.meta?.rows_written) ||
            result.meta.rows_written < 0)) {
        throw new Error('Canonical D1 billing receipt missing or invalid');
      }
      const rowsWritten = results.reduce(
        (sum, result) => sum + result.meta.rows_written, 0
      );
      if (userFirst && relationChanges === 1 && rowsWritten === 0) {
        throw new Error('153 mutation missing a billable relation write');
      }
      if (userFirst && rowsWritten > 2) {
        // D1 already committed: keep the pending for audited recovery.
        throw new Error('153 relation exceeded live D1 W2 billing budget');
      }
      // Re-send the SAME counter event after ambiguous post-D1 failures, even
      // when the relation no longer changes. The per-track owner must dedupe.
      if (previousLiked !== liked) {
        const outcome = await commitAggregate({
          uid, trackId, id, revision, seq, previousLiked, liked,
          delta: Number(liked) - Number(previousLiked),
        });
        if (outcome?.aggregateConfirmed !== true ||
            outcome?.id !== id || outcome?.trackId !== trackId ||
            outcome?.revision !== revision) {
          throw new Error('Durable track aggregate not confirmed');
        }
      }
      return { canonicalCommitted: true, liked, rowsWritten, relationChanges };
    },
  };
}


// SORIDRAW_LIKE_RECOVERY_PAGER_155_20260921
// Read-only, bounded, deterministic cold-recovery tool for the UNAPPLIED
// user-first 153 schema. This is NOT a hot-path lookup. A validated local R2
// cache should be used on unchanged revisit; never re-page on app update.
// Index contract: (user_uid,created_at DESC,track_id DESC). The track-id tie
// break prevents dropping likes created in the same millisecond.
// No full-table count, OFFSET paging, user writes, or legacy fallback here.
export function createLikeRecentPager155(db) {
  if (!db?.prepare) throw new TypeError('Read-only D1 binding required');
  return async function listRecentLikes155(uid, cursor = null, limit = 128) {
    if (!safeId(uid, 256) || !Number.isSafeInteger(limit) || limit < 1 || limit > 128) {
      throw new TypeError('Invalid bounded personal like recovery request');
    }
    if (cursor !== null &&
        (!Number.isSafeInteger(cursor.createdAt) || cursor.createdAt < 0 ||
         !safeId(cursor.trackId, 512))) {
      throw new TypeError('Invalid like recovery cursor');
    }
    const sql = 'SELECT track_id,created_at FROM explore_likes_153 ' +
      'WHERE user_uid = ? ' +
      (cursor === null ? '' :
        'AND (created_at < ? OR (created_at = ? AND track_id < ?)) ') +
      'ORDER BY created_at DESC,track_id DESC LIMIT ?';
    const values = cursor === null
      ? [uid, limit] : [uid, cursor.createdAt, cursor.createdAt, cursor.trackId, limit];
    const response = await db.prepare(sql).bind(...values).all();
    if (!Array.isArray(response?.results) || response.results.length > limit) {
      throw new Error('Invalid bounded like recovery result');
    }
    const items = response.results.map((row) => {
      if (!safeId(row?.track_id, 512) ||
          !Number.isSafeInteger(row?.created_at) || row.created_at < 0) {
        throw new Error('Invalid canonical like recovery row');
      }
      return { trackId: row.track_id, createdAt: row.created_at };
    });
    for (let i = 1; i < items.length; i += 1) {
      const earlier = items[i - 1], later = items[i];
      if (!(later.createdAt < earlier.createdAt ||
            (later.createdAt === earlier.createdAt && later.trackId < earlier.trackId))) {
        throw new Error('Unordered or duplicated canonical recovery rows');
      }
    }
    if (cursor !== null && items.length) {
      const first = items[0];
      if (!(first.createdAt < cursor.createdAt ||
            (first.createdAt === cursor.createdAt && first.trackId < cursor.trackId))) {
        throw new Error('Canonical recovery cursor did not advance');
      }
    }
    const last = items[items.length - 1];
    return { items, nextCursor: items.length === limit ?
      { createdAt: last.createdAt, trackId: last.trackId } : null };
  };
}


// SORIDRAW_LIKE_TRACK_AGGREGATOR_147_20260921
// Candidate separate durable track owner. One instance must own ONE track
// across ALL environments. Seed its count from an audited canonical baseline;
// never invent zero or reset a missing count. The track owner atomically stores
// both count and each UID's last applied operation (id + revision).
// Publishing to public R2 is a SECOND recoverable step. No unconditional
// overwrite or fire-and-forget notification is permitted.
export function createLikeTrackAggregator147(trackId, storage, publishTrack) {
  if (!safeId(trackId, 512) || !storage?.transaction || typeof publishTrack !== 'function') {
    throw new TypeError('Shared track owner, durable transaction and versioned publisher required');
  }
  const totalKey = 'soridraw:track-like-total:147';
  const lastKey = (uid) => 'soridraw:track-like-user:147:' + uid;
  let tail = Promise.resolve();
  async function commit(event) {
    const { uid, id, revision, seq, previousLiked, liked, delta } = event || {};
    if (event?.trackId !== trackId || !safeId(uid, 256) || !safeId(id, 128) ||
        !Number.isSafeInteger(revision) || revision <= 0 ||
        !Number.isSafeInteger(seq) || seq <= 0 ||
        typeof previousLiked !== 'boolean' || typeof liked !== 'boolean' ||
        delta !== Number(liked) - Number(previousLiked) || delta === 0) {
      throw new TypeError('Invalid durable track delta');
    }
    const persisted = await storage.transaction(async (txn) => {
      const total = await txn.get(totalKey);
      if (!total || !Number.isSafeInteger(total.count) || total.count < 0 ||
          !Number.isSafeInteger(total.version) || total.version < 0) {
        throw new Error('Track count not seeded from audited canonical baseline');
      }
      const previous = await txn.get(lastKey(uid));
      if (previous) {
        if (!Number.isSafeInteger(previous.revision) || previous.revision <= 0 ||
            typeof previous.liked !== 'boolean' || !safeId(previous.id, 128)) {
          throw new Error('Invalid durable per-user track revision');
        }
        if (previous.revision > revision) throw new Error('Superseded track delta');
        if (previous.revision === revision) {
          if (previous.id !== id || previous.liked !== liked ||
              previous.previousLiked !== previousLiked || previous.delta !== delta) {
            throw new Error('Conflicting durable track delta');
          }
          return { version: previous.version, count: previous.count, duplicate: true };
        }
        if (previous.revision + 1 !== revision) {
          // A missing intermediate receipt must not be silently skipped. It
          // may represent a committed delta whose count is not yet reconciled.
          throw new Error('Track revision gap; audited recovery required');
        }
        if (previous.liked !== previousLiked) {
          throw new Error('Track delta pre-state differs from previously committed action');
        }
      } else if (revision !== 1) {
        // A new per-UID track ledger can start only with the first operation.
        // Existing users with higher revisions need an audited initial state.
        throw new Error('Missing track user baseline; audited recovery required');
      }
      const nextCount = total.count + delta;
      if (!Number.isSafeInteger(nextCount) || nextCount < 0 ||
          total.version >= Number.MAX_SAFE_INTEGER) {
        throw new Error('Track count invalid or overflowed');
      }
      const version = total.version + 1;
      await txn.put(totalKey, { count: nextCount, version });
      await txn.put(lastKey(uid), {
        id, revision, seq, previousLiked, liked, delta, count: nextCount, version,
      });
      return { version, count: nextCount, duplicate: false };
    });
    // The durable count was committed above. If this conditional R2 publish
    // fails, 139 retains pending and repeats the SAME id. A later snapshot may
    // supersede this event only if it proves >= the durable generation.
    const published = await publishTrack({
      ...event, count: persisted.count, generation: persisted.version,
    });
    // Updating only a shared track card is NOT enough: recommended/latest,
    // popular ordering and the owner's public profile may show an old count.
    // Require a generation receipt for every existing public read surface.
    const surfaces = published?.surfaceGenerations;
    const allPublicSurfacesConfirmed = ['card', 'feed', 'profile'].every(
      (scope) => Number.isSafeInteger(surfaces?.[scope]) &&
        surfaces[scope] >= persisted.version
    );
    if (published?.published !== true ||
        !Number.isSafeInteger(published?.snapshotGeneration) ||
        published.snapshotGeneration < persisted.version ||
        !allPublicSurfacesConfirmed) {
      throw new Error('All public like surfaces not confirmed after durable count');
    }
    return {
      aggregateConfirmed: true, id, trackId, revision,
      generation: persisted.version, count: persisted.count,
      duplicate: persisted.duplicate,
    };
  }
  return function commitAggregate147(event) {
    const operation = tail.then(() => commit(event));
    tail = operation.catch(() => {});
    return operation;
  };
}


// SORIDRAW_LIKE_SHARED_TRACK_CARD_151_20260921
// One public surface only: existing shared-track-card-v115 R2 object.
// This adapter alone does NOT complete Feed, popular sorting, or profile;
// the 147 owner requires separate proven receipts for those surfaces.
export function createLikeSharedTrackCardPublisher151(bucket) {
  if (!bucket?.get || !bucket?.put) throw new TypeError('Shared R2 bucket required');
  return async function publishTrackCard151({ trackId, count, generation, delta }) {
    if (!safeId(trackId, 512) || !Number.isSafeInteger(count) || count < 0 ||
        !Number.isSafeInteger(generation) || generation <= 0 ||
        (delta !== 1 && delta !== -1)) {
      throw new TypeError('Invalid canonical public track count');
    }
    const key = 'internal/explore/shared-track-card-v115/' +
      encodeURIComponent(trackId) + '.json';
    for (let attempt = 0; attempt < 12; attempt++) {
      const object = await bucket.get(key);
      if (!object?.etag) throw new Error('Existing shared track card missing; verified rebuild required');
      let bundle;
      try { bundle = JSON.parse(await object.text()); }
      catch { throw new Error('Shared track card unreadable'); }
      if (Number(bundle?.schemaVersion) !== 1 ||
          bundle.trackId !== trackId || bundle?.card?.id !== trackId ||
          !Number.isSafeInteger(bundle.card.likeCount) ||
          bundle.card.likeCount < 0) {
        throw new Error('Shared track card missing expected schema or count');
      }
      const previousGeneration = bundle.lastLikeGeneration151 == null
        ? 0 : bundle.lastLikeGeneration151;
      if (!Number.isSafeInteger(previousGeneration) || previousGeneration < 0) {
        throw new Error('Invalid shared card generation');
      }
      if (previousGeneration > generation) {
        return { published: true, snapshotGeneration: previousGeneration,
          superseded: true, surface: 'card' };
      }
      if (previousGeneration === generation) {
        if (bundle.card.likeCount !== count ||
            bundle.card?.stats?.likeCount != null &&
              bundle.card.stats.likeCount !== count) {
          throw new Error('Conflicting shared card generation/count');
        }
        return { published: true, snapshotGeneration: generation,
          duplicate: true, surface: 'card' };
      }
      // The first migrated update must begin from the exact audited baseline,
      // not a stale card reconstructed from older TEST/PRODUCTION workers.
      if (previousGeneration === 0 && generation !== 1) {
        throw new Error('Shared card generation missing; audited rebuild required');
      }
      if (previousGeneration === 0 &&
          bundle.card.likeCount !== count - delta) {
        throw new Error('Shared card baseline differs from verified track total');
      }
      // A generation jump is safe only if the new count came from the same
      // serialized, durable per-track owner and old writers are cut over.
      const nextCard = {
        ...bundle.card, likeCount: count,
        ...(bundle.card.stats && typeof bundle.card.stats === 'object'
          ? { stats: { ...bundle.card.stats, likeCount: count } } : {}),
      };
      const now = Date.now();
      const next = {
        ...bundle, card: nextCard,
        lastLikeGeneration151: generation, updatedAt: now,
      };
      const result = await bucket.put(key, JSON.stringify(next), {
        onlyIf: { etagMatches: object.etag },
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: { soridrawSharedTrackCard: '115', updatedAt: String(now) },
      });
      if (!result) continue;
      return { published: true, snapshotGeneration: generation, surface: 'card' };
    }
    throw new Error('Shared public track card CAS contention; retry required');
  };
}
