import assert from 'node:assert/strict';
import vm from 'node:vm';
import {edits,patchApp795ExploreModule,canonicalAppend} from './app795-explore-module-patch.mjs';
import {app795WriterEnabled,verifyApp795Cutover,immutableApp795Receipt,requireApp795WriterFence} from './app795-canonical-runtime.mjs';
assert.equal(app795WriterEnabled({SORIDRAW_ENVIRONMENT:'preview'}),false);
assert.equal(await verifyApp795Cutover(),null);
await assert.rejects(requireApp795WriterFence({env:{SORIDRAW_ENVIRONMENT:'preview'},operation:{},phase:'relation'}),/ADMISSION_REQUIRED/);
const frozen=immutableApp795Receipt({actorUid:'actor',operationId:'receipt',delivery:{},token:'no'});
assert(Object.isFrozen(frozen));assert.deepEqual(Object.keys(frozen).sort(),['actorUid','operationId']);
assert.throws(()=>patchApp795ExploreModule('preview-entry.mjs','not the active source'),/DRIFT/);
const get=n=>edits.find(x=>x.name===n).after;
const denied=async()=>{throw Error('fence refused')};
let writes=0;
const env={DB:{prepare(){writes++;throw Error('D1 write reached')},batch(){writes++;throw Error('D1 write reached')}}};
const c=vm.createContext({app795WriterEnabled:()=>true,requireApp795WriterFence:denied,
 readFollowProfile354:async()=>({sync:{pending:{a:{id:'a'}}}}),
 registerFollowPending354:async()=>{writes++;throw Error('R2 write reached')},
 throwApi:()=>{throw Error('canonical hold')}});
vm.runInContext([get('mutateFollowOverlayRelation350'),get('completeFollowIntent354'),get('repairFollowProfile354'),get('orchestrateFollowOverlay354')].join('\n')+'\nglobalThis.test={mutateFollowOverlayRelation350,completeFollowIntent354,repairFollowProfile354,orchestrateFollowOverlay354}',c);
await assert.rejects(c.test.mutateFollowOverlayRelation350(env,'a','b',true,1,{mode:'overlay348',cutoverToken:'t'},null),/fence refused/);
await assert.rejects(c.test.completeFollowIntent354(env,{},{}),/fence refused/);
await assert.rejects(c.test.repairFollowProfile354(env,'a',{}),/fence refused/);
await assert.rejects(c.test.orchestrateFollowOverlay354(env,'a','b',true,'op',0,{}),/canonical hold/);
assert.equal(writes,0);
let old=0,alarms=0;
const reply=()=>new Response(null,{status:503});
const test=enabled=>{
 const v=vm.createContext({WorkerEntrypoint:class{constructor(env){this.env=env}},app795WriterEnabled:()=>enabled,URL,Response,
 createApp795CanonicalConnection:()=>({alarmRoute:async()=>{alarms++;return 'new'}}),
 activeFor607:async()=>true,generalOwner660:()=>true,reply,handleOwnerFollowReplayService601:async()=>{old++;return 'old'}});
 vm.runInContext(get('OwnerFollowReplayEntrypoint607').replace('export class','class')+'\nglobalThis.Entry=OwnerFollowReplayEntrypoint607',v);
 return new v.Entry({});
};
assert.equal(await test(false).fetch(new Request('https://owner-follow.internal/owner-follow/app794-alarm-internal')),'old');
assert.equal(await test(true).fetch(new Request('https://owner-follow.internal/owner-follow/app794-alarm-internal')),'new');
assert.equal(await test(true).fetch(new Request('https://owner-follow.internal/old')),'old');
assert.equal(old,2);assert.equal(alarms,1);
assert(canonicalAppend.includes('admittedPrecondition=null'));
console.log('APP795_CANONICAL_INTENT_RELATION_RECOVERY_FAIL_CLOSED=PASS');
console.log('APP795_PRIVATE_ALARM_ROUTE_LEGACY_OFF_PRESERVED=PASS');
