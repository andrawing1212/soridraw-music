// APP790 physical candidate, QA only. Reuse exact APP583 class and QA730 pair.
// No active app imports; no new Auth users, IAM, rules, functions or namespaces.
import legacy,{OwnerFollowIsolated558 as Original} from './owner-follow-isolated-558-entry.mjs';
import {parseOwnerQaConfig583} from './owner-follow-qa-live-583.mjs';
import {createQaFirebaseVerifier749} from './owner-follow-qa-real-auth-749.mjs';
import {sendOwnerFollowHttp539} from '../runtime/owner-follow-http-539.mjs';
import {createApp790QaOwnerConnection} from '../../../scripts/app790-qa-auth-owner-connection.mjs';
const ORIGIN='https://soridraw-qa-owner-584.web.app';
const RTDB='https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app';
const LEGACY='qa730-durable-state-v1',CONTROL='qa790-run-control-v1',RECEIPTS='app755-owner-follow-pending-v1';
const DO_NAME='qa730-isolated-owner-only',TABLE='app768_qa_synthetic_follow';
const response=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const hold=reason=>response(409,{ok:false,status:'HOLD',reason});
const rev=x=>Number.isSafeInteger(x)&&x>=0&&x<Number.MAX_SAFE_INTEGER-100;
const exact=(e,c)=>!!c&&e?.SORIDRAW_ENVIRONMENT==='preview'&&
 e.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1'&&e.QA790_ISOLATED==='1'&&
 !e.DB&&!e.PROFILE_MEDIA&&!e.RATE_DB&&!e.EXPLORE_CACHE&&!e.SORIDRAW_OWNER_FOLLOW_ENDPOINT_539&&
 /^[0-9]{8,20}$/.test(e.QA790_RUN||'')&&/^qa790_[a-f0-9]{16}$/.test(e.QA790_ROW||'')&&
 /^qa790_cutover_[a-f0-9]{32}$/.test(e.QA790_CUTOVER||'')&&
 /^[a-f0-9]{64}$/.test(e.QA790_ACCESS||'')&&e.OWNER558_DO&&e.QA790_D1&&e.QA790_R2;
const digest=async x=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(x))))].map(v=>v.toString(16).padStart(2,'0')).join('');
const operation=(e,c,base,desired)=>({ownerUid:c.ownerUid,actorUid:c.actorUid,authEpoch:c.authEpoch,
 cutoverToken:e.QA790_CUTOVER,canonicalOperationId:'qa790_'+(desired?'follow':'cancel')+'_'+e.QA790_RUN,
 expectedRevision:base+(desired?0:1),priorR2Revision:13+(desired?0:1),desired,beforeFollowing:!desired});
const keys=async a=>{const h=await digest([a.cutoverToken,a.ownerUid,a.actorUid,a.authEpoch,a.canonicalOperationId]);
 return {floor:'internal/qa788/owner-floor/'+await digest([a.cutoverToken,a.ownerUid,a.authEpoch]),
 admission:'internal/qa767/owner-follow-admissions/'+h,settled:'internal/qa783/owner-follow-settled/'+h,projection:'internal/qa790/projection/'+h}};
const same=(x,a,fields)=>!!x&&fields.every(k=>x[k]===a[k]);
const identity=['ownerUid','actorUid','authEpoch','cutoverToken','canonicalOperationId','expectedRevision','desired'];
const read=async(e,k)=>{const raw=await e.QA790_R2.get(k);if(!raw)return null;
 const text=await raw.text();if(text.length>2048)throw Error('R2_SIZE');return JSON.parse(text)};
const pair=async e=>{const v=await e.QA790_D1.prepare('SELECT following FROM '+TABLE+' WHERE k=?').bind(e.QA790_ROW).first();
 if(!v||![0,1].includes(Number(v.following)))throw Error('QA_PAIR_UNVERIFIED');return Number(v.following)===1};
const validOld=(x,c)=>x?.ownerUid===c.ownerUid&&x.actorUid===c.actorUid&&rev(x.version)&&
 typeof x.desired==='boolean'&&x.followerCount===Number(x.desired)&&x.pending===null;
const validMarker=(x,c)=>x?.source==='QA790_TRUSTED_RTDB_MARKER'&&x.verified===true&&x.ownerUid===c.ownerUid&&
 x.authEpoch===c.authEpoch&&rev(x.version)&&[0,1].includes(x.followerCount);
const sameMarker=(x,y)=>x?.version===y?.version&&x?.followerCount===y?.followerCount&&x?.authEpoch===y?.authEpoch;
const exactControl=(x,e,c)=>x?.run===e.QA790_RUN&&rev(x.base)&&validMarker(x.marker,c)&&
 x.marker.version>=x.base&&x.marker.version<=x.base+2;
const status=(old,pending=false)=>({ok:true,syntheticOnly:true,qaFirebaseAuthAppCheckVerified:true,
 version:old.version,following:old.desired,followerCount:old.followerCount,pending,hold:false});
const qaVerifier=createQaFirebaseVerifier749();
async function markerFromOwner(request,c){
 const token=request.headers.get('Authorization')?.slice(7);
 if(!token)return null;
 const url=new URL(RTDB+'/ownerFollowerSync532/'+encodeURIComponent(c.ownerUid)+'.json');
 url.searchParams.set('auth',token);
 // Forward only to the pinned QA RTDB path, never persist/log credentials.
 const r=await fetch(url,{method:'GET',redirect:'manual',headers:{'X-Firebase-AppCheck':request.headers.get('X-Firebase-AppCheck'),'Cache-Control':'no-store'},signal:AbortSignal.timeout(10000)});
 if(r.status!==200)return null;
 const x=await r.json();
 if(x?.authEpoch!==c.authEpoch||!rev(x.version)||![0,1].includes(x.followerCount))return null;
 return {source:'QA790_TRUSTED_RTDB_MARKER',verified:true,ownerUid:c.ownerUid,
 authEpoch:x.authEpoch,version:x.version,followerCount:x.followerCount};
}
export class OwnerFollowIsolated558 extends Original{
 constructor(state,env){super(state,env);this.state=state;this.e=env;
  this.c=parseOwnerQaConfig583(env.OWNER583_QA_CONFIG);
  this.enabled=exact(env,this.c)&&state.id.toString()===env.OWNER558_DO.idFromName(DO_NAME).toString();
 }
 connection(control){
  const e=this.e,c=this.c,s=this.state;
  return createApp790QaOwnerConnection({enabled:true,scope:'APP790_ISOLATED_QA_SOURCE_ONLY',env:e,state:s,config:c,
   verifyBoundOwner:async()=>({ownerUid:c.ownerUid,verifiedOwnerDoIdentity:this.enabled}),
   readQaOwnerMarker:async()=>control.marker,
   verifyTrustedEpoch:async a=>({source:'APP788_ISOLATED_SYNTHETIC_EPOCH_CERT',verified:exactControl(control,e,c),
    ownerUid:c.ownerUid,actorUid:c.actorUid,authEpoch:c.authEpoch,cutoverToken:e.QA790_CUTOVER,
    allActiveAndLegacyWritersCovered:true,newEpochFromVerifiedGenesis:true,noHistoricalNamespaceReuse:true,
    ownerDoPitrIndependent:true,retentionAndAccountDeletionReviewed:true,physicalNamespaceIsolatedFromProduction:true,
    firstD1Revision:control.base,firstR2Revision:13}),
   verifySettledCanonical:async a=>{
    const k=await keys(a),p=await read(e,k.projection);
    if(!same(p,a,identity)||p?.kind!=='QA790_EXACT_PROJECTION'||p.revision!==a.expectedRevision+1||
      p.r2Revision!==a.priorR2Revision+1||p.followerCount!==Number(a.desired)||!rev(p.updatedAt)||await pair(e)!==a.desired)return null;
    return {...a,source:'QA783_EXACT_D1_R2_SETTLED',verified:true,changed:true,canonicalD1Committed:true,
     r2ProjectionSettled:true,ownerEpochVerified:true,committedRevision:p.revision,nextR2Revision:p.r2Revision,
     d1OperationId:a.canonicalOperationId,r2OperationId:a.canonicalOperationId,followerCount:p.followerCount,updatedAt:p.updatedAt};
   },sendOwnerFollowHttp539,issueId:()=>('qa790_receipt_'+crypto.randomUUID().replace(/-/g,''))});
 }
 async fetch(req){
  const path=new URL(req.url).pathname;
  if(!path.startsWith('/qa790/internal/'))return super.fetch(req);
  if(!this.enabled||req.method!=='POST'||req.headers.get('X-QA790-Internal')!==this.e.QA790_ACCESS)return response(403,{ok:false});
  const e=this.e,c=this.c,s=this.state.storage;
  try{
   const b=await req.json(),old=await s.get(LEGACY),control=await s.get(CONTROL);
   if(!validOld(old,c))return hold('EXISTING_QA730_BASELINE_UNVERIFIED');
   if(control&&!exactControl(control,e,c))return hold('OTHER_QA_RUN_OR_CONTROL_UNVERIFIED');
   if(path==='/qa790/internal/status'){
    if(b.marker!==null&&!validMarker(b.marker,c))return hold('OWNER_MARKER_UNVERIFIED');
    if(!control){
     if(old.desired||await s.get(RECEIPTS)||await pair(e)!==false)return hold('QA_START_NOT_CLEAN');
     if(b.marker!==null){
      if(b.marker.version!==old.version||b.marker.followerCount!==0)return hold('REAL_RTDB_AND_LEGACY_BASELINE_MISMATCH');
      await s.put(CONTROL,{run:e.QA790_RUN,base:old.version,marker:b.marker});
     }
     return response(200,status(old));
    }
    if(b.marker!==null&&!sameMarker(b.marker,control.marker)){
     const desired=b.marker.version===control.base+1;
     if(b.marker.version!==control.marker.version+1||b.marker.version>control.base+2||
       b.marker.followerCount!==Number(desired)||old.version!==control.marker.version||old.desired!==Boolean(control.marker.followerCount))
      return hold('UNEXPECTED_REAL_RTDB_ADVANCE');
     const a=operation(e,c,control.base,desired),k=await keys(a),floor=await read(e,k.floor),settled=await read(e,k.settled);
     if(floor?.pending!==null||floor.lastOperationId!==a.canonicalOperationId||floor.d1Revision!==a.expectedRevision+1||
       floor.r2Revision!==a.priorR2Revision+1||!same(floor,a,['ownerUid','authEpoch','cutoverToken'])||
       settled?.kind!=='APP783_IMMUTABLE_QA_SETTLED'||!same(settled,a,identity)||
       settled.committedRevision!==a.expectedRevision+1||await pair(e)!==desired)return hold('EXACT_SETTLEMENT_UNVERIFIED');
     const stored=await s.get(RECEIPTS),receipt=stored?.entries?.find(x=>x.canonicalOperationId===a.canonicalOperationId);
     if(!same(receipt,a,[...identity,'priorR2Revision','beforeFollowing'])||receipt.delivery?.status!=='delivered')
      return response(200,status(old,true));
     // Preserve existing QA730 baseline after actual owner RTDB read. This
     // compatibility write is QA only, exact next revision, no canonical D1.
     const next={...old,version:b.marker.version,desired,followerCount:b.marker.followerCount,
      operationId:a.canonicalOperationId,lastStatus:'settled',pending:null};
     await s.transaction(async tx=>{
      const latest=await tx.get(LEGACY),current=await tx.get(CONTROL);
      if(!validOld(latest,c)||latest.version!==old.version||!exactControl(current,e,c)||!sameMarker(current.marker,control.marker))throw Error('BASELINE_RACE');
      await tx.put(LEGACY,next);await tx.put(CONTROL,{...control,marker:b.marker});
     });
     return response(200,status(next));
    }
    return response(200,status(old,(await pair(e))!==old.desired));
   }
   if(path==='/qa790/internal/cleanup'){
    if(!control)return response(200,{status:'QA790_NO_RUN_STATE',clean:true});
    const row=await pair(e),stored=await s.get(RECEIPTS);
    const a=operation(e,c,control.base,true),b=operation(e,c,control.base,false);
    const ka=await keys(a),kb=await keys(b);
    const complete=old.version===control.base+2&&old.desired===false&&control.marker.version===old.version&&
     control.marker.followerCount===0&&row===false&&stored?.entries?.length===2&&
     stored.entries.every(x=>x.delivery?.status==='delivered'&&[a.canonicalOperationId,b.canonicalOperationId].includes(x.canonicalOperationId));
    const untouched=old.version===control.base&&old.desired===false&&control.marker.version===old.version&&row===false&&
     !await e.QA790_R2.head(ka.projection)&&!await e.QA790_R2.head(kb.projection)&&
     (!stored||stored.entries?.every(x=>x.delivery?.status==='pending'));
    if(!complete&&!untouched)return hold('PARTIAL_RUN_PRESERVE_EXACT_EVIDENCE');
    if(stored?.archiveUsed||await s.get('pending'))return hold('UNRELATED_RECEIPT_OR_ALARM_PRESENT');
    // Only exact run keys; no list or deleteAll. Legacy baseline remains.
    await s.deleteAlarm();
    for(const k of new Set([...Object.values(ka),...Object.values(kb)]))await e.QA790_R2.delete(k);
    // Keep the run receipt and control until ALL exact R2 deletes succeeded.
    // Retrying cleanup after a failed delete never discards the evidence.
    await s.transaction(async tx=>{
     const latest=await tx.get(CONTROL),prior=await tx.get(LEGACY);
     if(!exactControl(latest,e,c)||!sameMarker(latest.marker,control.marker)||
       !validOld(prior,c)||prior.version!==old.version)throw Error('CLEANUP_STATE_DRIFT');
     await tx.delete(RECEIPTS);await tx.delete(CONTROL);
    });
    return response(200,{status:'QA790_EXACT_CLEANUP',clean:true,completed:complete});
   }
   if(!control)return hold('REAL_OWNER_BASELINE_REQUIRED');
   const desired=b.desired;
   if(typeof desired!=='boolean')return hold('EXACT_DIRECTION_REQUIRED');
   const a=operation(e,c,control.base,desired),conn=this.connection(control);
   const k=await keys(a);
   if(path==='/qa790/internal/reserve'){
    if(old.version!==a.expectedRevision||old.desired!==a.beforeFollowing||
      control.marker.version!==a.expectedRevision||control.marker.followerCount!==Number(a.beforeFollowing)||
      await pair(e)!==a.beforeFollowing)return hold('QA_ONE_SHOT_ORDER_OR_BASELINE_MISMATCH');
    if(desired){
     const start=await conn.bootstrap(a);
     if(!['QA788_SYNTHETIC_GENESIS_FLOOR_CREATED','QA788_GENESIS_ALREADY_VERIFIED_READ_ONLY'].includes(start.status))return hold('GENESIS_UNVERIFIED');
    }
    // The only public command is the existing signed QA browser's one-shot
    // follow/cancel. Ordered identity is generated on the server, not by user.
    const auth=new Request('https://qa-only.invalid/qa730/verified/follow',{method:desired?'PUT':'DELETE',
     headers:{Authorization:req.headers.get('Authorization'),'X-Firebase-AppCheck':req.headers.get('X-Firebase-AppCheck'),
      'Content-Type':'application/json'},body:JSON.stringify({followOperationId:a.canonicalOperationId,followExpectedRevision:a.expectedRevision})});
    const v=await conn.reserve(auth,a);
    if(v.status!=='QA788_ADMITTED_AND_OWNER_DO_RESERVED')return hold(v.reason||'RESERVE_HOLD');
    return response(200,{status:v.status,receiptId:v.receipt.operationId,version:a.expectedRevision+1});
   }
   if(!/^qa790_receipt_[a-f0-9]{32}$/.test(b.receiptId||''))return hold('EXACT_RECEIPT_REQUIRED');
   if(path==='/qa790/internal/commit'){
    const verified=await conn.inspectReceipt(a,b.receiptId);
    if(verified.status!=='found')return hold('EXACT_RECEIPT_UNVERIFIED');
    const [admission,floor,settled,projection]=await Promise.all([read(e,k.admission),read(e,k.floor),e.QA790_R2.head(k.settled),e.QA790_R2.head(k.projection)]);
    if(settled||projection||admission?.kind!=='APP767_ADMISSION_NOT_CANONICAL_COMMIT'||!same(admission,a,identity)||
      floor?.kind!=='APP788_QA_OWNER_FLOOR_V1'||!same(floor,a,['ownerUid','authEpoch','cutoverToken'])||
      floor.d1Revision!==a.expectedRevision||floor.r2Revision!==a.priorR2Revision||
      !same(floor.pending,a,['actorUid','canonicalOperationId','expectedRevision','desired'])||
      await pair(e)!==a.beforeFollowing)return hold('PRECOMMIT_EXACT_PROOF_UNVERIFIED');
    const w=await e.QA790_D1.prepare('UPDATE '+TABLE+' SET following=? WHERE k=? AND following=?').bind(Number(desired),e.QA790_ROW,Number(!desired)).run();
    if(w?.meta?.rows_written!==1)return hold('CANONICAL_D1_W1_UNVERIFIED');
    const p={...a,kind:'QA790_EXACT_PROJECTION',revision:a.expectedRevision+1,r2Revision:a.priorR2Revision+1,
     followerCount:Number(desired),updatedAt:Date.now()};
    const put=await e.QA790_R2.put(k.projection,JSON.stringify(p),{onlyIf:{etagDoesNotMatch:'*'}});
    if(!put?.etag)return hold('CANONICAL_R2_PROJECTION_UNKNOWN');
    return response(200,{status:'QA790_CANONICAL_WRITTEN',d1RowsWritten:1}); // No DO reread.
   }
   if(path==='/qa790/internal/finalize'){
    const v=await conn.finalize(a,b.receiptId);
    return response(v.status==='HOLD'?409:200,{status:v.status,reason:v.reason||null,d1RowsWritten:0});
   }
   if(path==='/qa790/internal/arm'){
    const v=await conn.armSettled(a,b.receiptId);
    return response(v.status==='HOLD'?409:200,{status:v.status,reason:v.reason||null,d1RowsWritten:0});
   }
  }catch{return hold('QA790_EXACT_STAGE_UNAVAILABLE')}
  return response(404,{ok:false});
 }
 async alarm(){
  if(!this.enabled)return super.alarm();
  const control=await this.state.storage.get(CONTROL);
  if(!exactControl(control,this.e,this.c))return; // no old pending work allowed
  await this.connection(control).alarm();
 }
}
function cors(r,origin){
 if(!origin)return r;
 const headers=new Headers(r.headers);headers.set('Access-Control-Allow-Origin',ORIGIN);headers.set('Vary','Origin');
 return new Response(r.body,{status:r.status,headers});
}
export default {
 async fetch(req,e,ctx){
  const url=new URL(req.url),path=url.pathname,origin=req.headers.get('Origin');
  const c=parseOwnerQaConfig583(e.OWNER583_QA_CONFIG);
  if(!path.startsWith('/qa730/')&&!path.startsWith('/qa790/'))return legacy.fetch(req,e,ctx);
  if(!exact(e,c)||url.search||origin&&origin!==ORIGIN)return response(403,{ok:false});
  const call=async(action,data,credentials=false)=>{
   const headers={'Content-Type':'application/json','X-QA790-Internal':e.QA790_ACCESS};
   if(credentials){headers.Authorization=req.headers.get('Authorization');headers['X-Firebase-AppCheck']=req.headers.get('X-Firebase-AppCheck')}
   const target=new URL(req.url);target.pathname='/qa790/internal/'+action;
   const stub=e.OWNER558_DO.get(e.OWNER558_DO.idFromName(DO_NAME));
   return stub.fetch(new Request(target,{method:'POST',headers,body:JSON.stringify(data)}));
  };
  if(path==='/qa790/operator/cleanup'&&req.method==='POST'&&!origin&&req.headers.get('X-QA790-Access')===e.QA790_ACCESS)
   return call('cleanup',{});
  if(path==='/qa790/operator/health'&&req.method==='GET'&&!origin&&req.headers.get('X-QA790-Access')===e.QA790_ACCESS)
   return response(200,{status:'QA790_ISOLATED_CANDIDATE_READY'});
  const action=path==='/qa730/verified/status'?'status':path==='/qa730/verified/follow'?'follow':null;
  if(!action)return cors(response(403,{ok:false}),origin);
  if(req.method==='OPTIONS'&&origin===ORIGIN){
   const method=req.headers.get('Access-Control-Request-Method');
   if(action==='status'?method!=='GET':!['PUT','DELETE'].includes(method))return cors(response(403,{ok:false}),origin);
   const allowed=['authorization','x-firebase-appcheck','accept','cache-control','content-type'];
   if((req.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean).some(x=>!allowed.includes(x)))return cors(response(403,{ok:false}),origin);
   return cors(new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':action==='status'?'GET, OPTIONS':'PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':allowed.join(', '),'Access-Control-Max-Age':'30'}}),origin);
  }
  try{
   const principal=await qaVerifier(req,{actorUid:c.actorUid,ownerUid:c.ownerUid,method:req.method,path:action});
   if(principal?.verified!==true||principal.qaProject!=='soridraw-app')return cors(response(403,{ok:false}),origin);
   if(action==='status'){
    const marker=principal.uid===c.ownerUid?await markerFromOwner(req,c):null;
    if(principal.uid===c.ownerUid&&!marker)return cors(hold('REAL_QA_RTDB_MARKER_UNVERIFIED'),origin);
    return cors(await call('status',{marker}),origin);
   }
   if(principal.uid!==c.actorUid||!['PUT','DELETE'].includes(req.method)||await req.text()!=='')return cors(response(403,{ok:false}),origin);
   const desired=req.method==='PUT';
   const reserved=await call('reserve',{desired},true);
   if(!reserved.ok)return cors(reserved,origin);
   const v=await reserved.json(),ticket={desired,receiptId:v.receiptId};
   if(v.status!=='QA788_ADMITTED_AND_OWNER_DO_RESERVED'||!/^qa790_receipt_[a-f0-9]{32}$/.test(v.receiptId||'')||!rev(v.version))return cors(hold('RESERVE_ACK_UNVERIFIED'),origin);
   const committed=await call('commit',ticket);if(!committed.ok)return cors(committed,origin);
   const w=await committed.json();if(w.status!=='QA790_CANONICAL_WRITTEN'||w.d1RowsWritten!==1)return cors(hold('CANONICAL_ACK_UNVERIFIED'),origin);
   const finalized=await call('finalize',ticket);if(!finalized.ok)return cors(finalized,origin);
   const f=await finalized.json();if(!['QA788_IMMUTABLE_SETTLED_AND_FLOOR_ADVANCED','QA788_FLOOR_ALREADY_SETTLED_NO_WRITE'].includes(f.status)||f.d1RowsWritten!==0)return cors(hold('SETTLEMENT_ACK_UNVERIFIED'),origin);
   const armed=await call('arm',ticket);if(!armed.ok)return cors(armed,origin);
   const a=await armed.json();if(a.status!=='QA790_EXISTING_ALARM_READY'||a.d1RowsWritten!==0)return cors(hold('ALARM_ACK_UNVERIFIED'),origin);
   return cors(response(200,{ok:true,syntheticOnly:true,qaFirebaseAuthAppCheckVerified:true,changed:true,version:v.version,d1RowsWritten:1,settlementAdditionalD1Writes:0}),origin);
  }catch{return cors(response(403,{ok:false}),origin)}
 }
};
