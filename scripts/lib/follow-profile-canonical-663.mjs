// APP663 SOURCE-ONLY exact per-public-profile follow signal contract.
// Same committed pair ID, distinct subject R2 revisions. No network effects.
import {createHash} from 'node:crypto';
const UID=/^[A-Za-z0-9_-]{1,128}$/,HEX=/^[a-f0-9]{64}$/,GEN=/^[a-f0-9]{32}$/;
const integer=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const count=n=>integer(n)&&n<=1_000_000_000;
export const edgeCommitId663=({cutoverToken,actorUid,targetUid,operationId})=>{
 if(typeof cutoverToken!=='string'||!cutoverToken||!UID.test(actorUid||'')||
  !UID.test(targetUid||'')||actorUid===targetUid||
  !/^[a-zA-Z0-9_-]{16,128}$/.test(operationId||''))return null;
 return createHash('sha256').update(JSON.stringify(
  ['follow663',cutoverToken,actorUid,targetUid,operationId]
 )).digest('hex');
};
export const normalizePublicFollowSignal663=raw=>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 if(Object.keys(raw).sort().join(',')!==
  'at,commitId,followerCount,followingCount,generation,profileUid,public,revision')
  return null;
 if(!UID.test(raw.profileUid||'')||!HEX.test(raw.commitId||'')||
  !GEN.test(raw.generation||'')||raw.public!==true||
  !Number.isSafeInteger(raw.revision)||raw.revision<=0||
  !count(raw.followerCount)||!count(raw.followingCount)||
  !Number.isSafeInteger(raw.at)||raw.at<=0)return null;
 return {...raw};
};
export const composePublicFollowPair663=({
 actorUid,targetUid,cutoverToken,operationId,at,actor,target
})=>{
 const commitId=edgeCommitId663({cutoverToken,actorUid,targetUid,operationId});
 if(!commitId||!integer(at)||at<=0)return null;
 const encode=(uid,data)=>normalizePublicFollowSignal663({
  profileUid:uid,generation:data?.generation,revision:data?.revision,
  followerCount:data?.followerCount,followingCount:data?.followingCount,
  public:data?.public,commitId,at
 });
 const a=encode(actorUid,actor),t=encode(targetUid,target);
 if(!a||!t||actor?.exact!==true||target?.exact!==true||
  actor?.pending!==0||target?.pending!==0)return null;
 return {commitId,actor:a,target:t};
};
// Account-generation change requires separate server-side lifecycle proof.
export const reconcilePublicFollowSignal663=(oldRaw,newRaw)=>{
 const incoming=normalizePublicFollowSignal663(newRaw);
 if(!incoming)return {status:'invalid',next:oldRaw??null};
 const old=normalizePublicFollowSignal663(oldRaw);
 if(!old)return {status:'apply',next:incoming};
 if(old.profileUid!==incoming.profileUid)return {status:'wrong-subject',next:old};
 if(old.generation!==incoming.generation)return {status:'generation-hold',next:old};
 if(incoming.revision<old.revision)return {status:'stale',next:old};
 if(incoming.revision===old.revision)return incoming.commitId===old.commitId&&
  incoming.followerCount===old.followerCount&&incoming.followingCount===old.followingCount
  ?{status:'duplicate',next:old}:{status:'same-revision-conflict',next:old};
 return {status:'apply',next:incoming};
};
