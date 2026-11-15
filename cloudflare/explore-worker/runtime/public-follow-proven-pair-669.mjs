// APP669 source-only canonical follow-pair issuer. Intended for the EXISTING
// durable owner-follow replay after its exact settled intent proof succeeds.
// No new public Worker route, poll, schema migration or active binding.
import {verifyOwnerFollowCommitProof557} from './owner-follow-commit-proof-557.mjs';
const UID=/^[A-Za-z0-9_-]{1,128}$/,EPOCH=/^[a-f0-9]{32}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const COUNT_MAX=1_000_000_000;
const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=COUNT_MAX;
const profileKey=uid=>'internal/explore/shared-profile-v113/'+encodeURIComponent(uid)+'.json';
const fail=status=>({status,ready:false});
const safe=(v)=>v&&typeof v==='object'&&!Array.isArray(v);
const extract=(bundle,uid,epoch)=>{
 const profile=bundle?.body?.data?.profile;
 const sync=bundle?.followSync354;
 const count=profile?.followerCount,following=profile?.followingCount;
 if(bundle?.uid!==uid&&profile?.uid!==uid)return null;
 if(profile?.uid!==uid||!Number.isSafeInteger(bundle.revision)||
   bundle.revision<=0||!validCount(count)||!validCount(following)||
   !safe(sync)||sync.exact!==true||!safe(sync.pending)||
   Object.keys(sync.pending).length!==0||
   !EPOCH.test(epoch))return null;
 return {profileUid:uid,generation:epoch,revision:bundle.revision,
  followerCount:count,followingCount:following,public:true,exact:true,pending:0};
};
export async function createVerifiedPublicFollowClaim669({
 reservation,env,now=Date.now,verify=verifyOwnerFollowCommitProof557,
}={}){
 const r=reservation||{},actor=r.actorUid,target=r.ownerUid;
 if(!UID.test(String(actor||''))||!UID.test(String(target||''))||
    actor===target||!OP.test(String(r.operationId||''))||
    typeof r.cutoverToken!=='string'||!r.cutoverToken||
    r.cutoverToken.length>128)return fail('invalid-reservation');
 // This proof reads the *exact* committed pair intent and cutover receipt.
 // A newer unrelated profile edit or another follow is NEVER commit proof.
 const committed=await verify({reservation:r,env});
 if(committed?.committed!==true)return fail(committed?.status||'commit-unverified');
 // Only the two affected public accounts. A private/deleted profile cannot
 // receive a public signal even if it previously had one.
 let rows;
 try{
  const result=await env.DB.prepare(
   'SELECT p.uid AS uid,p.is_public AS isPublic,s.owner_follow_auth_epoch_532 AS epoch '+
   'FROM public_profiles p JOIN profile_stats s ON p.uid=s.uid '+
   'WHERE p.uid IN (?,?) LIMIT 2').bind(actor,target).all();
  rows=result?.results;
 }catch{return fail('public-enrollment-unavailable')}
 if(!Array.isArray(rows)||rows.length!==2)return fail('not-two-public-profiles');
 const byUid=new Map(rows.map(row=>[row.uid,row]));
 if([actor,target].some(uid=>byUid.get(uid)?.isPublic!==1||
    !EPOCH.test(String(byUid.get(uid)?.epoch||''))))
  return fail('public-or-generation-hold');
 let bundles;
 try{
  const files=await Promise.all([actor,target].map(uid=>env.PROFILE_MEDIA.get(profileKey(uid))));
  if(files.some(file=>!file))return fail('r2-missing');
  bundles=await Promise.all(files.map(f=>f.text().then(JSON.parse)));
 }catch{return fail('r2-unavailable')}
 const a=extract(bundles[0],actor,byUid.get(actor).epoch);
 const b=extract(bundles[1],target,byUid.get(target).epoch);
 if(!a||!b)return fail('r2-not-exact');
 if(b.revision<=Number(r.priorR2Revision||0))
  return fail('target-revision-not-advanced');
 const at=Number(now());
 if(!Number.isSafeInteger(at)||at<=0)return fail('invalid-clock');
 return {status:'ready',ready:true,claim:{
  schemaVersion:1,actorUid:actor,targetUid:target,
  cutoverToken:r.cutoverToken,operationId:r.operationId,signedAtMs:at,
  actor:a,target:b,
 },readScope:{d1Rows:2,r2Objects:2}};
}
