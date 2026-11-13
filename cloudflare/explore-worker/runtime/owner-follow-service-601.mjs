// APP601: source-only, private Service Binding in both directions.
// The active Explore Worker has NO enabled route or Service Binding.
import {replayOwnerFollowReservation556} from './owner-follow-postcommit-555.mjs';

export const APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN=false;
const RESERVE_PATH='/internal/owner-follow/reserve600';
const REPLAY_PATH='/owner-follow/replay557-internal';
const HEADER='X-Soridraw-Owner-Bridge-600';
const MAX_TICKET_BYTES=1024;
const MAX_REPLAY_BYTES=2048;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const EPOCH=/^[0-9a-f]{32}$/;
const OP=/^[A-Za-z0-9_-]{16,128}$/;
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const active=(env,enabled)=>enabled===true&&
 env?.SORIDRAW_ENVIRONMENT==='preview'&&
 env?.SORIDRAW_OWNER_FOLLOW_W2_PUSH_555==='1'&&
 env?.SORIDRAW_OWNER_DO_STANDALONE_600==='1';
const secretValid=secret=>typeof secret==='string'&&
 /^[A-Za-z0-9_-]{32,256}$/.test(secret);
function capabilityValid(request,env){
 const expected=env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
 const actual=request.headers.get(HEADER);
 if(!secretValid(expected)||typeof actual!=='string')return false;
 let diff=expected.length^actual.length;
 for(let i=0;i<expected.length;i++)diff|=
  expected.charCodeAt(i)^(actual.charCodeAt(i)||0);
 return diff===0;
}
async function readBounded(request,limit){
 const declared=request.headers.get('Content-Length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit))
  return {status:413};
 try{
  const raw=await request.text();
  if(new TextEncoder().encode(raw).byteLength>limit)return {status:413};
  const value=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))return {status:400};
  return {value};
 }catch{return {status:400}}
}
const validTicket=record=>record&&
 UID.test(String(record.ownerUid||''))&&
 UID.test(String(record.actorUid||''))&&record.ownerUid!==record.actorUid&&
 OP.test(String(record.operationId||''))&&
 EPOCH.test(String(record.authEpoch||''))&&
 typeof record.cutoverToken==='string'&&record.cutoverToken.length>0&&
 record.cutoverToken.length<=128&&
 typeof record.desired==='boolean'&&
 typeof record.beforeFollowing==='boolean'&&
 record.desired!==record.beforeFollowing&&
 Number.isSafeInteger(record.expectedRevision)&&record.expectedRevision>=0&&
 Number.isSafeInteger(record.priorR2Revision)&&record.priorR2Revision>=0;

// Only the canonical Explore authenticated precommit calls this. It reserves
// BEFORE the canonical writer and rejects ambiguous/malformed acknowledgment.
export async function reserveOwnerFollowViaService601(ticket,env,{
 enabled=APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN,
}={}){
 if(!active(env,enabled))return {ok:false,status:'disabled'};
 if(!validTicket(ticket))return {ok:false,status:'invalid-reservation'};
 const capability=env?.SORIDRAW_OWNER_DO_BRIDGE_SECRET_600;
 const service=env?.OWNER_FOLLOW_RESERVATION_SERVICE_600;
 if(!secretValid(capability)||typeof service?.fetch!=='function')
  return {ok:false,status:'missing-private-service'};
 const raw=JSON.stringify(ticket);
 if(new TextEncoder().encode(raw).byteLength>MAX_TICKET_BYTES)
  return {ok:false,status:'oversized'};
 try{
  const response=await service.fetch(new Request('https://owner-follow.internal'+RESERVE_PATH,{
   method:'POST',headers:{'Content-Type':'application/json',[HEADER]:capability},body:raw,
  }));
  // HTTP 200 alone is not a durable ACK. Only the exact DO envelope counts.
  if(response.status!==200)return {ok:false,status:'reservation-unavailable'};
  const value=await response.json();
  if(value?.ok===true&&
     (value.status==='reserved'||value.status==='already-reserved')&&
     Number.isSafeInteger(value.generation)&&value.generation>=1)
   return {ok:true,status:value.status,generation:value.generation};
 }catch{/* Do not call canonical on an uncertain reservation. */}
 return {ok:false,status:'unverified-reservation-ack'};
}

// This is called ONLY from the internal service-bound Explore handler; the
// Worker must not forward arbitrary client requests or bind public routes.
export async function handleOwnerFollowReplayService601({
 request,env,enabled=APP601_OWNER_SERVICE_WIRING_COMPILED_OPEN,
 now=Date.now,send=fetch,
}={}){
 if(!active(env,enabled))return reply(503,{ok:false,status:'disabled'});
 const url=new URL(request.url);
 if(url.pathname!==REPLAY_PATH)return reply(404,{ok:false});
 if(request.method!=='POST')return reply(405,{ok:false});
 if(!capabilityValid(request,env))return reply(403,{ok:false});
 const parsed=await readBounded(request,MAX_REPLAY_BYTES);
 if(!parsed.value)return reply(parsed.status,{ok:false});
 if(!validTicket(parsed.value))return reply(400,{ok:false,status:'invalid-reservation'});
 // APP557 validates the exact R2 settled pair identity; APP555 validates
 // settled owner R2, incarnation in D1, and signed Firebase response.
 let result;
 try{
  result=await replayOwnerFollowReservation556({
   reservation:parsed.value,env,now,send,enabled:true,
  });
 }catch{return reply(503,{ok:false,status:'retry-required'})}
 if(result?.status==='delivered'&&
    Number.isSafeInteger(result.deliveredRevision)&&
    result.deliveredRevision>parsed.value.priorR2Revision)
  return reply(200,{ok:true,status:'delivered',
   deliveredRevision:result.deliveredRevision});
 // The only terminal rejection is one proven by APP555 Auth epoch or by
 // the Firebase receiver's explicit 409, never a transport 403 or 5xx.
 if(result?.status==='rejected-generation')
  return reply(409,{ok:false,status:'rejected-generation'});
 return reply(503,{ok:false,status:'retry-required'});
}
