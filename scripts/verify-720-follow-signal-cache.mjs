// APP720 real TypeScript logic exercised in an isolated VM; no server I/O.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const transpile=path=>ts.transpileModule(readFileSync(path,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const visitsModule={exports:{}};
vm.runInNewContext(transpile('src/services/exploreFollowVisitReuse715.ts'),{
  exports:visitsModule.exports,require:(name)=>{throw Error('unexpected visit import: '+name);},
  Date,Map,Promise,Number,String,Boolean,Set,
});
const create=visitsModule.exports.createExploreFollowVisitReuse715;
const verified={isFollowing:false,followerCount:3,followingCount:9,countVerified661:true};
const legacy={...verified,countVerified661:false};
const actor='actor',target='public-target',base=1_000_000;
const a=create();
assert.equal(a.remember(actor,target,verified,base,a.version(),base+1,true),true);
assert.equal(a.read(actor,target,base+119999,true).isFollowing,false,
 'one authenticated GET + active RTDB => at most 120s local reuse');
assert.equal(a.read(actor,target,base+120000,true),null,'120s bounded recovery');
assert.equal(a.remember(actor,target,verified,base,a.version(),base+1,true),true);
assert.equal(a.read(actor,target,base+10000,false),null,
 'stream unavailable => 10s fallback, no unchecked long lease');
const b=create();
b.remember(actor,target,legacy,base,b.version(),base+1,true);
assert.equal(b.read(actor,target,base+10000,true),null,
 'not exact canonical follow count => never allow 120s');
const c=create();
c.remember(actor,target,verified,base,c.version(),base+1,false);
assert.equal(c.read(actor,target,base+10000,true),null,
 'GET before stream established => cannot gain authority retroactively');
const d=create();
d.remember(actor,target,verified,base,d.version(),base+1,true);
assert.equal(d.read('other-account',target,base+2,true),null,'account isolation');
assert.equal(d.read(actor,'other-target',base+2,true),null,'target isolation');
d.invalidate();
assert.equal(d.read(actor,target,base+2,true),null,'remote event/click/account boundary');
assert.equal(d.remember(actor,target,verified,base,d.version()-1,base+3,true),false,
 'old GET cannot repopulate invalidated cache');
const e=create();
let loads=0,resolve;
const pending=new Promise(r=>resolve=r);
const one=e.runOrJoin(actor,target,()=>{loads++;return pending;},base);
const two=e.runOrJoin(actor,target,()=>{loads++;return pending;},base+10);
resolve(verified);
const [first,joined]=await Promise.all([one,two]);
assert.equal(loads,1,'same viewer+target inflight coalescing preserved');
assert.equal(joined.shared,true);
assert.equal(first.startedAt,base);
assert.equal(joined.startedAt,base);

const subscriptions=[];
const syncModule={exports:{}};
const fakeDatabase={
  onValue:(_ref,onNext,onError)=>{
    const subscription={onNext,onError,closed:false};
    subscriptions.push(subscription);
    return ()=>{subscription.closed=true};
  },
  ref:(_db,key)=>key,
  runTransaction:async()=>{throw Error('server write forbidden by verification');},
};
vm.runInNewContext(transpile('src/services/exploreFollowSyncService.ts'),{
 exports:syncModule.exports,require:name=>{
  if(name==='firebase/database')return fakeDatabase;
  if(name==='../firebase')return {realtimeDb:{}};
  throw Error('unexpected follow signal dependency '+name);
 },
 Date,Math,Number,String,Boolean,Promise,Set,Map,
 window:{localStorage:{getItem:()=>null,setItem:()=>{}},dispatchEvent:()=>{}},
 CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},
 console:{warn:()=>{}},
});
let live=false,signals=0;
const unsubscribe=syncModule.exports.subscribeExploreFollowSync377(
 actor,()=>{signals++},ready=>{live=ready});
assert.equal(subscriptions.length,1,'no extra RTDB listener');
subscriptions[0].onNext({val:()=>null});
assert.equal(live,true,'initial valid onValue callback qualifies existing stream');
subscriptions[0].onNext({val:()=>({
 version:100,at:Date.now(),originDeviceId:'other-device',
 targetUid:target,following:true,actorFollowingCount:1,targetFollowerCount:4,
})});
assert.equal(signals,1,'confirmed remote signal retained');
subscriptions[0].onError(Error('disconnected'));
assert.equal(live,false,'RTDB error removes extended cache qualification');
unsubscribe();
assert.equal(subscriptions[0].closed,true);

const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
assert.match(page,/signalQualified720=\(\)=>followStreamReady720Ref\.current===user\.uid/);
assert.match(page,/visit715\.read\(user\.uid,nextProfile\.uid,Date\.now\(\),signalQualified720\(\)\)/);
assert.match(page,/Date\.now\(\),signalQualified720\(\)\);/);
assert.match(page,/const reusableFollow716=!queuedFollow&&!recentChoice715\(\)/,
 'pending and recent local choice still force canonical verification');
assert.match(page,/window\.addEventListener\('offline',onBoundary720\)/);
assert.match(page,/window\.addEventListener\('online',onBoundary720\)/);
assert.match(page,/followVisitCache715Ref\.current\?\.invalidate\(\)/);
assert.match(page,/getExploreFollowState\(user, nextProfile\.uid, true\)/);
assert.equal((readFileSync('src/services/exploreFollowSyncService.ts','utf8')
 .match(/onValue\(/g)||[]).length,1,'APP720 adds zero RTDB subscriptions');
console.log('APP720_VERIFIED_GET_AND_LIVE_SIGNAL_REUSE_UNTIL_120S=PASS');
console.log('APP720_FALLBACK_10S_LEGACY_PENDING_ACCOUNT_CONNECTION_FENCES=PASS');
console.log('APP720_RTDB_CONFIRMED_UPDATE_DISCONNECT_AND_SINGLE_LISTENER=PASS');
console.log('APP720_BACKEND_D1_R2_FIREBASE_RULES_WRITES=0');
