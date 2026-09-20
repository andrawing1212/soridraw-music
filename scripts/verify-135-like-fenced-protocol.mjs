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
