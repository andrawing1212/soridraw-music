import assert from 'node:assert/strict';
import {createEmptyCatalogJournal} from '../cloudflare/media-worker/src/catalogJournal.js';
import {createR2BasePageReader518} from '../cloudflare/media-worker/src/catalogR2BasePages518.js';
import {CatalogR2ContractError518} from '../cloudflare/media-worker/src/catalogR2Provider518.js';

const uid='owner-strict',key='catalog/v5/owner-strict/musicNote/bases/100.json';
const fixture=(items,{trailingComma=false,metadataUid=uid}={})=>{
 const base={schemaVersion:4,authority:'server',kind:'musicNote',
  revision:100,items,itemCount:items.length,complete:true,generatedAtMs:1000};
 let encoded=JSON.stringify(base);
 if(trailingComma)encoded=encoded.replace(/\],"itemCount":/ ,',],"itemCount":');
 const bytes=new TextEncoder().encode(encoded);
 const head={...createEmptyCatalogJournal({
  kind:'musicNote',baseKey:key,baseRevision:100,itemCount:items.length,now:1,
 }),canonicalAuthority518:true};
 let reads=0,puts=0,largestRange=0,requestedBytes=0,receivedBytes=0;
 const env={SORIDRAW_CANONICAL_CATALOG_518:'ENABLED_AFTER_SHARED_ROLLOUT',
  CATALOG:{
   async head(){return {etag:'"fixed"',size:bytes.length,
    customMetadata:{uid:metadataUid,kind:'musicNote'}};},
   async get(k,opts){
    assert.equal(k,key);assert.ok(opts?.range);
    const {offset,length}=opts.range;
    assert.ok(length<=65536);
    largestRange=Math.max(largestRange,length);reads++;requestedBytes+=length;
    const slice=bytes.slice(offset,offset+length);
    receivedBytes+=slice.length;
    return {etag:'"fixed"',customMetadata:{uid:metadataUid,kind:'musicNote'},
      async arrayBuffer(){return slice.buffer.slice(slice.byteOffset,slice.byteOffset+slice.byteLength);}};
   },
   async put(){puts++;throw Error('unexpected R2 PUT');},
  }};
 const reader=createR2BasePageReader518({
  env,sharedReleaseFencesVerified:true,readOwnerHead:async()=>({}),
  projectItem:item=>item,
 });
 return {reader,head,stats:()=>({
  reads,puts,largestRange,requestedBytes,receivedBytes,baseBytes:bytes.length,
 })};
};
const crawl=async data=>{
 const info=await data.reader.inspect({uid,head:data.head});
 let offset=0,seen=0,steps=0,ids=[];
 while(steps++<50){
  const before=data.stats();
  const p=await data.reader.page({uid,head:data.head,baseEtag:info.baseEtag,
   baseSize:info.baseSize,offset,seen,pageSize:256});
  const after=data.stats();
  // Enforce total network bytes requested/received, not only parser's
  // consumed bytes. A footer re-fetch must count against the same page.
  assert.ok(after.requestedBytes-before.requestedBytes<=131072,
   'all R2 range GET requested bytes per page must be <=128KiB');
  assert.ok(after.receivedBytes-before.receivedBytes<=131072,
   'all R2 range GET received bytes per page must be <=128KiB');
  assert.ok(p.offset>offset&&p.offset-offset<=131072,
   'source byte budget is a strict 128KiB');
  assert.ok(p.seen>=seen&&p.seen-seen<=256);
  ids.push(...p.ids);
  offset=p.offset;seen=p.seen;
  if(p.done){assert.equal(seen,data.head.baseItemCount);return {ids,steps};}
 }
 throw Error('no forward progress');
};
// 80KiB + 80KiB cannot fit inside one 128KiB source page.
const pair=fixture([
 {id:'one',createdAtMs:2,title:'x'.repeat(80*1024)},
 {id:'two',createdAtMs:1,title:'x'.repeat(80*1024)},
]);
const pairResult=await crawl(pair);
assert.deepEqual(pairResult.ids,['one','two']);
assert.ok(pairResult.steps>=2);
assert.equal(pair.stats().puts,0);
// 120KiB item and the JSON prefix can fit under 128KiB; 130KiB
// item may need a prefix-only first step, then its full own page.
const nearLimit=fixture([{id:'large',createdAtMs:1,title:'한'.repeat(43670)}]);
const large=await crawl(nearLimit);
assert.deepEqual(large.ids,['large']);
assert.ok(large.steps>=2,'prefix-only checkpoint permits one long valid item');
assert.equal(nearLimit.stats().puts,0);
// Audit regression: one valid UTF-8 BASE is exactly 131,007 bytes.
// The prior implementation made an extra 8,192-byte prefix GET on the last
// page (139,199 total) despite claiming a 128KiB source-page limit.
const edgeEmpty=fixture([{id:'edge',createdAtMs:1,title:''}]);
const edgeTarget=131007;
const edgeFill=edgeTarget-edgeEmpty.stats().baseBytes;
assert.ok(edgeFill>0);
const edge=fixture([{id:'edge',createdAtMs:1,title:'x'.repeat(edgeFill)}]);
assert.equal(edge.stats().baseBytes,edgeTarget);
const edgeResult=await crawl(edge);
assert.deepEqual(edgeResult.ids,['edge']);
assert.equal(edge.stats().requestedBytes,edgeTarget,
 'no redundant R2 prefix re-fetch at end of BASE');
assert.equal(edge.stats().receivedBytes,edgeTarget);
assert.equal(edge.stats().puts,0);
console.log('APP518_REAL_R2_TOTAL_GET_BYTES_131007_LE128K=PASS');
// A malformed comma after the last item must NEVER disappear when the
// footer metadata is reassembled without the full items array.
const malformed=fixture([{id:'a',createdAtMs:1}],{trailingComma:true});
await assert.rejects(()=>crawl(malformed),err=>
 err instanceof CatalogR2ContractError518&&
 /APP518_PAGED_TRAILING_COMMA/.test(err.message));
assert.equal(malformed.stats().puts,0);
const foreign=fixture([{id:'a',createdAtMs:1}],{metadataUid:'foreign'});
await assert.rejects(()=>crawl(foreign),err=>err instanceof CatalogR2ContractError518);
assert.equal(foreign.stats().puts,0);
console.log('APP518_STRICT_128K_PAGE_BOUNDARY_80K_PAIR=PASS');
console.log('APP518_LONG_ITEM_CROSS_PAGE_PREFIX_ONLY_RESUME=PASS');
console.log('APP518_MALFORMED_JSON_TRAILING_COMMA_TERMINAL=PASS');
console.log('APP518_FOREIGN_R2_PAGE_DENY_PUT0=PASS');
