import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const serviceTs=readFileSync('src/services/explorePublicPublicationSyncService.ts','utf8');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');

let onValueNext=null;
const localStore=new Map();
globalThis.window={
  localStorage:{
    getItem:(key)=>localStore.has(key)?localStore.get(key):null,
    setItem:(key,value)=>localStore.set(key,String(value)),
    removeItem:(key)=>localStore.delete(key),
  },
};

const transpiled=ts.transpileModule(serviceTs,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const mod={exports:{}};
const stubRequire=(id)=>{
  if(id==='firebase/database'){
    return {
      onValue:(_ref,next)=>{
        onValueNext=next;
        return ()=>undefined;
      },
      ref:(_db,path)=>({path}),
    };
  }
  if(id==='../config/exploreEnvironment') return {EXPLORE_API_BASE:'https://preview.invalid'};
  if(id==='../firebase'){
    return {
      auth:{currentUser:null},
      getFirebaseAppCheckToken:async()=>null,
      realtimeDb:{},
    };
  }
  if(id==='../lib/cloudflareDiagnostics') return {recordCloudflareResponse:()=>undefined};
  throw new Error('unexpected require '+id);
};
new Function('require','module','exports',transpiled)(stubRequire,mod,mod.exports);
const api=mod.exports;

assert.equal(typeof api.subscribeExplorePublicPublicationInvalidation429,'function');
assert.equal(typeof api.hasSettledExplorePublicPublicationSignal429,'function');
assert.equal(typeof api.rememberSettledExplorePublicPublicationSignal429,'function');

const received=[];
api.subscribeExplorePublicPublicationInvalidation429((signal)=>received.push(signal));
assert.equal(typeof onValueNext,'function');

const now=Date.now();
const rowAt=now-50;
const trackId='music_note_owner_same_ms';
const ownerUid='owner';

onValueNext({val:()=>({
  version:10,
  at:now,
  actorUid:'publication-server-431',
  rows:[{trackId,ownerUid,at:rowAt,status:'public'}],
})});
onValueNext({val:()=>({
  version:11,
  at:now+1,
  actorUid:'publication-server-431',
  rows:[{trackId,ownerUid,at:rowAt,status:'private'}],
})});

assert.equal(received.length,2,
  'same-timestamp newer-version private signal must reach the listener');
assert.equal(received[0].rows[0].status,'public');
assert.equal(received[0].version,10);
assert.equal(received[1].rows[0].status,'private');
assert.equal(received[1].version,11);
assert.equal(received[1].rows[0].at,rowAt);

const viewer='viewer';
api.rememberSettledExplorePublicPublicationSignal429(viewer,trackId,rowAt,10,now);
assert.equal(
  api.hasSettledExplorePublicPublicationSignal429(viewer,trackId,rowAt,10,now+1),
  true,
  'exact public v10 acknowledgement should be settled',
);
assert.equal(
  api.hasSettledExplorePublicPublicationSignal429(viewer,trackId,rowAt,11,now+1),
  false,
  'public v10 acknowledgement must not suppress same-timestamp private v11',
);
api.rememberSettledExplorePublicPublicationSignal429(viewer,trackId,rowAt,11,now+2);
assert.equal(
  api.hasSettledExplorePublicPublicationSignal429(viewer,trackId,rowAt,11,now+3),
  true,
  'private v11 acknowledgement should settle exact signal',
);

// Existing timestamp-only localStorage rows are treated as version 0 so an
// upgraded client never drops a newer same-timestamp server signal.
localStore.set('soridraw_public_publication_ack_429',JSON.stringify({
  viewerUid:viewer,
  rows:{[trackId]:{at:rowAt,checkedAt:now+4}},
}));
assert.equal(
  api.hasSettledExplorePublicPublicationSignal429(viewer,trackId,rowAt,11,now+5),
  false,
  'legacy timestamp-only acknowledgement must not hide newer version',
);

assert.match(page,/hasSettledExplorePublicPublicationSignal429\([\s\S]*?row432\.at, signalVersion433/);
assert.match(page,/rememberSettledExplorePublicPublicationSignal429\([\s\S]*?row432\.at, signalState433\.version/);
assert.match(page,/rememberSettledExplorePublicPublicationSignal429\([\s\S]*?row432\.at, signalVersion433/);

console.log('APP434_SAME_TIMESTAMP_NEWER_VERSION_RECEIVER_DELIVERED=PASS');
console.log('APP434_SAME_TIMESTAMP_ACK_VERSION_ORDER=PASS');
console.log('APP434_LEGACY_TIMESTAMP_ONLY_ACK_UPGRADE_SAFE=PASS');
console.log('APP434_PAGE_PASSES_SIGNAL_VERSION_TO_SETTLEMENT=PASS');
