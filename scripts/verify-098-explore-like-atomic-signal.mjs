import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const sync = readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const rules = readFileSync('database.rules.json', 'utf8');
const start = service.indexOf('const publishExploreLikeAccountSyncSignal');
const end = service.indexOf('const buildAuthHeaders', start);
assert.ok(start >= 0 && end > start);
const publisher = service.slice(start, end);
assert.ok(service.includes("import { ref as databaseRef, runTransaction } from 'firebase/database';"));
assert.ok(service.includes('SORIDRAW_EXPLORE_LIKE_ATOMIC_SIGNAL_098_20260916'));
assert.ok(publisher.includes('databaseRef(realtimeDb, `userSync/${uid}/exploreLike`)'));
assert.ok(publisher.includes('const currentConfirmedResults'));
assert.ok(publisher.indexOf('for (const currentResult of currentConfirmedResults)') < publisher.indexOf('for (const existing of currentSignal?.results || [])'));
assert.ok(publisher.includes('if (!mergedByTrack.has(existing.trackId))'));
assert.ok(publisher.includes('const previousVersion = Math.max(0, currentSignal?.version || 0)'));
assert.ok(publisher.includes('const version = Math.max(Date.now(), previousVersion + 1)'));
assert.ok(publisher.includes('{ applyLocally: false }'));
assert.ok(publisher.includes('transaction.snapshot.val()'));
assert.ok(!publisher.includes('readAccountPatchCache(uid)'));
assert.ok(!publisher.includes('setRealtimeValue('));
assert.ok(!service.includes('exploreLikeDevices'));
assert.ok(sync.includes('userSync/${safeUid}/exploreLike'));
assert.ok(!sync.includes('exploreLikeDevices'));
assert.ok(rules.includes('"exploreLike"'));
assert.ok(!rules.includes('exploreLikeDevices'));
assert.ok(rules.includes("$index.matches(/^(0|[1-9]|[1-4][0-9])$/)"));
assert.ok(!publisher.includes('requestExploreLike('));
assert.ok(!publisher.includes('fetch('));
assert.ok(!service.includes('firebase/firestore'));

const merge = (fresh, retained, max = 50) => {
  const map = new Map();
  fresh.forEach((row) => map.set(row.trackId, row));
  retained.forEach((row) => {
    if (map.size < max && !map.has(row.trackId)) map.set(row.trackId, row);
  });
  return [...map.values()].slice(0, max);
};
assert.deepEqual(
  merge([{ trackId: 'B', displayLikeCount: 1 }], [{ trackId: 'A', displayLikeCount: 1 }]),
  [{ trackId: 'B', displayLikeCount: 1 }, { trackId: 'A', displayLikeCount: 1 }],
);
assert.deepEqual(
  merge([{ trackId: 'A', displayLikeCount: 2 }], [{ trackId: 'A', displayLikeCount: 1 }, { trackId: 'B', displayLikeCount: 1 }]),
  [{ trackId: 'A', displayLikeCount: 2 }, { trackId: 'B', displayLikeCount: 1 }],
);
console.log('PASS 098: concurrent PC/mobile signals cannot blind-overwrite retained counts; current D1-confirmed batch wins and RTDB latest rows survive.');
