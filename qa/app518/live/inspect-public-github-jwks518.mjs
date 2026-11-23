// APP518 QA: acquire an ephemeral OFFICIAL public signing-key snapshot on
// the authenticated GitHub runner, not inside the Cloudflare Worker.
// Never log JWT, token request URL, cloud credentials, or the public keys.
import {verifyGithubOidcQa518}
 from '../../../cloudflare/media-worker/src/app518QaGithubOidc518.js';
const CONFIG='https://token.actions.githubusercontent.com/.well-known/openid-configuration';
const JWKS='https://token.actions.githubusercontent.com/.well-known/jwks';
const fail=x=>{throw new Error(x);};
export async function getPinnedGithubPublicJwks518({
 runId,workflowSha,nowMs=Date.now(),
 requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
 requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
 fetcher=fetch,
}={}){
 if(!/^[0-9]{8,20}$/.test(runId||'')
  ||!/^[a-f0-9]{40}$/.test(workflowSha||'')
  ||typeof requestUrl!=='string'||!requestUrl.startsWith('https://')
  ||typeof requestToken!=='string'||requestToken.length<20
  ||typeof fetcher!=='function')fail('HOLD_QA_JWKS_TRUSTED_RUN_REQUIRED');
 const get=async(url,headers)=>{
  const res=await fetcher(url,{method:'GET',redirect:'error',
   headers,signal:AbortSignal.timeout(12000)});
  if(res?.status!==200)fail('HOLD_QA_GITHUB_PUBLIC_KEY_OR_TOKEN_UNAVAILABLE');
  try{return await res.json();}catch{fail('HOLD_QA_GITHUB_PUBLIC_KEY_OR_TOKEN_UNAVAILABLE');}
 };
 const config=await get(CONFIG,{Accept:'application/json'});
 if(config?.issuer!=='https://token.actions.githubusercontent.com'
  ||config?.jwks_uri!==JWKS
  ||!config?.id_token_signing_alg_values_supported?.includes('RS256'))
  fail('HOLD_QA_GITHUB_SIGNING_DISCOVERY_CHANGED');
 const published=await get(JWKS,{Accept:'application/json'});
 if(!Array.isArray(published?.keys)||published.keys.length<1
  ||published.keys.length>10)fail('HOLD_QA_JWKS_KEY_COUNT');
 const keys=published.keys.map(k=>{
  if(k?.kty!=='RSA'||(k.alg&&k.alg!=='RS256')
   ||(k.use&&k.use!=='sig')
   ||!/^[A-Za-z0-9_:-]{1,128}$/.test(k.kid||'')
   ||!/^[A-Za-z0-9_-]{200,1200}$/.test(k.n||'')
   ||k.e!=='AQAB')fail('HOLD_QA_JWKS_KEY_CONTRACT');
  return {kty:'RSA',alg:'RS256',use:'sig',kid:k.kid,n:k.n,e:k.e};
 });
 if(new Set(keys.map(k=>k.kid)).size!==keys.length)
  fail('HOLD_QA_JWKS_DUPLICATE_KID');
 const issuerUrl=new URL(requestUrl);
 if(issuerUrl.protocol!=='https:')
  fail('HOLD_QA_ISSUER_REQUEST_URL');
 issuerUrl.searchParams.set('audience','soridraw-app518-qa-'+runId);
 const data=await get(issuerUrl.toString(),{
  Authorization:'Bearer '+requestToken,Accept:'application/json',
 });
 if(typeof data?.value!=='string'||data.value.length>14000)
  fail('HOLD_QA_GITHUB_TOKEN_NOT_ISSUED');
 // Verify a REAL token from exactly this owner-run/workflow against the
 // discovered key BEFORE embedding the public snapshot in the QA-only worker.
 await verifyGithubOidcQa518({
  token:data.value,runId,workflowSha,nowMs,
  pinnedJwks:{keys},pinnedAtMs:nowMs,
  fetcher:()=>{throw Error('MUST_NOT_FETCH_KEYS_AGAIN')},
 });
 return Object.freeze({keys,issuedAtMs:nowMs,expiresAtMs:nowMs+600000});
}
