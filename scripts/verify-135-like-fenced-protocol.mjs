import { LikeFencedProcessor139, createLikeD1Canonical140, createLikeSharedR2Publisher141, createLikeDurableOwner143, createLikeRelationOnly146, createLikeTrackAggregator147, createLikeSharedTrackCardPublisher151, createLikeRecentPager155, createLikeExactR2Rebuilder156, createLikeOverlayCanonical157, createLikeOverlayPager157, createLikeLazyTrackAggregator158, createTrackStatsBaselineLoader158 } from '../cloudflare/explore-worker/runtime/like-fenced-139.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ISOLATED PROTOCOL SIMULATION ONLY. No real Cloudflare Durable Object or D1.
// Caller must send server-issued per-track base revision (not a device clock).
// A single durable actor owns all commands for one UID; it MUST recover its
// pending transaction before accepting the next command for that track.
class FencedActor {
  constructor(database, durable) { this.database = database; this.tracks = durable; }
  canonical(track) { return Boolean(this.database.likes.get(track)); }
  record(track) {
    if (!this.tracks.has(track)) {
      // Actual implementation requires an authenticated, canonical D1 read
      // on first mutation and an atomic single-writer startup contract.
      this.tracks.set(track, { revision: 0, desired: this.canonical(track), pending: null, last: null });
    }
    return this.tracks.get(track);
  }
  writeD1(track, desired, crash) {
    if (crash === 'before_d1') throw Error('injected_before_d1');
    const previous = this.canonical(track);
    if (previous !== desired) {
      this.database.likes.set(track, desired);
      this.database.count += desired ? 1 : -1;
      this.database.logicalRowWrites += 2; // EXCLUDES index/trigger fan-out.
    }
    if (crash === 'after_d1_before_ack') throw Error('injected_after_d1_before_ack');
  }
  reconcile(track, crash) {
    const record = this.record(track);
    if (!record.pending) return;
    const pending = record.pending;
    this.writeD1(track, pending.desired, crash);
    record.revision = pending.revision;
    record.desired = pending.desired;
    record.last = { id: pending.id, revision: pending.revision, desired: pending.desired };
    record.pending = null;
  }
  mutate(track, id, baseRevision, desired, crash) {
    const record = this.record(track);
    // Even if original response vanished, settle it BEFORE a newer request.
    try { this.reconcile(track, crash === 'recovery_failure' ? 'before_d1' : undefined); }
    catch { return { state: 'pending', revision: record.revision }; }
    if (record.last?.id === id) return { state: 'settled', revision: record.revision, desired: record.desired, duplicate: true };
    if (record.revision !== baseRevision) return { state: 'stale', revision: record.revision, desired: record.desired };
    // Durable intent must be persisted BEFORE attempting D1.
    record.pending = { id, revision: record.revision + 1, desired };
    try { this.reconcile(track, crash); }
    catch { return { state: 'pending', revision: record.revision }; }
    return { state: 'settled', revision: record.revision, desired };
  }
  recover(track) { this.reconcile(track); }
}

const db = { likes: new Map(), count: 0, logicalRowWrites: 0 };
const durable = new Map();
let actor = new FencedActor(db, durable);
assert.equal(actor.mutate('song','pc-like',0,true).state,'settled');
assert.equal(db.count, 1);
assert.deepEqual(actor.mutate('song','pc-like',0,true),{state:'settled',revision:1,desired:true,duplicate:true});
assert.equal(db.logicalRowWrites,2);
console.log('135_FENCED_SAME_ID_REPLAY_NO_D1_DUPLICATION=PASS');
assert.equal(actor.mutate('song','mobile-unlike',1,false).state,'settled');
assert.equal(actor.mutate('song','late-old-like',0,true).state,'stale');
assert.equal(db.count,0);
console.log('135_FENCED_LATE_OLD_LIKE_CANNOT_REVERSE_UNLIKE=PASS');
assert.equal(actor.mutate('song','new-like',2,true).state,'settled');
assert.equal(db.count,1);
console.log('135_FENCED_REBASED_NEW_USER_INTENT=PASS');
assert.equal(actor.mutate('song2','another-song',0,true).state,'settled');
assert.equal(db.count,2);
console.log('135_FENCED_DISTINCT_SONGS_INDEPENDENT=PASS');
assert.equal(actor.mutate('song','crash-before',3,false,'before_d1').state,'pending');
assert.equal(db.count,2);
assert.equal(actor.mutate('song','newer-must-wait',3,true,'recovery_failure').state,'pending');
actor = new FencedActor(db, durable); // simulated runtime restart, intent survives
actor.recover('song');
assert.equal(db.count,1);
assert.equal(actor.mutate('song','crash-before',3,false).state,'settled');
console.log('135_FENCED_RECOVER_DURABLE_INTENT_BEFORE_NEW_ORDER=PASS');
assert.equal(actor.mutate('song','crash-after',4,true,'after_d1_before_ack').state,'pending');
assert.equal(db.count,2);
actor = new FencedActor(db, durable); // crash after D1, before persisted final ACK
actor.recover('song');
assert.equal(db.count,2);
assert.equal(actor.mutate('song','crash-after',4,true).state,'settled');
assert.equal(db.logicalRowWrites,12);
console.log('135_FENCED_AFTER_D1_CRASH_RECOVERY_NO_DOUBLE_COUNT=PASS');
// A legacy writer can still bypass this actor. This is an explicit blocker,
// not a passing test: deployment must cut over ALL shared canonical writers.
db.likes.set('song',false); db.count -= 1;
assert.notEqual(actor.record('song').desired,actor.canonical('song'));
console.log('135_LEGACY_WRITER_BYPASS_RELEASE_GATE=FAIL');
console.log('135_REAL_D1_INDEX_TRIGGER_COST=NOT_MEASURED');
console.log('135_DO_BILLING_AND_CROSS_SYSTEM_ATOMICITY=NOT_MEASURED');
console.log('135_PRODUCT_RELEASE_READINESS=FAIL');


// 139: Test the actual Worker-compatible protocol core, not only FencedActor's
// conceptual in-memory model. This is a fake ledger + fake atomic D1 adapter:
// it must NOT be interpreted as Cloudflare metering or real DO atomicity.
{
  const persistent = new Map();
  const membership = new Map();
  const counts = new Map();
  const publications = [];
  let failure = '';
  let denyPublish = false;
  const ledger = {
    async get(key) { return structuredClone(persistent.get(key)); },
    async put(key, value) { persistent.set(key, structuredClone(value)); },
    async nextPublicationSeq(uid) {
      const key = 'seq:' + uid;
      const next = (persistent.get(key) ?? 0) + 1;
      persistent.set(key, next);
      return next;
    },
  };
  const canonical = {
    async readMembership(uid, id) { return membership.get(uid + ':' + id) ?? false; },
    async applyAtomically(uid, id, liked) {
      if (failure === 'before') { failure = ''; throw Error('before D1'); }
      const key = uid + ':' + id;
      const previous = membership.get(key) ?? false;
      if (previous !== liked) {
        membership.set(key, liked);
        counts.set(id, (counts.get(id) ?? 0) + (liked ? 1 : -1));
      }
      if (failure === 'after') { failure = ''; throw Error('after D1'); }
      return { canonicalCommitted: true, liked };
    },
  };
  const publish = async (event) => {
    if (denyPublish) throw Error('shared R2 unavailable');
    const last = publications.findLast((x) => x.uid === event.uid && x.trackId === event.trackId);
    if (last && last.revision > event.revision) throw Error('stale publication');
    publications.push(event);
    return { settled: true };
  };
  let processor = new LikeFencedProcessor139({ ledger, canonical, publish });
  const send = (id, baseRevision, liked, trackId = 'song') =>
    processor.mutate({ uid: 'user', trackId, id, baseRevision, liked });

  assert.deepEqual(await send('first', 0, true), { state: 'settled', revision: 1, liked: true });
  assert.deepEqual(await send('first', 0, true), { state: 'settled', duplicate: true, revision: 1, liked: true });
  assert.equal(counts.get('song'), 1, 'same operation must not double count');
  assert.deepEqual(await send('first', 0, false), { state: 'conflict', revision: 1, liked: true },
    'an operation ID reused for opposite desired state may not be treated as a successful duplicate');
  assert.deepEqual(await send('first', 1, true), { state: 'conflict', revision: 1, liked: true },
    'an operation ID reused with a different base revision must be rejected');
  assert.equal((await send('second', 1, false)).state, 'settled');
  assert.deepEqual(await send('delayed-old', 0, true), { state: 'stale', revision: 2, liked: false });
  assert.equal(counts.get('song'), 0, 'old like must not reverse confirmed unlike');

  failure = 'before';
  assert.equal((await send('crash-before', 2, true)).state, 'pending');
  assert.equal(counts.get('song'), 0);
  processor = new LikeFencedProcessor139({ ledger, canonical, publish });
  assert.equal((await send('crash-before', 2, true)).state, 'settled');
  assert.equal(counts.get('song'), 1);
  failure = 'after';
  assert.equal((await send('crash-after', 3, false)).state, 'pending');
  assert.equal(counts.get('song'), 0);
  processor = new LikeFencedProcessor139({ ledger, canonical, publish });
  assert.equal((await send('crash-after', 3, false)).state, 'settled');
  assert.equal(counts.get('song'), 0, 'after-D1 crash retry may not subtract twice');

  denyPublish = true;
  assert.equal((await send('publication-offline', 4, true)).state, 'pending');
  assert.equal((await send('newer-blocked', 4, false)).state, 'pending');
  denyPublish = false;
  assert.equal((await send('publication-offline', 4, true)).state, 'settled');
  assert.equal((await send('different-track', 0, true, 'song2')).state, 'settled');
  assert.equal(counts.get('song2'), 1);
  assert.equal(publications.at(-1).trackId, 'song2');
  console.log('139_ACTUAL_CORE_IDEMPOTENT_REPLAY_AND_CONFLICT=PASS');
  console.log('139_ACTUAL_CORE_DURABLE_CRASH_RECOVERY_MODEL=PASS');
  console.log('139_ACTUAL_CORE_PUBLISH_AFTER_D1_ONLY=PASS');
  console.log('139_ACTUAL_CORE_PUBLISH_FAILURE_BLOCKS_NEW_ORDER=PASS');
  console.log('139_REAL_CLOUDFLARE_D1_DO_COST_AND_LEGACY_WRITERS=NOT_VERIFIED');
  console.log('139_PRODUCT_RELEASE=FAIL');
}


// 140: verify actual adapter statement ordering/guards with a transactional
// D1-shaped mock. The existing 133/134 SQLite tests separately model row cost;
// only an isolated real Cloudflare D1 can approve billed rows_written.
{
  let relation = false, stat = 0, eligible = true, sqlCalls = 0, batches = 0;
  const prepared = (sql) => ({
    bind(...args) {
      return {
        sql, args,
        async first() {
          assert.match(sql, /SELECT 1 AS liked FROM likes/);
          return relation ? { liked: 1 } : null;
        },
      };
    },
  });
  const db = {
    prepare(sql) { sqlCalls++; return prepared(sql); },
    async batch(stmts) {
      batches++;
      assert.equal(stmts.length, 4, 'preflight+relation+stat+canonical membership in one batch');
      assert.match(stmts[0].sql, /JOIN public_profiles p/);
      assert.match(stmts[0].sql, /JOIN track_stats s/);
      assert.match(stmts[2].sql, /changes\(\) = 1/);
      assert.match(stmts[3].sql, /SELECT EXISTS\(/);
      const desired = stmts[1].sql.includes('INSERT OR IGNORE');
      const before = relation;
      if (eligible) relation = desired;
      const relationChanges = eligible && before !== relation ? 1 : 0;
      if (relationChanges) stat += desired ? 1 : -1;
      return [
        { results: [{ eligible: Number(eligible) }], meta: { rows_written: 0 } },
        { results: [], meta: { rows_written: relationChanges } },
        { results: [], meta: { rows_written: relationChanges } },
        { results: [{ liked: Number(relation) }], meta: { rows_written: 0 } },
      ];
    },
  };
  const adapter = createLikeD1Canonical140(db);
  assert.equal(await adapter.readMembership('uid','song'), false);
  assert.deepEqual(await adapter.applyAtomically('uid','song',true), {
    canonicalCommitted: true, liked: true, rowsWritten: 2,
  });
  assert.equal(stat, 1);
  assert.deepEqual(await adapter.applyAtomically('uid','song',true), {
    canonicalCommitted: true, liked: true, rowsWritten: 0,
  });
  assert.equal(stat, 1, 'duplicate like must not double count');
  assert.equal((await adapter.applyAtomically('uid','song',false)).liked, false);
  assert.equal(stat, 0);
  assert.equal((await adapter.applyAtomically('uid','song',false)).rowsWritten, 0);
  eligible = false;
  await assert.rejects(adapter.applyAtomically('uid','song',true), /Canonical D1 settlement not proven/);
  assert.equal(relation, false, 'invalid private track must not create a like');
  assert.ok(batches >= 5 && sqlCalls > 0);
  console.log('140_D1_ADAPTER_SQL_BATCH_ORDER_AND_FAIL_CLOSED_MOCK=PASS');
  console.log('140_REAL_D1_CHANGES_ROWS_WRITTEN_TRIGGER_INDEX=NOT_MEASURED');
}


// 141: Execute the actual post-D1 publisher against a revisioned, conditional
// R2 mock. Never treat this as a real Cloudflare account or live billing test.
{
  function mockBucket(initial) {
    let value = structuredClone(initial), generation = 1, writes = 0, conflicts = 0;
    let forceConflict = false;
    return {
      get value() { return structuredClone(value); },
      get writes() { return writes; },
      get conflicts() { return conflicts; },
      conflictOnce() { forceConflict = true; },
      async get(key) {
        assert.equal(key, 'internal/explore/shared-social-v114/likes/user.json');
        if (!value) return null;
        const snapshot = JSON.stringify(value), etag = 'rev-' + generation;
        return { etag, text: async () => snapshot };
      },
      async put(key, body, options) {
        assert.equal(key, 'internal/explore/shared-social-v114/likes/user.json');
        assert.equal(options?.httpMetadata?.contentType, 'application/json; charset=utf-8');
        if (forceConflict) { forceConflict = false; conflicts++; return null; }
        if (options?.onlyIf?.etagMatches !== 'rev-' + generation) {
          conflicts++;
          return null;
        }
        value = JSON.parse(body);
        generation++;
        writes++;
        return { etag: 'rev-' + generation };
      },
    };
  }
  const r2 = mockBucket({
    schemaVersion: 1, uid: 'user', likedTrackIds: ['existing'],
    canonicalComplete156: true, canonicalSource156: 'explore_likes_153', exactLikeCount156: 1,
    lastLikeOrders074: { existing: { at: 100, batchId: 'legacy' } },
    customLegacyField: 'untouched',
  });
  let notifications = [], failNotify = false;
  const publish = createLikeSharedR2Publisher141(r2, async (event) => {
    if (failNotify) throw Error('notification failed');
    notifications.push(event);
  });
  const issued = new Map();
  let nextSeq = 0;
  const event = (trackId, id, revision, liked, explicitSeq) => {
    let seq = explicitSeq ?? issued.get(id);
    if (seq == null) { seq = ++nextSeq; issued.set(id, seq); }
    return { uid: 'user', trackId, id, revision, liked, seq };
  };
  const liked = await publish(event('song', 'first', 1, true));
  assert.equal(liked.settled, true);
  assert.deepEqual(new Set(r2.value.likedTrackIds), new Set(['existing', 'song']));
  assert.equal(r2.value.customLegacyField, 'untouched');
  assert.deepEqual(r2.value.lastLikeOrders074.existing, { at: 100, batchId: 'legacy' });
  assert.equal(r2.value.lastPublishedSeq141, 1);
  assert.deepEqual(r2.value.lastPublishedEvent141,
    { trackId: 'song', id: 'first', revision: 1, liked: true });
  const firstWrites = r2.writes;
  assert.deepEqual(await publish(event('song', 'first', 1, true)), { settled: true, duplicate: true });
  assert.equal(r2.writes, firstWrites, 'same revision never rewrites shared R2');
  await assert.rejects(publish(event('song', 'different-id', 1, true, 1)), /Conflicting publication sequence/);
  await assert.rejects(publish(event('song', 'first', 1, false)), /Conflicting publication sequence/);
  assert.equal((await publish(event('song', 'second', 2, false))).settled, true);
  assert.equal(r2.value.likedTrackIds.includes('song'), false);
  assert.deepEqual(await publish(event('song', 'old', 1, true, 1)), { settled: false, superseded: true });
  assert.equal(r2.value.likedTrackIds.includes('song'), false);
  r2.conflictOnce();
  assert.equal((await publish(event('new-track', 'retry-etag', 1, true))).settled, true);
  assert.equal(r2.conflicts, 1, 'CAS conflict retries against this user only');

  failNotify = true;
  await assert.rejects(publish(event('song', 'third', 3, true)), /notification failed/);
  assert.equal(r2.value.likedTrackIds.includes('song'), true, 'R2 CAS committed before notification');
  const committedWrites = r2.writes;
  failNotify = false;
  assert.deepEqual(await publish(event('song', 'third', 3, true)), { settled: true, duplicate: true });
  assert.equal(r2.writes, committedWrites, 'notification retry must not rewrite R2');
  assert.equal(notifications.at(-1).id, 'third');

  const cold = mockBucket(null);
  let coldNotified = false;
  await assert.rejects(
    createLikeSharedR2Publisher141(cold, async () => { coldNotified = true; })(event('cold', 'c', 1, true)),
    /unavailable/
  );
  assert.equal(cold.writes, 0);
  assert.equal(coldNotified, false);
  const full = mockBucket({ schemaVersion: 1, uid: 'user',
    likedTrackIds: Array.from({ length: 2000 }, (_, i) => 'track-' + i) });
  const fullPublish = createLikeSharedR2Publisher141(full, async () => {});
  await assert.rejects(fullPublish(event('new', 'n', 1, true)), /completeness unverified/);
  await assert.rejects(fullPublish(event('track-1', 'remove-legacy', 1, false, 9)),
    /completeness unverified/);
  assert.equal(full.writes, 0, 'ambiguous legacy 2000 snapshot must never be mutated or truncated');

  // 156: cold-only exact rebuild from the 155 bounded canonical pager. This
  // turns an ambiguous legacy 2,000-item object into an exact >2,000 snapshot
  // without changing the v114 key/schema consumed by older readers.
  const canonical2053 = Array.from({ length: 2053 }, (_, i) => ({
    trackId: 'exact-' + String(i).padStart(5, '0'),
    createdAt: 1800000000000 - Math.floor(i / 7),
  }));
  let pageCalls156 = 0;
  const listPage156 = async (_uid, cursor, limit) => {
    assert.equal(limit, 128);
    let start = 0;
    if (cursor) {
      start = canonical2053.findIndex(x => x.createdAt === cursor.createdAt &&
        x.trackId === cursor.trackId) + 1;
      assert.ok(start > 0, 'cursor must be one of the canonical rows');
    }
    pageCalls156++;
    const items = canonical2053.slice(start, start + limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: items.length === limit && start + items.length < canonical2053.length
        ? { createdAt: last.createdAt, trackId: last.trackId } : null,
    };
  };
  let barrier156 = 10;
  assert.throws(() => createLikeExactR2Rebuilder156(full, listPage156,
    async () => barrier156), /blocked until all legacy like writers/);
  const rebuild156 = createLikeExactR2Rebuilder156(full, listPage156,
    async () => barrier156, { legacyWriterCutoverVerified: true });
  assert.deepEqual(await rebuild156('user'),
    { rebuilt: true, count: 2053, publicationSeq: 10 });
  assert.equal(full.value.canonicalComplete156, true);
  assert.equal(full.value.canonicalSource156, 'explore_likes_153');
  assert.equal(full.value.exactLikeCount156, 2053);
  assert.equal(full.value.likedTrackIds.length, 2053);
  assert.ok(pageCalls156 <= Math.ceil(2053 / 128) + 1);

  const exactPublish = createLikeSharedR2Publisher141(full, async () => {});
  assert.equal((await exactPublish(event('exact-new', 'exact-add', 1, true, 11))).settled, true);
  assert.equal(full.value.likedTrackIds.length, 2054);
  assert.equal(full.value.exactLikeCount156, 2054);
  assert.equal((await exactPublish(event('exact-00001', 'exact-remove', 1, false, 12))).settled, true);
  assert.equal(full.value.likedTrackIds.length, 2053);
  assert.equal(full.value.exactLikeCount156, 2053);

  const contested = mockBucket({ schemaVersion: 1, uid: 'user', likedTrackIds: ['legacy'] });
  let seqReads156 = 0;
  const contestedRebuild = createLikeExactR2Rebuilder156(contested,
    async () => ({ items: [], nextCursor: null }),
    async () => (++seqReads156 === 1 ? 20 : 21),
    { legacyWriterCutoverVerified: true });
  await assert.rejects(contestedRebuild('user'), /Concurrent like mutation/);
  assert.equal(contested.writes, 0, 'rebuild must not publish across a concurrent UID mutation');

  // More than 128 distinct changes must remain possible with a single
  // per-UID cursor instead of a 128-track history embedded in every R2 body.
  const longHistory = mockBucket({ schemaVersion: 1, uid: 'user', likedTrackIds: [],
    canonicalComplete156: true, canonicalSource156: 'explore_likes_153', exactLikeCount156: 0 });
  const historyPublish = createLikeSharedR2Publisher141(longHistory, async () => {});
  for (let i = 0; i < 256; i++) {
    const result = await historyPublish(event('history-' + i, 'history-id-' + i, 1, true));
    assert.equal(result.settled, true);
  }
  assert.equal(longHistory.value.likedTrackIds.length, 256);
  assert.equal(longHistory.value.lastPublishedSeq141, nextSeq);
  assert.equal(longHistory.value.lastLikeRevisions141, undefined,
    'no growing per-track R2 history should be created');
  assert.deepEqual(await historyPublish(event('history-0', 'obsolete', 1, false, 1)),
    { settled: false, superseded: true });
  console.log('141_SHARED_R2_POSTCOMMIT_CAS_AND_LEGACY_FIELDS=PASS');
  console.log('141_STALE_REPLAY_CONFLICT_AND_IDEMPOTENT_NOTIFY=PASS');
  console.log('141_CAS_RETRY_AMBIGUOUS_2000_FAIL_CLOSED_AND_128_HISTORY_ELIMINATED=PASS');
  console.log('156_EXACT_2053_R2_REBUILD_AND_POST_REBUILD_MUTATION=PASS');
  console.log('156_LEGACY_WRITER_CUTOVER_GATE=PASS');
  const legacy061 = readFileSync('cloudflare/explore-worker/patches/061-shared-social-r2-parity.mjs', 'utf8');
  assert.match(legacy061, /existing\?\.canonicalComplete156 === true/);
  assert.match(legacy061, /must never truncate an.*exact >2,000 canonical snapshot/s);
  console.log('156_LEGACY_061_SHARED_MIRROR_EXACT_SNAPSHOT_GUARD=PASS');
  console.log('141_LIVE_CROSS_ENV_WRITER_AND_AUTH_NOT_CONNECTED=NOT_VERIFIED');
}


// 142: integrated 139 + 141 verification. The storage/API adapters below are
// isolated fakes; validate ordering only, not Cloudflare billing or live data.
{
  const durable = new Map(), relation = new Map();
  let commits = 0, notified = 0, rejectD1 = false, rejectNotify = false;
  let snapshot = { schemaVersion: 1, uid: 'user', likedTrackIds: [],
    canonicalComplete156: true, canonicalSource156: 'explore_likes_153', exactLikeCount156: 0 };
  let etag = 1, r2Writes = 0;
  const ledger = {
    async get(key) { return structuredClone(durable.get(key)); },
    async put(key, value) { durable.set(key, structuredClone(value)); },
    async nextPublicationSeq(uid) {
      const key = 'seq:' + uid;
      const next = (durable.get(key) ?? 0) + 1;
      durable.set(key, next);
      return next;
    },
  };
  const canonical = {
    async readMembership(uid, id) { return relation.get(uid + ':' + id) ?? false; },
    async applyAtomically(uid, id, liked) {
      if (rejectD1) throw Error('canonical D1 unavailable');
      const key = uid + ':' + id, before = relation.get(key) ?? false;
      if (before !== liked) { relation.set(key, liked); commits++; }
      return { canonicalCommitted: true, liked };
    },
  };
  const bucket = {
    async get() {
      const data = JSON.stringify(snapshot), observed = String(etag);
      return { etag: observed, text: async () => data };
    },
    async put(_key, json, opts) {
      if (opts?.onlyIf?.etagMatches !== String(etag)) return null;
      snapshot = JSON.parse(json);
      etag++;
      r2Writes++;
      return { etag: String(etag) };
    },
  };
  const publisher = createLikeSharedR2Publisher141(bucket, async () => {
    if (rejectNotify) throw Error('notification temporarily unavailable');
    notified++;
  });
  let integrated = new LikeFencedProcessor139({ ledger, canonical, publish: publisher });
  const intent = (id, baseRevision, liked) =>
    integrated.mutate({ uid: 'user', trackId: 'song', id, baseRevision, liked });
  rejectD1 = true;
  assert.equal((await intent('first', 0, true)).state, 'pending');
  assert.deepEqual(snapshot.likedTrackIds, [], 'R2 must stay unchanged until actual D1 commit');
  assert.equal(r2Writes, 0);
  rejectD1 = false;
  rejectNotify = true;
  assert.equal((await intent('first', 0, true)).state, 'pending');
  assert.equal(commits, 1, 'D1 must commit before R2 and notification');
  assert.deepEqual(snapshot.likedTrackIds, ['song']);
  assert.equal(r2Writes, 1);
  integrated = new LikeFencedProcessor139({ ledger, canonical, publish: publisher });
  rejectNotify = false;
  assert.deepEqual(await intent('first', 0, true),
    { state: 'settled', duplicate: true, revision: 1, liked: true });
  assert.equal(r2Writes, 1, 'recover a notification without an extra R2 object write');
  assert.equal(commits, 1);
  assert.equal(notified, 1);
  assert.equal((await intent('second', 1, false)).state, 'settled');
  assert.equal(commits, 2);
  assert.deepEqual(snapshot.likedTrackIds, []);
  assert.equal((await intent('out-of-order', 0, true)).state, 'stale');
  assert.equal(commits, 2);
  assert.equal(r2Writes, 2);
  console.log('142_CORE_TO_PUBLISHER_END_TO_END_MOCK=PASS');
  console.log('142_NO_PERSONAL_CACHE_BEFORE_D1_AND_RECOVER_NOTIFICATION=PASS');
  console.log('142_CROSS_ENV_AUTH_REAL_D1_AND_DEVICE_SIGNALS=NOT_VERIFIED');
}


// 143: actual durable-owner glue, tested against transactional storage mock.
// One DO instance must be shared across ALL environments before real routing.
{
  const durable = new Map(), canonicalLiked = new Map(), sequenceSeen = [];
  const storage = {
    async get(key) { return structuredClone(durable.get(key)); },
    async put(key, value) { durable.set(key, structuredClone(value)); },
    async transaction(fn) {
      return fn({
        async get(key) { return durable.get(key); },
        async put(key, val) { durable.set(key, val); },
      });
    },
  };
  const canonical = {
    async readMembership(uid, track) { return canonicalLiked.get(uid + ':' + track) ?? false; },
    async applyAtomically(uid, track, liked) {
      canonicalLiked.set(uid + ':' + track, liked);
      return { canonicalCommitted: true, liked };
    },
  };
  const publish = async (event) => {
    sequenceSeen.push(event.seq);
    return { settled: true };
  };
  let owner = createLikeDurableOwner143({ uid: 'user', storage, canonical, publish });
  const request = (trackId, id) => ({
    uid: 'user', trackId, id, baseRevision: 0, liked: true,
  });
  const results = await Promise.all([
    owner.mutate(request('song-a', 'a')),
    owner.mutate(request('song-b', 'b')),
    owner.mutate(request('song-c', 'c')),
  ]);
  assert.deepEqual(results.map(x => x.state), ['settled', 'settled', 'settled']);
  assert.deepEqual(sequenceSeen, [1, 2, 3], 'concurrent tracks require one ordered account-wide stream');
  assert.equal(durable.get('soridraw:account-like-seq:143:user'), 3);
  await assert.rejects(owner.mutate({ ...request('song-d', 'd'), uid: 'other' }), /UID owner mismatch/);
  owner = createLikeDurableOwner143({ uid: 'user', storage, canonical, publish });
  assert.equal((await owner.mutate(request('song-d', 'd'))).state, 'settled');
  assert.deepEqual(sequenceSeen, [1, 2, 3, 4], 'restart must preserve global publication order');
  assert.equal(canonicalLiked.get('user:song-d'), true);
  console.log('143_DURABLE_UID_OWNER_SERIALIZATION_AND_RESTART_MODEL=PASS');
  console.log('143_SHARED_CROSS_ENV_SERVICE_BINDING_AND_AUTH=NOT_CONFIGURED');
}


// 146: real relation-only adapter integrated into the actual 139 pending
// protocol. Mock D1 billing deliberately excludes live SQLite indexes;
// success here is correctness, NOT real Cloudflare W1-W2 proof.
{
  let relation = false, publicTrack = true, canonicalCount = 5;
  let aggregateCount = 5, actualRelationWrites = 0, publishCount = 0;
  let aggregateFailure = '', newestSeq = 0;
  const ledgerValues = new Map(), counterDedupe = new Map(), r2Likes = new Map();
  const ledger = {
    async get(key) { return structuredClone(ledgerValues.get(key)); },
    async put(key, value) { ledgerValues.set(key, structuredClone(value)); },
    async nextPublicationSeq(uid) {
      const key = 'seq:' + uid, next = (ledgerValues.get(key) || 0) + 1;
      ledgerValues.set(key, next);
      return next;
    },
  };
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            sql, args,
            async first() {
              assert.match(sql, /SELECT 1 AS liked FROM likes/);
              return relation ? { liked: 1 } : null;
            },
          };
        },
      };
    },
    async batch(statements) {
      assert.equal(statements.length, 3);
      assert.match(statements[0].sql, /JOIN public_profiles p/);
      assert.doesNotMatch(statements[1].sql, /UPDATE\s+track_stats|explore_derived_tracks/);
      assert.match(statements[2].sql, /SELECT EXISTS\(SELECT 1 FROM likes/);
      const desired = statements[1].sql.includes('INSERT OR IGNORE');
      const before = relation;
      if (publicTrack) relation = desired;
      const changes = publicTrack && before !== relation ? 1 : 0;
      actualRelationWrites += changes;
      return [
        { results: [{ eligible: Number(publicTrack) }], meta: { rows_written: 0, changes: 0 } },
        { results: [], meta: { rows_written: changes, changes } },
        { results: [{ liked: Number(relation) }], meta: { rows_written: 0, changes: 0 } },
      ];
    },
  };
  const commitAggregate = async (event) => {
    assert.equal(canonicalCount, 5, 'old track_stats remains read-compatible but not hot-written');
    assert.equal(event.delta, Number(event.liked) - Number(event.previousLiked));
    if (aggregateFailure === 'before') {
      aggregateFailure = '';
      throw Error('aggregate unavailable before commit');
    }
    const key = [event.uid, event.trackId].join(':');
    const previous = counterDedupe.get(key);
    if (previous?.revision > event.revision) throw Error('stale external counter operation');
    if (previous?.revision === event.revision) {
      assert.equal(previous.id, event.id, 'same revision needs exact operation ID');
      assert.equal(previous.delta, event.delta);
    } else {
      aggregateCount += event.delta;
      counterDedupe.set(key, { id: event.id, revision: event.revision, delta: event.delta });
    }
    if (aggregateFailure === 'after') {
      aggregateFailure = '';
      throw Error('aggregate committed but receipt missing');
    }
    return { aggregateConfirmed: true, id: event.id, trackId: event.trackId, revision: event.revision };
  };
  const canonical = createLikeRelationOnly146(db, commitAggregate);
  const publish = async (event) => {
    assert.equal(aggregateCount, 5 + Number(event.liked), 'public count settles BEFORE personal R2');
    assert.ok(event.seq > newestSeq);
    newestSeq = event.seq;
    r2Likes.set(event.trackId, event.liked);
    publishCount++;
    return { settled: true };
  };
  let processor = new LikeFencedProcessor139({ ledger, canonical, publish });
  const send = (id, baseRevision, liked) =>
    processor.mutate({ uid: 'u', trackId: 'song', id, baseRevision, liked });
  assert.equal(await canonical.readMembership('u', 'song'), false);
  aggregateFailure = 'before';
  assert.equal((await send('like-1', 0, true)).state, 'pending');
  assert.equal(relation, true, 'D1 relation committed independently');
  assert.equal(aggregateCount, 5, 'public count has not been applied yet');
  assert.equal(r2Likes.has('song'), false, 'no personal R2 before BOTH settlement stages');
  processor = new LikeFencedProcessor139({ ledger, canonical, publish });
  assert.equal((await send('like-1', 0, true)).state, 'settled');
  assert.equal(aggregateCount, 6);
  assert.equal(r2Likes.get('song'), true);
  assert.equal(actualRelationWrites, 1, 'retry after D1 commit writes no extra relation row');
  assert.equal((await send('like-1', 0, true)).duplicate, true);
  assert.equal(aggregateCount, 6);
  assert.equal((await send('unlike-2', 1, false)).state, 'settled');
  assert.equal(relation, false);
  assert.equal(aggregateCount, 5);
  assert.equal(r2Likes.get('song'), false);
  assert.equal(actualRelationWrites, 2);
  assert.equal((await send('late-like', 0, true)).state, 'stale');
  aggregateFailure = 'after';
  assert.equal((await send('like-3', 2, true)).state, 'pending');
  assert.equal(aggregateCount, 6);
  assert.equal(publishCount, 2, 'never notify personal R2 before aggregate receipt');
  processor = new LikeFencedProcessor139({ ledger, canonical, publish });
  assert.equal((await send('like-3', 2, true)).state, 'settled');
  assert.equal(aggregateCount, 6, 'idempotent counter retry never adds twice');
  assert.equal(actualRelationWrites, 3);
  assert.equal(r2Likes.get('song'), true);
  publicTrack = false;
  assert.equal((await send('private-attempt', 3, false)).state, 'pending');
  assert.equal(relation, true);
  assert.equal(aggregateCount, 6);
  assert.equal(publishCount, 3);
  console.log('146_RELATION_ONLY_WITH_DURABLE_AGGREGATE_CRASH_RETRY=PASS');
  console.log('146_D1_RELATION_LOGICAL_WRITES_ONE_PER_REAL_CHANGE=PASS');
  console.log('146_NO_PERSONAL_SETTLEMENT_BEFORE_PUBLIC_COUNT=PASS');
  console.log('146_REAL_D1_TRIGGER_INDEX_ROWS_WRITTEN_AND_OLD_READERS=NOT_MEASURED');
  console.log('146_PRODUCT_RELEASE_READINESS=FAIL');
}


// 147: actual per-track durable counter with idempotent UID+revision receipt.
// This simulated transaction is committed before R2 publication. It does NOT
// grant shared ownership to old workers or prove a live DO billing figure.
{
  const persisted = new Map([
    ['soridraw:track-like-total:147', { count: 5, version: 0 }],
  ]);
  let published = { count: 5, generation: 0 }, failOnce = false, omitProfileOnce = false, writeTransactions = 0;
  const storage = {
    async transaction(fn) {
      const draft = new Map([...persisted].map(([key,value]) => [key, structuredClone(value)]));
      const result = await fn({
        async get(key) { return structuredClone(draft.get(key)); },
        async put(key,value) { draft.set(key, structuredClone(value)); },
      });
      persisted.clear();
      for (const [key,value] of draft) persisted.set(key,value);
      writeTransactions++;
      return result;
    },
  };
  const publishTrack = async (event) => {
    if (failOnce) { failOnce = false; throw Error('R2 public track outage'); }
    if (event.generation >= published.generation) {
      published = { count: event.count, generation: event.generation };
    }
    const surfaces = {card:published.generation,feed:published.generation,
      profile:omitProfileOnce ? undefined : published.generation};
    omitProfileOnce = false;
    return { published: true, snapshotGeneration: published.generation,
      surfaceGenerations:surfaces };
  };
  const commit = createLikeTrackAggregator147('song', storage, publishTrack);
  const input = (uid,id,revision,previousLiked,liked,seq=revision) => ({
    uid, trackId: 'song', id, revision, previousLiked, liked,
    delta: Number(liked)-Number(previousLiked), seq,
  });
  const first = await commit(input('u1','first',1,false,true));
  assert.equal(first.aggregateConfirmed,true);
  assert.equal(first.count,6);
  assert.deepEqual(published,{count:6,generation:1});
  omitProfileOnce = true;
  await assert.rejects(commit(input('u1','first',1,false,true)),
    /All public like surfaces not confirmed/);
  assert.equal(persisted.get('soridraw:track-like-total:147').count,6,
    'missing profile receipt does not reapply the durable count');
  const duplicate = await commit(input('u1','first',1,false,true));
  assert.equal(duplicate.duplicate,true);
  assert.equal(duplicate.generation,1);
  assert.equal(persisted.get('soridraw:track-like-total:147').count,6);
  await assert.rejects(commit(input('u1','different',1,false,true)),/Conflicting durable track delta/);
  const second = await commit(input('u1','second',2,true,false));
  assert.equal(second.count,5);
  const simultaneous = await Promise.all([
    commit(input('u2','other-user',1,false,true)),
    commit(input('u3','third-user',1,false,true)),
  ]);
  assert.deepEqual(simultaneous.map(x => x.generation),[3,4],
    'different users changing one track must get serial generations');
  assert.equal(published.count,7);
  failOnce = true;
  await assert.rejects(commit(input('u2','other-unlike',2,true,false)),/public track outage/);
  assert.equal(persisted.get('soridraw:track-like-total:147').count,6);
  assert.equal(published.count,7, 'public R2 is not yet acknowledged');
  const repair = await commit(input('u2','other-unlike',2,true,false));
  assert.equal(repair.duplicate,true);
  assert.equal(repair.count,6);
  assert.equal(published.count,6);
  await assert.rejects(commit(input('u2','late',1,false,true)),/Superseded track delta/);
  await assert.rejects(commit(input('u1','bad-prestate',3,true,false)),/pre-state differs/);
  const beforeGaps150 = persisted.get('soridraw:track-like-total:147').count;
  await assert.rejects(commit(input('u1','skip-revision',4,false,true)),
    /Track revision gap/);
  await assert.rejects(commit(input('brand-new','unseeded-revision',2,false,true)),
    /Missing track user baseline/);
  assert.equal(persisted.get('soridraw:track-like-total:147').count,beforeGaps150,
    'invalid gaps and unseeded revisions cannot corrupt the count');
  // A different track is a different DO instance with its own storage.
  const coldStorage = {
    async transaction(fn) {
      return fn({ async get() { return undefined; }, async put() {} });
    },
  };
  const cold = createLikeTrackAggregator147('cold',coldStorage,publishTrack);
  await assert.rejects(cold({
    uid:'u1', trackId:'cold',id:'new',revision:1,seq:1,
    previousLiked:false, liked:true, delta:1,
  }),/not seeded/);
  assert.equal(writeTransactions>=6,true);
  console.log('147_TRACK_DURABLE_COUNTER_SERIAL_AND_DEDUPE_MODEL=PASS');
  console.log('147_TRACK_R2_FAILURE_RETRY_NO_DOUBLE_COUNT=PASS');
  console.log('147_COLD_COUNT_FAIL_CLOSED_AND_PRESTATE_GUARD=PASS');
  console.log('152_PARTIAL_PUBLIC_CARD_FEED_PROFILE_RECEIPT_NOT_SETTLED=PASS');
  console.log('150_MISSING_TRACK_USER_REVISION_GAP_FAIL_CLOSED=PASS');
  console.log('147_SHARED_TRACK_OWNER_SEED_AND_LIVE_R2=NOT_CONFIGURED');
}


// 149: integrated real 143 → 139 → 146 → 147 → public R2 → personal
// publisher path in one isolated execution. NOT the deployed Worker or live D1.
{
  const relations = new Set();
  const accounts = new Map();
  const trackData = new Map([
    ['soridraw:track-like-total:147',{count:5,version:0}],
  ]);
  const publicState = { count:5, generation:0 }, personal = new Map();
  let blockPublicOnce = true, relationWrites = 0, oldStats = 5;
  const trackStorage = {
    async transaction(callback) {
      const draft = new Map([...trackData].map(([k,v]) => [k,structuredClone(v)]));
      const result = await callback({
        get: async (k) => structuredClone(draft.get(k)),
        put: async (k,v) => draft.set(k,structuredClone(v)),
      });
      trackData.clear();
      for (const [k,v] of draft) trackData.set(k,v);
      return result;
    },
  };
  const trackAggregate = createLikeTrackAggregator147('song',trackStorage,async (event) => {
    if (blockPublicOnce) { blockPublicOnce=false; throw Error('temporary public R2 outage'); }
    if (event.generation >= publicState.generation) {
      publicState.count = event.count;
      publicState.generation = event.generation;
    }
    return {published:true,snapshotGeneration:publicState.generation,
      surfaceGenerations:{card:publicState.generation,feed:publicState.generation,
        profile:publicState.generation}};
  });
  const db = {
    prepare(sql) {
      return {bind(...args) {
        return {
          sql,args,
          async first() {
            return relations.has(args[1] + ':' + args[0]) ? {liked:1} : null;
          },
        };
      }};
    },
    async batch(statements) {
      const [trackId,uid] = statements[1].args;
      const key = uid + ':' + trackId, before = relations.has(key);
      const desired = statements[1].sql.includes('INSERT OR IGNORE');
      if (desired) relations.add(key); else relations.delete(key);
      const changes = Number(before !== relations.has(key));
      relationWrites += changes;
      return [
        {results:[{eligible:1}],meta:{changes:0,rows_written:0}},
        {results:[],meta:{changes,rows_written:changes}},
        {results:[{liked:Number(relations.has(key))}],meta:{changes:0,rows_written:0}},
      ];
    },
  };
  const canonical = createLikeRelationOnly146(db,trackAggregate);
  const makeUidOwner = (uid) => {
    const values = accounts.get(uid) || new Map();
    accounts.set(uid,values);
    const storage = {
      get: async (key) => structuredClone(values.get(key)),
      put: async (key,value) => values.set(key,structuredClone(value)),
      transaction: async (cb) => cb({
        get: async (key) => structuredClone(values.get(key)),
        put: async (key,value) => values.set(key,structuredClone(value)),
      }),
    };
    return createLikeDurableOwner143({
      uid,storage,canonical,
      publish: async (event) => {
        assert.equal(publicState.count,trackData.get('soridraw:track-like-total:147').count,
          'public count must converge before personal heart is confirmed');
        personal.set(uid,event.liked);
        return {settled:true};
      },
    });
  };
  const pc = makeUidOwner('pc-user'), mobile = makeUidOwner('mobile-user');
  const like = (uid,id,baseRevision,liked) => ({
    uid,trackId:'song',id,baseRevision,liked,
  });
  assert.equal((await pc.mutate(like('pc-user','pc-like',0,true))).state,'pending');
  assert.equal(relationWrites,1);
  assert.equal(publicState.count,5,'outage must not falsely announce a new public count');
  assert.equal(trackData.get('soridraw:track-like-total:147').count,6,
    'durable delta persists while R2 is offline');
  assert.equal(personal.has('pc-user'),false);
  assert.equal((await pc.mutate(like('pc-user','pc-like',0,true))).state,'settled');
  assert.equal(relationWrites,1,'D1 is not rewritten on retry');
  assert.equal(publicState.count,6);
  assert.equal(personal.get('pc-user'),true);
  assert.equal((await mobile.mutate(like('mobile-user','mobile-like',0,true))).state,'settled');
  assert.equal(publicState.count,7);
  assert.equal(relationWrites,2);
  assert.equal((await pc.mutate(like('pc-user','pc-unlike',1,false))).state,'settled');
  assert.equal(publicState.count,6);
  assert.equal(personal.get('pc-user'),false);
  assert.equal(personal.get('mobile-user'),true);
  assert.equal((await pc.mutate(like('pc-user','old-like',0,true))).state,'stale');
  assert.equal(publicState.count,6);
  assert.equal(oldStats,5,'legacy track_stats MUST be cut over before release');
  console.log('149_UID_D1_TRACK_R2_INTEGRATED_MODEL=PASS');
  console.log('149_CROSS_ACCOUNT_PUBLIC_COUNT_AND_PERSONAL_HEART_MODEL=PASS');
  console.log('149_LEGACY_READER_UNCHANGED_COUNT_RELEASE_GATE=FAIL');
  console.log('149_REAL_SHARED_WORKERS_D1_BILLING=NOT_VERIFIED');
}


// 151: real shared-track-card-v115 CAS adapter, not a claim about public Feed
// or profile. It refuses cold, broken, conflicting and unsafely reset bundles.
{
  let stored = { schemaVersion: 1, trackId: 'song', updatedAt: 1,
    card: { id: 'song', title: 'existing-title', likeCount: 5,
      stats: { likeCount: 5, playCount: 17 } }, keepLegacy: 'untouched' };
  let revision = 1, writes = 0, forceConflict = false;
  const bucket = {
    get snapshot() { return structuredClone(stored); },
    get writes() { return writes; },
    conflictOnce() { forceConflict = true; },
    async get(key) {
      assert.equal(key, 'internal/explore/shared-track-card-v115/song.json');
      if (!stored) return null;
      const body = JSON.stringify(stored), etag = String(revision);
      return { etag, text: async () => body };
    },
    async put(key, body, options) {
      assert.equal(key, 'internal/explore/shared-track-card-v115/song.json');
      if (forceConflict) { forceConflict = false; return null; }
      if (options?.onlyIf?.etagMatches !== String(revision)) return null;
      stored = JSON.parse(body);
      revision++;
      writes++;
      return { etag: String(revision) };
    },
  };
  const publish = createLikeSharedTrackCardPublisher151(bucket);
  const evt = (count,generation,delta) => ({trackId:'song',count,generation,delta});
  const first = await publish(evt(6,1,1));
  assert.equal(first.published,true);
  assert.equal(first.surface,'card');
  assert.equal(bucket.snapshot.card.likeCount,6);
  assert.equal(bucket.snapshot.card.stats.likeCount,6);
  assert.equal(bucket.snapshot.card.stats.playCount,17);
  assert.equal(bucket.snapshot.card.title,'existing-title');
  assert.equal(bucket.snapshot.keepLegacy,'untouched');
  const beforeDuplicate = writes;
  assert.equal((await publish(evt(6,1,1))).duplicate,true);
  assert.equal(writes,beforeDuplicate);
  await assert.rejects(publish(evt(100,1,1)),/Conflicting shared card/);
  assert.equal((await publish(evt(6,0,1)).catch(e => String(e).includes('Invalid canonical'))), true);
  bucket.conflictOnce();
  assert.equal((await publish(evt(7,2,1))).published,true);
  assert.equal(bucket.snapshot.card.likeCount,7);
  assert.equal((await publish(evt(6,1,1))).superseded,true);
  assert.equal(bucket.snapshot.card.likeCount,7);
  stored = null;
  await assert.rejects(publish(evt(8,3,1)), /missing/);
  assert.equal(writes,2);
  stored = {schemaVersion:1,trackId:'song',card:{id:'song',likeCount:1}};
  await assert.rejects(publish(evt(8,3,1)), /generation missing/);
  await assert.rejects(publish(evt(8,1,1)), /baseline differs/);
  assert.equal(writes,2);
  console.log('151_SHARED_TRACK_CARD_ETAG_CAS_AND_LEGACY_FIELDS=PASS');
  console.log('151_COLD_BASELINE_CONFLICT_AND_STALE_FAIL_CLOSED=PASS');
  console.log('151_FEED_POPULAR_PROFILE_SURFACES=NOT_CONNECTED');
}


// 153: the new table is additive and UNAPPLIED. Even with a D1 W2 result,
// the actual new adapter must refuse use until an independently verified
// shared-data cutover. These checks use only a D1-shaped synthetic mock.
{
  let liked = false, costOverride = null, aggregateCalls = 0, prepared = [];
  const db = {
    prepare(sql) {
      prepared.push(sql);
      return {
        bind(...args) {
          return {
            sql, args,
            async first() {
              assert.match(sql, /FROM explore_likes_153 WHERE user_uid = \? AND track_id = \?/);
              assert.deepEqual(args, ['actor', 'song']);
              return liked ? { liked: 1 } : null;
            },
          };
        },
      };
    },
    async batch(statements) {
      assert.equal(statements.length, 3);
      assert.match(statements[0].sql, /JOIN public_profiles/);
      assert.match(statements[1].sql, /explore_likes_153/);
      const desired = statements[1].sql.includes('INSERT OR IGNORE');
      if (!desired) assert.deepEqual(statements[1].args, ['actor', 'song', 'song']);
      const before = liked;
      liked = desired;
      const changes = Number(before !== liked);
      const writes = costOverride ?? (changes && liked ? 2 : changes);
      return [
        { results: [{ eligible: 1 }], meta: { rows_written: 0, changes: 0 } },
        { results: [], meta: { rows_written: costOverride === 'missing' ? undefined :
          costOverride === 'nan' ? NaN : writes, changes } },
        { results: [{ liked: Number(liked) }], meta: { rows_written: 0, changes: 0 } },
      ];
    },
  };
  const aggregate = async (event) => {
    aggregateCalls++;
    return { aggregateConfirmed: true, id: event.id,
      trackId: event.trackId, revision: event.revision };
  };
  let refused = false;
  try { createLikeRelationOnly146(db, aggregate, { relationTable: 'explore_likes_153' }); }
  catch (error) { refused = /cutover unverified/.test(String(error)); }
  assert.equal(refused, true, 'new table must be gated until legacy data and writers are ready');
  const newTable = createLikeRelationOnly146(db, aggregate, {
    relationTable: 'explore_likes_153',
    cutoverVerified: true, // fixture only: production is not verified or activated
  });
  assert.equal(await newTable.readMembership('actor', 'song'), false);
  const intent = (id, revision, previousLiked, desiredLiked, seq = revision) =>
    newTable.applyAtomically('actor', 'song', desiredLiked,
      { id, revision, previousLiked, seq });
  const first = await intent('like-1', 1, false, true);
  assert.equal(first.rowsWritten, 2);
  assert.equal(aggregateCalls, 1);
  const repeat = await intent('like-1', 1, false, true);
  assert.equal(repeat.rowsWritten, 0);
  assert.equal(aggregateCalls, 2,
    'idempotent external aggregator still receives retries for the same intent');
  const unlike = await intent('unlike-2', 2, true, false);
  assert.equal(unlike.rowsWritten, 1);
  assert.equal(liked, false);
  assert.equal(aggregateCalls, 3);
  costOverride = 3;
  await assert.rejects(intent('like-over-budget', 3, false, true),
    /exceeded live D1 W2 billing budget/);
  assert.equal(aggregateCalls, 3, 'W3+ must not settle downstream aggregate');
  for (const [receipt, expected] of [
    ['missing', /billing receipt missing or invalid/],
    ['nan', /billing receipt missing or invalid/],
    [-1, /billing receipt missing or invalid/],
    [0, /missing a billable relation write/],
  ]) {
    // Separate isolated fresh-like fixture each time. D1 may have committed
    // even when the receipt is rejected; the aggregator must remain untouched.
    liked = false;
    costOverride = receipt;
    await assert.rejects(intent('like-bad-receipt-' + String(receipt), 3, false, true), expected);
    assert.equal(aggregateCalls, 3, 'invalid billing receipt must not settle');
  }
  assert.ok(prepared.some(sql => sql.includes('INSERT OR IGNORE INTO explore_likes_153')));
  assert.ok(prepared.some(sql => sql.includes('DELETE FROM explore_likes_153 WHERE user_uid')));
  console.log('153_EXPLICIT_CUTOVER_USER_FIRST_D1_ADAPTER=PASS');
  console.log('153_W2_RELATION_AND_W3_FAIL_CLOSED_MOCK=PASS');
  console.log('153_SHARED_BASELINE_AND_LEGACY_WORKERS_RELEASE_GATE=FAIL');
}


// 155: cold-recovery of >2,000 personal likes must page by a stable compound
// timestamp/track cursor. Same-millisecond clicks must never disappear.
// This is an in-memory D1-shaped fixture, not a claim of live D1 rows_read.
{
  const all = Array.from({ length: 2053 }, (_, i) => ({
    track_id: 'track-' + String(i).padStart(5, '0'),
    created_at: 1710000000000 + Math.floor(i / 11),
  })).sort((a, b) => b.created_at - a.created_at ||
    (a.track_id < b.track_id ? 1 : a.track_id > b.track_id ? -1 : 0));
  let calls = 0;
  const db155 = {
    prepare(sql) {
      assert.match(sql, /FROM explore_likes_153 WHERE user_uid = \?/);
      assert.match(sql, /ORDER BY created_at DESC,track_id DESC LIMIT \?/);
      assert.doesNotMatch(sql, /OFFSET|COUNT\s*\(/);
      return {
        bind(...args) {
          assert.equal(args[0], 'account-155');
          const hasCursor = sql.includes('created_at < ?');
          assert.equal(args.length, hasCursor ? 5 : 2);
          const limit = args.at(-1);
          assert.ok(limit > 0 && limit <= 128);
          return {
            async all() {
              calls++;
              let list = all;
              if (hasCursor) {
                const [, at1, at2, trackId] = args;
                assert.equal(at1, at2);
                list = list.filter(row => row.created_at < at1 ||
                  (row.created_at === at1 && row.track_id < trackId));
              }
              return { results: list.slice(0, limit) };
            },
          };
        },
      };
    },
  };
  const page = createLikeRecentPager155(db155);
  const recovered = [];
  let cursor = null;
  do {
    const result = await page('account-155', cursor, 128);
    recovered.push(...result.items);
    cursor = result.nextCursor;
  } while (cursor !== null);
  assert.equal(recovered.length, 2053, 'no truncation at old 2000-like limit');
  assert.deepEqual(recovered.map(x => x.trackId), all.map(x => x.track_id),
    'stable cursor preserves exact ordering even at duplicate timestamps');
  assert.equal(new Set(recovered.map(x => x.trackId)).size, 2053);
  assert.ok(calls <= Math.ceil(2053 / 128) + 1, 'only bounded page queries');
  await assert.rejects(page('account-155', null, 129), /Invalid bounded/);
  await assert.rejects(page('account-155', { createdAt: -1, trackId: 'x' }, 128),
    /Invalid like recovery cursor/);
  console.log('155_BOUNDED_2053_LIKES_SAME_MS_CURSOR_RECOVERY=PASS');
  console.log('155_W2_WIDENED_INDEX_REAL_REMOTE_BILLING=NOT_YET_MEASURED');
  console.log('155_LEGACY_2000_R2_SNAPSHOT_CUTOVER=NOT_CONNECTED');
}


// 157: no-backfill overlay model. Existing legacy likes stay immutable;
// post-cutover changes are one override/tombstone row plus one secondary index.
// This D1-shaped mock validates transition semantics only; real billing is
// measured separately by measure-153-isolated-d1.mjs.
{
  const legacy = new Set(['legacy-song']);
  const overrides = new Map();
  let aggregateCalls157 = 0;
  let cost157 = null;
  const effective157 = (trackId) => overrides.has(trackId)
    ? Boolean(overrides.get(trackId).liked) : legacy.has(trackId);
  const db157 = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            sql, args,
            async first() {
              const trackId = args[1];
              return { liked: Number(effective157(trackId)) };
            },
          };
        },
      };
    },
    async batch(statements) {
      assert.equal(statements.length, 4);
      assert.match(statements[0].sql, /track_stats/);
      assert.match(statements[1].sql, /DELETE FROM explore_like_overrides_157/);
      assert.match(statements[2].sql, /INSERT INTO explore_like_overrides_157/);
      const args = statements[2].args;
      const uid = args[0], trackId = args[1], desired = Boolean(args[2]);
      const expectedPrevious = Boolean(args[12]);
      assert.equal(uid, 'u157');
      const baseline = legacy.has(trackId);
      const before = effective157(trackId);
      let removeChanges = 0, upsertChanges = 0;
      if (before === expectedPrevious && before !== desired) {
        if (desired === baseline) {
          overrides.delete(trackId);
          removeChanges = 1;
        } else {
          overrides.set(trackId, { liked: desired, updatedAt: args[3] });
          upsertChanges = 1;
        }
      }
      const totalChanges = removeChanges + upsertChanges;
      const written = cost157 == null
        ? (removeChanges ? 1 : upsertChanges ? 2 : 0)
        : cost157;
      return [
        { results: [{ eligible: 1, baseline_liked: Number(baseline), liked: Number(before) }],
          meta: { rows_written: 0, changes: 0 } },
        { results: [], meta: { rows_written: removeChanges ? written : 0, changes: removeChanges } },
        { results: [], meta: { rows_written: upsertChanges ? written : 0, changes: upsertChanges } },
        { results: [{ liked: Number(effective157(trackId)) }], meta: { rows_written: 0, changes: 0 } },
      ];
    },
  };
  const aggregate157 = async (event) => {
    aggregateCalls157++;
    return { aggregateConfirmed: true, id: event.id, trackId: event.trackId, revision: event.revision };
  };
  assert.throws(() => createLikeOverlayCanonical157(db157, aggregate157),
    /blocked until all legacy like writers/);
  const overlay = createLikeOverlayCanonical157(db157, aggregate157,
    { legacyWriterCutoverVerified: true });
  assert.equal(await overlay.readMembership('u157', 'legacy-song'), true);
  assert.equal(await overlay.readMembership('u157', 'new-song'), false);

  const apply157 = (trackId, id, revision, previousLiked, liked, seq = revision) =>
    overlay.applyAtomically('u157', trackId, liked,
      { id, revision, previousLiked, seq });

  assert.equal((await apply157('new-song', 'n1', 1, false, true)).rowsWritten, 2);
  assert.equal(legacy.has('new-song'), false, 'new relation must not backfill legacy table');
  assert.equal(overrides.get('new-song').liked, true);
  assert.equal((await apply157('new-song', 'n1-dup', 2, true, true)).rowsWritten, 0);
  assert.equal((await apply157('new-song', 'n2', 2, true, false)).rowsWritten, 1);
  assert.equal(overrides.has('new-song'), false, 'return to false baseline deletes redundant override');

  assert.equal((await apply157('legacy-song', 'l1', 1, true, false)).rowsWritten, 2);
  assert.equal(legacy.has('legacy-song'), true, 'legacy baseline must remain immutable');
  assert.equal(overrides.get('legacy-song').liked, false);
  assert.equal((await apply157('legacy-song', 'l2', 2, false, true)).rowsWritten, 1);
  assert.equal(overrides.has('legacy-song'), false, 'return to true baseline deletes tombstone');
  assert.equal(aggregateCalls157, 4, 'only actual membership changes aggregate');

  await assert.rejects(apply157('legacy-song', 'bad-prev', 3, false, false),
    /effective relation transition not proven/);
  assert.equal(overrides.has('legacy-song'), false, 'stale pre-state must not create an override');
  cost157 = 3;
  await assert.rejects(apply157('new-cost-song', 'cost', 1, false, true),
    /exceeded live D1 W2 billing budget/);
  assert.equal(aggregateCalls157, 4, 'W3+ must not settle downstream aggregate');
  cost157 = null;

  // Cold exact union: one legacy tombstone, one legacy re-like override, and
  // two post-cutover additions. No copy of the other 2,052 legacy rows.
  const legacyRows157 = Array.from({ length: 2053 }, (_, i) => ({
    trackId: 'base-' + String(i).padStart(5, '0'),
    createdAt: 1900000000000 - Math.floor(i / 9),
  }));
  const overrideRows157 = new Map([
    ['base-00001', { liked: false, updatedAt: 1900000001000 }],
    ['base-00002', { liked: true, updatedAt: 1900000002000 }],
    ['added-a', { liked: true, updatedAt: 1900000003000 }],
    ['added-b', { liked: true, updatedAt: 1900000003000 }],
  ]);
  const exactEffective157 = () => {
    const rows = [];
    for (const row of legacyRows157) {
      if (overrideRows157.has(row.trackId)) continue;
      rows.push(row);
    }
    for (const [trackId, value] of overrideRows157) {
      if (value.liked) rows.push({ trackId, createdAt: value.updatedAt });
    }
    rows.sort((a, b) => b.createdAt - a.createdAt ||
      (a.trackId < b.trackId ? 1 : a.trackId > b.trackId ? -1 : 0));
    return rows;
  };
  const dbPager157 = {
    prepare(sql) {
      assert.match(sql, /WITH effective_likes AS/);
      assert.match(sql, /NOT EXISTS/);
      assert.match(sql, /explore_like_overrides_157/);
      return {
        bind(...args) {
          return {
            async all() {
              assert.equal(args[0], 'u157');
              assert.equal(args[1], 'u157');
              const limit = args.at(-1);
              let rows = exactEffective157();
              if (args.length === 6) {
                const [, , at1, at2, trackId] = args;
                assert.equal(at1, at2);
                rows = rows.filter(row => row.createdAt < at1 ||
                  (row.createdAt === at1 && row.trackId < trackId));
              }
              return { results: rows.slice(0, limit).map(row => ({
                track_id: row.trackId, liked_at: row.createdAt,
              })) };
            },
          };
        },
      };
    },
  };
  assert.throws(() => createLikeOverlayPager157(dbPager157),
    /blocked until all legacy like writers/);
  const pager157 = createLikeOverlayPager157(dbPager157,
    { legacyWriterCutoverVerified: true });
  const recovered157 = [];
  let cursor157 = null;
  do {
    const page157 = await pager157('u157', cursor157, 128);
    recovered157.push(...page157.items);
    cursor157 = page157.nextCursor;
  } while (cursor157);
  const expected157 = exactEffective157();
  assert.equal(recovered157.length, 2054);
  assert.deepEqual(recovered157.map(x => x.trackId), expected157.map(x => x.trackId));
  assert.equal(recovered157.some(x => x.trackId === 'base-00001'), false);
  assert.equal(recovered157.filter(x => x.trackId === 'base-00002').length, 1);
  assert.equal(overrideRows157.size, 4, 'no user-wide backfill is created');

  // 157 -> 156 integration: exact shared snapshot can be rebuilt directly
  // from baseline+small overrides, without copying 2,053 legacy relations.
  let exactBody157 = null, exactEtag157 = 0;
  const exactBucket157 = {
    async get() {
      if (!exactBody157) return null;
      const body = exactBody157, etag = 'e' + exactEtag157;
      return { etag, text: async () => body };
    },
    async put(_key, body, options) {
      if (exactBody157 === null) {
        if (options?.onlyIf?.etagDoesNotMatch !== '*') return null;
      } else if (options?.onlyIf?.etagMatches !== 'e' + exactEtag157) {
        return null;
      }
      exactBody157 = body;
      exactEtag157++;
      return { etag: 'e' + exactEtag157 };
    },
  };
  const rebuildFromOverlay157 = createLikeExactR2Rebuilder156(
    exactBucket157, pager157, async () => 0,
    { legacyWriterCutoverVerified: true }
  );
  assert.deepEqual(await rebuildFromOverlay157('u157'),
    { rebuilt: true, count: 2054, publicationSeq: 0 });
  const rebuilt157 = JSON.parse(exactBody157);
  assert.equal(rebuilt157.canonicalComplete156, true);
  assert.equal(rebuilt157.exactLikeCount156, 2054);
  assert.deepEqual(rebuilt157.likedTrackIds, expected157.map(x => x.trackId));
  assert.equal(overrideRows157.size, 4, 'exact R2 rebuild must not materialize a D1 backfill');

  console.log('157_NO_BACKFILL_SPARSE_OVERLAY_TRANSITIONS_W2_W1_MOCK=PASS');
  console.log('157_TO_156_EXACT_R2_REBUILD_WITHOUT_D1_BACKFILL=PASS');
  console.log('157_2054_EFFECTIVE_COLD_UNION_WITH_TOMBSTONE=PASS');
  console.log('157_REAL_REMOTE_D1_BILLING=MEASURE_SEPARATELY');
}


// 158: lazy per-track total baseline. First changed track reads the frozen
// legacy count once; later mutations/restarts use durable owner state only.
{
  const values158 = new Map();
  const storage158 = {
    async get(key) { return structuredClone(values158.get(key)); },
    async transaction(cb) {
      return cb({
        get: async (key) => structuredClone(values158.get(key)),
        put: async (key, value) => values158.set(key, structuredClone(value)),
      });
    },
  };
  let baselineReads158 = 0;
  const cutover158 = 'cutover-158-A';
  const baselineDb158 = {
    prepare(sql) {
      assert.equal(sql, 'SELECT like_count FROM track_stats WHERE track_id = ? LIMIT 1');
      return {
        bind(trackId) {
          assert.equal(trackId, 'track-158');
          return {
            async first() {
              baselineReads158++;
              return { like_count: 5 };
            },
          };
        },
      };
    },
  };
  const loadBaseline158 = createTrackStatsBaselineLoader158(baselineDb158, cutover158);
  const publish158 = async (event) => ({
    published: true,
    snapshotGeneration: event.generation,
    surfaceGenerations: {
      card: event.generation, feed: event.generation, profile: event.generation,
    },
  });
  assert.throws(() => createLikeLazyTrackAggregator158(
    'track-158', storage158, publish158, loadBaseline158,
    { cutoverToken: cutover158 }
  ), /legacy count writers/);

  let aggregate158 = createLikeLazyTrackAggregator158(
    'track-158', storage158, publish158, loadBaseline158,
    { legacyWriterCutoverVerified: true, cutoverToken: cutover158 }
  );
  const event158 = (uid, id, revision, seq, previousLiked, liked) => ({
    uid, trackId: 'track-158', id, revision, seq, previousLiked, liked,
    delta: Number(liked) - Number(previousLiked),
  });
  const first158 = await aggregate158(event158('u1', 'a1', 1, 1, false, true));
  assert.equal(first158.count, 6);
  assert.equal(first158.generation, 1);
  assert.equal(baselineReads158, 1);
  assert.deepEqual(values158.get('soridraw:track-like-total:147'),
    { count: 6, version: 1, cutoverToken158: cutover158 });

  const second158 = await aggregate158(event158('u1', 'a2', 2, 2, true, false));
  assert.equal(second158.count, 5);
  assert.equal(second158.generation, 2);
  assert.equal(baselineReads158, 1, 'same track must not reread D1 baseline');

  // Simulated owner restart: durable total+token survives; another user can
  // change the same track without a second track_stats baseline read.
  aggregate158 = createLikeLazyTrackAggregator158(
    'track-158', storage158, publish158, loadBaseline158,
    { legacyWriterCutoverVerified: true, cutoverToken: cutover158 }
  );
  const third158 = await aggregate158(event158('u2', 'b1', 1, 3, false, true));
  assert.equal(third158.count, 6);
  assert.equal(third158.generation, 3);
  assert.equal(baselineReads158, 1);

  const wrongToken158 = createLikeLazyTrackAggregator158(
    'track-158', storage158, publish158, loadBaseline158,
    { legacyWriterCutoverVerified: true, cutoverToken: 'cutover-158-B' }
  );
  await assert.rejects(wrongToken158(event158('u3', 'c1', 1, 4, false, true)),
    /baseline token\/count mismatch/);
  assert.equal(baselineReads158, 1);

  const emptyValues158 = new Map();
  const emptyStorage158 = {
    async get(key) { return structuredClone(emptyValues158.get(key)); },
    async transaction(cb) {
      return cb({
        get: async (key) => structuredClone(emptyValues158.get(key)),
        put: async (key, value) => emptyValues158.set(key, structuredClone(value)),
      });
    },
  };
  const badBaseline158 = createLikeLazyTrackAggregator158(
    'track-158', emptyStorage158, publish158,
    async () => ({ count: 5, cutoverToken: 'wrong' }),
    { legacyWriterCutoverVerified: true, cutoverToken: cutover158 }
  );
  await assert.rejects(badBaseline158(event158('u1', 'bad', 1, 1, false, true)),
    /audited track_stats baseline unavailable/);
  assert.equal(emptyValues158.size, 0);
  console.log('158_READONLY_TRACK_STATS_PK_BASELINE_LOADER=PASS');
  console.log('158_LAZY_TRACK_STATS_BASELINE_ONE_READ_PER_CHANGED_TRACK=PASS');
  console.log('158_NO_GLOBAL_TRACK_COUNT_BACKFILL=PASS');
  console.log('158_CUTOVER_TOKEN_AND_RESTART_DURABILITY=PASS');
}
