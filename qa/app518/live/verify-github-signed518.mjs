import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyGithubOidcQa518} from '../../../cloudflare/media-worker/src/app518QaGithubOidc518.js';
const now=Date.parse('2026-11-23T02:00:00Z');
const s=Math.floor(now/1000);
const runId='45123456789',workflowSha='f'.repeat(40);
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'soridraw-qa-test-key',
 alg:'RS256',use:'sig'};
const b64u=x=>Buffer.from(x).toString('base64url');
const claims={
 iss:'https://token.actions.githubusercontent.com',
 aud:'soridraw-app518-qa-'+runId,repository:'andrawing1212/soridraw-music',
 repository_id:'1188157610',repository_owner_id:'268937716',
 actor_id:'268937716',event_name:'issue_comment',ref:'refs/heads/main',
 workflow_ref:'andrawing1212/soridraw-music/.github/workflows/app782-app518-qa-firebase-wif-readonly.yml@refs/heads/main',
 sha:workflowSha,run_id:runId,run_attempt:'1',
 iat:s-20,nbf:s-20,exp:s+180,
};
const jwt=(p=claims,kid=jwk.kid)=>{
 const input=b64u(JSON.stringify({alg:'RS256',typ:'JWT',kid}))+
  '.'+b64u(JSON.stringify(p));
 return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
};
let networkCalls=0;
const fetcher=async (url,opts)=>{
 assert.equal(url,'https://token.actions.githubusercontent.com/.well-known/jwks');
 assert.equal(opts.method,'GET');
 assert.equal(opts.redirect,'error');
 networkCalls++;
 return {status:200,json:async()=>({keys:[jwk]})};
};
const base={runId,workflowSha,nowMs:now,fetcher};
const v=await verifyGithubOidcQa518({...base,token:jwt()});
assert.equal(v.source,'GITHUB_VERIFIED_OIDC_RSA_SIGNATURE');
assert.equal(v.runId,runId);
assert.equal(v.expiresAtMs,(s+180)*1000);
const fail=async(p,reason)=>{
 await assert.rejects(()=>verifyGithubOidcQa518({...base,token:jwt(p)}),
  e=>e?.message===reason);
};
for(const [k,value] of [
 ['aud','not-the-run-audience'],
 ['repository_id','999999999'],
 ['repository_owner_id','99999'],
 ['actor_id','1234'],['workflow_ref','other/workflow.yml'],
 ['event_name','workflow_dispatch'],['ref','refs/heads/preview'],
 ['sha','0'.repeat(40)],['run_id','11111111111'],
 ['run_attempt','2'],
]){
 await fail({...claims,[k]:value},'HOLD_QA_OIDC_IMMUTABLE_CLAIMS');
}
await fail({...claims,iat:s-200},'HOLD_QA_OIDC_EXPIRED_OR_REPLAY');
await fail({...claims,exp:s-1},'HOLD_QA_OIDC_EXPIRED_OR_REPLAY');
await assert.rejects(()=>verifyGithubOidcQa518({
 ...base,token:jwt().slice(0,-2)+'XX',
}),e=>e?.message==='HOLD_QA_OIDC_BAD_SIGNATURE');
await assert.rejects(()=>verifyGithubOidcQa518({
 ...base,token:jwt(claims,'untrusted-key'),
}),e=>e?.message==='HOLD_QA_OIDC_KID_UNTRUSTED');
await assert.rejects(()=>verifyGithubOidcQa518({
 ...base,token:jwt(),fetcher:async()=>({status:403}),
}),e=>e?.message==='HOLD_QA_OIDC_JWKS_UNAVAILABLE');
const unsigned=[b64u(JSON.stringify({alg:'none',kid:jwk.kid})),
 b64u(JSON.stringify(claims)),b64u('unsigned')].join('.');
await assert.rejects(()=>verifyGithubOidcQa518({
 ...base,token:unsigned,
}),e=>e?.message==='HOLD_QA_OIDC_UNTRUSTED_ALGORITHM');
assert.ok(networkCalls>=3);
console.log('APP518_QA_GITHUB_OIDC_REAL_RSA_SIGNATURE_VERIFY=PASS');
console.log('APP518_QA_WRONG_REPO_OWNER_ACTOR_EVENT_WORKFLOW_SHA_TIME_RUN_DENIED=PASS');
console.log('APP518_QA_JWKS_FAIL_CLOSED_AND_UNSIGNED_TOKENS_DENIED=PASS');
console.log('APP518_QA_SIGNED_GATE_SOURCE_ONLY; CLOUD_MUTATIONS=0; LIVE_E2E=NOT_TESTED');
