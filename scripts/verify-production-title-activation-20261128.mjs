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

// Exercise the real HTTP adapter against local mock responses: no token or network.
import {createTitleActivationTransport} from './lib/production-title-activation-transport-20261128.mjs';
const live=Object.fromEntries(Object.entries(PINS).map(([n,v])=>[n,{id:'baseline-'+n,versions:[{version_id:v,percentage:100}]}]));
const calls=[];let count=0;
const response=(result,status=200,headers={})=>({ok:status<300,status,headers:new Headers(headers),async json(){return {success:true,result}}});
const send=async(url,opt)=>{
 const u=new URL(url);calls.push([opt.method,u.pathname+u.search]);
 if(u.hostname==='soridraw-explore-api.andrawing1212.workers.dev'){
  assert.equal(opt.headers.Authorization,undefined);
  return response({},opt.method==='GET'?401:204,{'access-control-allow-origin':'https://soridraw.com','X-SORIDRAW-D1-Write':'0'});
 }
 assert.equal(u.hostname,'api.cloudflare.com');
 const p=u.pathname.split('/workers/').at(-1);
 if(opt.method==='GET'){
  if(p.endsWith('/deployments'))return response({deployments:[live[p.split('/')[1]]]});
  if(p.endsWith('/schedules'))return response({schedules:p.includes('soridraw-explore-preview')?[{cron:'37 * * * *'}]:[]});
 }
 if(opt.method==='POST'&&p===TARGET+'/versions'){
  assert.equal(u.search,'?deploy=false');return response({id:fresh});
 }
 if(opt.method==='POST'&&p==='scripts/'+TARGET+'/deployments'){
  const body=JSON.parse(opt.body);assert.equal(body.versions.length,1);assert.equal(body.versions[0].percentage,100);
  const row={id:'owned-api-'+(++count),versions:body.versions};live[TARGET]=row;return response(row);
 }
 throw Error('UNEXPECTED_MOCK_API '+opt.method+' '+p);
};
const real=createTitleActivationTransport({token:'offline-test',send,sleep:async()=>{}});
assert.equal((await real.readActivePins())[TARGET].version,PINS[TARGET]);
await assert.rejects(()=>real.deploy('soridraw-media',fresh),/DEPLOY_SCOPE/);
await assert.rejects(()=>real.uploadInactive('soridraw-media',{}),/UPLOAD_SCOPE/);
await assert.rejects(()=>real.uploadInactive(TARGET,{}),/UPLOAD_SCOPE/);
assert.equal(calls.filter(([m])=>m==='POST').length,0);
const upload={main_module:'entry.mjs',bindings:Array.from({length:27},(_,i)=>({name:'b'+i,type:'inherit',version_id:PINS[TARGET]})),modules:Array.from({length:15},()=>({}))};
assert.equal(await real.uploadInactive(TARGET,upload),fresh);
await assert.rejects(()=>real.deploy(TARGET,'00000000-0000-0000-0000-000000000000'),/ROLLBACK_OWNERSHIP/);
const ack=await real.deploy(TARGET,fresh);await real.awaitActive(TARGET,ack);
assert.equal(await real.smokeReadOnly(),true);
live[TARGET]={id:'external-same-version',versions:[{version_id:fresh,percentage:100}]};
await assert.rejects(()=>real.deploy(TARGET,PINS[TARGET]),/ROLLBACK_OWNERSHIP/);
assert.equal(calls.filter(([m])=>m==='POST').length,2);
console.log('TITLE_SCOPED_HTTP_ADAPTER_NO_FOREIGN_WRITE_AND_ROLLBACK_OWNERSHIP=PASS_SYNTHETIC');
