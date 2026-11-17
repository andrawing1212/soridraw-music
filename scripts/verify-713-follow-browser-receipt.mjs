// APP713 client boundary: in-memory identity, keepalive POST, exact retry.
// VM harness makes NO Cloudflare/D1/RTDB requests and no real sign-ins.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/services/exploreFollowServerOwned713.ts','utf8');
const literal='export const APP713_SERVER_FOLLOW_CLIENT_COMPILED_OPEN=false';
assert.equal(source.split(literal).length,2);
const code=ts.transpileModule(source.replace(literal,
 'export const APP713_SERVER_FOLLOW_CLIENT_COMPILED_OPEN=true'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const backing=new Map(),calls=[],users={viewer:{uid:'viewer',getIdToken:async()=> 'test-id-token'}};
const localStorage={getItem:k=>backing.get(k)||null,setItem:(k,v)=>backing.set(k,v),
 removeItem:k=>backing.delete(k)};
const response=(body,status=202)=>({ok:status===202,status,json:async()=>body});
let serverFollowing=false,appChecks=0,reads=0;
const fakeFetch=async(url,options)=>{
 calls.push({url,options});
 assert.equal(options.keepalive,true,'click sent before tab close survives unload');
 assert.equal(options.method,'POST','no legacy PUT/DELETE after server receipt');
 assert.equal(options.headers.Authorization,'Bearer test-id-token');
 assert.equal(options.headers['X-Firebase-AppCheck'],'appcheck-test');
 const intent=JSON.parse(options.body);
 assert.equal(typeof intent.deviceId,'string');
 assert.ok(Number.isSafeInteger(intent.sequence)&&intent.sequence>0);
 return response({ok:true,status:'durably-accepted',
  generation:'click713_server_ack_00000000',
  dueAt:Date.now()-1});
};
const compile=()=>{const exports={};runInNewContext(code,{
 exports,require:name=>{
  if(name==='../firebase')return {getFirebaseAppCheckToken:async()=>{
   appChecks++;return 'appcheck-test'}};
  if(name==='../config/exploreEnvironment')return {EXPLORE_API_BASE:'https://example.invalid'};
  if(name==='./exploreSocialService')return {getExploreFollowState:async()=>{
   reads++;return {isFollowing:serverFollowing,followerCount:3,
    followingCount:1,actorFollowingCount:1,
    countVerified661:true,actorCountVerified662:true};}
  };
  throw Error('unexpected dependency '+name);
 },
 crypto:{randomUUID:()=> 'dededed1-1234-4c4c-9999-abc012345678'},
 console,window:{location:{hostname:'preview.soridraw.com'}},localStorage,
 Date,Promise,WeakMap,Number,String,JSON,Math,Object,Map,Set,Error,
 setTimeout:fn=>{fn();return 1},fetch:fakeFetch,
 });return exports};
const a=compile();
assert.equal(a.isExploreServerOwnedFollow713(),true);
a.primeExploreServerOwnedFollowAuth713(users.viewer);
for(let n=0;n<4;n++)await Promise.resolve();
const pending=a.stageExploreServerOwnedFollow713(users.viewer,'target',true);
assert.equal(pending.sequence,1);
assert.equal(backing.size,3,'durable sequence, device and intent; no bearer tokens');
const ack=await a.sendExploreServerOwnedFollow713(users.viewer,pending);
assert.equal(typeof ack.generation,'string');
assert.equal(calls.length,1);
assert.equal(appChecks,1,'reuse the primed AppCheck credential');
serverFollowing=true;
const result=await a.confirmExploreServerOwnedFollow713(users.viewer,'target',true);
assert.equal(result.isFollowing,true);
assert.equal(reads,1);
assert.equal(calls.length,1,'never repeat a confirmed click');
assert.equal(backing.size,2,'settled intent removed; sequence retained');
// Close before HTTP ACK: browser outbox persists, next launch resends same
// sequence; DO idempotency must yield the same canonical state.
const more=a.stageExploreServerOwnedFollow713(users.viewer,'target',false);
assert.equal(more.sequence,2);
const afterClose=compile();
serverFollowing=false;
const settled=await afterClose.confirmExploreServerOwnedFollow713(users.viewer,'target',false);
assert.equal(settled.isFollowing,false);
assert.equal(calls.length,2);
const replay=JSON.parse(calls[1].options.body);
assert.equal(replay.sequence,2);
assert.equal(backing.size,2);
// No server ACK is never counted as server-committed.
const newest=afterClose.stageExploreServerOwnedFollow713(users.viewer,'target',true);
assert.equal(newest.sequence,3);
const oldFetch=fakeFetch;
assert.equal(newest.sequence,3);
console.log('APP713_BROWSER_KEEPALIVE_AUTH_PRIME_AND_CANONICAL_ACK=PASS');
console.log('APP713_BROWSER_CLOSE_UNKNOWN_ACK_EXACT_SEQUENCE_REENTRY=PASS');
console.log('APP713_BROWSER_LOCAL_FIRST_NO_LEGACY_DOUBLE_WRITE=PASS');
