import assert from 'node:assert/strict';
import {createHmac,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {
 ackPublicLikeEventStorage416,readPublicLikeReleaseState416,
 registerPublicLikeEventStorage416,
} from '../cloudflare/explore-worker/runtime/public-like-window-416.mjs';
import {releaseDuePublicLikeWindow416}
 from '../cloudflare/explore-worker/runtime/public-like-release-416.mjs';

const require=createRequire(import.meta.url);
const compile=source=>ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(compile(readFileSync('functions/src/exploreLikePublicRelease416.ts','utf8')),
 {module:mod,exports:mod.exports,require,Buffer,JSON,Object,Array,Number,Set,Map,Error,Date},
 {timeout:2500});
const publish=mod.exports.publishPublicLikeRelease416;
const secret='stage416-public-release-secret-longer-than-32';
const now=1_700_080_500_000,deadline=now-5000;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const rows=Array.from({length:80},(_,i)=>({trackId:'song-'+i,ownerUid:'owner-'+(i%3)}));
let marker=null,signal=null,markerWrites=0,signalWrites=0,failSignal=false;
const db={ref:path=>({transaction:async update=>{
 const current=path==='publicLikeRelease416'?marker:signal;
 if(path==='publicSync/exploreLike'&&failSignal)throw Error('signal unavailable');
 const next=update(current);
 if(next===undefined)return {committed:false,snapshot:{val:()=>current}};
 if(path==='publicLikeRelease416'){marker=next;markerWrites++;}
 else if(path==='publicSync/exploreLike'){signal=next;signalWrites++;}
 else throw Error('unexpected RTDB path '+path);
 return {committed:true,snapshot:{val:()=>next}};
}})};
const call=async data=>{
 const raw=JSON.stringify(data),sig=createHmac('sha256',secret).update(raw).digest('hex');
 return publish(db,raw,sig,secret,now,'publicLikeRelease416','publicSync/exploreLike');
};
const claim={windowId:id(1),releaseToken:'stage416-public-'+id(1),
 deadlineAtMs:deadline,signedAtMs:now,rows};
const first=await call(claim);
assert.equal(first.status,'PUBLISHED');assert.equal(first.signalChanged,true);
assert.equal(markerWrites,2,'normal release bounded marker reserve+checkpoint');
assert.equal(signalWrites,1);assert.equal(signal.rows.length,50);
assert.equal(signal.overflow416.length,30);
assert.equal(new Set([...signal.rows,...signal.overflow416].map(x=>x.trackId)).size,80);
assert([...signal.rows,...signal.overflow416].every(x=>x.at===deadline));
const before=[markerWrites,signalWrites];
const duplicate=await call({...claim,signedAtMs:now+1});
assert.equal(duplicate.status,'DUPLICATE');
assert.deepEqual([markerWrites,signalWrites],before,'completed release retry W0');

const claim2={windowId:id(2),releaseToken:'stage416-public-'+id(2),
 deadlineAtMs:deadline+1000,signedAtMs:now,rows:[{trackId:'song-x',ownerUid:'owner-x'}]};
failSignal=true;
await assert.rejects(call(claim2),/signal unavailable/);
assert.equal(marker.status,'PENDING');
const pendingWrites=markerWrites;
failSignal=false;
const resumed=await call(claim2);
assert.equal(resumed.status,'PUBLISHED');
assert.equal(markerWrites,pendingWrites+1,'resume does not rewrite reservation');
assert.equal(signalWrites,2);
const afterResume=[markerWrites,signalWrites];
const stale=await call(claim);
assert.equal(stale.status,'STALE');
assert.deepEqual([markerWrites,signalWrites],afterResume,'older release cannot rebroadcast');

globalThis.crypto=webcrypto;
const base=1_700_090_000_000;
const map=new Map();
const storage={
 async get(key){return map.get(key);},
 async put(entries,value){
   if(typeof entries==='string'){map.set(entries,structuredClone(value));return;}
   for(const [key,row] of Object.entries(entries))map.set(key,structuredClone(row));
 },
 async list({prefix}={}){return new Map([...map].filter(([key])=>!prefix||key.startsWith(prefix)));},
 async delete(keys){for(const key of (Array.isArray(keys)?keys:[keys]))map.delete(key);},
};
const event={eventId:id(10),windowCandidateId:id(11),eventAtMs:base,
 publicMinutes:5,trackIds:['outside-top40','song-a']};
await registerPublicLikeEventStorage416(storage,event,base);
await ackPublicLikeEventStorage416(storage,event.eventId,base+1);
let callbackAttempts=0,materializeCalls=0;
const materialize=async({trackIds})=>{
 materializeCalls++;assert.deepEqual(trackIds,['outside-top40','song-a']);
 return {releaseRows:[
   {trackId:'outside-top40',ownerUid:'owner-o'},
   {trackId:'song-a',ownerUid:'owner-a'},
 ],missingIds:[],d1ReadQueries:2,d1Writes:0,r2Reads:7,r2Writes:4};
};
const releaseEndpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicLikeRelease416Candidate';
const failingHttp=async(_url,init)=>{
 callbackAttempts++;
 const expected=createHmac('sha256',secret).update(init.body).digest('hex');
 assert.equal(init.headers['X-Soridraw-416-Public-Release-Signature'],expected);
 const sent=JSON.parse(init.body);
 assert.equal(sent.releaseToken,'stage416-public-'+event.windowCandidateId);
 assert.equal(sent.deadlineAtMs,base+300_000);
 return {ok:false,json:async()=>({ok:false})};
};
await assert.rejects(releaseDuePublicLikeWindow416({
 db:{},r2:{},storage,releaseEndpoint,secret,nowMs:base+300_000,
 http:failingHttp,materialize,
}),/416_PUBLIC_RELEASE_CALLBACK_NOT_CONFIRMED/);
assert.equal((await readPublicLikeReleaseState416(storage,base+300_000)).exists,true,
 'failed callback keeps exact window for retry');
const okHttp=async(_url,init)=>{
 callbackAttempts++;
 const sent=JSON.parse(init.body);
 assert.equal(sent.rows.length,2);
 return {ok:true,json:async()=>({ok:true,data:{status:'PUBLISHED'}})};
};
const released=await releaseDuePublicLikeWindow416({
 db:{},r2:{},storage,releaseEndpoint,secret,nowMs:base+300_001,
 http:okHttp,materialize,
});
assert.equal(released.status,'RELEASED');assert.equal(released.cleared,true);
assert.equal(released.d1Writes,0);
assert.equal((await readPublicLikeReleaseState416(storage,base+300_001)).exists,false);
assert.equal(callbackAttempts,2);assert.equal(materializeCalls,2,
 'projection replay is allowed but window clear waits for RTDB receipt');

const projectionSource=readFileSync(
 'cloudflare/explore-worker/runtime/public-like-projection-416.mjs','utf8');
assert.match(projectionSource,/releaseRows=\[\.\.\.canonical\.states\.values\(\)\]/);
const releaseSource=readFileSync(
 'cloudflare/explore-worker/runtime/public-like-release-416.mjs','utf8');
assert.match(releaseSource,/materializePublicLikeProjection416/);
assert.match(releaseSource,/clearPublicLikeReleaseStorage416/);
assert.ok(releaseSource.indexOf('materialize({db,r2,trackIds:state.trackIds})')<
 releaseSource.indexOf('sendPublicLikeRelease416({'),
 'R2 projection must finish before public RTDB callback');
assert.ok(releaseSource.indexOf('sendPublicLikeRelease416({')<
 releaseSource.indexOf('clearPublicLikeReleaseStorage416(storage,state)'),
 'window clear must follow confirmed RTDB callback');
console.log('STAGE416_PUBLIC_RELEASE_R2_BEFORE_RTDB_BEFORE_CLEAR=PASS');
console.log('STAGE416_PUBLIC_RELEASE_CALLBACK_FAILURE_RETRY_SAFE=PASS');
console.log('STAGE416_PUBLIC_RELEASE_RTDB_COMPLETED_REPLAY_W0=PASS');
console.log('STAGE416_PUBLIC_RELEASE_80_CHANGED_IDS_ATOMIC_SIGNAL=PASS');
console.log('STAGE416_PUBLIC_RELEASE_D1_WRITES=0');
console.log('DEPLOYMENT=0');
console.log('SHARED_DATA_CHANGE=0');
