// APP547: source-only PREVIEW live Firebase Admin incarnation proof.
// A 60s-old signed enrolment event by itself is NOT proof the Auth user still
// exists. Every D1 bind requires a fresh, nonce-bound, HMAC-authenticated
// Firebase Admin verification before and after its guarded UPDATE.
// No page-entry query, poll, user scan, or cross-environment activation.
export const OWNER_FOLLOW_AUTH_PROOF_547_COMPILED_OPEN=false;
export const OWNER_FOLLOW_AUTH_PROOF_ENDPOINT_547=
 'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/verifyOwnerFollowEpoch547Candidate';
const UID=/^[A-Za-z0-9_-]{1,128}$/,EPOCH=/^[0-9a-f]{32}$/,HEX=/^[0-9a-f]{64}$/;
const encode=text=>new TextEncoder().encode(text);
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const unhex=text=>new Uint8Array(text.match(/../g).map(x=>parseInt(x,16)));
async function hmacKey(secret){
 if(typeof secret!=='string'||secret.length<32)
  throw Error('547_MISSING_PROOF_SECRET');
 return crypto.subtle.importKey('raw',encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function verifyLiveOwnerEpoch547({
 event,env,now=Date.now,send=fetch,
 enabled=OWNER_FOLLOW_AUTH_PROOF_547_COMPILED_OPEN,
}={}){
 if(!enabled||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547!=='1')
  throw Error('547_AUTH_PROOF_DISABLED');
 if(!event||!['bind','revoke'].includes(event.action)||
    !UID.test(String(event.uid||''))||
    !EPOCH.test(String(event.authEpoch||''))||
    !Number.isSafeInteger(event.authCreatedAtMs)||event.authCreatedAtMs<=0)
  throw Error('547_INVALID_PROOF_SUBJECT');
 const key=await hmacKey(env.SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544);
 const at=now();
 if(!Number.isSafeInteger(at)||at<=0)throw Error('547_INVALID_CLOCK');
 const nonce=hex(crypto.getRandomValues(new Uint8Array(16)));
 const body=JSON.stringify({
  action:event.action,at,authCreatedAtMs:event.authCreatedAtMs,
  authEpoch:event.authEpoch,nonce,uid:event.uid,
 });
 const signature=hex(new Uint8Array(await crypto.subtle.sign(
  'HMAC',key,encode(at+'.'+body))));
 let result;
 try{
  result=await send(OWNER_FOLLOW_AUTH_PROOF_ENDPOINT_547,{
   method:'POST',headers:{
    'Content-Type':'application/json','X-Soridraw-Owner-Epoch-Proof-At':String(at),
    'X-Soridraw-Owner-Epoch-Proof-Signature':signature,
   },body,
  });
 }catch{throw Error('547_AUTH_PROOF_TRANSPORT_UNAVAILABLE')}
 if(result?.status===409||result?.status===403)return false;
 if(!result?.ok)throw Error('547_AUTH_PROOF_SERVER_UNAVAILABLE');
 const raw=await result.text();
 if(raw.length<70||raw.length>512)throw Error('547_INVALID_AUTH_PROOF');
 const signed=String(result.headers?.get('X-Soridraw-Owner-Epoch-Proof-Signature')||'');
 if(!HEX.test(signed)||!(await crypto.subtle.verify(
   'HMAC',key,unhex(signed),encode(raw))))
  throw Error('547_AUTH_PROOF_SIGNATURE_INVALID');
 let data;
 try{data=JSON.parse(raw)}catch{throw Error('547_AUTH_PROOF_FORMAT_INVALID')}
 if(!data||Object.keys(data).sort().join(',')!==
    'action,at,authCreatedAtMs,authEpoch,nonce,ok,uid'||
    data.ok!==true||data.action!==event.action||data.uid!==event.uid||
    data.authEpoch!==event.authEpoch||
    data.authCreatedAtMs!==event.authCreatedAtMs||
    data.nonce!==nonce||
    !Number.isSafeInteger(data.at)||Math.abs(now()-data.at)>10000||
    data.at<at-10000)
  throw Error('547_AUTH_PROOF_GENERATION_MISMATCH');
 return true;
}
