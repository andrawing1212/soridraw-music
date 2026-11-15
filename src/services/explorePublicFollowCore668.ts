// APP668 pure public counter contract, intentionally without RTDB imports.
// This remains harmless on TEST/PROD and can be tested without Firebase.
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const GEN=/^[a-f0-9]{32}$/;
const HEX=/^[a-f0-9]{64}$/;
const COUNT_MAX=1_000_000_000;
const MAX_AGE=10*60_000;
export type PublicProfileFollowSignal668={
 profileUid:string;generation:string;revision:number;
 followerCount:number;followingCount:number;
 public:true;commitId:string;at:number;
};
const validCount=(v:unknown):v is number=>typeof v==='number'&&
 Number.isSafeInteger(v)&&v>=0&&v<=COUNT_MAX;
export const normalizePublicProfileFollow668=(raw:unknown,uid:string):PublicProfileFollowSignal668|null=>{
 if(!UID.test(uid)||!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const row=raw as Record<string,unknown>;
 if(Object.keys(row).sort().join(',')!==
  'at,commitId,followerCount,followingCount,generation,profileUid,public,revision'||
  row.profileUid!==uid||typeof row.generation!=='string'||!GEN.test(row.generation)||
  typeof row.commitId!=='string'||!HEX.test(row.commitId)||
  row.public!==true||typeof row.revision!=='number'||
  !Number.isSafeInteger(row.revision)||row.revision<=0||
  !validCount(row.followerCount)||!validCount(row.followingCount)||
  typeof row.at!=='number'||!Number.isSafeInteger(row.at)||row.at<=0)return null;
 return row as PublicProfileFollowSignal668;
};
// Monotonic revision is per profile, not per actor/target follow pair.
// Different account generations must NEVER inherit the prior UID cache.
export const acceptPublicProfileFollow668=(
 previous:PublicProfileFollowSignal668|null,
 incoming:PublicProfileFollowSignal668,
 now=Date.now(),
):boolean=>{
 if(!Number.isSafeInteger(now)||incoming.at>now+60_000||
    now-incoming.at>MAX_AGE)return false;
 if(!previous)return true;
 if(previous.profileUid!==incoming.profileUid||
    previous.generation!==incoming.generation)return false;
 return incoming.revision>previous.revision;
};
