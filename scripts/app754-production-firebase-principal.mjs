// APP754: signed Firebase Auth + App Check verifier for the EXISTING production
// web app. SOURCE ONLY, NOT imported by an active Explore Worker. Zero admin
// credentials, D1/R2/DO/Functions/RTDB access, user-data reads, or deployment.
// Project/app identity verified against BOTH existing preview and production
// src/firebase.js. Never accept QA project tokens or a caller-asserted uid.
const PROJECT='soridraw-app-866a5';
const NUMBER='91309780603';
const WEB_APP='1:91309780603:web:cde703895e2cf31ecffcde';
const AUTH_JWKS='https://www.googleapis.com/service_accounts/v1/metadata/jwk/securetoken@system.gserviceaccount.com';
const APP_JWKS='https://firebaseappcheck.googleapis.com/v1/jwks';
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const KID=/^[A-Za-z0-9_-]{1,256}$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const FOLLOW=/^\/v1\/profiles\/[A-Za-z0-9_-]{1,128}\/follow$/;
const ORIGINS=new Set(['https://soridraw.com','https://www.soridraw.com',
  'https://soridraw.web.app','https://soridraw.firebaseapp.com']);
const fail=()=>{throw Error('APP754_PRODUCTION_SIGNED_PRINCIPAL_REQUIRED')};
function decode(s){
 try{
  if(typeof s!=='string'||s.length<1||s.length>12000)fail();
  const padded=s.replace(/-/g,'+').replace(/_/g,'/')+
    '='.repeat((4-s.length%4)%4);
  return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
 }catch{fail()}
}
function jsonPart(s){
 try{return JSON.parse(new TextDecoder().decode(decode(s)))}catch{fail()}
}
const safeInt=n=>Number.isSafeInteger(n)&&n>0;
function checkClaims(x,auth,now){
 if(!x||typeof x!=='object'||!safeInt(x.iat)||!safeInt(x.exp)||
    x.exp<=now||x.exp<=x.iat||x.iat>now+30||
    (x.nbf!==undefined&&(!safeInt(x.nbf)||x.nbf>now+30)))fail();
 if(auth){
  if(x.iss!=='https://securetoken.google.com/'+PROJECT||
     x.aud!==PROJECT||!UID.test(x.sub||'')||
     !safeInt(x.auth_time)||x.auth_time>now+30)fail();
 }else if(x.iss!=='https://firebaseappcheck.googleapis.com/'+NUMBER||
    !Array.isArray(x.aud)||!x.aud.includes('projects/'+NUMBER)||
    x.sub!==WEB_APP)fail();
}
export const APP754_PRODUCTION_PRINCIPAL_COMPILED_OPEN=false;
export function createApp754ProductionPrincipalVerifier({
 send=fetch,now=Date.now,subtle=globalThis.crypto?.subtle,
}={}){
 if(typeof send!=='function'||typeof now!=='function'||!subtle)fail();
 const cache=new Map();
 async function getKeys(url){
  const prior=cache.get(url);
  if(prior&&now()<prior.expires)return prior.keys;
  let resp;
  try{
   // Cloudflare Workers rejects redirect:'error'. Redirects must NOT follow.
   resp=await send(url,{method:'GET',redirect:'manual',
     headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  }catch{fail()}
  if(!resp?.ok||resp.status!==200)fail();
  let data;
  try{data=await resp.json()}catch{fail()}
  if(!Array.isArray(data?.keys)||data.keys.length<1||data.keys.length>30)
    fail();
  const keys=data.keys.filter(k=>k?.kty==='RSA'&&KID.test(k.kid||'')&&
    typeof k.n==='string'&&k.n.length>0&&typeof k.e==='string'&&k.e.length>0&&
    (!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));
  if(!keys.length)fail();
  const maxAge=/\bmax-age=(\d+)\b/i.exec(resp.headers?.get('cache-control')||'');
  const ttl=Math.min(21600,Math.max(0,Number(maxAge?.[1]||300)));
  cache.set(url,{keys,expires:now()+ttl*1000});
  return keys;
 }
 async function signedClaims(token,endpoint,auth){
  if(typeof token!=='string'||token.length<90||token.length>12000||
     !JWT.test(token)||!subtle)fail();
  const [header,body,signature]=token.split('.');
  const h=jsonPart(header);
  if(h?.alg!=='RS256'||h?.typ!=='JWT'||!KID.test(h.kid||'')||
     h.jku!==undefined||h.x5u!==undefined||h.crit!==undefined)fail();
  const key=(await getKeys(endpoint)).find(x=>x.kid===h.kid);
  if(!key)fail();
  let verified=false;
  try{
   const publicKey=await subtle.importKey('jwk',key,
     {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
   verified=await subtle.verify('RSASSA-PKCS1-v1_5',publicKey,
     decode(signature),new TextEncoder().encode(header+'.'+body));
  }catch{fail()}
  if(!verified)fail();
  const claims=jsonPart(body);
  checkClaims(claims,auth,Math.floor(now()/1000));
  return claims;
 }
 return async function verifyFirebasePrincipal({request,env}={}){
  // A deny result does not identify which credential failed. Never log token,
  // claims, key id, UID, signing material or raw upstream error.
  const denied={verifiedAuth:false,verifiedAppCheck:false};
  try{
   if(env?.SORIDRAW_ENVIRONMENT!=='production'||
      !request||!['PUT','DELETE'].includes(request.method)||
      !FOLLOW.test(new URL(request.url).pathname))return denied;
   const origin=request.headers.get('Origin');
   if(origin&&!ORIGINS.has(origin))return denied;
   const bearer=/^Bearer ([A-Za-z0-9._-]+)$/.exec(
     request.headers.get('Authorization')||'');
   const appCheck=request.headers.get('X-Firebase-AppCheck');
   if(!bearer||!appCheck)return denied;
   // Both identities are cryptographically verified. Never forward either JWT
   // to DO, D1/R2, Functions, logs, or client-visible errors.
   const auth=await signedClaims(bearer[1],AUTH_JWKS,true);
   await signedClaims(appCheck,APP_JWKS,false);
   return {verifiedAuth:true,verifiedAppCheck:true,
     firebaseProjectId:PROJECT,uid:auth.sub};
  }catch{return denied}
 };
}
