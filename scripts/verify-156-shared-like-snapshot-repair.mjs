import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const start = entry.indexOf('const VERIFIED_LIKE_REPAIR_MARKER_156 =');
const end = entry.indexOf('\nexport default {', start);
assert.ok(start > 0 && end > start, 'bounded 156 repair missing');
const source = entry.slice(start, end);
for (const required of [
  'SORIDRAW_VERIFIED_SHARED_LIKE_SNAPSHOT_REPAIR_156_20260924',
  'etagMatches: object.etag',
  'etagDoesNotMatch:',
  'VERIFIED_LIKE_REPAIR_TITLES_156',
  'SELECT t.id, COALESCE(s.like_count,0)',
  'AND t.is_public=1 AND t.status=',
  'observed.size !== ids.length',
]) assert.ok(entry.includes(required), required);
assert.match(entry.slice(end, end + 520), /await baseWorker\.scheduled\(controller, env, ctx\)/);
assert.match(entry.slice(end, end + 520), /await repairVerifiedSharedLikeSnapshots156\(env\)/);
assert.doesNotMatch(source, /UPDATE |DELETE |INSERT |\.run\(/);
const fetchBlock = entry.slice(entry.indexOf('  async fetch(request, env, ctx) {', end));
assert.ok(fetchBlock.startsWith('  async fetch(request, env, ctx) {'));
assert.doesNotMatch(fetchBlock, /repairVerifiedSharedLikeSnapshots156/);

// Execute the exact helper with isolated fake R2 and D1 bindings.
const ctx = {
  sharedFeedR2Key112: sort => 'internal/explore/shared-feed-v112/' + sort + '-40.json',
  Date, Map, Set, JSON, Number, String, Error, Array, console,
};
vm.runInNewContext(source + '\nthis.repair = repairVerifiedSharedLikeSnapshots156;', ctx);
const ids = ['track-a', 'track-b', 'track-c', 'track-d'];
const titles = [
  "Leaving One Step Open", "Left Unsaid", "Through the Night", "Just Stay Here Awhile",
];
const initial = () => ({payload:{data:{items:ids.map((id,i)=>({
  id, title: titles[i], likeCount:0, stats:{likeCount:0}, preserved:'do-not-change',
}))}}});
const storage = new Map([
  [ctx.sharedFeedR2Key112('latest'), { etag:'latest-1', data:initial() }],
  [ctx.sharedFeedR2Key112('popular'), { etag:'popular-1', data:initial() }],
]);
let d1Reads = 0, d1Writes = 0, r2Writes = 0, oneConflict = true;
const bucket = {
  head: async key => storage.has(key) ? {etag:storage.get(key).etag} : null,
  get: async key => {
    const record=storage.get(key);
    return record ? {etag:record.etag, customMetadata:{keep:'yes'}, text:async()=>JSON.stringify(record.data)} : null;
  },
  put: async (key,body,opts) => {
    const record = storage.get(key);
    if (opts?.onlyIf?.etagDoesNotMatch === '*' && record) return null;
    if (opts?.onlyIf?.etagMatches) {
      if (oneConflict) { oneConflict=false; return null; }
      if (!record || record.etag !== opts.onlyIf.etagMatches) return null;
    }
    r2Writes += 1;
    storage.set(key,{etag:key+'-'+r2Writes,data:JSON.parse(body)});
    return {etag:key+'-'+r2Writes};
  },
};
const db = {
  prepare: sql => {
    assert.match(sql,/WHERE t\.id IN \(\?,\?,\?,\?\)/);
    assert.match(sql,/t\.is_public=1/);
    return {bind: (...args) => {
      assert.deepEqual([...args],ids);
      return {all:async()=> {
        d1Reads+=1;
        return {results:ids.map(id=>({id,like_count:1}))};
      }};
    }};
  },
};
const first = await ctx.repair({PROFILE_MEDIA:bucket, DB:db});
assert.equal(first.repaired,true);
assert.equal(d1Reads,1);
assert.equal(d1Writes,0);
assert.equal(r2Writes,3,'two first-page R2 updates and one marker');
for(const sort of ['latest','popular']) {
  const rows=storage.get(ctx.sharedFeedR2Key112(sort)).data.payload.data.items;
  assert.equal(rows.length,4);
  for(const row of rows) {
    assert.equal(row.likeCount,1);
    assert.equal(row.stats.likeCount,1);
    assert.equal(row.preserved,'do-not-change');
  }
}
const second=await ctx.repair({PROFILE_MEDIA:bucket,DB:db});
assert.equal(second.alreadyRepaired,true);
assert.equal(d1Reads,1,'healthy repeat must perform no canonical read');
assert.equal(r2Writes,3,'healthy repeat must write nothing');
console.log('156_BOUNDED_SHARED_LIKE_R2_REPAIR=PASS');
console.log('156_CAS_CONFLICT_RETRY=PASS');
console.log('156_D1_CANONICAL_READ_ONCE_NO_WRITE=PASS');
console.log('156_REPAIR_MARKER_ZERO_REPEAT_IO=PASS');
