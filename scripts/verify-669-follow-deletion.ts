import assert from 'node:assert/strict';
const m=await import('../functions/src/explorePublicFollowDeletion669');
const revoke=(m as any).revokeDeletedPublicFollow669??
 (m as any).default?.revokeDeletedPublicFollow669;
assert.equal(typeof revoke,'function');
const path='publicSync/exploreFollowProfiles667/target';
let value:any={profileUid:'target',generation:'a'.repeat(32),
 followerCount:3,followingCount:1,public:true,at:1800000000000};
let writes=0,reads=0;
const db={ref(p:string){assert.equal(p,path);return{
 async transaction(fn:(v:any)=>any){reads++;
 const next=fn(value);
 if(next===undefined)return{committed:false};
 value=next;writes++;return{committed:true};
 },
 }}};
let r=await revoke(db as any,'target','b'.repeat(32));
assert.equal(r.status,'different-generation-or-absent');assert.equal(writes,0);
r=await revoke(db as any,'target','a'.repeat(32));
assert.equal(r.status,'revoked');assert.equal(value,null);assert.equal(writes,1);
r=await revoke(db as any,'target','a'.repeat(32));
assert.equal(r.status,'different-generation-or-absent');assert.equal(writes,1);
value={profileUid:'target',generation:'c'.repeat(32)};
r=await revoke(db as any,'target','a'.repeat(32));
assert.equal(r.status,'different-generation-or-absent');assert.equal(writes,1);
const before=reads;
r=await revoke(db as any,'bad/uid','a'.repeat(32));
assert.equal(r.status,'invalid-or-not-enrolled');
assert.equal(reads,before);
console.log('APP669_AUTH_DELETE_EXACT_GENERATION_REVOCATION=PASS');
console.log('APP669_RECREATED_ACCOUNT_AND_ABSENT_PATH_PRESERVED=PASS');
console.log('APP669_INVALID_EVENT_NO_DB_IO=PASS');
