import { LikeFencedProcessor139, createLikeD1Canonical140, createLikeSharedR2Publisher141, createLikeDurableOwner143 } from '../cloudflare/explore-worker/runtime/like-fenced-139.mjs';
import assert from 'node:assert/strict';

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
  await assert.rejects(fullPublish(event('new', 'n', 1, true)), /capacity/);
  assert.equal(full.writes, 0, 'no liked song may be truncated');
  assert.equal((await fullPublish(event('track-1', 'remove', 1, false))).settled, true,
    'unlike must be permitted on a full bundle');
  assert.equal(full.value.likedTrackIds.length, 1999);

  // More than 128 distinct changes must remain possible with a single
  // per-UID cursor instead of a 128-track history embedded in every R2 body.
  const longHistory = mockBucket({ schemaVersion: 1, uid: 'user', likedTrackIds: [] });
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
  console.log('141_CAS_RETRY_COLD_2000_AND_128_HISTORY_ELIMINATED=PASS');
  console.log('141_LIVE_CROSS_ENV_WRITER_AND_AUTH_NOT_CONNECTED=NOT_VERIFIED');
}


// 142: integrated 139 + 141 verification. The storage/API adapters below are
// isolated fakes; validate ordering only, not Cloudflare billing or live data.
{
  const durable = new Map(), relation = new Map();
  let commits = 0, notified = 0, rejectD1 = false, rejectNotify = false;
  let snapshot = { schemaVersion: 1, uid: 'user', likedTrackIds: [] };
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
