// APP539 source-only candidate of a Firebase Functions HTTP endpoint.
// No live index import, no exports in securedIndex, no deployed secret,
// no shared Firebase initialization at module import time.
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import {getAuth} from "firebase-admin/auth";
import {getDatabase} from "firebase-admin/database";
import {
 parseSignedReceipt533,deliverOwnerFollower533,
} from "./owner-follow-auth-533.mjs";

export const APP539_FUNCTIONS_HTTP_COMPILED_OPEN=false;
const SECRET_539=defineSecret("SORIDRAW_OWNER_FOLLOW_HMAC_539");
const MAX_BODY=512;
const HEADER_AT="x-soridraw-follow-relay529-at";
const HEADER_SIG="x-soridraw-follow-relay529-signature";
const send=(res,status,body)=>{
 res.statusCode=status;
 res.setHeader("Cache-Control","private,no-store");
 res.setHeader("Content-Type","application/json; charset=utf-8");
 res.end(JSON.stringify(body));
};
async function bodyFromHttp(req){
 if(Buffer.isBuffer(req.rawBody))return req.rawBody;
 const chunks=[];
 let size=0;
 for await (const chunk of req){
  const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  size+=b.length;
  if(size>MAX_BODY)throw Error("APP539_BODY_TOO_LARGE");
  chunks.push(b);
 }
 return Buffer.concat(chunks);
}
export const createOwnerFollowHttp539=({
 auth,database,secret,now=Date.now,deliver=deliverOwnerFollower533,
}={})=>async(req,res)=>{
 res.setHeader("Cache-Control","private,no-store");
 if(req.method!=="POST")return send(res,405,{ok:false,error:"METHOD_NOT_ALLOWED"});
 let body;
 try{body=await bodyFromHttp(req);}
 catch{return send(res,413,{ok:false,error:"BODY_REJECTED"});}
 if(body.length<50||body.length>MAX_BODY)return send(res,403,{ok:false,error:"INVALID_RECEIPT"});
 const at=String(req.headers?.[HEADER_AT]||"");
 const signature=String(req.headers?.[HEADER_SIG]||"");
 const rawBody=body.toString("utf8");
 const parsed=parseSignedReceipt533(rawBody,at,signature,secret,now());
 if(!parsed||!auth||!database)return send(res,403,{ok:false,error:"INVALID_RECEIPT"});
 try{
  const outcome=await deliver({
   auth,database,rawBody,at,signature,secret,now,
  });
  if(!outcome?.accepted){
   // Deleted/recreated owner is NEVER acknowledged. The durable D1
   // outbox must not mark an old incarnation as successfully delivered.
   return send(res,409,{ok:false,error:"STALE_OR_RETIRED_GENERATION"});
  }
  return send(res,200,{ok:true,applied:outcome.applied===true});
 }catch{
  return send(res,503,{ok:false,error:"ISOLATED_OWNER_DELIVERY_UNAVAILABLE"});
 }
};
// The exact handler above is what a future Functions v2 onRequest would
// execute. The registered export remains hardcoded disabled, and this
// module is not imported by the real Functions securedIndex.
export const publishOwnerFollowHttp539=onRequest({
 region:"asia-northeast3",secrets:[SECRET_539],
 cors:false,timeoutSeconds:15,maxInstances:3,
},async(req,res)=>{
 if(!APP539_FUNCTIONS_HTTP_COMPILED_OPEN)
  return send(res,503,{ok:false,error:"APP539_DISABLED"});
 return createOwnerFollowHttp539({
  auth:getAuth(),database:getDatabase(),secret:SECRET_539.value(),
 })(req,res);
});
