// Stage416: executable offline two-browser simulation, no live Firebase/D1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const source = fs.readFileSync('src/services/exploreLikeIntent416.ts', 'utf8');
let compiled = stripTypeScriptTypes(source, { mode: 'strip' });
compiled = compiled
  .replace(/^import\s+.*?from\s+'firebase\/database';/m, '')
  .replace(/^import\s+.*?from\s+'\.\.\/firebase';/m, '')
  .replaceAll('export const ', 'const ');
assert(!/^import\s/m.test(compiled), 'Only the two mocked imports may be used');
compiled += `
module.exports = {
  readExploreLikeIntent416, listExploreLikeIntents416, clearExploreLikeIntent416,
  subscribeExploreLikeIntent416, publishExploreLikeIntent416,
  settleExploreLikeIntent416,
};`;

const database = new Map();
const listeners = new Map();
let rejectWrites = false;
let writes = 0;
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const sdk = {
  databaseRef: (_db, path) => path,
  onValue: (path, onNext) => {
    if (!listeners.has(path)) listeners.set(path, new Set());
    listeners.get(path).add(onNext);
    onNext({ val: () => clone(database.get(path) || null) });
    return () => listeners.get(path).delete(onNext);
  },
  runTransaction: async (path, updater) => {
    if (rejectWrites) throw new Error('permission_denied');
    const next = updater(clone(database.get(path) || null));
    if (next === undefined) return { committed: false };
    database.set(path, clone(next));
    writes++;
    for (const listener of listeners.get(path) || []) {
      listener({ val: () => clone(next) });
    }
    return { committed: true, snapshot: { val: () => clone(next) } };
  },
};
const clients = [];
function makeClient() {
  const storage = new Map();
  const notices = [];
  const module = { exports: {} };
  const context = {
    module, console, Date,
    window: { localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => { storage.set(key, value); },
    } },
    onValue: sdk.onValue,
    runTransaction: sdk.runTransaction,
    databaseRef: sdk.databaseRef,
    realtimeDb: {},
  };
  vm.runInNewContext(compiled, context, { timeout: 1000 });
  const client = { api: module.exports, notices, storage };
  clients.push(client);
  return client;
}
const A = makeClient();
const B = makeClient();
const uid = 'same-account-416';
const track = 'track-416';
const op1 = '11111111-1111-4111-a111-111111111111';
const op2 = '22222222-2222-4222-a222-222222222222';
const unsubscribe = B.api.subscribeExploreLikeIntent416(uid, (id, liked) => B.notices.push({ id, liked }));
const like = (liked, operationId, trackId = track) => ({
  trackId, ownerUid: 'owner', liked, operationId,
});
assert.equal(B.api.readExploreLikeIntent416(uid, track), undefined, 'cold subscriber must not invent a heart');
await A.api.publishExploreLikeIntent416(uid, like(true, op1));
assert.equal(B.api.readExploreLikeIntent416(uid, track), true, 'remote preview must repaint before server ACK');
assert.equal(B.api.listExploreLikeIntents416(uid)[track], true, 'My Likes local candidate must see same provisional membership');
assert.deepEqual(B.notices.at(-1), { id: track, liked: true });
assert.equal(database.get(`userSync/${uid}/exploreLike`), undefined, 'accepted 127 signal unchanged');
assert.equal(database.get('publicSync/exploreLike'), undefined, 'public signal unchanged');
await A.api.publishExploreLikeIntent416(uid, like(false, op2));
assert.equal(B.api.readExploreLikeIntent416(uid, track), false, 'latest same-track click wins');
const afterFalse = B.notices.length;
await A.api.settleExploreLikeIntent416(uid, [{ trackId: track, operationId: op1, status: 'accepted' }]);
assert.equal(B.api.readExploreLikeIntent416(uid, track), false, 'stale operation settlement cannot remove newer intent');
assert.equal(B.notices.length, afterFalse);
await A.api.settleExploreLikeIntent416(uid, [{ trackId: track, operationId: op2, status: 'rejected' }]);
assert.equal(B.api.readExploreLikeIntent416(uid, track), undefined, 'rejected hint clears; canonical fallback remains independent');
assert.equal(B.notices.at(-1).id, track);
const cross = makeClient();
const unsubOther = cross.api.subscribeExploreLikeIntent416('other-uid', () => {
  throw new Error('must never receive another UID');
});
await A.api.publishExploreLikeIntent416(uid, like(true, '33333333-3333-4333-a333-333333333333'));
assert.equal(cross.api.readExploreLikeIntent416('other-uid', track), undefined);
const beforeDenied = writes;
rejectWrites = true;
await assert.rejects(
  A.api.publishExploreLikeIntent416(uid, like(false, '44444444-4444-4444-a444-444444444444')),
  /permission_denied/,
);
rejectWrites = false;
assert.equal(writes, beforeDenied, 'permission denied cannot create shared state');
for (let i = 0; i < 65; i++) {
  await A.api.publishExploreLikeIntent416(uid, like(true,
    '55555555-5555-4555-a555-' + String(i).padStart(12, '0'), 'track-' + i));
}
assert(database.get(`userSync/${uid}/exploreLikeIntent416`).results.length <= 50);
assert.equal(database.get('publicSync/exploreLike'), undefined);
unsubscribe();
unsubOther();
// A checked-in source/Rule contract is also part of this release gate.
const rules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));
assert(rules.rules.userSync.$uid.exploreLikeIntent416, 'private node requires explicitly installed additive rules');
// The settled 127 node must still retain the previously allowed receipt field.
assert(rules.rules.userSync.$uid.exploreLike.results.$index.canonicalSettled417);
const service = fs.readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = fs.readFileSync('src/pages/ExplorePage.tsx', 'utf8');
assert(service.includes('EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 5_000'), 'stage3 5m canonical delay must not start here');
assert(service.includes('publishConfirmedLikeSignal127(uid, acceptedForSignal127)'), 'existing accepted notifier is protected');
assert(service.includes("source: 'remote-intent'"), 'provisional signal is separate from accepted');
assert(page.includes('if (isTentative416) return;'), 'provisional signal must not publish public count in Explore');
console.log('STAGE416_PRIVATE_INTENT_TWO_CLIENTS=PASS');
console.log('STAGE416_STALE_REPLAY_AND_REJECTION=PASS');
console.log('STAGE416_UID_ISOLATION_AND_BOUNDED_50=PASS');
console.log('STAGE416_PERMISSION_DENIED_SAFE_FALLBACK=PASS');
console.log('STAGE416_CANONICAL_AND_PUBLIC_MUTATION_ZERO=PASS');
console.log('STAGE416_EXISTING_ACCEPTED_PATH_AND_RULES_PRESERVED=PASS');
console.log('STAGE416_LIVE_DEVICE_LATENCY=NOT_TESTED');
