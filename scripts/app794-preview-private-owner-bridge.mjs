// APP794: source-only split over the EXISTING 600/607 service bindings.
// No new cloud binding, DO class/migration, public route or live enable.
// Explore owns canonical R2/D1/HMAC; the private owner DO owns receipts.
// A fresh alarm invokes Explore once; Explore never calls that DO back.
import {createApp792PreviewOwnerConnection,createApp792PreviewFollowIngress} from './app792-preview-common-follow.mjs';
import {createApp755ProductionOwnerReceiptStore} from './app755-production-owner-receipt.mjs';
export const APP794_PRIVATE_BRIDGE_COMPILED_OPEN=false;
const HEADER='X-Soridraw-Owner-Bridge-600',BASE='https://owner-follow.internal';
const ROUTE='/internal/owner-follow/app794/',ALARM='/owner-follow/app794-alarm-internal';
const KEY='app755-owner-follow-pending-v1',UID=/^[A-Za-z0-9_-]{1,128}$/,OP=/^[A-Za-z0-9_-]{16,128}$/,EPOCH=/^[a-f0-9]{32}$/;
const secretOK=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{32,256}$/.test(x);
const scope=e=>e?.SORIDRAW_ENVIRONMENT==='preview'&&e?.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653==='preview-only'&&
 e?.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653==='1'&&e?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1'&&
 e?.SORIDRAW_OWNER_FOLLOW_PRIVATE_794==='1'&&secretOK(e.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600);
const fields=['ownerUid','actorUid','authEpoch','cutoverToken','generation','canonicalOperationId','expectedRevision','priorR2Revision','desired','beforeFollowing','sameStateOnly'];
const rev=n=>Number.isSafeInteger(n)&&n>=0;
const ticket=a=>a&&UID.test(a.ownerUid||'')&&UID.test(a.actorUid||'')&&a.ownerUid!==a.actorUid&&
 EPOCH.test(a.authEpoch||'')&&OP.test(a.generation||'')&&OP.test(a.canonicalOperationId||'')&&
 typeof a.cutoverToken==='string'&&a.cutoverToken.length>0&&a.cutoverToken.length<=128&&
 rev(a.expectedRevision)&&rev(a.priorR2Revision)&&typeof a.desired==='boolean'&&
 (a.sameStateOnly===true?a.beforeFollowing===a.desired:a.sameStateOnly===undefined&&a.beforeFollowing===!a.desired);
const receipt=a=>ticket(a)&&OP.test(a.operationId||'')&&a.operationId!==a.canonicalOperationId&&a.durable===true&&a.ownerDoAlarmScheduled===true;
const exact=(a,b)=>!!b&&fields.every(k=>a[k]===b[k])&&a.operationId===b.operationId;
const clean=a=>Object.fromEntries([...fields,'operationId','durable','ownerDoAlarmScheduled','delivery'].filter(k=>a[k]!==undefined).map(k=>[k,a[k]]));
const hold=reason=>({status:'HOLD',reason,deployAuthorized:false});
const reply=(status,value)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const ownedName=uid=>'app794-owner:'+uid; // disjoint from legacy uid and uid:public-follow-680
function authorized(r,e){
 const a=e?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600,b=r.headers.get(HEADER);
 if(!secretOK(a)||typeof b!=='string'||a.length!==b.length)return false;
 let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
}
async function parse(r){
 if(r.method!=='POST'||new URL(r.url).origin!==BASE||new URL(r.url).search)return null;
 const n=r.headers.get('Content-Length');
 if(n!==null&&(!/^\d+$/.test(n)||Number(n)>2048))return null;
 const raw=await r.text();if(new TextEncoder().encode(raw).length>2048)return null;
 const a=JSON.parse(raw);return ticket(a)?clean(a):null;
}
async function call(service,e,path,a){
 if(!scope(e)||typeof service?.fetch!=='function')throw Error('APP794_PRIVATE_UNAVAILABLE');
 const r=await service.fetch(new Request(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',
  [HEADER]:e.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600},body:JSON.stringify(clean(a))}));
 if(r.status!==200)throw Error('APP794_PRIVATE_ACK_UNVERIFIED');
 const v=await r.json();if(!v||typeof v.status!=='string')throw Error('APP794_PRIVATE_ACK_INVALID');return v;
}
const bound=(state,e,uid)=>UID.test(uid||'')&&state?.id?.toString()===e?.OWNER_FOLLOW_DO_600?.idFromName(ownedName(uid))?.toString();
// Existing owner Worker default fetch intercepts only these private paths.
// Inactive or unrelated requests are left to its existing handler.
export function createApp794OwnerWorkerRoute({enabled=APP794_PRIVATE_BRIDGE_COMPILED_OPEN}={}){
 return async (request,env)=>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith(ROUTE))return null;
  if(!enabled||!scope(env))return reply(503,hold('OFF'));
  if(!authorized(request,env))return reply(403,hold('CAPABILITY'));
  if(!['inspect','reserve','rearm'].includes(path.slice(ROUTE.length)))return reply(404,hold('PATH'));
  try{
   const a=await parse(request);if(!a)return reply(400,hold('TICKET'));
   const ns=env.OWNER_FOLLOW_DO_600,stub=ns.get(ns.idFromName(ownedName(a.ownerUid)));
   return await stub.fetch(new Request(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',
    [HEADER]:env.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600},body:JSON.stringify(a)}));
  }catch{return reply(503,hold('OWNER_UNAVAILABLE'))}
 };
}
// Install alongside the existing OwnerFollowerStandalone600 fetch/alarm.
// Old DO IDs and keys are untouched; no alarm is canceled or migrated.
export function createApp794OwnerDoPort({state,env,enabled=APP794_PRIVATE_BRIDGE_COMPILED_OPEN,now=Date.now,issueId}={}){
 const storeFor=uid=>createApp755ProductionOwnerReceiptStore({storage:state.storage,ownerUid:uid,enabled:true,now,issueId,allowSameState792:true});
 return {
  async fetch(request){
   const path=new URL(request.url).pathname;
   if(!path.startsWith(ROUTE))return null;
   if(!enabled||!scope(env))return reply(503,hold('OFF'));
   if(!authorized(request,env))return reply(403,hold('CAPABILITY'));
   try{
    const a=await parse(request),op=path.slice(ROUTE.length);
    if(!a||!bound(state,env,a.ownerUid)||await state.storage.get('pending'))return reply(409,hold('OWNER_SCOPE'));
    const store=storeFor(a.ownerUid);
    if(op==='inspect')return reply(200,await store.inspectReceipt(a));
    if(op==='reserve'){
     if(a.operationId!==undefined||a.durable!==undefined||a.ownerDoAlarmScheduled!==undefined||a.delivery!==undefined)return reply(400,hold('SERVER_ID_REQUIRED'));
     const v=await store.reserve(a);
     return receipt(v)&&fields.every(k=>v[k]===a[k])?reply(200,{status:'reserved',receipt:v}):reply(409,hold('RESERVE'));
    }
    if(op==='rearm'&&receipt(a)){
     const v=await store.inspectReceipt(a);
     if(v.status!=='found'||!exact(a,v.receipt))return reply(409,hold('RECEIPT'));
     return reply(200,await store.rearmVerifiedSettlement({receipt:v.receipt}));
    }
    return reply(404,hold('PATH'));
   }catch{return reply(503,hold('OWNER_STORE'))}
  },
  async alarm(){
   // Do not call legacy alarm for an APP794 object during runtime OFF:
   // its receipts remain intact. No blind delete/rearm of either queue.
   const raw=await state.storage.get(KEY);
   if(raw===undefined||raw===null)return null; // legacy handler owns its original alarm
   const uid=raw.ownerUid;
   if(!bound(state,env,uid)||await state.storage.get('pending'))throw Error('APP794_MIXED_OR_UNBOUND_QUEUE');
   if(!enabled||!scope(env))throw Error('APP794_PENDING_RUNTIME_OFF');
   const store=storeFor(uid),due=await store.duePending();
   let delivered=0,waiting=0,retried=0,held=0;
   for(const a of due){
    const inspected=await store.inspectReceipt(a);
    if(inspected.status!=='found'||!exact(a,inspected.receipt))throw Error('APP794_ALARM_RECEIPT');
    let v;
    try{v=await call(env.OWNER_FOLLOW_CANONICAL_REPLAY_600,env,ALARM,inspected.receipt)}catch{v={status:'PROOF_WAIT'}}
    if(v.d1AdditionalWrites!==0||!['delivered','rejected-generation','relay-failed'].includes(v.status)){
     const q=await store.deferSettlement({receipt:a});if(q.status==='held')held++;else waiting++;continue;
    }
    const q=await store.markDelivery({receipt:a,result:v.status});
    if(q.changed!==true)throw Error('APP794_DELIVERY_RECORD_UNVERIFIED');
    if(q.status==='delivered')delivered++;else if(q.status==='held')held++;else retried++;
   }
   return {delivered,waiting,retried,held,d1AdditionalWrites:0};
  }
 };
}
// Explore-side port uses the existing forward binding. No credentials copied.
function remoteStore(env,uid){
 const invoke=(op,a)=>{if(a.ownerUid!==uid)throw Error('APP794_SCOPE');return call(env.OWNER_FOLLOW_RESERVATION_SERVICE_600,env,ROUTE+op,a)};
 return {inspectReceipt:a=>invoke('inspect',a),
  async reserve(a){const v=await invoke('reserve',a);return v.status==='reserved'?v.receipt:null},
  rearmVerifiedSettlement:({receipt:a})=>invoke('rearm',a)};
}
function core(env,uid,store,verifyCutover,now,send){
 return createApp792PreviewOwnerConnection({enabled:true,env,ownerUid:uid,privateReceiptStore:store,
  // The DO port checks the real idFromName binding on each receipt request;
  // this callback attests the private service boundary, not a new DO identity.
  verifyBoundOwner:async()=>({verifiedPrivateReceiptBoundary:true,ownerUid:uid}),verifyCutover,now,send});
}
export function createApp794ExploreConnection({env,enabled=APP794_PRIVATE_BRIDGE_COMPILED_OPEN,
 verifyCutover,authenticate,preauthorizeCanonical,callCanonical,readPair,now=Date.now,send=fetch}={}){
 if(!enabled)return null;
 if(!scope(env)||typeof env.OWNER_FOLLOW_RESERVATION_SERVICE_600?.fetch!=='function'||[verifyCutover,authenticate,preauthorizeCanonical,callCanonical].some(x=>typeof x!=='function'))
  throw Error('APP794_CANONICAL_DEPENDENCIES');
 const ownerService=async uid=>core(env,uid,remoteStore(env,uid),verifyCutover,now,send);
 const ingress=createApp792PreviewFollowIngress({enabled:true,verifyCutover,authenticate,preauthorizeCanonical,
  callCanonical,readPair,ownerService});
 return {
  ingress:({request})=>ingress({request,env}),
  bootstrap:a=>ownerService(a.ownerUid).then(x=>x.bootstrap(a)),
  // Called only by the existing named private replay entrypoint, never
  // by the public fetch dispatcher. The bound DO already inspected its
  // receipt. Restrict this request to that receipt and prohibit backcalls.
  async alarmRoute(request){
   if(new URL(request.url).pathname!==ALARM)return null;
   if(!scope(env)||!authorized(request,env))return reply(403,hold('CAPABILITY'));
   try{
    const a=await parse(request);if(!receipt(a))return reply(400,hold('RECEIPT'));
    const deny=async()=>{throw Error('APP794_ALARM_BACKCALL_FORBIDDEN')};
    const store={inspectReceipt:async b=>exact(a,b)?{status:'found',receipt:a}:hold('EXACT_RECEIPT'),
     reserve:deny,rearmVerifiedSettlement:deny};
    const v=await core(env,a.ownerUid,store,verifyCutover,now,send).settleAndDeliver(a);
    return reply(200,v);
   }catch{return reply(503,hold('ALARM_UNAVAILABLE'))}
  }
 };
}
