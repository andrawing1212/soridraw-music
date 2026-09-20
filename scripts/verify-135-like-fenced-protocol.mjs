import { LikeFencedProcessor139 } from '../cloudflare/explore-worker/runtime/like-fenced-139.mjs';
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
