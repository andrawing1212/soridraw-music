import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  analyzePinnedVersionModules, readActiveCode,
  produceApp728CodeProvenanceReport,
} from './app728-active-code-provenance.mjs';

const V='cfd40718-6ab5-4133-bdb2-fa69332d6810';
const V2='af81502a-298d-4ec6-bc2a-0c529d6dc29e';
const encode=s=>Buffer.from(s,'utf8').toString('base64');
const getVersion=(source,version=V)=>({
  id:version, main_module:'worker.js', modules:[
    {name:'worker.js',content_base64:encode(source)},
    {name:'lib.js',content_base64:encode('internal extra module')}
  ],
});
const exampleSource='const ENV_NAME="SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET";'+
  ' const code="SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669";'+
  ' const foo="/v1/profiles/123/follow";'+
  ' const hidden="THIS_IS_A_SECRET_NEVER_PRINT_THIS_EXAMPLE";';
const analysis=analyzePinnedVersionModules(getVersion(exampleSource));
assert.equal(analysis.moduleCount,2);
assert.match(analysis.mainCodeSha256,/^[0-9a-f]{64}$/);
assert.match(analysis.allModuleCodeSha256,/^[0-9a-f]{64}$/);
assert.equal(analysis.evidenceOnlyMarkers.publicFollow669,true);
assert.equal(analysis.evidenceOnlyMarkers.privateLikeHandoff416,true);
assert.equal(analysis.evidenceOnlyMarkers.followMutation,true);
assert.equal(analysis.evidenceOnlyMarkers.productionMirror,false);
assert.equal(analysis.featureActivationVerified,false);
assert(!JSON.stringify(analysis).includes('THIS_IS_A_SECRET'));
const reordered=getVersion(exampleSource);
reordered.modules.reverse();
assert.equal(analyzePinnedVersionModules(reordered).allModuleCodeSha256,analysis.allModuleCodeSha256);
const noMain=getVersion(exampleSource);noMain.main_module='not-found.js';
assert.throws(()=>analyzePinnedVersionModules(noMain),/ACTIVE_MAIN_MODULE_NOT_FOUND/);
const noCode=getVersion(exampleSource);noCode.modules[0].content_base64='';
assert.throws(()=>analyzePinnedVersionModules(noCode),/ACTIVE_MODULE_CONTENT_UNVERIFIED/);
const dupe=getVersion(exampleSource);dupe.modules[1].name='worker.js';
assert.throws(()=>analyzePinnedVersionModules(dupe),/ACTIVE_MODULE_CONTENT_UNVERIFIED/);
const badBase64=getVersion(exampleSource);badBase64.modules[1].content_base64='!!!!';
assert.throws(()=>analyzePinnedVersionModules(badBase64),/ACTIVE_MODULE_CONTENT_UNVERIFIED/);

function mockFetcher({ moving=false, badVersion=false, missing=false }={}) {
  const calls=[];
  const fetcher=async (url, opts)=>{
    calls.push({url,method:opts.method,headers:opts.headers});
    const deployment= url.endsWith('/deployments');
    const target= moving&&deployment&&calls.filter(c=>c.url.endsWith('/deployments')).length===2?V2:V;
    const result=deployment
      ? {deployments:[{versions:[{percentage:100,version_id:target}]}]}
      : badVersion?getVersion(exampleSource,V2)
      : missing ?{id:V,main_module:'worker.js',modules:[]}
      :getVersion(exampleSource,V);
    return {ok:true,json:async()=>({success:true,result})};
  };
  return {fetcher,calls};
}
const sample=mockFetcher();
const proof=await readActiveCode('soridraw-explore-preview','TEST_SECRET_TOKEN',sample.fetcher);
assert.equal(proof.activeVersion,V);
assert.equal(proof.moduleCount,2);
assert.equal(sample.calls.length,3);
assert(sample.calls.every(c=>c.method==='GET'));
assert(sample.calls.some(c=>c.url.includes('/versions/'+V+'?include=modules')));
assert(sample.calls.every(c=>!c.url.includes('soridraw-explore-test')));
assert(!JSON.stringify(proof).includes('TEST_SECRET_TOKEN'));
assert(!JSON.stringify(proof).includes('THIS_IS_A_SECRET'));
const shifted=mockFetcher({moving:true});
await assert.rejects(()=>readActiveCode('soridraw-explore-preview','token',shifted.fetcher),/ACTIVE_WORKER_CHANGED_DURING_READ/);
const wrongID=mockFetcher({badVersion:true});
await assert.rejects(()=>readActiveCode('soridraw-explore-preview','token',wrongID.fetcher),/PINNED_VERSION_ID_RESPONSE_DRIFT/);
const missing=mockFetcher({missing:true});
await assert.rejects(()=>readActiveCode('soridraw-explore-preview','token',missing.fetcher),/ACTIVE_MODULE_LIST_UNVERIFIED/);
await assert.rejects(()=>readActiveCode('soridraw-explore-test','token',sample.fetcher),/WORKER_OR_TOKEN_NOT_ALLOWED/);

const workerNames={
 previewExplore:'soridraw-explore-preview',productionExplore:'soridraw-explore-api',
 previewMedia:'soridraw-media-preview',productionMedia:'soridraw-media',
};
const snapshot=Object.fromEntries(Object.entries(workerNames).map(([k,name])=>[k,{
 ...proof,name,activeVersion:k.startsWith('preview')?V:V2
}]));
const report=produceApp728CodeProvenanceReport(snapshot,{},'a'.repeat(40),'a'.repeat(40));
assert.equal(report.collectionStatus,'PASS');
assert.equal(report.releaseStatus,'HOLD');
assert.equal(report.executable,false);
assert.equal(report.testEnvironmentQueried,false);
assert.equal(report.mutations,0);
assert.equal(report.sharedDataReads,0);
assert.equal(report.comparisons.exactBuildOrActualBehaviorParityProven,false);
assert(!JSON.stringify(report).includes('THIS_IS_A_SECRET'));
assert(!JSON.stringify(report).includes('TEST_SECRET_TOKEN'));
const mismatch=produceApp728CodeProvenanceReport(snapshot,{},'a'.repeat(40),'b'.repeat(40));
assert.equal(mismatch.collectionStatus,'UNVERIFIED');
const missingProof={...snapshot,productionMedia:undefined};
assert.equal(produceApp728CodeProvenanceReport(missingProof,{},'a'.repeat(40),'a'.repeat(40)).collectionStatus,'UNVERIFIED');
const workflow=readFileSync('.github/workflows/soridraw-app728-direct-preflight.yml','utf8');
assert(workflow.includes('app728-active-code-provenance.mjs'));
assert(workflow.includes('verify-728-active-code-provenance.mjs'));
assert(workflow.includes('/app728-code '));
assert(workflow.includes('contents: read'));
assert(!/wrangler\s+(deploy|upload)|firebase\s+hosting:clone/i.test(workflow));
console.log('APP728_ACTIVE_CODE_PROVENANCE_SYNTHETIC=PASS (GET-only pinned modules, stable hashes, unverified activation, drift and secret safety)');
