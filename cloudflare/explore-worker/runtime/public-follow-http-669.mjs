// APP669 isolated sender, not used by any active Worker or public route.
// Must be invoked only from the existing durable owner-follow replay, after
// its exact pair reservation and canonical commit have been established.
import {createVerifiedPublicFollowClaim669} from './public-follow-proven-pair-669.mjs';
const ENDPOINT='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExplorePublicFollow669';
const DOMAIN='soridraw:preview:public-follow-669';
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const sign=async(raw,baseSecret)=>{
 if(typeof baseSecret!=='string'||baseSecret.length<32)throw Error('669_SECRET_MISSING');
 const encoder=new TextEncoder();
 const imported=await crypto.subtle.importKey('raw',encoder.encode(baseSecret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const derived=hex(await crypto.subtle.sign('HMAC',imported,encoder.encode(DOMAIN)));
 const key=await crypto.subtle.importKey('raw',encoder.encode(derived),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(raw)));
};
export async function deliverVerifiedPublicFollow669({
 reservation,env,now=Date.now,send=fetch,issuer=createVerifiedPublicFollowClaim669,
 enabled=false,
}={}){
 if(!enabled||env?.SORIDRAW_ENVIRONMENT!=='preview'||
    env?.SORIDRAW_PUBLIC_FOLLOW_READY_669!=='1')
  return {status:'disabled'};
 if(env?.SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669!==ENDPOINT)
  return {status:'endpoint-hold'};
 const proof=await issuer({reservation,env,now});
 if(proof?.ready!==true)return {status:proof?.status||'proof-failed'};
 const raw=JSON.stringify(proof.claim);
 if(new TextEncoder().encode(raw).byteLength>2048)return {status:'oversized'};
 const secret=env.SORIDRAW_OWNER_FOLLOW_HMAC_539;
 let signature;
 try{signature=await sign(raw,secret)}catch{return {status:'signing-unavailable'}}
 let response;
 try{
  response=await send(ENDPOINT,{method:'POST',headers:{
   'Content-Type':'application/json',
   'X-Soridraw-Public-Follow-669-At':String(proof.claim.signedAtMs),
   'X-Soridraw-Public-Follow-669-Signature':signature,
  },body:raw});
 }catch{return {status:'transport-retry'}}
 const reply=await response?.json?.().catch(()=>null);
 if(response?.ok===true&&reply?.ok===true)
  return {status:'delivered',deliveredRevision:proof.claim.target.revision};
 if(response?.status===409)return {status:'generation-hold'};
 return {status:'receiver-retry'};
}
