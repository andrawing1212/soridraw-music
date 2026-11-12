// APP563 offline feasibility prototype; NOT a Worker/DO implementation.
// Two final R2 profile PUTs are possible only if EVERY profile reader uses an
// authoritative per-profile generation fence. Such a fence requires a new D1
// write/read contract (or DO read on every profile view) and breaks frozen 354.
// The candidate is permanently source-only and cannot be enabled with a flag.
export const APP563_REDUCED_R2_SOURCE_ONLY=true;
export const APP563_LIVE_ACTIVATION_ALLOWED=false;
const fail=(status)=>({ok:false,status});
export function createIsolatedR2PostcommitModel563(){
 const ledger={r2Read:0,r2Put:0,d1Read:0,d1Write:0,doRead:0,doWrite:0,doAlarm:0,ownerSignals:0};
 const canonical=new Map(),profiles=new Map(),r2=new Map(),journal=new Map();
 const pair=(actor,owner)=>JSON.stringify([actor,owner]);
 const addUser=uid=>{if(profiles.has(uid))return;profiles.set(uid,{generation:0,
  followers:0,following:0});r2.set(uid,{generation:0,followers:0,following:0,
   exact:true,profileField:'unmodified'});};
 const stored=(uid)=>{const x=r2.get(uid);return x&&{...x}};
 const getCanonical=(uid)=>{ledger.d1Read++;return {...profiles.get(uid)}};
 function reserve({actor,owner,id,following}){
  if(typeof actor!=='string'||typeof owner!=='string'||actor===owner||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(String(id||''))||
    typeof following!=='boolean')return fail('invalid');
  addUser(actor);addUser(owner);
  ledger.doRead++;
  const other=[...journal.values()].find(x=>x.actor===actor&&x.owner===owner&&
   x.status!=='delivered'&&x.id!==id);
  if(other)return fail('same-pair-pending');
  const previous=journal.get(id);
  if(previous){
   if(previous.actor!==actor||previous.owner!==owner||previous.following!==following)
    return fail('id-conflict');
   return {ok:true,status:'duplicate'};
  }
  journal.set(id,{id,actor,owner,following,status:'reserved',changed:null});
  ledger.doWrite++;ledger.doAlarm++;
  return {ok:true,status:'reserved'};
 }
 function commit(id,{crashBeforeJournalAck=false}={}){
  const t=journal.get(id);
  if(!t)return fail('not-reserved');
  const key=pair(t.actor,t.owner);
  let edge=canonical.get(key);
  if(edge?.id===id){
   t.changed=edge.changed;
   if(!crashBeforeJournalAck){t.status='committed';ledger.doWrite++;}
   return {ok:true,status:'recovered-d1-commit'};
  }
  if(t.status!=='reserved')return fail('invalid-stage');
  const prior=edge?.following===true,desired=t.following;
  const changed=prior!==desired;
  // Synthetic atomic D1 batch: one canonical relation, plus two durable
  // per-profile generations + exact counters (which original v354 does NOT
  // maintain). Even zero-change new operation requires a sequence receipt.
  canonical.set(key,{id,following:desired,changed,revision:(edge?.revision||0)+1});
  ledger.d1Write++;
  if(changed)for(const [uid,side] of [[t.actor,'following'],[t.owner,'followers']]){
   const p=profiles.get(uid);p[side]+=desired?1:-1;p.generation++;
   ledger.d1Write++;
  }
  t.changed=changed;
  if(crashBeforeJournalAck)throw Error('SYNTHETIC_CRASH_AFTER_D1_COMMIT');
  t.status='committed';ledger.doWrite++;
  return {ok:true,status:changed?'committed':'noop'};
 }
 function readLegacy(uid){
  ledger.r2Read++;
  return stored(uid); // original v354 trusts exact; no D1 generation check.
 }
 function readFenced(uid){
  ledger.r2Read++;
  const row=stored(uid),truth=getCanonical(uid);
  if(!row||!truth)return fail('unknown');
  if(row.generation!==truth.generation)
   return {ok:false,status:'stale-after-commit',canonicalGeneration:truth.generation};
  return {ok:true,status:'exact',profile:row};
 }
 function materialize(id,uid,{raceOnce=false}={}){
  const t=journal.get(id);
  if(!t||t.status==='reserved')return fail('uncommitted');
  if(uid!==t.actor&&uid!==t.owner)return fail('unrelated-profile');
  const truth=getCanonical(uid);
  const prev=readLegacy(uid);
  if(!truth||!prev)return fail('missing-profile');
  if(prev.generation>truth.generation)return fail('future-profile');
  if(prev.generation===truth.generation)return {ok:true,status:'already-current'};
  // This corresponds to a CAS PUT carrying the authoritative target
  // generation and all profile fields; an R2 race would retry from the
  // latest GET (not silently overwrite a user profile edit).
  if(raceOnce)return fail('cas-conflict-retry-needed');
  r2.set(uid,{...prev,followers:truth.followers,following:truth.following,
   generation:truth.generation,exact:true});
  ledger.r2Put++;
  return {ok:true,status:'materialized'};
 }
 function signal(id){
  const t=journal.get(id);
  if(!t||t.status==='reserved')return fail('uncommitted');
  if(r2.get(t.actor).generation!==profiles.get(t.actor).generation||
     r2.get(t.owner).generation!==profiles.get(t.owner).generation)
   return fail('both-profiles-not-materialized');
  if(t.status==='delivered')return {ok:true,status:'already-delivered'};
  t.status='delivered';ledger.doWrite++;
  if(t.changed===false)return {ok:true,status:'noop-no-signal'};
  ledger.ownerSignals++;
  const current=r2.get(t.owner);
  return {ok:true,status:'delivered',ownerVersion:current.generation,
   followerCount:current.followers,operationId:id};
 }
 return {ledger,reserve,commit,readLegacy,readFenced,materialize,signal,
  getRevision:(actor,owner)=>canonical.get(pair(actor,owner))?.revision||0,
  current:(uid)=>({...profiles.get(uid)}),
  pending:()=>[...journal.values()].filter(x=>x.status!=='delivered'),
  getCanonical,
 };
}
