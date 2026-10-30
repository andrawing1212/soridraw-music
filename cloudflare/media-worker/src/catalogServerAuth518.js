// app518 server-to-server HMAC. UNWIRED, no public endpoint.
// Only exact HTTPS POST requests with a secret signature and a bounded
// timestamp window are accepted. No browser Firebase Auth / App Check token
// can substitute for a server-held secret. Replay is harmless ONLY because
// the recipient has exact uid+docId+source-version D1 idempotency.
const txt=x=>typeof x==='string'?x.trim():'';
const timestamp=x=>/^\d{13}$/.test(txt(x))?Number(x):NaN;
const hex=x=>/^[0-9a-f]{64}$/.test(txt(x));
const MAX_BYTES=4096;
const MAX_SKEW_MS=5*60*1000;
const bytes=s=>new TextEncoder().encode(s);
const decodeHex=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));

export const verifyServerRequest518=async({request,secret,nowMs}={})=>{
 if(!request||request.method!=='POST'||typeof secret!=='string'
   ||bytes(secret).length<32||!Number.isSafeInteger(nowMs))
   return {code:'DENY_SERVER_AUTH_CONFIGURATION'};
 if(!request.url?.startsWith('https://'))
   return {code:'DENY_UNTRUSTED_TRANSPORT'};
 const ct=txt(request.headers?.get('content-type')||'').toLowerCase();
 if(ct!=='application/json')return {code:'DENY_CONTENT_TYPE'};
 const rawTs=txt(request.headers?.get('x-soridraw-server-time-518'));
 const ts=timestamp(rawTs);
 if(!Number.isSafeInteger(ts)||Math.abs(nowMs-ts)>MAX_SKEW_MS)
   return {code:'DENY_TIMESTAMP_WINDOW'};
 const signature=txt(request.headers?.get('x-soridraw-server-signature-518'));
 if(!hex(signature))return {code:'DENY_SIGNATURE_FORMAT'};
 const len=Number(request.headers?.get('content-length'));
 if(Number.isFinite(len)&&len>MAX_BYTES)return {code:'DENY_PAYLOAD_SIZE'};
 let raw;
 try{raw=await request.text();}catch{return {code:'DENY_BODY_READ'};}
 if(bytes(raw).length>MAX_BYTES||raw.length===0)
   return {code:'DENY_PAYLOAD_SIZE'};
 const signed=bytes(rawTs+'\n'+raw);
 try{
  const key=await crypto.subtle.importKey(
   'raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const valid=await crypto.subtle.verify(
   {name:'HMAC'},key,decodeHex(signature),signed);
  if(!valid)return {code:'DENY_BAD_SIGNATURE'};
 }catch{return {code:'DENY_BAD_SIGNATURE'};}
 let parsed;
 try{parsed=JSON.parse(raw);}catch{return {code:'DENY_BAD_JSON'};}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)
   ||!['enqueue','exact-source','retry'].includes(parsed.action)
   ||!/^.{1,128}$/.test(txt(parsed.uid))
   ||!/^.{1,240}$/.test(txt(parsed.documentId))
   ||/[\\/]/.test(parsed.uid)||/[\\/]/.test(parsed.documentId))
   return {code:'DENY_SIGNED_REQUEST_SHAPE'};
 if(parsed.action==='enqueue'
   &&(!/^\d{21}$/.test(txt(parsed.sourceVersionNs))
     ||!['saved','removed'].includes(parsed.desiredState)))
   return {code:'DENY_SIGNED_MUTATION_SHAPE'};
 return {code:'VERIFIED_SERVER_REQUEST',payload:parsed};
};
