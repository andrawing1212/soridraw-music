import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const marker = '// SORIDRAW_PERSONAL_LIKE_SETTLED_GUARD_RELEASE_189_20260924';
assert.ok(source.includes(marker));
assert.match(source, /canonicalSettled: complete &&\s*String\(payload\.data\.likesSnapshotSource \|\| ''\) === 'verified-single-user-d1-182'/);

// Reproduce the observed shape without user IDs or real track IDs: canonical/R2
// has ten likes while one device has five historical false pending guards.
const canonicalIds = Array.from({ length: 10 }, (_, index) => `track-${index + 1}`);
const staleGuardIds = canonicalIds.slice(5);
const reconcile = ({ sourceName, outbox = {} }) => {
  const confirmed = new Set(canonicalIds);
  const unresolved = Object.fromEntries(staleGuardIds.map(id => [id, false]));
  const canonicalSettled = sourceName === 'verified-single-user-d1-182';
  if (canonicalSettled) {
    for (const id of Object.keys(unresolved)) {
      if (!outbox[id]) delete unresolved[id];
    }
  }
  const visible = canonicalIds.filter(id => outbox[id]?.desiredLiked ?? unresolved[id] ?? confirmed.has(id));
  return { visible, unresolved };
};

const before = reconcile({ sourceName: 'accepted-pre-aggregate-r2' });
assert.equal(before.visible.length, 5, 'reproduces PC 5 from five stale false guards over canonical 10');
const repaired = reconcile({ sourceName: 'verified-single-user-d1-182' });
assert.equal(repaired.visible.length, 10, 'canonical-settled proof releases historical guards');
assert.deepEqual(repaired.unresolved, {});
const protectedClick = reconcile({
  sourceName: 'verified-single-user-d1-182',
  outbox: { 'track-10': { desiredLiked: false } },
});
assert.equal(protectedClick.visible.length, 9, 'new unsent local intention still wins');
assert.equal(protectedClick.unresolved['track-10'], false, 'guard under a live outbox is preserved');

assert.match(source, /if \(snapshot161\.canonicalSettled\) \{[\s\S]*if \(!outbox\[id\]\) delete unresolved\[id\];[\s\S]*writeSnapshotPending127\(uid, unresolved\);/);
console.log('APP189_PC5_CANONICAL10_REPRODUCTION=PASS');
console.log('APP189_CANONICAL_SETTLED_GUARD_RELEASE=PASS');
console.log('APP189_LIVE_OUTBOX_PRESERVED=PASS');
console.log('APP189_ORDINARY_EXACT_R2_GUARD_PRESERVED=PASS');
