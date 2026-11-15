import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const module=await import('../functions/src/explorePublicFollowEndpoint669');
const create=(module as any).createPublicFollowHttp669 ??
 (module as any).default?.createPublicFollowHttp669;
const derive=(module as any).derivePublicFollowKey669 ??
 (module as any).default?.derivePublicFollowKey669;
assert.equal(typeof create,'function');
const secret='server-bridge-owner-follow-secret-0123456789abcdef';
const now=1800000000000;
const claim={
 schemaVersion:1,actorUid:'Actor',targetUid:'Target',
 cutoverToken:'token',operationId:'operation_1234567890',signedAtMs:now,
 actor:{profileUid:'Actor',generation:'0'.repeat(32),revision:5,followerCount:2,followingCount:6,public:true,exact:true,pending:0},
 target:{profileUid:'Target',generation:'0'.repeat(32),revision:7,followerCount:8,followingCount:4,public:true,exact:true,pending:0},
};
let authReads=0,firestoreReads=0,writes=0;
const births={Actor:now-100000,Target:now-100000};
const users={Actor:{},Target:{}};
const auth={async getUser(uid:string){authReads++;return {uid,disabled:false,
 metadata:{creationTime:new Date(births[uid as keyof typeof births]).toISOString()}}}};
const firestore={collection(name:string){assert.equal(name,'users');return{doc(uid:string){return{async get(){firestoreReads++;return{
 exists:true,data:()=>users[uid as keyof typeof users]
 };}}}}}};
const values=new Map();
const database={ref(path:string){return{async transaction(update:(v:unknown)=>unknown){
 const result=update(values.get(path)??null);
 if(result===undefined)return{committed:false};
 values.set(path,result);writes++;return{committed:true};
 }}}};
const invoke=async({
 body=claim,raw=JSON.stringify(body),key=derive(secret),authMock=auth,
 enabled=true,clock=now,method='POST'
}:any={})=>{
 const signature=createHmac('sha256',key).update(raw).digest('hex');
 let status=0,result:any=null;
 const handler=create({auth:authMock,firestore,database,secret,enabled,now:()=>clock});
 await handler({method,rawBody:Buffer.from(raw),get:(n:string)=>{
 if(n==='X-Soridraw-Public-Follow-669-At')return String(body.signedAtMs);
 if(n==='X-Soridraw-Public-Follow-669-Signature')return signature;
 return undefined;
 }},{set(){},status(n:number){status=n;return{json(v:any){result=v}}}});
 return {status,result};
};
assert.equal((await invoke({enabled:false})).status,503);
assert.equal(authReads,0);
assert.equal((await invoke({method:'GET'})).status,405);
assert.equal((await invoke({key:'wrong domain key'})).status,403);
assert.equal(authReads,0);
let r=await invoke();
assert.equal(r.status,200);assert.equal(r.result.ok,true);
assert.equal(authReads,2);assert.equal(firestoreReads,2);assert.equal(writes,2);
assert.equal((await invoke()).status,200);
assert.equal(writes,2);
births.Actor=now-200000; // Same UID, different Auth incarnation.
r=await invoke();
assert.equal(r.status,503);assert.equal(writes,2);
births.Actor=now-100000;
users.Target={authDeletionPendingAt:now-100};
assert.equal((await invoke()).status,409);assert.equal(writes,2);
users.Target={authDeleted:true};
assert.equal((await invoke()).status,409);assert.equal(writes,2);
users.Target={accountStatus:'banned'};
assert.equal((await invoke()).status,409);assert.equal(writes,2);
users.Target={};
assert.equal((await invoke({clock:now+100000})).status,403);
assert.equal(writes,2);
console.log('APP669_HMAC_DOMAIN_AND_AUTH_GENERATION=PASS');
console.log('APP669_DELETION_AND_DISABLED_ACCOUNT_BLOCK=PASS');
console.log('APP669_IDEMPOTENT_DUAL_PROFILE_RTDB_WRITE=PASS');
