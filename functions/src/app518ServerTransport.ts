/**
 * app518 UNWIRED Firebase Admin <-> Cloudflare service transport.
 * This has NO live HTTP trigger export or secret configuration. The body
 * bytes are MACed exactly as sent, and the receiver verifies those bytes
 * before parsing any user-supplied UID/document ID. Requests expire in 5m.
 * Every replay must still pass exact canonical read and versioned D1 CAS.
 */
import {createHmac,timingSafeEqual} from "node:crypto";
import * as admin from "firebase-admin";
import {readExactApp518Source, type App518Source} from "./app518CanonicalSourceProvider";
const valid=(s:string,n=240)=>s.length>0&&s.length<=n&&!/[\\/]/.test(s);
export type App518ServicePayload={
 action:"enqueue"|"exact-source"|"retry";
 uid:string; documentId:string;
 sourceVersionNs?:string; desiredState?:"saved"|"removed";
};
export const signApp518ServiceRequest=({
 secret,body,nowMs,
}:{secret:string;body:App518ServicePayload;nowMs:number})=>{
 if(Buffer.byteLength(secret)<32||!Number.isSafeInteger(nowMs)
    ||!valid(body.uid,128)||!valid(body.documentId))
  throw new Error("APP518_DENY_SIGNER_INPUT");
 const serialized=JSON.stringify(body);
 if(Buffer.byteLength(serialized)>4096)throw new Error("APP518_PAYLOAD_TOO_LARGE");
 const time=String(nowMs);
 const signature=createHmac("sha256",secret).update(time+"\n"+serialized).digest("hex");
 return {body:serialized,headers:{
  "content-type":"application/json",
  "x-soridraw-server-time-518":time,
  "x-soridraw-server-signature-518":signature,
 }};
};
type ServerRequest={
 method:string;
 headers:Record<string,string|string[]|undefined>;
 rawBody:Buffer;
};
const header=(req:ServerRequest,k:string)=>{
 const value=req.headers[k];
 return typeof value==="string"?value:"";
};

/** Call only from an explicitly approved internal HTTPS function endpoint. */
export const handleVerifiedApp518ExactSource=async({
 request,db,secret,nowMs,
}:{
 request:ServerRequest;db:admin.firestore.Firestore;secret:string;nowMs:number;
}):Promise<{status:number;code:string;source?:unknown}>=>{
 if(request?.method!=="POST"||Buffer.byteLength(secret)<32
   ||!Number.isSafeInteger(nowMs)||!Buffer.isBuffer(request.rawBody)
   ||request.rawBody.byteLength>4096)
  return {status:403,code:"DENY_SERVER_CONFIGURATION"};
 const time=header(request,"x-soridraw-server-time-518");
 const signature=header(request,"x-soridraw-server-signature-518");
 const stamp=Number(time);
 if(!/^\d{13}$/.test(time)||!Number.isSafeInteger(stamp)
   ||Math.abs(stamp-nowMs)>300_000||!/^[0-9a-f]{64}$/.test(signature))
  return {status:403,code:"DENY_SERVER_SIGNATURE"};
 const expected=createHmac("sha256",secret).update(time+"\n").update(request.rawBody).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))
  return {status:403,code:"DENY_SERVER_SIGNATURE"};
 let body:App518ServicePayload;
 try{body=JSON.parse(request.rawBody.toString("utf8")) as App518ServicePayload;}
 catch{return {status:400,code:"DENY_BAD_JSON"};}
 if(!body||body.action!=="exact-source"||
   typeof body.uid!=="string"||typeof body.documentId!=="string"||
   !valid(body.uid,128)||!valid(body.documentId))
  return {status:400,code:"DENY_REQUEST_SHAPE"};
 // One server-only exact Firestore read, never an entire favorites collection.
 const result=await readExactApp518Source(db,body.uid,body.documentId);
 if(result.code!=="SOURCE_VERIFIED")
  return {status:409,code:result.code};
 return {status:200,code:"SOURCE_VERIFIED",source:result.source};
};


/**
 * Future authenticated Firebase -> Cloudflare dispatcher. No live listener.
 * Caller MUST provide the exact server-rechecked source, not event.after.
 * Failed requests throw so a future durable event delivery can retry.
 */
export const dispatchApp518VerifiedEnqueue=async({
  source,secret,workerUrl,expectedHostname,nowMs,post=fetch,
}:{
  source:App518Source;secret:string;workerUrl:string;
  expectedHostname:string;nowMs:number;post?:typeof fetch;
}):Promise<{code:string}>=>{
  let dest:URL;
  try{dest=new URL(workerUrl);}catch{throw Error("APP518_WORKER_URL_INVALID");}
  if(dest.protocol!=="https:"||dest.hostname!==expectedHostname
    ||dest.username||dest.password||dest.hash||dest.search||dest.port)
    throw Error("APP518_WORKER_HOST_NOT_PINNED");
  if(source.verifiedByServer!==true||source.origin!=="server-exact-read"
    ||!valid(source.uid,128)||!valid(source.documentId)
    ||!["saved","removed"].includes(source.state)
    ||typeof source.updateTime!=="string")
    throw Error("APP518_SOURCE_UNVERIFIED");
  // Same fixed-width nanosecond representation as D1 outbox; no client time.
  const updateTime=source.updateTime;
  const iso=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(updateTime);
  if(!iso)throw Error("APP518_SOURCE_UPDATE_TIME_INVALID");
  const epochMs=Date.parse(iso[1]+"Z");
  if(!Number.isFinite(epochMs)||epochMs<=0
    ||new Date(epochMs).toISOString().slice(0,19)!==iso[1])
    throw Error("APP518_SOURCE_UPDATE_TIME_INVALID");
  const version=(BigInt(epochMs)*1_000_000n+
    BigInt((iso[2]||"").padEnd(9,"0")||"0")).toString().padStart(21,"0");
  const signed=signApp518ServiceRequest({secret,nowMs,body:{
    action:"enqueue",uid:source.uid,documentId:source.documentId,
    sourceVersionNs:version,desiredState:source.state,
  }});
  const response=await post(dest.href,{method:"POST",headers:signed.headers,
    body:signed.body,redirect:"error"});
  if(!response.ok)throw Error("APP518_WORKER_ENQUEUE_RETRYABLE");
  const result=await response.json() as {code?:string};
  if(!["ENQUEUED","STALE_OR_DUPLICATE"].includes(result?.code||""))
    throw Error("APP518_WORKER_ENQUEUE_UNVERIFIED");
  return {code:result.code||""};
};
