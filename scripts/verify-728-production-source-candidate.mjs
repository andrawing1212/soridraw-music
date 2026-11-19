import assert from 'node:assert/strict';
import {
  APP728_QUARANTINED_SOURCE_FILES, selectApp728QuarantinedSources,
  verifyApp728ProductionBaseline, readPinnedProductionCode728,
} from './app728-production-source-candidate.mjs';
const version='af81502a-298d-4ec6-bc2a-0c529d6dc29e';
const goodSha='4363820117100cb03bcbc44a01e127aeb5de3cf4';
const imported=Object.fromEntries(APP728_QUARANTINED_SOURCE_FILES.map(name=>[name,'export const reviewOnly=true;\n']));
imported['owner-follow-postcommit-555.mjs']+='export const APP555_OWNER_POSTCOMMIT_W2_COMPILED_OPEN=false;\n';
imported['public-follow-dual-ack-671.mjs']+='export const APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=false;\n';
imported['owner-follow-target-scope-659.mjs']+='const gate=(env)=>env?.SORIDRAW_ENVIRONMENT!==\'preview\';\n';
const good=selectApp728QuarantinedSources(imported);
assert.equal(good.length,APP728_QUARANTINED_SOURCE_FILES.length);
assert(good.every(x=>x.sha256.length===64&&x.bytes>0));
assert(good.every(x=>!x.name.includes('do-557')));
const withImport={...imported};withImport['public-follow-http-669.mjs']+="import {proof} from './public-follow-proven-pair-669.mjs';";
assert.equal(selectApp728QuarantinedSources(withImport).length,good.length);
const missing={...imported};delete missing['owner-follow-http-539.mjs'];
assert.throws(()=>selectApp728QuarantinedSources(missing),/MISSING_OR_INVALID_SOURCE/);
const escapes={...imported};escapes['owner-follow-http-539.mjs']+="import './../../../internal-secret.mjs';";
assert.throws(()=>selectApp728QuarantinedSources(escapes),/IMPORT_ESCAPES_REVIEW_BUNDLE/);
const unknown={...imported,"new-worker-do.mjs":'export const x=1;'};
assert.throws(()=>selectApp728QuarantinedSources(unknown),/UNAPPROVED_SOURCE_MODULE/);
const released={...imported};released['public-follow-dual-ack-671.mjs']='export const APP671_PUBLIC_DUAL_ACK_COMPILED_OPEN=true;';
assert.throws(()=>selectApp728QuarantinedSources(released),/PREVIEW_COMPILE_OFF_GATES_CHANGED/);
const deploy={...imported};deploy['owner-follow-http-539.mjs']='const msg="wrangler deploy";';
assert.throws(()=>selectApp728QuarantinedSources(deploy),/MUTATION_COMMAND_IN_REVIEW_SOURCE/);

const dead={
 sourceSha:goodSha,lockedPreviewSha:goodSha,activeVersion:version,
 mainModule:'worker.js',code:Buffer.from('export default {};'),
 modules:[{name:'worker.js'}],settings:{bindings:[]}
};
assert.throws(()=>verifyApp728ProductionBaseline(dead),/PRODUCTION_CODE_SHA_DRIFT/);
assert.throws(()=>verifyApp728ProductionBaseline({...dead,activeVersion:'a'.repeat(36)}),/PRODUCTION_ACTIVE_VERSION_DRIFT/);
assert.throws(()=>verifyApp728ProductionBaseline({...dead,lockedPreviewSha:'b'.repeat(40)}),/PREVIEW_SHA_UNVERIFIED/);
assert.throws(()=>verifyApp728ProductionBaseline({...dead,modules:[{name:'worker.js'},{name:'extra.mjs'}]}),/PRODUCTION_MODULE_SHAPE_DRIFT/);
let count=0;
const token='DO_NOT_PRINT_THIS_TOKEN';
const fetcher=async (url,options)=>{
 count++;
 assert.equal(options.method,'GET');
 assert(url.startsWith('https://api.cloudflare.com/client/v4/accounts/'));
 assert(!url.includes('soridraw-explore-test'));
 if(url.includes('/deployments')){
  return {ok:true,json:async()=>({success:true,result:{deployments:[{versions:[{percentage:100,version_id:version}]}]}})};
 }
 if(url.includes('/versions/'))return {ok:true,json:async()=>({success:true,result:{id:version,main_module:'worker.js',modules:[{name:'worker.js',content_base64:Buffer.from('export default {};').toString('base64')}]}})};
 return {ok:true,json:async()=>({success:true,result:{bindings:[]}})};
};
await assert.rejects(()=>readPinnedProductionCode728(token,fetcher),/PROD_CODE_DRIFT/);
assert.equal(count,3); // fail code identity before final GET, no hidden retries
const previousGet=async(url,options)=>{
 assert.equal(options.method,'GET');
 if(url.includes('/deployments'))
  return {ok:true,json:async()=>({success:true,result:{deployments:[{versions:[{percentage:100,version_id:'00000000-0000-0000-0000-000000000000'}]}]}})};
 return {ok:false,status:403,json:async()=>({})};
};
await assert.rejects(()=>readPinnedProductionCode728(token,previousGet),/PROD_VERSION_CHANGED_SINCE_AUDIT/);
await assert.rejects(()=>readPinnedProductionCode728('',fetcher),/AUTH_MISSING/);
console.log('APP728_SOURCE_ONLY_PRESERVATION_SYNTHETIC=PASS (quarantined modules, no enable, immutable PROD baseline, GET-only, fail closed)');
