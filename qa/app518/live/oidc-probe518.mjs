// One-shot GitHub OIDC claim diagnosis. NO cloud account or data calls,
// mutations, secrets printing, or token printing.
import {verifyGithubOidcQa518}
 from '../../../cloudflare/media-worker/src/app518QaGithubOidc518.js';
const expected={
 iss:'https://token.actions.githubusercontent.com',
 repository:'andrawing1212/soridraw-music',
 repository_id:'1188157610',
 repository_owner_id:'268937716',
 actor_id:'268937716',
 workflow_ref:'andrawing1212/soridraw-music/.github/workflows/app782-app518-qa-firebase-wif-readonly.yml@refs/heads/main',
 event_name:'issue_comment',
 ref:'refs/heads/main',
 sha:process.env.GITHUB_SHA,
 run_id:process.env.GITHUB_RUN_ID,
 run_attempt:'1',
 aud:'soridraw-app518-qa-'+process.env.GITHUB_RUN_ID,
};
const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
url.searchParams.set('audience',expected.aud);
const req=await fetch(url,{method:'GET',redirect:'error',
 headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},
 signal:AbortSignal.timeout(12000)});
if(req.status!==200)throw Error('APP518_QA_OIDC_ISSUER_UNAVAILABLE');
const token=(await req.json())?.value;
if(typeof token!=='string'||token.split('.').length!==3)
 throw Error('APP518_QA_OIDC_TOKEN_INVALID');
const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
const checks=Object.fromEntries(Object.entries(expected).map(([key,value])=>[
 key,String(claims[key])===String(value),
]));
const now=Math.floor(Date.now()/1000);
checks.iat_recent=Number.isInteger(claims.iat)&&claims.iat>=now-180&&claims.iat<=now+20;
checks.exp_valid=Number.isInteger(claims.exp)&&claims.exp>now;
checks.nbf_valid=!claims.nbf||claims.nbf<=now+20;
checks.header_rs256=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString()).alg==='RS256';
console.log('APP518_QA_OIDC_SIGNED_FIELD_MATCHES='+JSON.stringify(checks));
try{
 const proof=await verifyGithubOidcQa518({
  token,runId:expected.run_id,workflowSha:expected.sha,nowMs:Date.now(),
 });
 if(proof.source!=='GITHUB_VERIFIED_OIDC_RSA_SIGNATURE')
  throw Error('HOLD_QA_VERIFIED_PROOF_WRONG');
 console.log('APP518_QA_OIDC_LIVE_JWKS_RSA_VERIFY=PASS');
}catch(error){
 console.log('APP518_QA_OIDC_LIVE_JWKS_RSA_VERIFY=HOLD_'+
  String(error?.message||'UNKNOWN').slice(0,100));
 process.exitCode=2;
}
console.log('APP518_QA_OIDC_PROBE_READONLY=PASS; CLOUD_DEPLOYMENTS=0; DATA_WRITES=0');
