// app518 UNWIRED Cloudflare R2 provider. Not imported in deployed index.js.
// Protect the shared CATALOG v5 Music Note journal, never MEDIA or favorites.
// No automatic bootstrap, base overwrite, bucket creation or full-user scan.
// All three deployed media Workers MUST have the canonical cutover installed
// before SORIDRAW_CANONICAL_CATALOG_518 may be enabled in ANY environment.
import {
 isValidCatalogJournal,materializeCatalogJournal,
 CATALOG_JOURNAL_MAX_BYTES,
} from './catalogJournal.js';
// Only verified owner/schema/authority failures are permanent. Ordinary
// get()/put() network failures remain retryable; never infer from messages.
export class CatalogR2ContractError518 extends Error {
 constructor(code){super(code);this.name='CatalogR2ContractError518';}
}
const txt=x=>typeof x==='string'?x.trim():'';
const validUid=x=>txt(x).length>0&&txt(x).length<=128&&!/[\\/]/.test(txt(x));
const key=uid=>'catalog/v5/'+encodeURIComponent(uid)+'/musicNote/journal.json';
const prefix=uid=>'catalog/v5/'+encodeURIComponent(uid)+'/musicNote/';
const cutover=env=>env?.SORIDRAW_CANONICAL_CATALOG_518==='ENABLED_AFTER_SHARED_ROLLOUT'
 &&env?.CATALOG?.get&&env?.CATALOG?.put;
const checkBody=obj=>obj&&obj.customMetadata?.uid;
const strictHead=async(object,uid)=>{
 if(!object||!checkBody(object)||object.customMetadata.uid!==uid
   ||object.customMetadata.kind!=='musicNote'||!txt(object.etag)
   ||Number(object.size)>CATALOG_JOURNAL_MAX_BYTES)return null;
 // Reading R2 bytes is fallible IO; invalid bytes are a permanent
 // contract failure only after a successful read.
 const body=await object.text();
 try{
  const head=JSON.parse(body);
  if(!isValidCatalogJournal(head,'musicNote')
    ||head.canonicalAuthority518!==true
    ||Number(object.customMetadata.revision)!==head.headRevision
    ||Number(object.customMetadata.itemCount)!==head.itemCount
    ||Number(object.customMetadata.baseRevision)!==head.baseRevision)
    return null;
  return {head,etag:object.etag};
 }catch{return null;}
};

// Shared-fence provenance comes from the server's verified release contract,
// never a browser header or Firebase user token. Local flag is a separate
// safety gate. If either is absent, source remains inert.
export const createOwnerR2Provider518=({
 env,sharedReleaseFencesVerified=false,
}={})=>{
 const enabled=cutover(env)&&sharedReleaseFencesVerified===true;
 const blocked=()=>{throw new CatalogR2ContractError518('APP518_SHARED_R2_CUTOVER_NOT_APPROVED');};
 const readOwnerHead=async uid=>{
  if(!enabled||!validUid(uid))blocked();
  const object=await env.CATALOG.get(key(uid));
  const result=await strictHead(object,uid);
  if(!result)throw new CatalogR2ContractError518('APP518_R2_HEAD_UNKNOWN_OR_CORRUPT');
  return {verifiedByServer:true,ownerUid:uid,
    fencedWritersVerified:true,head:result.head,etag:result.etag};
 };
 const storeHeadIfEtag=async({uid,expectedEtag,nextHead,
   sourceVersionNs,documentId}={})=>{
  if(!enabled||!validUid(uid)||!txt(expectedEtag)
    ||!txt(documentId)||!/^\d{21}$/.test(txt(sourceVersionNs))
    ||!isValidCatalogJournal(nextHead,'musicNote')
    ||nextHead.canonicalAuthority518!==true)
    blocked();
  const expectedMutation='canonical518:'+documentId+':'+sourceVersionNs;
  if(!nextHead.recentMutations?.some(m=>m.id===expectedMutation))
    throw new Error('APP518_R2_MUTATION_VERSION_NOT_PRESENT');
  const body=JSON.stringify(nextHead);
  if(new TextEncoder().encode(body).length>CATALOG_JOURNAL_MAX_BYTES)
    throw new Error('APP518_R2_COMPACT_REQUIRED');
  const stored=await env.CATALOG.put(key(uid),body,{
    onlyIf:{etagMatches:expectedEtag},
    httpMetadata:{contentType:'application/json; charset=utf-8',
      cacheControl:'private, no-store'},
    customMetadata:{
      uid,kind:'musicNote',baseRevision:String(nextHead.baseRevision),
      revision:String(nextHead.headRevision),itemCount:String(nextHead.itemCount),
      deltaCount:String(nextHead.deltas.length),authority:'server',
    },
  });
  return {casCommitted:Boolean(stored?.etag),
    ownerVerified:Boolean(stored?.etag)};
 };
 const loadCompleteFencedOwnerR2=async({
  uid,projectItem,sortItems,
 }={})=>{
  if(!enabled||!validUid(uid)||typeof projectItem!=='function'
    ||typeof sortItems!=='function')blocked();
  const before=await readOwnerHead(uid);
  const baseKey=before.head.baseKey;
  if(!txt(baseKey).startsWith(prefix(uid))||
    !txt(baseKey).endsWith('.json'))throw new CatalogR2ContractError518('APP518_FOREIGN_BASE_KEY');
  const object=await env.CATALOG.get(baseKey);
  if(!object||object.customMetadata?.uid!==uid||
    object.customMetadata?.kind!=='musicNote')
    throw new CatalogR2ContractError518('APP518_MISSING_OR_FOREIGN_BASE');
  // Transient stream failure must escape as retryable IO. Only parsing
  // successfully read bytes proves permanently invalid JSON.
  const baseBody=await object.text();
  let base;
  try{base=JSON.parse(baseBody);}catch{
    throw new CatalogR2ContractError518('APP518_BASE_INVALID_JSON');
  }
  if(base?.schemaVersion!==4||base?.authority!=='server'
    ||base?.kind!=='musicNote'||base.complete!==true
    ||!Array.isArray(base.items)||base.revision!==before.head.baseRevision
    ||base.itemCount!==before.head.baseItemCount)
    throw new CatalogR2ContractError518('APP518_BASE_INVALID');
  const materialized=materializeCatalogJournal({
    baseSnapshot:base,head:before.head,projectItem,sortItems,
  });
  if(!materialized||materialized.itemCount>20000
    ||materialized.items.length!==before.head.itemCount)
    throw new CatalogR2ContractError518('APP518_BASE_MATERIALIZE_INVALID_OR_OVERSIZED');
  const after=await readOwnerHead(uid);
  if(before.etag!==after.etag||
    before.head.headRevision!==after.head.headRevision)
    throw new Error('APP518_OWNER_HEAD_CHANGED_DURING_MATERIALIZE');
  return {kind:'musicNote',complete:true,ownerUid:uid,
    verifiedByServer:true,fencedWritersVerified:true,
    etag:before.etag,head:{...before.head,etag:before.etag},
    items:materialized.items};
 };
 return {enabled,readOwnerHead,storeHeadIfEtag,
   loadCompleteFencedOwnerR2};
};
