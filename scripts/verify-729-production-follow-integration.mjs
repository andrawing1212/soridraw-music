import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {
 APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN,
 integrateApp729ProductionOwnerFollow,
} from './app729-production-follow-adapter.mjs';
import {buildApp729ProductionIntegrationEntry} from './app729-production-follow-entry.mjs';

const actor='actorValid01',owner='ownerValid02';
const followUrl='https://soridraw.example/v1/profiles/'+owner+'/follow';
let calls=0, pending=0, signals=0, status=200, changed=true, principal=true, durable=true, settled=true;
const base={
 async fetch(){
   calls++;
   return Response.json({ok:status===200,data:{following:true,revision:8}},{status});
 },
 async scheduled(){return 'original scheduled';},
 alarm(){return 'original alarm';},
 marker:'keep all existing properties',
};
assert.equal(APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN,false);
const off=integrateApp729ProductionOwnerFollow(base);
assert.strictEqual(off,base,'OFF returns canonical Worker object, never wrapper');
assert.strictEqual(off.fetch,base.fetch);
assert.strictEqual(off.scheduled,base.scheduled);
assert.strictEqual(off.alarm,base.alarm);
const response=await off.fetch(new Request(followUrl,{method:'PUT'}),{SORIDRAW_ENVIRONMENT:'production'},{});
assert.equal(response.status,200);
assert.equal(calls,1);
assert.equal(pending,0);
assert.equal(signals,0);
assert.throws(()=>integrateApp729ProductionOwnerFollow(base,{enabled:true}),/APP729_HOLD_BRIDGE_NOT_VERIFIED/);
assert.throws(()=>integrateApp729ProductionOwnerFollow(base,{enabled:'1'}),/APP729_HOLD_COMPILE_FLAG_INVALID/);
assert.throws(()=>integrateApp729ProductionOwnerFollow(null),/APP729_HOLD_CANONICAL_WORKER_MISSING/);
const weak={verifyFirebaseActorAndAppCheck:()=>{},reserveDurableBeforeCommit:()=>{},
 makeCanonicalRequest:()=>{},verifyCanonicalSettledCommit:()=>{},queueSettledOwnerSignal:()=>{}};
assert.throws(()=>integrateApp729ProductionOwnerFollow(base,{enabled:true,bridge:weak}),/APP729_HOLD_DELIVERY_CONTRACT_NOT_PROVEN/);
const bridge={
 ownerOnlyRulesProof:true, stableReceiptReplayProof:true,
 changedOnlyAndCanonicalOrderingProof:true,prodFunctionTargetVerified:true,
 async verifyFirebaseActorAndAppCheck(){pending++;return principal?{verified:true,uid:actor}:{verified:false};},
 async reserveDurableBeforeCommit(){pending++;return durable?{durable:true,operationId:'confirmedoperationid1234567',expectedRevision:0,cutoverToken:'synthetic-cutover',authEpoch:'0123456789abcdef0123456789abcdef'}:{durable:false};},
 async makeCanonicalRequest({request,reservation}){return new Request(request,{body:JSON.stringify({followOperationId:reservation.operationId,followExpectedRevision:reservation.expectedRevision}),headers:{'Content-Type':'application/json'}});},
 async verifyCanonicalSettledCommit({canonicalResponse,operationId,ownerUid}){
  pending++;assert.equal(canonicalResponse.status,200);
  return {changed,settled,operationId,ownerUid,revision:8};
 },
 async queueSettledOwnerSignal({reservation,proof,ownerUid}){
  assert.equal(reservation.operationId,proof.operationId);assert.equal(ownerUid,owner);signals++;
 },
};
const on=integrateApp729ProductionOwnerFollow(base,{enabled:true,bridge});
assert.notStrictEqual(on,base);
assert.strictEqual(on.scheduled,base.scheduled);
assert.strictEqual(on.alarm,base.alarm);
assert.equal(on.marker,base.marker);
const ctx={};
const send=(method='PUT',env='production',
 body=JSON.stringify({followOperationId:'confirmedoperationid1234567',
  followExpectedRevision:0}))=>on.fetch(new Request(followUrl,{method,
  headers:{'Content-Type':'application/json'},body}),
  {SORIDRAW_ENVIRONMENT:env},ctx);

// APP745: the *real* APP354 client initially sends a bodyless PUT/DELETE
// and retries ONLY if requestAuthed exposes error.code FOLLOW_ORDER_REQUIRED.
const client354=readFileSync('src/services/exploreFollowOrdering354.ts','utf8');
const clientApi=readFileSync('src/services/exploreSocialService.ts','utf8');
assert(client354.includes("code !== 'FOLLOW_ORDER_REQUIRED'"));
assert(client354.includes("followOperationId: operation.id"));
assert(client354.includes("followExpectedRevision: operation.revision"));
assert(clientApi.includes('payload?.error?.code'));
const firstNoMutation={calls,pending,signals};
const negotiate=async(method,origin)=>{
 const h=origin?{'Origin':origin}:{};
 return on.fetch(new Request(followUrl,{method,headers:h}),
  {SORIDRAW_ENVIRONMENT:'production'},ctx);
};
for(const method of ['PUT','DELETE']){
 const res=await negotiate(method,'https://soridraw.com');
 assert.equal(res.status,409);
 const body=await res.json();
 assert.equal(body.ok,false);
 assert.equal(body.error.code,'FOLLOW_ORDER_REQUIRED');
 assert.equal(res.headers.get('Access-Control-Allow-Origin'),
  'https://soridraw.com');
 assert.match(res.headers.get('Cache-Control'),/no-store/);
 assert.equal(res.headers.get('Vary'),'Origin');
}
assert.equal(calls,firstNoMutation.calls,'unversioned requests cannot commit D1');
assert.equal(signals,firstNoMutation.signals,'no owner signal before commit');
assert.equal(pending,firstNoMutation.pending+2,
 'verify principal once; no DO/canonical calls during negotiation');
const untrusted=await negotiate('PUT','https://bad.example');
assert.equal(untrusted.status,409);
assert.equal(untrusted.headers.get('Access-Control-Allow-Origin'),null);
assert.equal(calls,firstNoMutation.calls);
assert.equal(signals,firstNoMutation.signals);
for(const host of ['https://www.soridraw.com','https://soridraw.web.app',
 'https://soridraw.firebaseapp.com']){
 const r=await negotiate('DELETE',host);
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),host);
}
const first=await send();
assert.equal(first.status,200);assert.equal(calls,2);assert.equal(signals,1);
changed=false;await send('DELETE');assert.equal(signals,1,'canonical no-op cannot signal');
changed=true;settled=false;await send();assert.equal(signals,1,'not settled cannot signal');
settled=true;status=503;await send();assert.equal(signals,1,'non-2xx cannot signal');
status=200;principal=false;const before=calls;assert.equal((await send()).status,401);assert.equal(calls,before);
principal=true;durable=false;assert.equal((await send()).status,503);assert.equal(calls,before);
durable=true;assert.equal((await send('PUT','preview')).status,503);assert.equal(calls,before);
const ignored=await on.fetch(new Request('https://soridraw.example/v1/profiles'),{SORIDRAW_ENVIRONMENT:'production'},ctx);
assert.equal(ignored.status,200);assert.equal(calls,before+1);assert.equal(signals,1);
assert(pending>=8);

const made=buildApp729ProductionIntegrationEntry();
assert.equal(made.runtimeEnabled,false);assert.equal(made.deployable,false);
assert.equal(made.originalMainUntouched,true);
assert.equal(made.additionalBindings,0);assert.equal(made.additionalMigrations,0);
assert.match(made.sha256,/^[0-9a-f]{64}$/);
assert(made.code.includes("import canonical from './production-main.mjs'"));
assert(made.code.includes('integrateApp729ProductionOwnerFollow(canonical'));
assert(made.code.includes('if (APP729_PRODUCTION_OWNER_FOLLOW_COMPILED_OPEN) {'));
const dir=mkdtempSync(join(tmpdir(),'app729-off-'));
try {
 mkdirSync(join(dir,'integration'));
 writeFileSync(join(dir,'production-main.mjs'),'export default {fetch:()=>new Response("preserved"), scheduled:()=>33};\n');
 writeFileSync(join(dir,'production-follow-entry.mjs'),made.code);
 writeFileSync(join(dir,'integration','app729-production-follow-adapter.mjs'),
   await (await import('node:fs/promises')).readFile(new URL('./app729-production-follow-adapter.mjs',import.meta.url),'utf8'));
 const mainModule=await import(pathToFileURL(join(dir,'production-main.mjs')));
 const entryModule=await import(pathToFileURL(join(dir,'production-follow-entry.mjs')));
 assert.strictEqual(entryModule.default,mainModule.default,'generated OFF entry exact object identity');
 const check=spawnSync(process.execPath,['--check',join(dir,'production-follow-entry.mjs')],{encoding:'utf8'});
 assert.equal(check.status,0,'generated entry must parse without any PROD enablement');
}finally{rmSync(dir,{recursive:true,force:true})}
console.log('APP729_PROD_FOLLOW_OFF_INTEGRATION=PASS (exact canonical passthrough, guarded synthetic settled signal, no-op/invalid/failed denied, source entry OFF)');
