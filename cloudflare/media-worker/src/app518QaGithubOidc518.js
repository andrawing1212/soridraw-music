// APP518 QA-only admission: verify a *GitHub-signed* OIDC JWT.
// Imported solely by a dedicated, temporary isolated Worker entrypoint.
// It never changes the PR #528 default (OFF) export or other Worker routes.
const ISSUER='https://token.actions.githubusercontent.com';
const JWKS='https://token.actions.githubusercontent.com/.well-known/jwks';
const REPO='andrawing1212/soridraw-music';
const REPO_ID='1188157610';
const OWNER_ID='268937716';
const WORKFLOW=REPO+'/.github/workflows/app782-app518-qa-firebase-wif-readonly.yml@refs/heads/main';
const fail=code=>{throw new Error(code);};
const text=x=>typeof x==='string'?x:'';
const b64decode=s=>{
 if(!/^[a-zA-Z0-9_-]+$/.test(s)||s.length>10000)fail('HOLD_QA_MALFORMED_OIDC');
 const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4);
 try{return Uint8Array.from(atob(padded),ch=>ch.charCodeAt(0));}
 catch{fail('HOLD_QA_MALFORMED_OIDC');}
};
const obj=bytes=>{
 try{
  const v=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!v||typeof v!=='object'||Array.isArray(v))fail('HOLD_QA_MALFORMED_OIDC');
  return v;
 }catch{fail('HOLD_QA_MALFORMED_OIDC');}
};
const timeClaims=(p,nowMs)=>{
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(p.iat)
  ||!Number.isSafeInteger(p.exp)||!Number.isSafeInteger(p.nbf||0))
  fail('HOLD_QA_OIDC_TIME');
 const now=Math.floor(nowMs/1000);
 if(p.iat>now+20||p.iat<now-180||p.exp<=now||p.exp>p.iat+360
  ||p.nbf>now+20)fail('HOLD_QA_OIDC_EXPIRED_OR_REPLAY');
};
export const verifyGithubOidcQa518=async({
 token,runId,workflowSha,nowMs=Date.now(),fetcher=fetch,
 pinnedJwks=null,pinnedAtMs=null,
}={})=>{
 if(!/^[0-9]{8,20}$/.test(text(runId))
  ||!/^[a-f0-9]{40}$/.test(text(workflowSha))
  ||typeof token!=='string'||token.length>14000
  ||typeof fetcher!=='function')fail('HOLD_QA_OIDC_BOUND_CONTEXT');
 const parts=token.split('.');
 if(parts.length!==3||parts.some(x=>!x))
  fail('HOLD_QA_MALFORMED_OIDC');
 const header=obj(b64decode(parts[0]));
 const claims=obj(b64decode(parts[1]));
 const signature=b64decode(parts[2]);
 if(header.alg!=='RS256'||(header.typ&&header.typ!=='JWT')
  ||!/^[a-zA-Z0-9_:-]{1,128}$/.test(text(header.kid))
  ||signature.length<128)
  fail('HOLD_QA_OIDC_UNTRUSTED_ALGORITHM');
 // All values below are within the SIGNED claims, not runtime env headers.
 if(claims.iss!==ISSUER
  ||claims.aud!=='soridraw-app518-qa-'+runId
  ||claims.repository!==REPO
  ||claims.repository_id!==REPO_ID
  ||claims.repository_owner_id!==OWNER_ID
  ||claims.actor_id!==OWNER_ID
  ||claims.workflow_ref!==WORKFLOW
  ||claims.event_name!=='issue_comment'
  ||claims.ref!=='refs/heads/main'
  ||claims.sha!==workflowSha
  ||String(claims.run_id)!==runId
  ||String(claims.run_attempt)!=='1')
  fail('HOLD_QA_OIDC_IMMUTABLE_CLAIMS');
 timeClaims(claims,nowMs);
 let jwks;
 if(pinnedJwks!==null){
  // QA-only deploy-time official GitHub PUBLIC verification material,
  // pre-verified with a real JWT from the exact owner issue-comment run.
  // Not accepted from request headers, token claims or user-supplied input.
  if(!Number.isSafeInteger(pinnedAtMs)
   ||pinnedAtMs>nowMs+20000||nowMs-pinnedAtMs>600000)
   fail('HOLD_QA_OIDC_PIN_EXPIRED');
  jwks=pinnedJwks;
 }else{
  let response;
  try{
   response=await fetcher(JWKS,{
    method:'GET',redirect:'manual',headers:{Accept:'application/json'},
    signal:AbortSignal.timeout(10000),
   });
  }catch{fail('HOLD_QA_OIDC_JWKS_UNAVAILABLE');}
  if(response?.status!==200)fail('HOLD_QA_OIDC_JWKS_UNAVAILABLE');
  try{jwks=await response.json();}
  catch{fail('HOLD_QA_OIDC_JWKS_UNAVAILABLE');}
 }
 if(!Array.isArray(jwks?.keys)||jwks.keys.length<1||jwks.keys.length>10)
  fail('HOLD_QA_OIDC_JWKS_UNAVAILABLE');
 if(new Set(jwks.keys.map(k=>k?.kid)).size!==jwks.keys.length)
  fail('HOLD_QA_OIDC_DUPLICATE_SIGNING_KID');
 const keys=jwks.keys.filter(x=>x.kid===header.kid&&x.kty==='RSA'
  &&(!x.use||x.use==='sig')&&(!x.alg||x.alg==='RS256')
  &&typeof x.n==='string'&&typeof x.e==='string');
 if(keys.length!==1)fail('HOLD_QA_OIDC_KID_UNTRUSTED');
 let ok=false;
 try{
  const key=await crypto.subtle.importKey('jwk',keys[0],
   {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,
   signature,new TextEncoder().encode(parts[0]+'.'+parts[1]));
 }catch{fail('HOLD_QA_OIDC_BAD_SIGNATURE');}
 if(!ok)fail('HOLD_QA_OIDC_BAD_SIGNATURE');
 return Object.freeze({
  source:'GITHUB_VERIFIED_OIDC_RSA_SIGNATURE',
  runId,workflowSha,expiresAtMs:claims.exp*1000,
  repoId:REPO_ID,ownerId:OWNER_ID,
 });
};
