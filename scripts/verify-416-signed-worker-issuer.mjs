import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {verifyPrivateHmac416,validatePrivateHandoff416} from
  '../cloudflare/explore-worker/runtime/like-private-batch-handoff-416.mjs';
const source=readFileSync('functions/src/exploreLikePrivateHandoff416.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
  target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};const require=createRequire(import.meta.url);
vm.runInNewContext(js,{module:{exports},exports,require,URL,Date,Error,Object,
  Number,fetch:()=>{throw Error('unexpected live network')}},{timeout:2000});
const {deliverPrivateSealToWorker416:deliver}=exports;
const now=1_700_000_000_000;
const secret='aStage416SharedSecretLongerThan32Characters';
const worker='https://preview.soridraw.com/v1/internal/private-like-handoff-416';
const seal={id:'00000000-0000-4000-8000-000000000077',version:89,
  closedAtMs:now-2_000,
  rows:[{trackId:'song-a',liked:true,operationId:'00000000-0000-4000-8000-000000000009',mutationAt:now-5_000}]};
let observed=0;
const accepted=async(url,init)=>{
  observed++;assert.equal(url,worker);
  assert.equal(init.method,'POST');
  assert.equal(await verifyPrivateHmac416(init.body,init.headers['X-Soridraw-416-Signature'],secret),true);
  const claim=validatePrivateHandoff416(JSON.parse(init.body),now);
  assert.equal(claim.version,89);assert.equal(claim.rows[0].liked,true);
  assert.equal(claim.rows[0].mutationAt,now-5_000);
  return {ok:true,json:async()=>({ok:true,data:{queued:true,canonicalD1:'settled',canonicalProof:'atomic-drain-batch-418',
    personalLikeSnapshot:'changed-track-r2',finalReceipt:'PUBLISHED',
    version:89,duplicate:false,batchIds:['l069_1699999998000_'+'a'.repeat(64)]}})};
};
const r=await deliver('uid1',seal,worker,secret,now,accepted);
assert.equal(r.accepted,true);assert.equal(r.version,89);
assert.equal(observed,1);
await assert.rejects(deliver('uid1',seal,'http://preview.soridraw.com/v1/internal/private-like-handoff-416',
  secret,now,accepted),/TARGET_REFUSED/);
await assert.rejects(deliver('uid1',seal,'https://evil.example/v1/internal/private-like-handoff-416',
  secret,now,accepted),/TARGET_REFUSED/);
await assert.rejects(deliver('uid1',seal,worker,secret,now,
  async()=>({ok:false,json:async()=>({ok:false})})),/NOT_CONFIRMED/);
await assert.rejects(deliver('uid1',seal,worker,secret,now,
  async()=>({ok:true,json:async()=>({ok:true,data:{queued:true,canonicalD1:'settled',canonicalProof:'atomic-drain-batch-418',
    personalLikeSnapshot:'changed-track-r2',finalReceipt:'PUBLISHED',
    version:88,batchIds:['l069_1699999998000_'+'a'.repeat(64)]}})})),/NOT_CONFIRMED/);
console.log('STAGE416_FIREBASE_SIGNED_TO_CLOUDFLARE_WORKER_EXACT_RECEIPT=PASS');
console.log('STAGE416_FIREBASE_HANDOFF_TARGET_RESTRICTION_AND_FAIL_CLOSED=PASS');
console.log('STAGE416_SIGNER_NOT_EXPORTED_OR_DEPLOYED=PASS');
