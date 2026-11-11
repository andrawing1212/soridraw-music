// APP562: source-only candidate. Never imported by the active canonical
// Worker. Do not change the byte-pinned APP543 release worker for a cost trial.
// Late-crash replay can sometimes settle only the pending pair receipt after
// both endpoint profiles already certify exact counts and canonical membership
// agrees. All provider reads/writes are supplied by an isolated caller.
export const APP562_R2_REPLAY_FAST_SETTLE_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const fail=status=>({settled:false,status,r2Writes:0});
const clean=(state,token)=>state?.sync?.exact===true&&
 state.sync.token===token&&state.sync.pending&&
 typeof state.sync.pending==='object'&&!Array.isArray(state.sync.pending)&&
 Object.keys(state.sync.pending).length===0;
export async function trySettleCompletedFollowIntent562({
 env,operation,cutover,readProfile,readMembership,readIntent,
 enabled=APP562_R2_REPLAY_FAST_SETTLE_COMPILED_OPEN,
}={}){
 if(!enabled)return fail('disabled');
 if(!env?.PROFILE_MEDIA?.put||!cutover?.cutoverToken||
    operation?.settled!==false||operation.token!==cutover.cutoverToken||
    !UID.test(String(operation.actor||''))||
    !UID.test(String(operation.target||''))||
    operation.actor===operation.target||
    !OP.test(String(operation.id||''))||
    typeof operation.following!=='boolean'||
    !Number.isSafeInteger(operation.revision)||operation.revision<=0||
    !Number.isSafeInteger(operation.expectedRevision)||operation.expectedRevision<0||
    typeof readProfile!=='function'||typeof readMembership!=='function'||
    typeof readIntent!=='function')
  return fail('invalid');
 let receipt;
 try{
  const actor=await readProfile(env,operation.actor,cutover);
  if(!clean(actor,cutover.cutoverToken))return fail('actor-not-exact');
  const target=await readProfile(env,operation.target,cutover);
  if(!clean(target,cutover.cutoverToken))return fail('target-not-exact');
  // D1 is authoritative; a higher R2 revision is not proof of a follow.
  const relation=await readMembership(env,operation.actor,operation.target,cutover);
  if(relation?.following!==operation.following)
   return fail('relation-not-committed');
  receipt=await readIntent(env,cutover,operation.actor,operation.target);
  if(!receipt?.object?.etag||!receipt?.key||
     receipt.value?.settled!==false||
     receipt.value.token!==cutover.cutoverToken||
     receipt.value.actor!==operation.actor||
     receipt.value.target!==operation.target||
     receipt.value.id!==operation.id||
     receipt.value.revision!==operation.revision||
     receipt.value.expectedRevision!==operation.expectedRevision||
     receipt.value.following!==operation.following)
   return fail('intent-superseded');
 }catch{return fail('proof-unavailable')}
 try{
  const saved=await env.PROFILE_MEDIA.put(receipt.key,
   JSON.stringify({...receipt.value,settled:true}),{
    onlyIf:{etagMatches:receipt.object.etag},
    httpMetadata:{contentType:'application/json; charset=utf-8'},
   });
  return saved?{settled:true,status:'settled-replay',r2Writes:1}:
   fail('intent-cas-contention');
 }catch{return fail('intent-write-unavailable')}
}
