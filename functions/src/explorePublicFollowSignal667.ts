// APP667 — source-only public-profile follow counter publisher.
// This is NOT an HTTP endpoint or deployed server function. The caller must
// independently prove the exact settled R2 actor+target pair and sign it with
// a server-held secret. Never invoke for an optimistic/unsettled follow.
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {Database} from 'firebase-admin/database';

const UID667=/^[A-Za-z0-9_-]{1,128}$/;
const GEN667=/^[a-f0-9]{32}$/;
const HEX667=/^[a-f0-9]{64}$/;
const OP667=/^[A-Za-z0-9_-]{16,128}$/;
const count667=(v:unknown):v is number=>
 typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=1_000_000_000;
type RawProfile667={
 profileUid:string;generation:string;revision:number;
 followerCount:number;followingCount:number;
 public:true;exact:true;pending:0;
};
type Claim667={
 schemaVersion:1;actorUid:string;targetUid:string;
 cutoverToken:string;operationId:string;signedAtMs:number;
 actor:RawProfile667|null;target:RawProfile667;
};
export type PublicFollowSignal667={
 profileUid:string;generation:string;revision:number;
 followerCount:number;followingCount:number;
 public:true;commitId:string;at:number;
};
const keys667=(v:Record<string,unknown>,names:string)=>
 Object.keys(v).sort().join(',')===names;
const validateProfile667=(v:unknown,uid:string):v is RawProfile667=>{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const p=v as Record<string,unknown>;
 return keys667(p,'exact,followerCount,followingCount,generation,pending,profileUid,public,revision')&&
  p.profileUid===uid&&typeof p.generation==='string'&&GEN667.test(p.generation)&&
  typeof p.revision==='number'&&Number.isSafeInteger(p.revision)&&p.revision>0&&
  count667(p.followerCount)&&count667(p.followingCount)&&
  p.public===true&&p.exact===true&&p.pending===0;
};
const parseClaim667=(raw:string,signature:string,secret:string,nowMs:number):Claim667=>{
 if(!raw||Buffer.byteLength(raw,'utf8')>2048||
   typeof secret!=='string'||secret.length<32||!HEX667.test(signature||'')||
   !Number.isSafeInteger(nowMs)||nowMs<=0)throw Error('667_INVALID_AUTH');
 const expected=createHmac('sha256',secret).update(raw,'utf8').digest();
 const given=Buffer.from(signature,'hex');
 if(given.length!==expected.length||!timingSafeEqual(expected,given))
   throw Error('667_INVALID_SIGNATURE');
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{throw Error('667_INVALID_JSON');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))
   throw Error('667_INVALID_PAYLOAD');
 const c=parsed as Record<string,unknown>;
 if(!keys667(c,'actor,actorUid,cutoverToken,operationId,schemaVersion,signedAtMs,target,targetUid')||
    c.schemaVersion!==1||typeof c.actorUid!=='string'||!UID667.test(c.actorUid)||
    typeof c.targetUid!=='string'||!UID667.test(c.targetUid)||
    c.actorUid===c.targetUid||typeof c.cutoverToken!=='string'||
    !c.cutoverToken||c.cutoverToken.length>128||
    typeof c.operationId!=='string'||!OP667.test(c.operationId)||
    typeof c.signedAtMs!=='number'||!Number.isSafeInteger(c.signedAtMs)||
    c.signedAtMs<=0||Math.abs(nowMs-c.signedAtMs)>300_000||
    (c.actor!==null&&!validateProfile667(c.actor,c.actorUid))||
    !validateProfile667(c.target,c.targetUid))
   throw Error('667_UNVERIFIED_PUBLIC_PAIR');
 return c as Claim667;
};
const validStored667=(raw:unknown):raw is PublicFollowSignal667=>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const v=raw as Record<string,unknown>;
 return keys667(v,'at,commitId,followerCount,followingCount,generation,profileUid,public,revision')&&
  typeof v.profileUid==='string'&&UID667.test(v.profileUid)&&
  typeof v.generation==='string'&&GEN667.test(v.generation)&&
  typeof v.commitId==='string'&&HEX667.test(v.commitId)&&
  typeof v.revision==='number'&&Number.isSafeInteger(v.revision)&&v.revision>0&&
  typeof v.at==='number'&&Number.isSafeInteger(v.at)&&v.at>0&&
  v.public===true&&count667(v.followerCount)&&count667(v.followingCount);
};
const applyOne667=async(db:Pick<Database,'ref'>,candidate:PublicFollowSignal667)=>{
 let state:'applied'|'duplicate'|'stale'='applied';
 const ref=db.ref('publicSync/exploreFollowProfiles667/'+candidate.profileUid);
 const result=await ref.transaction((prior:unknown)=>{
  state='applied';
  if(prior===null||prior===undefined)return candidate;
  if(!validStored667(prior)||prior.profileUid!==candidate.profileUid)
   throw Error('667_CORRUPT_EXISTING_SIGNAL');
  if(prior.generation!==candidate.generation)
   throw Error('667_AUTH_GENERATION_HOLD');
  if(prior.revision>candidate.revision){state='stale';return;}
  if(prior.revision===candidate.revision){
   if(prior.commitId===candidate.commitId&&
      prior.followerCount===candidate.followerCount&&
      prior.followingCount===candidate.followingCount){
     state='duplicate';return;
   }
   throw Error('667_SAME_REVISION_CONFLICT');
  }
  return candidate;
 },undefined,false);
 if(result.committed)return 'applied' as const;
 if(state==='applied')throw Error('667_TRANSACTION_NOT_COMMITTED');
 return state;
};
/**
 * Must only be called by a separately authenticated PREVIEW issuer after
 * verifying the canonical operation receipt and both R2 profiles are settled.
 * Two independent profile revisions; one pair commitId. Partial success must
 * return an error to the existing durable retry owner — never silently ACK.
 */
export const publishPublicFollowPair667=async(
 db:Pick<Database,'ref'>,raw:string,signature:string,secret:string,
 nowMs=Date.now(),
)=>{
 const claim=parseClaim667(raw,signature,secret,nowMs);
 const commitId=createHash('sha256').update(JSON.stringify(
  ['follow663',claim.cutoverToken,claim.actorUid,claim.targetUid,claim.operationId]
 )).digest('hex');
 const row=(p:RawProfile667):PublicFollowSignal667=>({
  profileUid:p.profileUid,generation:p.generation,revision:p.revision,
  followerCount:p.followerCount,followingCount:p.followingCount,
  public:true,commitId,at:nowMs,
 });
 // If the second transaction fails, the issuer must retry the same signed
 // canonical operation; the first path is an idempotent duplicate.
 // A private or unlisted actor has no public aggregate signal path. Their
 // verified intent still increments/decrements the PUBLIC target correctly.
 const actor=claim.actor?await applyOne667(db,row(claim.actor)):'skipped-private';
 const target=await applyOne667(db,row(claim.target));
 // Each Firebase transaction may consume an RTDB read; do not report R0.
 return {commitId,actor,target,d1Reads:0,rtdbTransactions:claim.actor?2:1};
};
