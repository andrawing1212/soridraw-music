import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const from = entry.indexOf('// SORIDRAW_BOUNDED_CANONICAL_PUBLIC_LIKE_CONVERGENCE_191_20260924');
const to = entry.indexOf('// SORIDRAW_VERIFIED_SHARED_LIKE_SNAPSHOT_REPAIR_156_20260924', from);
assert.ok(from > 0 && to > from, '191 production helper missing');
const source = entry.slice(from, to);
const ctx = {
  sharedFeedR2Key112: sort => 'feed/' + sort,
  Date, Map, Set, JSON, Number, String, Error, Array,
};
vm.runInNewContext(source + '\nthis.repair191=repairSharedPublicLikeCounts191;', ctx);

const ids = Array.from({length:40},(_,i)=>'public-'+(i+1));
const initiallyWrong = new Set(ids.slice(0,6));
const feed = () => ({payload:{data:{items:ids.map(id=>({
  id,ownerUid:'public-owner',likeCount:initiallyWrong.has(id)?0:1,
  stats:{likeCount:initiallyWrong.has(id)?0:1},
  preserved:'keep',
}))}}});
const values = new Map([
  ['feed/latest', {data:feed(),etag:'initial-latest'}],
  ['feed/popular', {data:feed(),etag:'initial-popular'}],
  ['internal/explore/shared-profile-v113/public-owner.json', {etag:'profile-1',data:{
    revision:1,body:{data:{revision:1,items:ids.map(id=>({id,likeCount:0,preserved:'keep'}))}}
  }}],
  ...ids.map(id=>['internal/explore/shared-track-card-v115/'+id+'.json',{
    etag:'card-'+id,data:{card:{id,likeCount:0,preserved:'keep'}}
  }]),
]);
let writes = 0, reads = 0, d1Writes = 0, conflict = true;
const bucket = {
  head: async key => values.has(key)? {etag:values.get(key).etag}:null,
  get: async key => values.has(key)? {
    etag:values.get(key).etag,
    customMetadata:{preserved:'yes'},
    text:async()=>JSON.stringify(values.get(key).data),
  }:null,
  put: async (key,body,opts) => {
    const old=values.get(key);
    if (opts?.onlyIf?.etagDoesNotMatch==='*' && old) return null;
    if (opts?.onlyIf?.etagMatches) {
      if (conflict && key==='feed/latest') {conflict=false;return null;}
      if (!old || old.etag!==opts.onlyIf.etagMatches) return null;
    }
    writes++;
    const etag='write-'+writes;
    values.set(key,{etag,data:JSON.parse(body)});
    return {etag};
  }
};
const env={
  PROFILE_MEDIA:bucket,
  DB:{prepare:sql=>{
    assert.match(sql,/WHERE t\.id IN \(/);
    assert.match(sql,/t\.is_public=1/);
    assert.doesNotMatch(sql,/\b(?:UPDATE|DELETE|INSERT)\b/i);
    return {bind:(...args)=>({all:async()=>{
      reads++;
      assert.equal(args.length,40,'first-page-only canonical read');
      assert.equal(new Set(args).size,40);
      return {results:args.map(id=>({id,owner_uid:'public-owner',like_count:1}))};
    }})};
  }},
};
const repaired = await ctx.repair191(env,{oneTime:true});
assert.equal(repaired.changedTracks,6,'six genuinely stale shared counts');
assert.equal(repaired.sampled,40,'bounded 40 distinct ids across both lists');
assert.equal(reads,1);
assert.equal(d1Writes,0);
assert.ok(values.has('internal/explore/repair-v191/bounded-first40.json'));
for(const sort of ['latest','popular']) for(const row of values.get('feed/'+sort).data.payload.data.items) {
  assert.equal(row.likeCount,1);
  assert.equal(row.stats.likeCount,1);
  assert.equal(row.preserved,'keep');
}
for(const id of initiallyWrong) {
  const card=values.get('internal/explore/shared-track-card-v115/'+id+'.json').data.card;
  assert.equal(card.likeCount,1);
  assert.equal(card.preserved,'keep');
}
const profile=values.get('internal/explore/shared-profile-v113/public-owner.json').data;
for(const row of profile.body.data.items) if(initiallyWrong.has(row.id)) assert.equal(row.likeCount,1);
assert.ok(profile.revision>1);
const wrote=writes;
const second=await ctx.repair191(env,{oneTime:true});
assert.equal(second.alreadyRepaired,true);
assert.equal(reads,1,'one-time marker protects idle canonical R0');
assert.equal(writes,wrote,'one-time marker protects R2 W0');
const next=await ctx.repair191(env);
assert.equal(next.changedTracks,0,'no-change batch does not rewrite shared data');
assert.equal(writes,wrote);
assert.equal(d1Writes,0);
assert.match(entry,/await baseWorker\.scheduled\([\s\S]*?await repairSharedPublicLikeCounts191\(this\.env\)/);
assert.match(entry,/await repairSharedPublicLikeCounts191\(env, \{ oneTime: true \}\)/);
console.log('191_CANONICAL_VS_SHARED_6_OF_40_REPAIRED=PASS');
console.log('191_SHARED_LATEST_POPULAR_PROFILE_CARDS_CAS=PASS');
console.log('191_TRANSIENT_CAS_RETRY=PASS');
console.log('191_ONETIME_WARM_D1_R0_R2_W0=PASS');
console.log('191_NO_USER_DATA_WRITES=PASS');
