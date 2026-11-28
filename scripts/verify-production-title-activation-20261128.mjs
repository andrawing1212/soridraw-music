import assert from 'node:assert/strict';
import {APPROVAL,PINS,TARGET,executeTitleActivation,prepareTitleUpload,verifyInactiveTitleCandidate,CANDIDATE_HASHES} from './qa-production-title-activation-20261128.mjs';
const fresh='12345678-1234-1234-1234-123456789abc';
assert.equal(Object.keys(CANDIDATE_HASHES).length,15);
assert.throws(()=>prepareTitleUpload({old:{id:PINS[TARGET],modules:[]},preview:{id:PINS['soridraw-explore-preview']}}),/MODULE_INVENTORY/);
assert.throws(()=>verifyInactiveTitleCandidate({old:{id:PINS[TARGET]},candidate:{id:fresh,modules:[]},id:fresh}),/MODULE_INVENTORY/);
function fixture({drift=false,badVerify=false,badSmoke=false,concurrent=false,unknown=false,rollbackFail=false}={}){
 const pins=Object.fromEntries(Object.entries(PINS).map(([n,v])=>[n,{version:v,deployment:'old-'+n}]));
 const events=[];let deployed=0,reads=0;
 const api={
  async readActivePins(){reads++;if(drift&&reads===3)pins[TARGET]={version:PINS[TARGET],deployment:'external-old-version'};return structuredClone(pins)},
  async snapshot(name,id){events.push('GET:'+name);return {id}},
  async uploadInactive(name,payload){assert.equal(name,TARGET);assert.deepEqual(payload,{titleOnly:true});events.push('INACTIVE');return fresh},
  async deploy(name,id){assert.equal(name,TARGET);events.push('DEPLOY:'+id);deployed++;
   if(unknown&&deployed===1){pins[name]={version:fresh,deployment:'unknown'};throw Error('timeout')}
   if(rollbackFail&&deployed===2)throw Error('rollback unavailable');
   pins[name]={version:id,deployment:'owned-'+deployed};return structuredClone(pins[name])},
  async awaitActive(name,ack){assert.deepEqual(pins[name],ack)},
  async smokeReadOnly(){events.push('SMOKE');if(concurrent)pins[TARGET]={version:fresh,deployment:'external-same-version'};return !(badSmoke||concurrent)}
 };
 return {api,events,pins,build:()=>({titleOnly:true}),verify:()=>!badVerify};
}
const run=(m,approval=APPROVAL)=>executeTitleActivation({api:m.api,approval,build:m.build,verify:m.verify});
let m=fixture();await assert.rejects(()=>run(m,'NO'),/DIRECTOR_APPROVAL_REQUIRED/);assert.deepEqual(m.events,[]);
m=fixture();assert.equal((await run(m)).status,'TITLE_WORKER_ACTIVE');assert.equal(m.pins[TARGET].version,fresh);
m=fixture({badVerify:true});await assert.rejects(()=>run(m),/INACTIVE_READBACK/);assert.equal(m.events.filter(x=>x.startsWith('DEPLOY')).length,0);
m=fixture({drift:true});await assert.rejects(()=>run(m),/CONCURRENT_DEPLOYMENT/);assert.equal(m.events.filter(x=>x.startsWith('DEPLOY')).length,0);
m=fixture({badSmoke:true});await assert.rejects(()=>run(m),/ROLLBACK_PASS/);assert.equal(m.pins[TARGET].version,PINS[TARGET]);assert.equal(m.events.filter(x=>x.startsWith('DEPLOY')).length,2);
m=fixture({concurrent:true});await assert.rejects(()=>run(m),/MANUAL_HOLD_CONCURRENT_DEPLOYMENT/);assert.equal(m.events.filter(x=>x.startsWith('DEPLOY')).length,1);
m=fixture({unknown:true});await assert.rejects(()=>run(m),/MANUAL_HOLD_UNACKNOWLEDGED_DEPLOYMENT/);assert.equal(m.events.filter(x=>x.startsWith('DEPLOY')).length,1);
m=fixture({badSmoke:true,rollbackFail:true});await assert.rejects(()=>run(m),/MANUAL_HOLD_ROLLBACK_UNCONFIRMED/);
console.log('TITLE_APPROVAL_AND_INACTIVE_READBACK_FENCE=PASS');
console.log('TITLE_OWNED_DEPLOYMENT_ROLLBACK_AND_CONCURRENT_HOLD=PASS_SYNTHETIC');
console.log('PRODUCTION_UPLOAD=0;LIVE_DEPLOY=0;NO_CLOUD_CREDENTIALS');
