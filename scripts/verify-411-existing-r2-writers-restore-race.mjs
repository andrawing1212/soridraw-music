/**
 * Stage411: independent read-only repro of an existing shared-R2 overwrite
 * hazard after 191 repair. No credential, no network, no live data, no deploy.
 * An intentionally reproduced counterexample is a diagnosis PASS, not a
 * product safety PASS.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const profilePatch=readFileSync('cloudflare/explore-worker/patches/060-shared-profile-r2-parity.mjs','utf8');
const cardPatch=readFileSync('cloudflare/explore-worker/patches/062-shared-track-card-r2.mjs','utf8');

const profileStart=profilePatch.indexOf('async function writeExploreSharedProfile060');
const profileEnd=profilePatch.indexOf('async function mirrorExploreLocalProfile060', profileStart);
const cardStart=cardPatch.indexOf('async function writeSharedTrackCard062');
const cardEnd=cardPatch.indexOf('async function deleteSharedTrackCard062', cardStart);
assert.ok(profileStart>0&&profileEnd>profileStart&&cardStart>0&&cardEnd>cardStart);
const profileWriter=profilePatch.slice(profileStart,profileEnd);
const cardWriter=cardPatch.slice(cardStart,cardEnd);
assert.ok(profileWriter.includes('await bucket.put(exploreSharedProfileR2Key060(uid)'));
assert.ok(cardWriter.includes('await bucket.put(exploreSharedTrackCardKey062(card.id)'));
assert.ok(!profileWriter.includes('onlyIf:'),'profile writer became conditional; revise this diagnostic');
assert.ok(!cardWriter.includes('onlyIf:'),'card writer became conditional; revise this diagnostic');
console.log('411_SHARED_PROFILE_WRITER_UNCONDITIONAL_R2_PUT=CONFIRMED');
console.log('411_SHARED_CARD_WRITER_UNCONDITIONAL_R2_PUT=CONFIRMED');

const start=entry.indexOf('const PUBLIC_LIKE_REPAIR_MARKER_191');
const end=entry.indexOf('// SORIDRAW_VERIFIED_SHARED_LIKE_SNAPSHOT_REPAIR_156_',start);
assert.ok(start>0&&end>start);
const repair=runInNewContext(entry.slice(start,end)+'\nrepairSharedPublicLikeCounts191',{
  sharedFeedR2Key112:sort=>'feed:'+sort,
  Map,Set,Number,String,Math,Date,JSON,Error,encodeURIComponent
},{timeout:2000});
const records=new Map();let rev=0;let overwriteOnce=false;let gets=0,puts=0;
const clone=x=>JSON.parse(JSON.stringify(x));
const row=(count)=>({id:'track',ownerUid:'owner',likeCount:count,stats:{likeCount:count}});
function save(key,data) {
  records.set(key,{etag:'e'+(++rev),data:clone(data),customMetadata:{}});
}
for(const sort of ['latest','popular'])save('feed:'+sort,{payload:{data:{items:[row(0)]}}});
const cardKey='internal/explore/shared-track-card-v115/track.json';
const profileKey='internal/explore/shared-profile-v113/owner.json';
save(cardKey,{card:row(0)});
save(profileKey,{body:{data:{items:[row(0)]}}});
const r2={
  async get(key) {
    gets++;
    const r=records.get(key);
    return r?{etag:r.etag,customMetadata:r.customMetadata,text:async()=>JSON.stringify(r.data)}:null;
  },
  async head(){return null;},
  async put(key,body,options={}) {
    puts++;
    const old=records.get(key);
    if(options?.onlyIf?.etagMatches && options.onlyIf.etagMatches!==old?.etag)return false;
    // Another old writer executes an unconditional shared-profile PUT after
    // the 191 profile CAS and before the Feed-last success. A real writer can
    // do this because the helpers above contain no onlyIf/ordering fence.
    if(key==='feed:latest'&&!overwriteOnce) {
      overwriteOnce=true;
      const stale=clone(records.get(profileKey).data);
      stale.body.data.items[0]=row(0);
      save(profileKey,stale);
    }
    save(key,JSON.parse(body));
    return {etag:records.get(key).etag};
  }
};
const stats={read:0,write:0};
const db={prepare:()=>({bind:()=>({all:async()=>{
  stats.read++;
  return {results:[{id:'track',owner_uid:'owner',like_count:1}]};
}})})};
const env={PROFILE_MEDIA:r2,DB:db};
const first=await repair(env);
const state=()=>{
  const x=key=>records.get(key).data;
  return {feed:x('feed:latest').payload.data.items[0].likeCount,
    card:x(cardKey).card.likeCount,profile:x(profileKey).body.data.items[0].likeCount};
};
const afterFirst=state();
const second=await repair(env);
const afterSecond=state();
assert.equal(overwriteOnce,true);
assert.deepEqual(afterFirst,{feed:1,card:1,profile:0});
assert.deepEqual(afterSecond,{feed:1,card:1,profile:0});
assert.equal(first.changedTracks,1);
assert.equal(second.changedTracks,0);
assert.equal(stats.write,0);
console.log('411_191_EXACT_SOURCE_COMPETING_PROFILE_PUT_REPRODUCED=PASS');
console.log('411_NEXT_ALARM_DOES_NOT_DETECT_PROFILE_ORPHAN=PASS');
console.log('411_ADDED_D1_WRITES=0');
console.log('411_RELEASE_GATE=BLOCKED (old shared projection writer is not fenced; this is a repro, NOT a product fix)');
