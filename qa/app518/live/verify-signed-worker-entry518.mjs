import assert from 'node:assert/strict';
import {copyFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const candidate=process.env.APP518_PINNED_CANDIDATE_DIR;
assert.ok(candidate?.includes('app518-pinned-candidate'));
const target=join(candidate,'cloudflare/media-worker/src');
const origin=join(process.cwd(),'cloudflare/media-worker/src');
for(const name of ['app518QaGithubOidc518.js','app518QaSignedEntry518.js']){
 const src=readFileSync(join(origin,name),'utf8');
 assert.ok(src.includes('APP518'));
 copyFileSync(join(origin,name),join(target,name));
}
const original=readFileSync(join(target,'app518IsolatedQaWorker518.js'),'utf8');
assert.ok(original.includes('trustedIsolatedQaProof=false'));
assert.ok(original.includes('createApp518IsolatedQaHandler518({env}).fetch(request)'));
const entry=await import(pathToFileURL(join(target,'app518QaSignedEntry518.js')).href);
let factoryCalls=0,oidcCalls=0;
const handler=entry.createSignedQa518Entry({
 now:()=>Date.parse('2026-11-23T02:00:00Z'),
 candidateFactory:({trustedIsolatedQaProof})=>{
   factoryCalls++;
   assert.equal(trustedIsolatedQaProof,true);
   return {enabled:true,fetch:async()=>new Response('{}',{status:200})};
 },
 oidcVerifier:async(ctx)=>{
  oidcCalls++;
  assert.equal(ctx.runId,'45123456789');
  assert.equal(ctx.workflowSha,'f'.repeat(40));
  if(ctx.token!=='real-signed-token')throw Error('BAD_SIGNATURE');
  return {source:'GITHUB_VERIFIED_OIDC_RSA_SIGNATURE',
   runId:ctx.runId,expiresAtMs:Date.parse('2026-11-23T02:03:00Z')};
 },
});
const env={
 SORIDRAW_APP518_QA_RUN_ID:'45123456789',
 SORIDRAW_APP518_QA_WORKFLOW_SHA:'f'.repeat(40),
 SORIDRAW_APP518_PILOT_UID:'qa518-45123456789-owner',
 SORIDRAW_APP518_PILOT_FAVORITE_ID:'qa518-45123456789-song',
 FIREBASE_PROJECT_ID:'soridraw-app',
 FIREBASE_PROJECT_NUMBER:'1083981050742',
 SORIDRAW_APP518_QA_ACCOUNT_ID_518:'b60fcd62c679c64db19f0b0e0c2f3429',
};
const url='https://qa518.example.invalid/v1/server/catalog518';
const request=(token,uri=url)=>new Request(uri,{method:'POST',
 headers:token?{'x-soridraw-qa-github-oidc':token}:{}});
assert.equal((await handler.fetch(request(null),env)).status,403);
assert.equal((await handler.fetch(request('real-signed-token'),{
 ...env,SORIDRAW_APP518_PILOT_UID:'real-user',
})).status,503);
assert.equal((await handler.fetch(request('forged'),env)).status,403);
assert.equal((await handler.fetch(request('real-signed-token',
 'https://qa518.example.invalid/unrelated'),env)).status,404);
assert.equal(factoryCalls,0);
assert.equal(oidcCalls,1);
assert.equal((await handler.fetch(request('real-signed-token'),env)).status,200);
assert.equal(factoryCalls,1);
console.log('APP518_QA_STAGED_PINNED_WORKER_WRAPPER_REQUIRES_SIGNED_GITHUB_PROOF=PASS');
console.log('APP518_QA_DEFAULT_PR528_WORKER_REMAINS_INERT=PASS');
console.log('APP518_QA_STAGE_ONLY_NO_DEPLOY_OR_DATA_WRITE=PASS');
