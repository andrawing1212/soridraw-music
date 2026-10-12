import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {finalizePrivateHandoff416} from
 '../cloudflare/explore-worker/runtime/like-private-finalize-416.mjs';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE explore_like_batches_069(batch_id TEXT PRIMARY KEY);'+
 'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT NOT NULL);'+
 'CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL);'+
 'CREATE TABLE likes(track_id TEXT,user_uid TEXT,PRIMARY KEY(track_id,user_uid));');
const bind=(sql,args=[])=>({bind:(...v)=>bind(sql,v),
 async first(){return sqlite.prepare(sql).get(...args)||null;},
 async all(){return {results:sqlite.prepare(sql).all(...args)}}});
const db={prepare:sql=>bind(sql)};
const uid='same-account',now=1_700_000_000_000;
const op=i=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0');
const rows=Array.from({length:80},(_,i)=>({trackId:'song-'+i,
 liked:i%3===0,operationId:op(i)}));
for(let i=0;i<80;i++){
 sqlite.prepare('INSERT INTO tracks VALUES(?,?)').run('song-'+i,'owner-'+(i%2));
 sqlite.prepare('INSERT INTO track_stats VALUES(?,?)').run('song-'+i,i+1);
 if(i%2===0)sqlite.prepare('INSERT INTO likes VALUES(?,?)').run('song-'+i,uid);
}
const batchIds=[0,1].map(i=>'l069_'+String(now-1000-i).padStart(13,'0')+'_'
 +(i?'b':'a').repeat(64));
let r2puts=0,etag=1;
let personal={schemaVersion:1,uid,canonicalComplete156:true,
 canonicalSource156:'legacy-exact',likedTrackIds:[],exactLikeCount156:0};
const r2={async get(){return {etag:'e'+etag,customMetadata:{},
 text:async()=>JSON.stringify(personal)};},
 async put(_key,body,opts){assert.equal(opts.onlyIf.etagMatches,'e'+etag);
 personal=JSON.parse(body);etag++;r2puts++;return {etag:'e'+etag};}};
// Exercise the real signed Functions publisher, legacy RTDB receiver, R2-only
// Worker endpoint and ExplorePage effect together. All I/O stays in fixtures.
const require=createRequire(import.meta.url);
const compile=source=>ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const finalModule={exports:{}};
vm.runInNewContext(compile(readFileSync('functions/src/exploreLikePrivateFinal416.ts','utf8')),
 {module:finalModule,exports:finalModule.exports,require,Buffer});
const realtime=new Map(),listeners=[];
const realtimeDb={ref:path=>({transaction:async update=>{
 const next=update(realtime.get(path)||null);
 if(next===undefined)return {committed:false,snapshot:{val:()=>realtime.get(path)}};
 realtime.set(path,next);
 if(path==='publicSync/exploreLike')for(const listener of listeners)listener({val:()=>next});
 return {committed:true,snapshot:{val:()=>next}};
}})};
let clock=now,publicRequests=0,publicR2Reads=0;
const entrySource=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const cardStart=entrySource.indexOf('const PUBLIC_LIKE_CARD_ROUTE_192');
const cardEnd=entrySource.indexOf('// SORIDRAW_CANONICAL_ATOMIC_DRAIN_RECEIPT_418',cardStart);
const readCards=vm.runInNewContext(entrySource.slice(cardStart,cardEnd)+';handlePublicLikeCards192;',
 {Headers,Response,URL,revisionCors036:()=>({})});
const publicCards=new Map(rows.map((row,i)=>[row.trackId,{
 schemaVersion:1,updatedAt:now-500,
 card:{id:row.trackId,ownerUid:'owner-'+i%2,likeCount:i+1},
}]));
const service={};
const storage=new Map();
vm.runInNewContext(compile(readFileSync('src/services/explorePublicLikeSyncService.ts','utf8')),{
 exports:service,URLSearchParams,
 Date:class extends Date{static now(){return clock;}},
 window:{localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}},
 require:name=>{
  if(name==='firebase/database')return {ref:(_db,path)=>path,onValue:(path,listener)=>{
   assert.equal(path,'publicSync/exploreLike');listeners.push(listener);return ()=>{};
  }};
  if(name==='../firebase')return {realtimeDb:{}};
  if(name==='../config/exploreEnvironment')return {EXPLORE_API_BASE:'https://fixture.invalid'};
  if(name==='../lib/cloudflareDiagnostics')return {recordCloudflareResponse(){}};
  throw Error('unexpected dependency '+name);
 },
 fetch:async url=>{
  publicRequests++;
  assert.equal(new URL(url).pathname,'/v1/public-like-cards','no full Feed request');
  return readCards(new Request(url),{
   get DB(){throw Error('public receiver must never read D1');},
   PROFILE_MEDIA:{get:async key=>{
    publicR2Reads++;
    const id=decodeURIComponent(key.split('/').pop().replace(/\.json$/,''));
    assert(['song-0','song-1'].includes(id),'only visible changed cards are read');
    return {text:async()=>JSON.stringify(publicCards.get(id))};
   }},
  });
 },
});
let screen=[{id:'song-0',likeCount:0,liked:false},{id:'song-1',likeCount:0,liked:false},
 {id:'unrelated',likeCount:9,liked:true}];
const timers=[],cachePatches=[];
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const effectStart=page.lastIndexOf('  useEffect(() => {',page.indexOf('const scheduleRefresh192'));
const effectEnd=page.indexOf('  }, [user?.uid]);',effectStart)+'  }, [user?.uid]);'.length;
vm.runInNewContext(compile(page.slice(effectStart,effectEnd)),{
 ...service,user:{uid:'B-account'},Date:class extends Date{static now(){return clock;}},
 useEffect:fn=>fn(),console,
 window:{setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}},
 publicLikeVisibleTracksRef192:{current:new Map(screen.map(t=>[t.id,'owner']))},
 publicLikePendingRowsRef192:{current:new Map()},
 publicLikeRefreshAttemptsRef192:{current:new Map()},publicLikeRefreshTimerRef192:{current:null},
 patchExploreFeedSessionCachesRow:(id,patch)=>cachePatches.push({id,...patch}),
 patchExplorePublicProfileFirstViewTrack(){},patchExploreLikedTrackCachedCount091(){},
 setTracks:update=>{screen=update(screen);},setPopularTracks(){},setCuratedTracks307(){},
 setManagedCuratedTracks307(){},setProfileTracks(){},setProfileLikedTracks(){},
});
const drainScreen=async()=>{while(timers.length)await timers.shift()();};
const secret='stage416-final-callback-secret-longer-than-32';
let callbacks=0,lastClaim=null;
const http=async(_url,init)=>{
 callbacks++;lastClaim=JSON.parse(init.body);
 assert.equal(init.headers['X-Soridraw-416-Final-Signature'],
  createHmac('sha256',secret).update(init.body).digest('hex'));
 const data=await finalModule.exports.publishAuthenticatedPrivateFinal416(
  realtimeDb,init.body,init.headers['X-Soridraw-416-Final-Signature'],secret,clock);
 return {ok:true,json:async()=>({ok:true,data})};
};
const args={db,r2,uid,windowId:op(500),version:80,batchIds,rows,
 finalEndpoint:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/privateLikeFinalReceipt416Candidate',
 secret,nowMs:now,http};
const out=await finalizePrivateHandoff416(args);
assert.equal(out.settled,true);assert.equal(out.rows.length,80);
assert.equal(r2puts,1,'whole account changed-window membership is one R2 CAS');
assert.equal(callbacks,1);
await drainScreen();
assert.equal(screen[0].likeCount,1,'A settled like updates B without navigation');
assert.equal(screen[1].likeCount,2);
assert.equal(screen[0].liked,false,'B personal heart stays untouched');
assert.equal(screen[2].likeCount,9);
assert.equal(publicRequests,1);assert.equal(publicR2Reads,2);
assert.equal(cachePatches.length,2);
assert.equal(lastClaim.rows.length,80);
for(let i=0;i<80;i++){
 const row=lastClaim.rows.find(x=>x.trackId==='song-'+i);
 assert.equal(row.operationId,op(i));
 assert.equal(row.liked,i%2===0,'final heart comes from canonical relation, not desired input');
 assert.equal(row.likeCount,i+1);assert.match(row.ownerUid,/^owner-/);
}
assert.equal(personal.exactLikeCount156,40);
const retry=await finalizePrivateHandoff416(args);
assert.equal(retry.receiptStatus,'DUPLICATE');
assert.equal(r2puts,1,'exact retry R2 W0');
assert.equal(callbacks,2);
await drainScreen();
assert.equal(publicRequests,1,'exact replay does not fetch cards again');
sqlite.prepare('INSERT INTO explore_like_batches_069 VALUES(?)').run(batchIds[0]);
await assert.rejects(finalizePrivateHandoff416({...args,version:81}),/416_FINAL_069_STILL_PENDING/);
assert.equal(r2puts,1);assert.equal(callbacks,2);
sqlite.prepare('DELETE FROM explore_like_batches_069').run();
sqlite.prepare('UPDATE track_stats SET like_count=0 WHERE track_id=?').run('song-0');
sqlite.prepare('DELETE FROM likes WHERE track_id=?').run('song-0');
clock=now+2000;
publicCards.set('song-0',{schemaVersion:1,updatedAt:now+1500,
 card:{id:'song-0',ownerUid:'owner-0',likeCount:0}});
await finalizePrivateHandoff416({...args,version:81,nowMs:clock,
 batchIds:['l069_'+String(now+1000)+'_'+'c'.repeat(64)],
 rows:[{trackId:'song-0',liked:false,operationId:op(1000)}]});
await drainScreen();
assert.equal(screen[0].likeCount,0,'settled unlike delivers zero to B');
assert.equal(screen[0].liked,false);assert.equal(screen[2].liked,true);
assert.equal(publicRequests,2);assert.equal(publicR2Reads,3);
assert.equal(timers.length,0,'no idle polling remains');
console.log('STAGE416_SIGNED_FINAL_PUBLIC_BUS_R2_ENDPOINT_B_SCREEN_LIKE_UNLIKE=PASS');
console.log('STAGE416_B_PERSONAL_HEART_UNCHANGED_NO_FEED_NO_D1_NO_IDLE_POLL=PASS');
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const index=readFileSync('functions/src/index.ts','utf8');
const appVersion=Number(JSON.parse(readFileSync('public/app-version.json','utf8')).version);
const expectSigned416=process.env.STAGE416_EXPECT_SIGNED_ROUTE === '1' || appVersion>=400;
if (expectSigned416) {
  assert.match(entry,/const STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE=true/);
} else {
  assert.match(entry,/const STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE=false/);
}
assert.match(entry,/finalizePrivateHandoff416\(\{/);
assert.match(index,/privateLikeFinalReceipt416Candidate/);
console.log('STAGE416_069_DRAIN_TO_ONE_R2_CAS_TO_SIGNED_FINAL80=PASS');
console.log('STAGE416_FINAL_RETRY_R2_W0_CALLBACK_IDEMPOTENT=PASS');
console.log('STAGE416_PENDING_069_BLOCKS_FALSE_FINAL_ACK=PASS');
console.log('STAGE416_FINAL_HTTP_PREVIEW_EXPORT_READY=PASS');
