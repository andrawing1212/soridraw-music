// app518 isolated CAS prototype. NOT imported by live Worker and not deployable.
// One existing conditional R2 journal HEAD holds the source clock/tombstone and
// the Catalog delta together; no extra Firestore ledger write in this model.
// All legacy writers must be fenced and head capacity proved before activation.
import {
  appendCatalogJournalDelta, catalogJournalEncodedBytes, isValidCatalogJournal,
  materializeCatalogJournal, CATALOG_JOURNAL_MAX_BYTES,
} from './catalogJournal.js';
import { decideCanonicalCatalogMutation518 } from './catalogCanonicalFence518.js';

const txt=x=>typeof x==='string'?x.trim():'';
const maxAttempts=3;

export const reconcileExactCanonicalWithJournal518=async ({
  uid,id,loadState,readExactCanonical,storeIfEtag,
  projectItem,sortItems,now=Date.now,
}={})=>{
  if(!txt(uid)||!txt(id)||id.length>240||/[\\/]/.test(id)
    ||![loadState,readExactCanonical,storeIfEtag,projectItem,sortItems].every(x=>typeof x==='function')){
    return {code:'DENY_ARGUMENTS',reads:0,puts:0};
  }
  let reads=0,puts=0;
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const state=await loadState(uid);
    if(!state||!isValidCatalogJournal(state.head,'musicNote')
      ||!txt(state.etag)||!state.base){
      return {code:'DENY_UNMATERIALIZED',reads,puts};
    }
    const ledger=state.head.sourceLedger518??{};
    if(!ledger||typeof ledger!=='object'||Array.isArray(ledger)){
      return {code:'DENY_LEDGER',reads,puts};
    }
    const snap=materializeCatalogJournal({
      baseSnapshot:state.base,head:state.head,projectItem,sortItems,
    });
    if(!snap||!Array.isArray(snap.items)||snap.itemCount!==state.head.itemCount){
      return {code:'DENY_CATALOG',reads,puts};
    }
    // Always re-read on each CAS conflict. A Firestore event.after is NEVER
    // canonical authority after another device has changed the same item.
    const canonical=await readExactCanonical(uid,id);
    reads++;
    const decision=decideCanonicalCatalogMutation518({
      expectedUid:uid,expectedDocumentId:id,
      canonical,ledger:ledger[id]??null,
    });
    if(decision.code!=='APPLY') return {code:decision.code,reads,puts};
    const present=snap.items.some(item=>txt(item?.id)===id);
    const saved=canonical.state==='saved';
    const projected=saved?projectItem(canonical.item,id):null;
    if(saved&&(!projected||txt(projected.id)!==id)){
      return {code:'DENY_PROJECTION',reads,puts};
    }
    const revision=Math.max(Math.floor(Number(now())||0),state.head.headRevision+1);
    const delta={
      mutationId:'canonical518:'+id+':'+decision.nextLedger.sourceVersionNs,
      baseRevision:state.head.headRevision,baseItemCount:state.head.itemCount,
      revision,nextItemCount:state.head.itemCount+(saved&&!present?1:0)-(!saved&&present?1:0),
      upserts:saved?[projected]:[],deletedIds:!saved&&present?[id]:[],
    };
    const appended=appendCatalogJournalDelta({
      head:state.head,delta,serverRevision:revision,now:now(),
    });
    if(!appended.ok||appended.duplicate){
      return {code:'DENY_APPEND_'+(appended.reason||'DUPLICATE'),reads,puts};
    }
    const nextHead={...appended.head,
      sourceLedger518:{...ledger,[id]:decision.nextLedger}};
    if(catalogJournalEncodedBytes(nextHead)>CATALOG_JOURNAL_MAX_BYTES){
      return {code:'DENY_HEAD_CAPACITY',reads,puts};
    }
    puts++;
    const success=await storeIfEtag({uid,etag:state.etag,head:nextHead});
    if(success) return {code:'APPLIED',reads,puts,
      revision:nextHead.headRevision,itemCount:nextHead.itemCount};
    // ETag mismatch: discard both old head and old Firestore snapshot.
  }
  return {code:'RETRYABLE_CONFLICT',reads,puts};
};
