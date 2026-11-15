import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const issuer667=await import('../functions/src/explorePublicFollowSignal667');
// Firebase Functions is a nested CommonJS package; tsx interop wraps its
// named exports in `default` when invoked from the root ESM test package.
const publishPublicFollowPair667=((issuer667 as any).publishPublicFollowPair667 ??
 (issuer667 as any).default?.publishPublicFollowPair667) as typeof issuer667.publishPublicFollowPair667;
assert.equal(typeof publishPublicFollowPair667,'function');
const SECRET='app667_must_be_server_held_32bytes_secret_01234567890';
const now=1_800_000_000_000;
const input={
 schemaVersion:1,actorUid:'Actor',targetUid:'Target',
 cutoverToken:'signed-cutover',operationId:'operation_1234567890',
 signedAtMs:now,
 actor:{profileUid:'Actor',generation:'a'.repeat(32),revision:15,
  followerCount:2,followingCount:5,public:true,exact:true,pending:0},
 target:{profileUid:'Target',generation:'b'.repeat(32),revision:24,
  followerCount:7,followingCount:1,public:true,exact:true,pending:0},
};
const signed=(c:any)=>{const raw=JSON.stringify(c);
 return {raw,sig:createHmac('sha256',SECRET).update(raw).digest('hex')};};
const data=new Map<string,unknown>();
const touched:string[]=[];
let failTargetOnce=false;
const db={ref:(path:string)=>({transaction:async(fn:(prior:unknown)=>unknown)=>{
 touched.push(path);
 if(failTargetOnce&&path.endsWith('/Target')){
  failTargetOnce=false;throw Error('simulated transport failure');
 }
 const prior=data.has(path)?data.get(path):null;
 const next=fn(prior);
 if(next===undefined)return {committed:false};
 data.set(path,next);
 return {committed:true};
 }})} as any;
const run=(c:any)=>{const {raw,sig}=signed(c);
 return publishPublicFollowPair667(db,raw,sig,SECRET,now);};
const first=await run(input);
assert.equal(first.actor,'applied');assert.equal(first.target,'applied');
assert.equal(data.size,2);assert.equal(touched.length,2);
const actor=data.get('publicSync/exploreFollowProfiles667/Actor') as any;
const target=data.get('publicSync/exploreFollowProfiles667/Target') as any;
assert.equal(actor.commitId,target.commitId);
assert.equal(actor.followingCount,5);assert.equal(target.followerCount,7);
assert.equal(JSON.stringify(actor).includes('operation_'),false);
assert.equal(JSON.stringify(actor).includes('cutover'),false);
assert.deepEqual((await run(input)).actor,'duplicate');
assert.equal(touched.length,4);assert.equal(data.size,2);
const next={...input,operationId:'operation_1234567891',
 actor:{...input.actor,revision:16,followingCount:6},
 target:{...input.target,revision:25,followerCount:8}};
failTargetOnce=true;
await assert.rejects(()=>run(next),/simulated transport/);
assert.equal((data.get('publicSync/exploreFollowProfiles667/Actor') as any).followingCount,6);
const repaired=await run(next);
assert.equal(repaired.actor,'duplicate');assert.equal(repaired.target,'applied');
assert.equal((data.get('publicSync/exploreFollowProfiles667/Target') as any).followerCount,8);
const old=await run(input);
assert.equal(old.actor,'stale');assert.equal(old.target,'stale');
for(const changed of [
 {...next,actor:{...next.actor,pending:1}},
 {...next,target:{...next.target,public:false}},
 {...next,actor:{...next.actor,exact:false}},
 {...next,actor:{...next.actor,followingCount:NaN}},
 {...next,actor:{...next.actor,followerCount:-1}},
 {...next,actor:{...next.actor,secret:'private'}},
 {...next,actorUid:'Target'},
]){
 const length=touched.length;
 await assert.rejects(()=>run(changed));
 assert.equal(touched.length,length);
}
const later={...next,operationId:'operation_1234567892',
 actor:{...next.actor,revision:16,followingCount:66},
 target:{...next.target,revision:26,followerCount:9}};
await assert.rejects(()=>run(later),/SAME_REVISION_CONFLICT/);
await assert.rejects(()=>run({...next,actor:{...next.actor,generation:'c'.repeat(32),revision:17}}),/AUTH_GENERATION_HOLD/);
const {raw}=signed(next);
await assert.rejects(()=>publishPublicFollowPair667(db,raw,'0'.repeat(64),SECRET,now),/INVALID_SIGNATURE/);
await assert.rejects(()=>publishPublicFollowPair667(db,raw,signed(next).sig,SECRET,now+400000),/UNVERIFIED|INVALID/);
const beforePrivateActor=(data.get('publicSync/exploreFollowProfiles667/Actor') as any).followingCount;
const privateOperation={...next,operationId:'operation_1234567899',actor:null,
 target:{...next.target,revision:26,followerCount:9}};
const privateResult=await run(privateOperation);
assert.equal(privateResult.actor,'skipped-private');
assert.equal(privateResult.target,'applied');
assert.equal(privateResult.rtdbTransactions,1);
assert.equal((data.get('publicSync/exploreFollowProfiles667/Actor') as any).followingCount,beforePrivateActor);
assert.equal((data.get('publicSync/exploreFollowProfiles667/Target') as any).followerCount,9);
assert.equal((await run(privateOperation)).target,'duplicate');
const missingActorTouches=touched.length;
await assert.rejects(()=>run({...privateOperation,actor:undefined}));
assert.equal(touched.length,missingActorTouches);
assert.equal(touched.every(p=>p.startsWith('publicSync/exploreFollowProfiles667/')),true);
console.log('APP670_PRIVATE_ACTOR_PUBLIC_TARGET_SINGLE_TRANSACTION=PASS');
console.log('APP667_PUBLIC_ONLY_AUTHENTICATED_PAIR=PASS');
console.log('APP667_IDEMPOTENT_PARTIAL_FAILURE_REPLAY=PASS');
console.log('APP667_STALE_CONFLICT_GENERATION_AND_UNVERIFIED_HOLD=PASS');
console.log('APP667_NO_D1_NO_CROSS_PROFILE_SCAN=PASS');
