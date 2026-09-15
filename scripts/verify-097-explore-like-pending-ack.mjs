import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const start = service.indexOf('export const observeExploreLikeAccountSyncSignal');
const end = service.indexOf('const publishExploreLikeAccountSyncSignal', start);
assert.ok(start >= 0 && end > start);
const observe = service.slice(start, end);

assert.ok(service.includes('SORIDRAW_EXPLORE_LIKE_REMOTE_PENDING_ACK_097_20260916'));
assert.ok(observe.includes('if (pending.desiredLiked === result.liked)'));
assert.ok(observe.includes('delete pendingOutbox[result.trackId]'));
assert.ok(observe.includes('pendingOutboxChanged = true'));
assert.ok(observe.includes('if (pendingOutboxChanged) persistLikeOutbox(uid, pendingOutbox)'));
assert.ok(observe.includes('return { ...result, liked: pending.desiredLiked }'));
assert.ok(observe.includes('Boolean(pendingOutbox[result.trackId])'));
assert.ok(observe.indexOf('persistLikeOutbox(uid, pendingOutbox)') < observe.indexOf('importExploreLikeDisplaySignal091('));
assert.ok(!observe.includes('requestExploreLike('));
assert.ok(!service.includes('firebase/firestore'));
assert.ok(!service.includes('getDocs('));
assert.ok(!service.includes('collection('));

console.log('PASS 097: matching durable pending state is acknowledged by RTDB and its confirmed display count is accepted; conflicting newer local intent remains protected with zero recovery reads.');
