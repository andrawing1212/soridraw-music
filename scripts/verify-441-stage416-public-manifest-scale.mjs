import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {
  preparePublicLikeManifest416,readPublicLikeManifest416,
  intersectPublicLikeManifest416,publicLikeManifestSlot416,
} from '../cloudflare/explore-worker/runtime/public-like-manifest-416.mjs';

const base=1_700_120_000_000;
const deadline=base+300_000;
const windowId='00000000-0000-4000-8000-000000000777';
const rows=Array.from({length:600},(_,i)=>({
  trackId:'track-'+String(i).padStart(4,'0'),
  ownerUid:'owner-'+(i%17),
}));

let reads=0,writes=0,seq=0;
const objects=new Map();
const r2={
 async get(key){
   reads++;
   const item=objects.get(key);
   if(!item)return null;
   return {etag:item.etag,customMetadata:item.customMetadata||{},
     text:async()=>item.body};
 },
 async put(key,body,opts={}){
   const prior=objects.get(key);
   const only=opts.onlyIf||{};
   if(only.etagMatches&&prior?.etag!==only.etagMatches)return null;
   if(only.etagDoesNotMatch==='*'&&prior)return null;
   const etag='e'+(++seq);
   objects.set(key,{etag,body,customMetadata:opts.customMetadata||{}});
   writes++;return {etag};
 },
};
const first=await preparePublicLikeManifest416(r2,rows,windowId,deadline);
assert.equal(first.inlineRows.length,256);
assert.equal(first.manifest416.count,600);
assert.equal(first.manifest416.slot,publicLikeManifestSlot416(deadline));
assert.equal(first.r2Writes,1);
assert.equal(objects.size,1,'rolling manifest uses one slot object');
const writesAfterFirst=writes;
const retry=await preparePublicLikeManifest416(r2,[...rows].reverse(),windowId,deadline);
assert.equal(retry.manifest416.digest,first.manifest416.digest);
assert.equal(retry.r2Writes,0,'exact manifest retry is R2 W0');
assert.equal(writes,writesAfterFirst);
const loaded=await readPublicLikeManifest416(r2,first.manifest416);
assert.equal(loaded.rows.length,600);
const matched=intersectPublicLikeManifest416(loaded.rows,
 ['track-0599','not-changed','track-0000']);
assert.deepEqual(matched.map(x=>x.trackId),['track-0000','track-0599']);
assert(objects.size<=8,'manifest ring is physically bounded');

const require=createRequire(import.meta.url);
const source=readFileSync('functions/src/exploreLikePublicRelease416.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const mod={exports:{}};
vm.runInNewContext(js,{module:mod,exports:mod.exports,require,Buffer,JSON,Object,Array,
 Number,Set,Map,Error,Date,Math},{timeout:2500});
const publish=mod.exports.publishPublicLikeRelease416;
const secret='stage416-public-manifest-secret-longer-than-32';
let marker=null,signal=null,markerWrites=0,signalWrites=0;
const db={ref:path=>({transaction:async update=>{
 const current=path==='publicLikeRelease416'?marker:signal;
 const next=update(current);
 if(next===undefined)return {committed:false,snapshot:{val:()=>current}};
 if(path==='publicLikeRelease416'){marker=next;markerWrites++;}
 else if(path==='publicSync/exploreLike'){signal=next;signalWrites++;}
 else throw Error('unexpected path '+path);
 return {committed:true,snapshot:{val:()=>next}};
}})};
const send=async signedAtMs=>{
 const claim={windowId,releaseToken:'stage416-public-'+windowId,
   deadlineAtMs:deadline,signedAtMs,rows:first.inlineRows,
   manifest416:first.manifest416};
 const raw=JSON.stringify(claim);
 const signature=createHmac('sha256',secret).update(raw).digest('hex');
 return publish(db,raw,signature,secret,signedAtMs,
   'publicLikeRelease416','publicSync/exploreLike');
};
const published=await send(deadline+1000);
assert.equal(published.status,'PUBLISHED');
assert.equal(published.count,600);
assert.equal(signal.rows.length,50);
assert.equal(signal.overflow416.length,206);
assert.equal(signal.manifest416.count,600);
assert.equal(signal.manifest416.digest,first.manifest416.digest);
assert.equal(signal.settledAfterProjection416,true);
assert.equal(signalWrites,1);
const before=[markerWrites,signalWrites];
const duplicate=await send(deadline+1001);
assert.equal(duplicate.status,'DUPLICATE');
assert.equal(duplicate.count,600);
assert.deepEqual([markerWrites,signalWrites],before,'exact high-volume retry RTDB W0');

const badClaim={windowId,releaseToken:'stage416-public-'+windowId,
 deadlineAtMs:deadline,signedAtMs:deadline+2000,rows:first.inlineRows,
 manifest416:{...first.manifest416,slot:(first.manifest416.slot+1)%8}};
const badRaw=JSON.stringify(badClaim);
await assert.rejects(
 publish(db,badRaw,createHmac('sha256',secret).update(badRaw).digest('hex'),
   secret,deadline+2000,'otherMarker','otherSignal'),
 /416_PUBLIC_RELEASE_BAD_CLAIM/);

const release=readFileSync('cloudflare/explore-worker/runtime/public-like-release-416.mjs','utf8');
assert.match(release,/preparePublicLikeManifest416/);
assert.match(release,/rows:prepared\.inlineRows/);
assert.match(release,/prepared\.manifest416/);

const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(entry,/PUBLIC_LIKE_MANIFEST_ROUTE_416/);
assert.match(entry,/caches\.default\.match\(cacheKey\)/);
assert.match(entry,/readPublicLikeManifest416\(env\.PROFILE_MEDIA,meta\)/);
assert.match(entry,/intersectPublicLikeManifest416\(manifest\?\.rows,requested\)/);
const manifestHandler=entry.slice(
 entry.indexOf('async function handlePublicLikeManifestIntersect416'),
 entry.indexOf('async function handleSignedPublicLikeRelease416'));
assert.doesNotMatch(manifestHandler,/env\.?DB|\.prepare\s*\(/,
 'manifest intersection must remain D1 R0/W0');

const service=readFileSync('src/services/explorePublicLikeSyncService.ts','utf8');
assert.match(service,/fetchExplorePublicLikeManifestMatches416/);
assert.match(service,/settledAfterProjection416/);
assert.match(service,/manifest416/);
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
assert.match(page,/fetchExplorePublicLikeManifestMatches416\(signal\.manifest416!?, visibleIds\)/);
assert.match(page,/row\.settledAfterProjection416 !== true && card\.updatedAt < row\.at/);
const like=readFileSync('src/services/exploreLikeService.ts','utf8');
assert.match(like,/const STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE = false/);
assert.match(like,/acceptedForSignal127\.length && !STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE/);

console.log('STAGE416_PUBLIC_MANIFEST_600_EXACT_IDS=PASS');
console.log('STAGE416_PUBLIC_MANIFEST_RING_MAX8=PASS');
console.log('STAGE416_PUBLIC_MANIFEST_RETRY_R2_W0=PASS');
console.log('STAGE416_PUBLIC_SIGNAL_600_INLINE256_PLUS_EXACT_MANIFEST=PASS');
console.log('STAGE416_PUBLIC_SIGNAL_HIGH_VOLUME_DUPLICATE_RTDB_W0=PASS');
console.log('STAGE416_PUBLIC_MANIFEST_INTERSECT_D1_R0W0=PASS');
console.log('STAGE416_CLIENT_EARLY_PUBLIC_SIGNAL_HARD_OFF_GATE=PASS');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
