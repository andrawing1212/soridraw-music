// Run with Node. No network, R2, Firebase, users or deploy.
import assert from 'node:assert/strict';
import {
  parseFirestoreUpdateTimeNs518,
  decideCanonicalCatalogMutation518,
} from '../cloudflare/media-worker/src/catalogCanonicalFence518.js';

const uid = 'fixture_uid';
const id = 'fixture_favorite_1';
const base = {
  expectedUid: uid, expectedDocumentId: id,
};
const saved = (updateTime, origin = 'server-exact-read') => ({
  verifiedByServer: true, origin, uid, documentId: id, updateTime, state: 'saved',
  item: { id, uid, createdAtMs: 1730000000000, title: 'fixture' },
});
const removed = (updateTime, origin = 'server-event') => ({
  verifiedByServer: true, origin, uid, documentId: id, updateTime, state: 'removed',
});
const time1 = '2026-10-28T02:00:00.000000001Z';
const time2 = '2026-10-28T02:00:00.000000002Z';
const time3 = '2026-10-28T02:00:00.000000003Z';
const decide = (canonical, ledger) => decideCanonicalCatalogMutation518({ ...base, canonical, ledger });
const initial = decide(saved(time1), null);
assert.equal(initial.code, 'APPLY');
assert.equal(initial.action.type, 'upsert');
assert.equal(initial.nextLedger.durable, true);
assert.equal(initial.nextLedger.sourceVersionNs, parseFirestoreUpdateTimeNs518(time1));
const deletion = decide(removed(time2), initial.nextLedger);
assert.equal(deletion.code, 'APPLY');
assert.equal(deletion.action.type, 'tombstone');
assert.equal(deletion.nextLedger.state, 'removed');
assert.equal(decide(saved(time1), deletion.nextLedger).code, 'SKIP_STALE',
  'late save must not resurrect removed song');
assert.equal(decide(removed(time2), deletion.nextLedger).code, 'SKIP_DUPLICATE',
  'duplicate delete event must not trigger R2 write');
assert.equal(decide(saved(time3, 'server-event'), deletion.nextLedger).code, 'APPLY',
  'newer confirmed save may re-add');
assert.equal(decide(saved(time3, 'server-event'), null).code, 'DENY_UNFENCED_EVENT',
  'no initial state from unordered trigger; needs exact canonical server read');
assert.equal(decide(saved(time1, 'client'), null).code, 'DENY_UNFENCED_EVENT');
assert.equal(decide({ ...saved(time1), verifiedByServer: false }, null).code, 'DENY_UNVERIFIED_SOURCE');
assert.equal(decide({ ...saved(time1), uid: 'other_user' }, null).code, 'DENY_UNVERIFIED_SOURCE');
assert.equal(decide({ ...saved(time1), item: { id: 'other_favorite' } }, null).code, 'DENY_INVALID_ITEM');
assert.equal(decide({ ...saved(time1), item: { id, uid: 'other_user' } }, null).code, 'DENY_UNVERIFIED_SOURCE');
assert.equal(decide({ ...saved(time1), updateTime: '' }, null).code, 'DENY_MISSING_SOURCE_VERSION');
assert.equal(parseFirestoreUpdateTimeNs518('2026-02-30T02:00:00Z'), null,
  'impossible dates must not be normalized to another source epoch');
assert.equal(decide({ ...saved(time1), updateTime: '2026-10-28T02:00:00.0+00:00' }, null).code, 'DENY_MISSING_SOURCE_VERSION');
assert.equal(decide(removed(time1, 'server-exact-read'), { ...initial.nextLedger, durable: false }).code, 'DENY_INVALID_LEDGER');
assert.equal(decide(removed(time1, 'server-exact-read'), { ...initial.nextLedger, uid: 'other_user' }).code, 'DENY_INVALID_LEDGER');
assert.equal(decide(removed(time1, 'server-exact-read'), initial.nextLedger).code, 'DENY_CONFLICTING_SAME_VERSION');
assert.ok(BigInt(parseFirestoreUpdateTimeNs518(time3)) > BigInt(parseFirestoreUpdateTimeNs518(time2)));
const olderVersion = parseFirestoreUpdateTimeNs518('1970-01-01T00:00:01Z');
const currentVersion = parseFirestoreUpdateTimeNs518('2026-10-28T02:00:00Z');
assert.equal(olderVersion.length, 21);
assert.equal(currentVersion.length, 21);
assert.ok(olderVersion < currentVersion, 'D1 fixed-width lexical order must match chronological order');
assert.equal(decideCanonicalCatalogMutation518({
  expectedUid: uid, expectedDocumentId: '../bad', canonical: saved(time1),
}).code, 'DENY_INVALID_ID');
console.log('APP518_ORDERED_CANONICAL_RECONCILIATION_FENCE=PASS');
console.log('APP518_DELETION_TOMBSTONE_STALE_SAVE_REPLAY=PASS');
console.log('APP518_OWNER_AND_VERSION_FAIL_CLOSED=PASS');
console.log('APP518_BACKEND_IO_AND_DEPLOY=ZERO');
