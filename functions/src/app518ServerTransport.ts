/**
 * app518 UNWIRED Firebase Admin <-> Cloudflare service transport.
 * This has NO live HTTP trigger export or secret configuration. The body
 * bytes are MACed exactly as sent, and the receiver verifies those bytes
 * before parsing any user-supplied UID/document ID. Requests expire in 5m.
 * Every replay must still pass exact canonical read and versioned D1 CAS.
 */
import {createHmac,timingSafeEqual} from "node:crypto";
import * as admin from "firebase-admin";
import {readExactApp518Source} from "./app518CanonicalSourceProvider";
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
