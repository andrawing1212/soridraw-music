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
 // APP579: older browsers (including the first negotiation request from
 // APP354) may send no operation fields. Never silently skip an enrolled
 // owner's durable signal if the canonical writer accepts that request.
 // Explicit malformed/partial versioned envelopes still go to the unchanged
 // canonical validator; they are never repaired from client-controlled data.
 let body,unversioned=false;
 try{
  const raw=await request.clone().text();
  body=raw.trim()?JSON.parse(raw):{};
  unversioned=body&&typeof body==='object'&&!Array.isArray(body)&&
   Object.keys(body).length===0;
 }catch{return callCanonical()}
 const ordered=OP.test(String(body?.followOperationId||''))&&
   Number.isSafeInteger(body?.followExpectedRevision)&&
   body.followExpectedRevision>=0;
 if(!ordered&&!unversioned)return callCanonical();
 if(typeof authenticate!=='function'||typeof reserve!=='function')return fail('unconfigured');
 let auth;
 try{auth=await authenticate(request,env,ctx)}
 catch{return fail('authentication-unavailable')}
 if(!auth?.ok)return auth?.response||fail('authentication-failed');
 if(!UID.test(String(auth.uid||''))||auth.uid===parts[3])
  return callCanonical(); // canonical owns its SELF_FOLLOW validation
 // A valid same-state request goes to the frozen canonical Writer. This
 // exact relation query is already needed for changed reservations; putting it
 // first saves cutover/profile/intent R2 GETs for the common no-op case.
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
 // Unenrolled owners MUST keep the exact existing canonical follow Writer.
 // A globally enabled PREVIEW push must not reject their normal follows.
 if(!row||row.epoch==='')return callCanonical();
 // Missing/corrupt non-empty epoch is not an opt-out: fail closed.
 if(!/^[0-9a-f]{32}$/.test(String(row.epoch||'')))
  return fail('owner-epoch-invalid');
 const beforeFollowing=row.override_following===null||
   row.override_following===undefined?Boolean(row.baseline):
   Number(row.override_following)===1;
 const desired=request.method==='PUT';
 if(beforeFollowing===desired)return callCanonical(); // canonical still validates/repairs exact no-op

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
  // Check exact pair intent before reading owner profile. Canonical owns the
  // retry of an already reserved operation; no redundant owner R2 GET.
  const ip=await media.get(keyIntent(manifest.cutoverToken,auth.uid,parts[3]));
  intent=ip?await readJson(ip):null;
  if(intent&&(!intent.token||intent.token!==manifest.cutoverToken||
     intent.actor!==auth.uid||intent.target!==parts[3]))
   return fail('intent-invalid');
  // A request already carrying the exact pair-intent identity was reserved
  // before the original canonical attempt. Route it to canonical idempotent
  // replay/recovery; do not allocate a second alarm or block an ambiguous ACK.
  if(ordered&&intent?.id===body.followOperationId&&
     intent?.expectedRevision===body.followExpectedRevision&&
     intent?.following===(request.method==='PUT')){
   return callCanonical();
  }
  if(intent&&!intent.settled)return fail('intent-not-settled');
  // APP579: an unversioned client must receive a stable, server-issued
  // operation based on the exact canonical pair revision. Do not infer
  // ordering from request timestamps or make a new random ID on retries.
  const currentRevision=Number(intent?.revision||0);
  if(!Number.isSafeInteger(currentRevision)||currentRevision<0)
   return fail('intent-revision-invalid');
  if(ordered&&currentRevision!==body.followExpectedRevision)
   return fail('intent-revision-stale');
  // Only a new changed operation needs a pre-mutation revision floor.
  const p=await media.get(keyProfile(parts[3]));
  if(!p)return fail('profile-unavailable');
  profile=await readJson(p);
  const v=profile?.followSync354;
  if(profile?.body?.data?.profile?.uid!==parts[3]||
     !Number.isSafeInteger(profile.revision)||profile.revision<=0||
     v?.token!==manifest.cutoverToken||v?.exact!==true||
     !v.pending||typeof v.pending!=='object'||
     Object.keys(v.pending).length!==0)return fail('profile-not-exact');

 }catch{return fail('preflight-read-unavailable')}
 // APP579: hash the canonical token/pair/revision/choice. Equal legacy
 // retries share the same ID; opposite choices and later pair revisions do not.
 // The hash is only an idempotency key, never an authentication proof.
 let operationId=body.followOperationId;
 let expectedRevision=body.followExpectedRevision;
 if(unversioned){
  expectedRevision=Number(intent?.revision||0);
  try{
   const key=JSON.stringify([manifest.cutoverToken,auth.uid,parts[3],
     expectedRevision,desired]);
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
   operationId='owner_follow_579_'+Array.from(new Uint8Array(digest))
     .map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch{return fail('legacy-operation-id-unavailable')}
 }
 const ticket={ownerUid:parts[3],actorUid:auth.uid,
   authEpoch:String(row.epoch),operationId,
   expectedRevision,cutoverToken:manifest.cutoverToken,desired,beforeFollowing,
   priorR2Revision:profile.revision};
 let result;
 try{result=await reserve(ticket,env)}
 catch{return fail('reservation-unavailable')}
 if(result?.ok!==true)return fail(result?.status||'reservation-rejected');
 // If canonical fails, do NOT infer no commit and clear this ticket. A 503
 // may occur after an R2/D1 change; alarm checks the exact settled pair ID.
 // Preserve Auth/AppCheck headers, request method and the exact canonical
 // Writer. Only unversioned, enrolled, actually changed requests get the
 // generated stable operation envelope. No bypass for non-canary owners.
 if(!unversioned)return callCanonical();
 const headers=new Headers(request.headers);
 // An old PUT with no body may carry Content-Length: 0. Never forward that
 // stale transport length with the synthesized canonical operation payload.
 headers.delete('Content-Length');
 headers.set('Content-Type','application/json');
 const canonicalRequest=new Request(request,{headers,
  body:JSON.stringify({followOperationId:operationId,
   followExpectedRevision:expectedRevision})});
 return callCanonical(canonicalRequest);
}
