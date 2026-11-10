// APP557: authenticated PREVIEW-only follow pre-commit reservation boundary.
// SOURCE ONLY: compiled OFF, no active DO binding, no live migration.
// This deliberately does NOT edit the frozen canonical overlay 354 writer.
// The canonical mutation is invoked only after the durable reservation ACK.
export const APP557_OWNER_PRECOMMIT_COMPILED_OPEN=false;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const fail=(status)=>Response.json({ok:false,error:{
 code:'OWNER_FOLLOW_RESERVATION_REQUIRED_557',message:'팔로우 저장 준비를 확인해 주세요.',
 detail:status}}, {status:503});
const readJson=async obj=>JSON.parse(await obj.text());
const keyProfile=uid=>'internal/explore/shared-profile-v113/'+encodeURIComponent(uid)+'.json';
const keyIntent=(token,actor,owner)=>'internal/explore/follow-intents-v354/'+
 encodeURIComponent(token)+'/'+encodeURIComponent(actor)+'/'+encodeURIComponent(owner)+'.json';
export async function runOwnerFollowPrecommit557({
 request,env,ctx,authenticate,callCanonical,reserve,
 enabled=APP557_OWNER_PRECOMMIT_COMPILED_OPEN,
}={}){
 if(typeof callCanonical!=='function')throw Error('557_CANONICAL_REQUIRED');
 if(!enabled||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555!=='1')
  return callCanonical();
 const url=new URL(request.url);
 const parts=url.pathname.split('/');
 if(parts.length!==5||parts[1]!=='v1'||parts[2]!=='profiles'||
    parts[4]!=='follow'||!UID.test(parts[3])||
    (request.method!=='PUT'&&request.method!=='DELETE'))
  return callCanonical();
 let body;
 try{body=await request.clone().json()}catch{return callCanonical()}
 if(!OP.test(String(body?.followOperationId||''))||
    !Number.isSafeInteger(body?.followExpectedRevision)||
    body.followExpectedRevision<0)return callCanonical();
 if(typeof authenticate!=='function'||typeof reserve!=='function')return fail('unconfigured');
 let auth;
 try{auth=await authenticate(request,env,ctx)}
 catch{return fail('authentication-unavailable')}
 if(!auth?.ok)return auth?.response||fail('authentication-failed');
 if(!UID.test(String(auth.uid||''))||auth.uid===parts[3])
  return callCanonical(); // canonical owns its SELF_FOLLOW validation
 const media=env?.PROFILE_MEDIA;
 if(!media||typeof media.get!=='function')return fail('r2-unavailable');
 let manifest,profile,intent;
 try{
  const m=await media.get('internal/explore/follow-cutover-v348/active.json');
  if(!m)return fail('cutover-unavailable');
  manifest=await readJson(m);
  if(manifest?.relationMode!=='overlay348'||manifest?.writeMode!=='active'||
     manifest?.profileCountsR2Exact!==true||
     manifest?.crashConsistentWriter354!==true||
     manifest?.orderedClientRequests354!==true||
     manifest?.legacyRelationWritersFrozen!==true||
     manifest?.legacyCounterWritersFrozen!==true||
     typeof manifest.cutoverToken!=='string'||
     !manifest.cutoverToken||manifest.cutoverToken.length>128)return fail('cutover-not-ready');
  const p=await media.get(keyProfile(parts[3]));
  if(!p)return fail('profile-unavailable');
  profile=await readJson(p);
  const v=profile?.followSync354;
  if(profile?.body?.data?.profile?.uid!==parts[3]||
     !Number.isSafeInteger(profile.revision)||profile.revision<=0||
     v?.token!==manifest.cutoverToken||v?.exact!==true||
     !v.pending||typeof v.pending!=='object'||
     Object.keys(v.pending).length!==0)return fail('profile-not-exact');
  const ip=await media.get(keyIntent(manifest.cutoverToken,auth.uid,parts[3]));
  intent=ip?await readJson(ip):null;
  if(intent&&(!intent.settled||intent.token!==manifest.cutoverToken||
     intent.actor!==auth.uid||intent.target!==parts[3]))return fail('intent-not-settled');
  if(Number(intent?.revision||0)!==body.followExpectedRevision)
   return fail('intent-revision-stale');
 }catch{return fail('preflight-read-unavailable')}
 let row;
 try{
  // One bounded indexed/current relation+enrollment read. The actor UID is
  // verified by Firebase auth, never trusted from the request body.
  row=await env.DB.prepare(`SELECT
   owner_follow_auth_epoch_532 AS epoch,
   EXISTS(SELECT 1 FROM follows WHERE follower_uid=? AND following_uid=?) AS baseline,
   (SELECT following FROM explore_follow_overrides_348
      WHERE follower_uid=? AND following_uid=? LIMIT 1) AS override_following
   FROM profile_stats WHERE uid=? LIMIT 1`)
   .bind(auth.uid,parts[3],auth.uid,parts[3],parts[3]).first();
 }catch{return fail('owner-enrollment-unavailable')}
 if(!/^[0-9a-f]{32}$/.test(String(row?.epoch||'')))
  return fail('owner-not-enrolled');
 const beforeFollowing=row.override_following===null||
   row.override_following===undefined?Boolean(row.baseline):
   Number(row.override_following)===1;
 const desired=request.method==='PUT';
 if(beforeFollowing===desired)return callCanonical(); // noop: no DO write
 const ticket={ownerUid:parts[3],actorUid:auth.uid,
   authEpoch:String(row.epoch),operationId:body.followOperationId,
   expectedRevision:body.followExpectedRevision,
   cutoverToken:manifest.cutoverToken,desired,beforeFollowing,
   priorR2Revision:profile.revision};
 let result;
 try{result=await reserve(ticket,env)}
 catch{return fail('reservation-unavailable')}
 if(result?.ok!==true)return fail(result?.status||'reservation-rejected');
 // If canonical fails, do NOT infer no commit and clear this ticket. A 503
 // may occur after an R2/D1 change; alarm checks the exact settled pair ID.
 return callCanonical();
}
