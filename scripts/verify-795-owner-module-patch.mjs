import assert from 'node:assert/strict';
import vm from 'node:vm';
import {ownerClassBefore,ownerHandlerBefore,ownerClassAfter,ownerHandlerAfter,patchApp795OwnerModule} from './app795-owner-module-patch.mjs';
import {APP794_PRIVATE_BRIDGE_COMPILED_OPEN} from './app794-preview-private-owner-bridge.mjs';
assert.equal(APP794_PRIVATE_BRIDGE_COMPILED_OPEN,false);
assert.throws(()=>patchApp795OwnerModule(ownerClassBefore+'\n'+ownerHandlerBefore),/SOURCE_DRIFT/);
function setup(enabled){
 const counts={oldFetch:0,oldAlarm:0,newPort:0,newFetch:0,newAlarm:0,newRoute:0,oldRoute:0};
 let newAlarm=false;
 const context={
  APP794_PRIVATE_BRIDGE_COMPILED_OPEN:enabled, APP600_OWNER_WORKER_COMPILED_OPEN:true,
  __name(){},Response,Request,URL,TextEncoder,
  createOwnerDoService600:()=>({fetch:async()=>{counts.oldFetch++;return 'old-fetch'},alarm:async()=>{counts.oldAlarm++;return 'old-alarm'}}),
  createApp794OwnerDoPort:()=>{counts.newPort++;return {fetch:async r=>{counts.newFetch++;return r.url.endsWith('/app794')?'new-fetch':null},alarm:async()=>{counts.newAlarm++;return newAlarm?'new-alarm':null}}},
  createApp794OwnerWorkerRoute:()=>async r=>{counts.newRoute++;return r.url.endsWith('/app794')?'new-route':null},
  active:()=>{counts.oldRoute++;return false},reply:(s,b)=>({s,b})
 };
 const scope=vm.createContext(context);
 vm.runInContext(ownerClassAfter+'\n'+ownerHandlerAfter+'\nglobalThis.Owner=OwnerFollowerStandalone600;globalThis.route=handleOwnerWorker600;',scope);
 const owner=new scope.Owner({},{}),req=path=>new Request('https://owner-follow.internal/'+path);
 return {owner,scope,counts,req,markNewAlarm:()=>{newAlarm=true}};
}
let x=setup(false);
assert.equal(await x.owner.fetch(x.req('legacy')),'old-fetch');
assert.equal(await x.owner.alarm(),'old-alarm');
assert.equal((await x.scope.route(x.req('app794'),{})).s,503);
assert.deepEqual(x.counts,{oldFetch:1,oldAlarm:1,newPort:0,newFetch:0,newAlarm:0,newRoute:0,oldRoute:1});
x=setup(true);
assert.equal(await x.owner.fetch(x.req('app794')),'new-fetch');
assert.equal(await x.owner.fetch(x.req('legacy')),'old-fetch');
assert.equal(await x.owner.alarm(),'old-alarm');
x.markNewAlarm();assert.equal(await x.owner.alarm(),'new-alarm');
assert.equal(await x.scope.route(x.req('app794'),{}),'new-route');
assert.equal((await x.scope.route(x.req('legacy'),{})).s,503);
assert.deepEqual(x.counts,{oldFetch:1,oldAlarm:1,newPort:1,newFetch:2,newAlarm:2,newRoute:2,oldRoute:1});
console.log('APP795_ACTUAL_OWNER_CALLSITE_OFF_ZERO_NEW_IO_LEGACY_PRESERVED=PASS');
console.log('APP795_PRIVATE_ROUTE_DO_FETCH_ALARM_HOOKS=PASS');
