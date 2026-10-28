import assert from 'node:assert/strict';
import {createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
import {createOwnerR2Provider518} from '../cloudflare/media-worker/src/catalogR2Provider518.js';
const uid='owner-1';
let head={...createEmptyCatalogJournal({
 kind:'musicNote',baseKey:'catalog/v5/owner-1/musicNote/bases/100.json',
 baseRevision:100,itemCount:0,now:1000,
}),canonicalAuthority518:true};
let etag='E1',puts=0,reads=0;
const meta=payload=>({
 uid,kind:'musicNote',revision:String(payload.headRevision),
 baseRevision:String(payload.baseRevision),itemCount:String(payload.itemCount),
});
const object=(value,keyUid=uid,kind='musicNote')=>({
 etag,size:Buffer.byteLength(JSON.stringify(value)),
 customMetadata:{...meta(value),uid:keyUid,kind},
 async text(){return JSON.stringify(value);},
});
const CATALOG={
 async get(key){reads++;
  assert.equal(key,'catalog/v5/owner-1/musicNote/journal.json');
  return object(head);
 },
 async put(key,body,options){
  assert.equal(key,'catalog/v5/owner-1/musicNote/journal.json');
  assert.equal(options.onlyIf.etagMatches,etag);
  const value=JSON.parse(body);
  if(!value.canonicalAuthority518)return null;
  head=value;etag='E'+(puts+2);puts++;
  return {etag};
 }
};
const off=createOwnerR2Provider518({env:{CATALOG}});
assert.equal(off.enabled,false);
await assert.rejects(()=>off.readOwnerHead(uid),/CUTOVER_NOT_APPROVED/);
const env={CATALOG,SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT'};
const noRollout=createOwnerR2Provider518({env});
assert.equal(noRollout.enabled,false);
await assert.rejects(()=>noRollout.readOwnerHead(uid),/CUTOVER_NOT_APPROVED/);
const backend=createOwnerR2Provider518({env,sharedReleaseFencesVerified:true});
assert.equal(backend.enabled,true);
let current=await backend.readOwnerHead(uid);
assert.equal(current.head.headRevision,100);
assert.equal(current.ownerUid,uid);
const version='001793152800000000001';
const next={...head,headRevision:200,updatedAtMs:2000,
 deltas:[{mutationId:'canonical518:song:'+version,
  baseRevision:100,revision:200,baseItemCount:0,nextItemCount:1,
  upserts:[{id:'song',uid}],deletedIds:[],createdAtMs:2000}],
 itemCount:1,recentMutations:[{id:'canonical518:song:'+version,
  revision:200,itemCount:1}]};
assert.equal((await backend.storeHeadIfEtag({
 uid,expectedEtag:current.etag,nextHead:next,
 sourceVersionNs:version,documentId:'song',
})).casCommitted,true);
assert.equal(puts,1);
current=await backend.readOwnerHead(uid);
assert.equal(current.head.headRevision,200);
assert.equal(current.etag,'E2');
await assert.rejects(()=>backend.storeHeadIfEtag({
 uid,expectedEtag:current.etag,nextHead:{...next,canonicalAuthority518:false},
 sourceVersionNs:version,documentId:'song',
}),/CUTOVER_NOT_APPROVED/);
assert.equal(puts,1);
const foreign={...env,CATALOG:{...CATALOG,async get(){return object(head,'other-owner');}}};
await assert.rejects(()=>createOwnerR2Provider518({
 env:foreign,sharedReleaseFencesVerified:true,
}).readOwnerHead(uid),/UNKNOWN_OR_CORRUPT/);
assert.equal(puts,1);
console.log('APP518_R2_RELEASE_FLAG_AND_SHARED_WRITER_FENCES_REQUIRED=PASS');
console.log('APP518_R2_OWNER_BOUND_HEAD_ETAG_CAS=PASS');
console.log('APP518_R2_INVALID_OR_FOREIGN_HEAD_NO_PUT=PASS');
console.log('APP518_R2_PROVIDER_ONLY_MOCK_IO=PASS');
