// APP713: verify one current Auth generation immediately before canonical
// follow settlement, through a PREVIEW-scoped Firebase Admin HTTPS oracle.
// No bearer token enters DO storage; HMAC is domain-separated from APP539.
export const APP713_ACTOR_ORACLE_COMPILED_OPEN=false;
const DOMAIN='soridraw:preview:actor-proof:713';
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/verifyExploreFollowActor713';
const CANARY='rcZ2GZrBndOZzT8C635eiNBjYIJ2';
const UID=/^[A-Za-z0-9_-]{1,128}$/,OP=/^[A-Za-z0-9_-]{16,128}$/;
const encode=s=>new TextEncoder().encode(s);
const hex=arr=>Array.from(new Uint8Array(arr),x=>x.toString(16).padStart(2,'0')).join('');
const unhex=s=>new Uint8Array(s.match(/../g).map(x=>parseInt(x,16)));
export async function verifyCurrentActor713({
 actorUid,operationId,issuedAtSec,env,now=Date.now,send=fetch,
 enabled=true,
}={}){
 if(enabled!==true||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_FOLLOW_SERVER_CLICK_713!=='1'||
    env?.SORIDRAW_FOLLOW_CANARY_UID_713!==CANARY||
    actorUid!==CANARY||!UID.test(String(actorUid||''))||
    !OP.test(String(operationId||''))||
    !Number.isSafeInteger(issuedAtSec)||issuedAtSec<=0)
  return false;
 const secret=env?.SORIDRAW_OWNER_FOLLOW_HMAC_539;
 if(typeof secret!=='string'||secret.length<32)return false;
 try{
  const base=await crypto.subtle.importKey('raw',encode(secret),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const derived=await crypto.subtle.sign('HMAC',base,encode(DOMAIN));
  const key=await crypto.subtle.importKey('raw',derived,
   {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  const at=now(),nonce=hex(crypto.getRandomValues(new Uint8Array(16)));
  const body=JSON.stringify({actorUid,operationId,issuedAtSec,at,nonce});
  const sig=hex(await crypto.subtle.sign('HMAC',key,encode(at+'.'+body)));
  const result=await send(ENDPOINT,{method:'POST',headers:{
   'Content-Type':'application/json','X-Soridraw-Actor-713-At':String(at),
   'X-Soridraw-Actor-713-Signature':sig,
  },body,signal:AbortSignal.timeout(15000)});
  if(result?.status!==200)return false;
  const raw=await result.text();
  if(raw.length<65||raw.length>512)return false;
  const answerSig=String(result.headers?.get('X-Soridraw-Actor-713-Proof')||'');
  if(!/^[a-f0-9]{64}$/.test(answerSig)||
     !(await crypto.subtle.verify('HMAC',key,unhex(answerSig),encode(raw))))
   return false;
  const answer=JSON.parse(raw);
  return answer?.ok===true&&answer.actorUid===actorUid&&
   answer.operationId===operationId&&answer.issuedAtSec===issuedAtSec&&
   answer.nonce===nonce&&Number.isSafeInteger(answer.at)&&
   Math.abs(now()-answer.at)<=15000;
 }catch{return false}
}
