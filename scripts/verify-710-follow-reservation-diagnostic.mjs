import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {patchReservationDiagnostic710} from './lib/follow-reservation-diagnostic-710.mjs';
const source=readFileSync(new URL('./fixtures/owner-follow660/owner-follow-service-active710.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
assert.throws(()=>patchReservationDiagnostic710(source+' '),/DRIFT/);
const patched=patchReservationDiagnostic710(source);
const logs=[];
const context=vm.createContext({Request,Response,TextEncoder,URL,console:{warn:(...args)=>logs.push(args)}});
vm.runInContext(patched.replace(/^import .*;$/gm,'').replaceAll('export ',''),context);
const reserve=context.reserveOwnerFollowViaService601;
let calls=0, response;
const env={SORIDRAW_ENVIRONMENT:'preview',SORIDRAW_OWNER_DO_STANDALONE_600:'1',
 SORIDRAW_OWNER_FOLLOW_W2_PUSH_555:'1',SORIDRAW_OWNER_DO_BRIDGE_SECRET_600:'s'.repeat(40),
 OWNER_FOLLOW_RESERVATION_SERVICE_600:{fetch:async()=>{calls++;return response;}}};
const ticket={ownerUid:'target',actorUid:'actor',authEpoch:'0'.repeat(32),
 operationId:'operation_123456789',cutoverToken:'cutover',desired:false,beforeFollowing:true,
 expectedRevision:5,priorR2Revision:8};
for(const reason of ['owner-queue-full','operation-conflict','storage-unavailable','generation-held']){
 response=Response.json({ok:false,status:reason},{status:503});
 const result=await reserve(ticket,env,{enabled:true});
 assert.equal(result.ok,false);assert.equal(result.status,'reservation-unavailable');
 assert.deepEqual(JSON.parse(logs.at(-1)[1]),{http:503,reason});
}
response=Response.json({status:'private-owner-secret',ticket},{status:403});
await reserve(ticket,env,{enabled:true});
assert.equal(JSON.parse(logs.at(-1)[1]).reason,'unclassified');
assert(!JSON.stringify(logs).includes('private-owner-secret'));
for(const status of ['reserved','already-reserved']){
 response=Response.json({ok:true,status,generation:1});
 assert.equal((await reserve(ticket,env,{enabled:true})).ok,true);
}
response=Response.json({ok:true,status:'reserved'});
assert.equal((await reserve(ticket,env,{enabled:true})).ok,false);
response=new Response('not-json',{status:502});
assert.equal((await reserve(ticket,env,{enabled:true})).status,'reservation-unavailable');
assert.equal(calls,9);assert.equal(logs.length,6);
assert(!JSON.stringify(logs).includes(ticket.operationId));
console.log('APP710 exact active source; failure labels; redaction; durable ACK; one request: PASS');
