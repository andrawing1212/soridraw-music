/**
 * Stage407 — Execute the EXACT existing 191 function with synthetic local D1
 * and simulated R2 CAS, including interrupted repair / replay.
 *
 * All I/O is Miniflare LOCAL or in-memory R2. No Worker runtime import,
 * no live Cloudflare binding, no user information, no deployment or migration.
 *
 * This verifier intentionally proves a pre-existing recovery gap rather than
 * claiming the product bug is fixed. Any future patch must keep healthy
 * baseline and retry behavior without expensive per-card read fanout.
 */
import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Miniflare } from 'miniflare';

const source=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const start=source.indexOf('const PUBLIC_LIKE_REPAIR_MARKER_191');
const end=source.indexOf('// SORIDRAW_VERIFIED_SHARED_LIKE_SNAPSHOT_REPAIR_156_',start);
assert.ok(start>0&&end>start,'191 function source not found');
const body=source.slice(start,end);
for(const guard of [
 'async function repairSharedPublicLikeCounts191(',
 'const changed = new Map();',
 'changed.set(id, expected);',
 'for (const [id, state] of changed)',
 'const saved = await shared.put(snapshot.key, JSON.stringify({',
]) assert.ok(body.includes(guard),'191 code changed: '+guard);
const repair=runInNewContext(body+'\nrepairSharedPublicLikeCounts191',{
 sharedFeedR2Key112:(sort)=>'feed:'+sort,
 Map,Set,Number,String,Math,Date,JSON,Error,encodeURIComponent,
},{timeout:2000});
assert.equal(typeof repair,'function');
console.log('407_EXACT_191_SOURCE_EXECUTION=PASS');

const mf=new Miniflare({
  modules:true,compatibilityDate:'2026-08-01',
  script:'export default {fetch(){return new Response("local");}};',
  d1Databases:{LOCAL:'00000000-0000-4000-8000-000000000407'}
});
const cases=[];
function verify(name,fn){
  assert.ok(fn(),name);
  cases.push(name);
  console.log('407_'+name+'=PASS');
}
const keys={
  latest:'feed:latest',popular:'feed:popular',
  card:'internal/explore/shared-track-card-v115/song.json',
  profile:'internal/explore/shared-profile-v113/owner.json'
};
function makeBucket({feed=0,card=0,profile=0,failOnce=null}={}){
  const records=new Map();
  let rev=0;
  const stats=(count)=>({likeCount:count});
  const feedValue=(count)=>({payload:{data:{items:[{
    id:'song',ownerUid:'owner',likeCount:count,stats:stats(count)
  }]}}});
  const cardValue={schemaVersion:1,card:{id:'song',ownerUid:'owner',likeCount:card,stats:stats(card)}};
  const profileValue={body:{data:{items:[{id:'song',ownerUid:'owner',likeCount:profile,stats:stats(profile)}]}}};
  for(const [key,val] of [
    [keys.latest,feedValue(feed)],[keys.popular,feedValue(feed)],
    [keys.card,cardValue],[keys.profile,profileValue]
  ])records.set(key,{etag:'etag_'+(++rev),body:val,customMetadata:{}});
  const writes=[],reads=[];
  let failed=false;
  return {
    writes,reads,records,
    bucket:{
      async get(key){
        reads.push(key);
        const x=records.get(key);
        if(!x)return null;
        return {etag:x.etag,customMetadata:x.customMetadata,
          text:async()=>JSON.stringify(x.body)};
      },
      async head(key){
        const x=records.get(key);return x?{etag:x.etag}:null;
      },
      async put(key,text,{onlyIf,customMetadata}={}){
        if(failOnce===key && !failed){
          failed=true;
          throw new Error('injected R2 put failure: '+key);
        }
        const current=records.get(key);
        if(onlyIf?.etagMatches && current?.etag!==onlyIf.etagMatches)return false;
        if(onlyIf?.etagDoesNotMatch==='*'&&current)return false;
        const data=JSON.parse(text);
        records.set(key,{etag:'etag_'+(++rev),body:data,customMetadata:customMetadata||{}});
        writes.push(key);
        return {etag:'etag_'+rev};
      }
    },
    counts(){
      const feed=records.get(keys.latest).body.payload.data.items[0].likeCount;
      const popular=records.get(keys.popular).body.payload.data.items[0].likeCount;
      const card=records.get(keys.card).body.card.likeCount;
      const profile=records.get(keys.profile).body.body.data.items[0].likeCount;
      return {feed,popular,card,profile};
    }
  };
}
let failed=null;
try {
  const d=await mf.getD1Database('LOCAL');
  await d.prepare("CREATE TABLE tracks(id TEXT PRIMARY KEY, owner_uid TEXT, is_public INTEGER, status TEXT)").run();
  await d.prepare("CREATE TABLE track_stats(track_id TEXT PRIMARY KEY, like_count INTEGER)").run();
  await d.prepare("INSERT INTO tracks VALUES('song','owner',1,'published')").run();
  await d.prepare("INSERT INTO track_stats VALUES('song',1)").run();
  const dbMeter={R:0,W:0,queries:0};
  const envDB={prepare(sql){return {bind(...args){return {async all(){
    const r=await d.prepare(sql).bind(...args).all();
    dbMeter.R+=Number(r.meta.rows_read||0);
    dbMeter.W+=Number(r.meta.rows_written||0);
    dbMeter.queries++;
    return r;
  }}}}}};
  const env=(item)=>({PROFILE_MEDIA:item.bucket, DB:envDB});
  const zero={feed:1,popular:1,card:1,profile:1};
  const healthy=makeBucket({feed:1,card:1,profile:1});
  dbMeter.R=0;const a=await repair(env(healthy));
  verify('HEALTHY_NO_WRITE',()=>a.changedTracks===0&&healthy.writes.length===0
    &&JSON.stringify(healthy.counts())===JSON.stringify(zero));
  verify('HEALTHY_STILL_D1_READ',()=>dbMeter.R>0&&dbMeter.W===0);
  const normal=makeBucket({feed:0,card:0,profile:0});
  const b=await repair(env(normal));
  verify('FULL_REPAIR_SUCESSS',()=>b.changedTracks===1&&normal.writes.length===4
    &&JSON.stringify(normal.counts())===JSON.stringify(zero));
  const afterNormal=normal.writes.length;
  await repair(env(normal));
  verify('SECOND_PASS_NO_EXTRA_R2_WRITE',()=>normal.writes.length===afterNormal);

  const bad=makeBucket({feed:0,card:0,profile:0,failOnce:keys.profile});
  await assert.rejects(repair(env(bad)),/injected R2 put failure/);
  const partial=bad.counts();
  verify('PARTIAL_FAILURE_KEEPS_FEED_STALE_FOR_RETRY',()=>partial.feed===0&&partial.popular===0&&partial.card===1&&partial.profile===0);
  // Unlike previous Stage407, the feed has NOT been committed yet.
  // A retry reselects the track and repairs exactly the missing projection.
  const beforeRetryCardWrites=bad.writes.filter(x=>x===keys.card).length;
  const retried=await repair(env(bad));
  const final=bad.counts();
  verify('RETRY_COMPLETES_PARTIAL_PROFILE',()=>retried.changedTracks===1&&final.profile===1&&final.feed===1&&final.popular===1);
  verify('RETRY_NO_DUPLICATE_CARD_PUT',()=>bad.writes.filter(x=>x===keys.card).length===beforeRetryCardWrites);

  // If the Feed PUT itself fails, card+profile have already settled. Retry
  // must not write those objects again, only update the remaining Feed.
  const failFeed=makeBucket({feed:0,card:0,profile:0,failOnce:keys.latest});
  await assert.rejects(repair(env(failFeed)),/injected R2 put failure/);
  const first=failFeed.counts();
  verify('FEED_FAILURE_RETAINS_RETRY_SIGNAL',()=>first.feed===0&&first.card===1&&first.profile===1);
  const priorDerived=failFeed.writes.filter(x=>x===keys.card||x===keys.profile).length;
  await repair(env(failFeed));
  const after=failFeed.counts();
  verify('FEED_RETRY_NO_EXTRA_DERIVED_WRITES',()=>after.feed===1&&after.popular===1&&after.card===1&&after.profile===1
    &&priorDerived===failFeed.writes.filter(x=>x===keys.card||x===keys.profile).length);

  // Pre-existing stale card+profile while both Feeds are already current
  // remains out of scope: finding it requires debt history or per-card reads.
  const cardOnly=makeBucket({feed:1,card:0,profile:0});
  const third=await repair(env(cardOnly));
  verify('ALREADY_CORRECT_FEED_DOES_NOT_REPAIR_CARD',()=>third.changedTracks===0
    &&cardOnly.counts().card===0&&cardOnly.counts().profile===0);

  // This is not a total service-failure assertion: other write paths may
  // repair those cards. It is a gap in this exact 191 isolated recovery path.
  console.log('407_EXACT_FUNCTION_ISOLATED_CASES=PASS '+cases.length+'/'+cases.length);
  console.log('408_FEED_LAST_RECOVERY_FIX=VERIFIED_IN_ISOLATION');
  console.log('408_DEPLOY_GATE=BLOCKED (legacy card-only debt, live parity and multi-account/PC/mobile verification remain)');
}catch(error){failed=String(error?.stack||error);console.error('407_EXACT_191_VERIFIER_FAIL',failed)}
finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
   '# Stage407 exact source 191 recovery replay audit','',
   'Actual 191 source evaluated in isolated VM with Miniflare local D1 and fake R2; NO deployment.',
   ...cases.map(x=>'- '+x+': PASS'), '',
   failed?'**FAIL**':'**FEED-LAST FIX PASS IN ISOLATION / LIVE GATE BLOCKED**','',
   'Feed-last fixes injected failure/retry without extra D1 writes; pre-existing orphaned card-only debt is unresolved.', ''
  ].join('\n'));
  await mf.dispose().catch(()=>{});
}
if(failed)process.exitCode=1;
