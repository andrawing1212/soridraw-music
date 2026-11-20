// APP732: isolated QA-only APP730 runtime, never an application/PROD entrypoint.
// Uses existing QA DO class/binding and pinned QA Functions destination.
// No real Firebase Auth/AppCheck or canonical D1/R2; synthetic pinned actor
// is authenticated only by the existing QA probe token and QA config.
import {createApp730SourceOnlyBridge} from '../../../scripts/app730-source-only-follow-bridge.mjs';
import {parseOwnerQaConfig583} from './owner-follow-qa-live-583.mjs';
import {sendOwnerFollowHttp539} from '../runtime/owner-follow-http-539.mjs';
import {QA_OWNER_FOLLOW_FUNCTION_URL_577} from '../runtime/owner-follow-qa-boundary-577.mjs';

const KEY='qa730-durable-state-v1';
// APP747: fault injection is restricted to this already isolated QA worker.
// It models ONE outbound Functions 503; it never changes the receiver,
// shared Firebase data, or the default APP583 worker.
const FAULT_KEY='qa747-sender-503-once-v1';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const validVersion=x=>Number.isSafeInteger(x)&&x>=0;
const QA_FUNC='https://asia-northeast3-soridraw-app.cloudfunctions.net/publishExploreOwnerFollower542';

export function createOwnerQa730Runtime({storage,env,now=Date.now,send=fetch}={}){
  const cfg=parseOwnerQaConfig583(env?.OWNER583_QA_CONFIG);
  const enabled=()=>Boolean(cfg)&&env?.SORIDRAW_ENVIRONMENT==='preview'&&
    env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1'&&
    !env?.DB&&!env?.PROFILE_MEDIA&&!env?.RATE_DB&&!env?.EXPLORE_CACHE&&
    !env?.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539&&
    QA_OWNER_FOLLOW_FUNCTION_URL_577===QA_FUNC&&
    storage&&typeof storage.get==='function'&&typeof storage.put==='function'&&
    typeof storage.setAlarm==='function';
  const auth=request=>enabled()&&request.headers.get('X-Owner583-Token')===cfg.probeToken;
  const faultAllowed=()=>enabled()&&env?.SORIDRAW_QA747_INJECT503==='1';
  const state=()=>storage.get(KEY);
  const createBridge=()=>createApp730SourceOnlyBridge({
    isolatedProof:{scope:'SYNTHETIC_ISOLATED_QA_ONLY'},
    verifyPrincipal:async({request})=>({
      uid:cfg.actorUid,verifiedAuth:auth(request),verifiedAppCheck:auth(request),
    }), // Synthetic QA token, NOT actual Firebase authentication
    readCanonicalReservation:async({actorUid,ownerUid,desired})=>{
      const x=await state();
      if(!x||x.pending||x.desired===desired||x.ownerUid!==ownerUid||
        x.actorUid!==actorUid||!validVersion(x.version))return null;
      return {
        actorUid,ownerUid,desired,beforeFollowing:x.desired,
        operationId:'qa730_follow_revision_'+(x.version+1)+'_'+(desired?'on':'off'),
        authEpoch:cfg.authEpoch,cutoverToken:'qa730-isolated-only',
        expectedRevision:x.version,priorR2Revision:x.version+1,
      };
    },
    reserveOwnerDo:async ticket=>{
      const x=await state();
      if(!x||x.pending||x.version!==ticket.expectedRevision)return {ok:false};
      const pending={...ticket,updatedAt:now(),attempts:0,hold:false};
      await storage.put(KEY,{...x,pending,lastStatus:'reserved'});
      await storage.setAlarm(now()+1000);
      return {ok:true,status:'reserved'};
    },
    verifyExactCommit:async({reservation})=>{
      const x=await state();
      return x?.operationId===reservation.operationId&&
        x?.version===reservation.expectedRevision+1&&
        x?.desired===reservation.desired&&
        x?.pending?.operationId===reservation.operationId
        ? {committed:true,operationRevision:x.version}:{committed:false};
    },
  });
  const canonical=async request=>{
    const body=await request.clone().json().catch(()=>null);
    const x=await state(),desired=request.method==='PUT';
    if(!x||!x.pending||body?.followOperationId!==x.pending.operationId||
      body?.followExpectedRevision!==x.version||
      x.pending.expectedRevision!==x.version||
      desired!==x.pending.desired||x.desired===desired)
      return reply({ok:false,error:'canonical-reservation-mismatch'},409);
    const version=x.version+1;
    await storage.put(KEY,{...x,version,desired,operationId:x.pending.operationId,
      followerCount:desired?1:0,lastStatus:'settled'});
    return new Response(JSON.stringify({ok:true,data:{
      uid:cfg.ownerUid,following:desired,duplicate:false,revision:version,
    }}),{status:200,headers:{
      'Content-Type':'application/json','X-Soridraw-Follow-Protocol':'354',
      'Cache-Control':'no-store',
    }});
  };
  const fetchEvent=async request=>{
    if(!auth(request))return reply({ok:false},403);
    const path=new URL(request.url).pathname;
    if(path==='/qa730/status'&&request.method==='GET'){
      const x=await state();
      return reply({ok:true,syntheticOnly:true,version:x?.version??null,
        following:x?.desired??false,followerCount:x?.followerCount??0,
        pending:Boolean(x?.pending),hold:Boolean(x?.pending?.hold),
        attempts:x?.pending?.attempts||0,lastStatus:x?.lastStatus||'uninitialized',
        // APP748: persistent QA-only evidence so a fast DO alarm cannot
        // hide the single injected outbound 503 before external polling.
        injected503Version:x?.lastInjected503Version??null,
        recovered503Version:x?.lastRecovered503Version??null,
        recoveryAttemptCount:x?.recoveryAttemptCount??0});
    }
    if(path==='/qa730/bootstrap'&&request.method==='POST'){
      if(await state())return reply({ok:false,error:'already-bootstrapped'},409);
      const data=await request.json().catch(()=>null);
      // QA runner must authenticate as QA Firebase and verify the retained
      // SG RTDB signal's exact epoch/version/count BEFORE this call.
      if(!data||data.qaRtdbBaselineVerified!==true||
        data.authEpoch!==cfg.authEpoch||!validVersion(data.version)||
        ![0,1].includes(data.followerCount))
        return reply({ok:false,error:'verified-qa-baseline-required'},409);
      await storage.put(KEY,{
        ownerUid:cfg.ownerUid,actorUid:cfg.actorUid,
        version:data.version,desired:data.followerCount===1,
        followerCount:data.followerCount,operationId:null,pending:null,
        lastStatus:'bootstrapped',
      });
      return reply({ok:true,syntheticOnly:true,version:data.version});
    }
    // Only the QA-synthetic actor may arm the exact NEXT revision while
    // no durable receipt is pending. A 503 is simulated locally at sender.
    if(path==='/qa730/arm-503-747'&&request.method==='POST'){
      if(!faultAllowed())return reply({ok:false,error:'fault-disabled'},403);
      const x=await state();
      if(!x||x.pending||!validVersion(x.version)||
         await storage.get(FAULT_KEY))
        return reply({ok:false,error:'qa-baseline-not-clear'},409);
      const next=x.version+1;
      await storage.put(FAULT_KEY,{expectedVersion:next,consumed:false});
      return reply({ok:true,syntheticOnly:true,fault:'sender-503-once',
        expectedVersion:next});
    }
    if(path==='/qa730/redrive'&&request.method==='POST'){
      const x=await state();
      if(!x?.pending)return reply({ok:false,error:'no-pending'},409);
      await storage.put(KEY,{...x,pending:{...x.pending,attempts:0,hold:false}});
      await storage.setAlarm(now()+1000);
      return reply({ok:true,rearmed:true});
    }
    if(path!=='/qa730/follow'||(request.method!=='PUT'&&request.method!=='DELETE'))
      return reply({ok:false},404);
    const x=await state();
    if(!x)return reply({ok:false,error:'bootstrap-required'},409);
    const desired=request.method==='PUT';
    if(x.pending)return reply({ok:false,error:'drain-pending-first'},409);
    if(x.desired===desired)return reply({ok:true,changed:false,version:x.version});
    const bridge=createBridge(),principal=await bridge.verifyFirebaseActorAndAppCheck({request,env});
    if(principal?.verified!==true||principal.uid!==cfg.actorUid)
      return reply({ok:false,error:'auth'},403);
    const reservation=await bridge.reserveDurableBeforeCommit({
      request,env,actorUid:cfg.actorUid,ownerUid:cfg.ownerUid,desired,
    });
    if(reservation?.durable!==true)return reply({ok:false,error:'reservation'},503);
    const canonicalRequest=await bridge.makeCanonicalRequest({
      request,reservation,actorUid:cfg.actorUid,ownerUid:cfg.ownerUid,
    });
    const committed=await canonical(canonicalRequest);
    if(!committed.ok)return committed;
    const proof=await bridge.verifyCanonicalSettledCommit({
      request,canonicalResponse:committed.clone(),env,
      operationId:reservation.operationId,actorUid:cfg.actorUid,
      ownerUid:cfg.ownerUid,desired,
    });
    if(proof?.settled!==true)return reply({ok:false,error:'commit-proof'},503);
    await bridge.queueSettledOwnerSignal({
      reservation,proof,ownerUid:cfg.ownerUid,actorUid:cfg.actorUid,
    });
    return reply({ok:true,syntheticOnly:true,changed:true,
      version:proof.revision,queuedByDurableAlarm:true});
  };
  const alarm=async()=>{
    if(!enabled())return false;
    const x=await state();
    if(!x?.pending)return false;
    if(x.pending.hold)return true;
    const exact=x.pending.operationId===x.operationId&&
      x.version===x.pending.expectedRevision+1&&
      x.desired===x.pending.desired;
    let delivery=null;
    if(exact)try{
      const fault=faultAllowed()?await storage.get(FAULT_KEY):null;
      if(fault&&fault.expectedVersion===x.version&&fault.consumed===false){
        // Model a single 503 from the outbound sender, without contacting
        // Firebase Functions. Keep the persisted ticket and DO alarm.
        await storage.put(FAULT_KEY,{...fault,consumed:true});
        delivery={ok:false,status:503};
      }else{
        delivery=await sendOwnerFollowHttp539({
          ownerUid:cfg.ownerUid,authEpoch:cfg.authEpoch,version:x.version,
          followerCount:x.followerCount,updatedAt:x.pending.updatedAt,
        },{endpoint:QA_OWNER_FOLLOW_FUNCTION_URL_577,
          secret:cfg.hmacSecret,qaOnly:true,send,now});
      }
    }catch{/* retain exact receipt; bounded retry */}
    const latest=await state();
    if(latest?.pending?.operationId!==x.pending.operationId)return true;
    if(delivery?.ok){
      const retry=latest.lastInjected503Version===x.version&&
        latest.pending.attempts>0;
      await storage.put(KEY,{...latest,pending:null,
        lastStatus:delivery.applied?'applied':'duplicate',lastAckAt:now(),
        ...(retry?{lastRecovered503Version:x.version,
          recoveryAttemptCount:latest.pending.attempts}:{})});
      if(faultAllowed()){
        const fault=await storage.get(FAULT_KEY);
        if(fault?.expectedVersion===x.version&&fault.consumed===true)
          await storage.delete(FAULT_KEY);
      }
      return true;
    }
    const attempts=x.pending.attempts+1,hold=attempts>=3||delivery?.status===409;
    await storage.put(KEY,{...latest,pending:{...latest.pending,attempts,hold},
      lastStatus:hold?'manual-hold':'retry-scheduled',
      ...(delivery?.status===503&&faultAllowed()?
        {lastInjected503Version:x.version}:{})});
    if(!hold)await storage.setAlarm(now()+Math.min(4000,1000*2**attempts));
    return true;
  };
  return {enabled,fetch:fetchEvent,alarm};
}
