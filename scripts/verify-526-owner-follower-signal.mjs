import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const core=readFileSync('src/services/exploreOwnerFollowerSyncCore526.ts','utf8');
const bridge=readFileSync('src/services/exploreOwnerFollowerSync526.ts','utf8');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const social=readFileSync('src/services/exploreSocialService.ts','utf8');
const rules=JSON.parse(readFileSync('database.rules.json','utf8'));
const compiled=ts.transpileModule(core,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const module={exports:{}};
runInNewContext(compiled,{module,exports:module.exports,Date,Number,String,Array,Object});
const {createExploreOwnerFollowerGate526,normalizeExploreOwnerFollowerSignal526}=module.exports;
const now=1800000000000;
const marker=(version,opts={})=>({ownerUid:'A',receiptId:'r'+version,version,at:now,...opts});
assert.equal(normalizeExploreOwnerFollowerSignal526(marker(1),'B'),null);
assert.equal(normalizeExploreOwnerFollowerSignal526(marker(1,{receiptId:''}),'A'),null);
let reads=0,resolveRead;
const paints=[];
const gate=createExploreOwnerFollowerGate526('A',()=>{
  reads++; return new Promise(resolve=>{resolveRead=resolve;});
},count=>paints.push(count),()=>now);
gate.receive(marker(1));
gate.receive(marker(1));
assert.equal(reads,0,'initial RTDB retained snapshot and duplicate must not reread');
gate.receive(marker(2));
await Promise.resolve();
assert.equal(reads,1,'new marker = one canonical GET');
gate.receive(marker(3));
gate.receive(marker(3));
assert.equal(reads,1,'in-flight duplicates coalesce');
resolveRead(100);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(paints.length,0,'stale response must not paint');
assert.equal(reads,2,'only one trailing read');
resolveRead(2);
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(paints,[2]);
gate.receive(marker(4,{at:now-11*60000}));
gate.receive(marker(5,{at:now+2*60000}));
gate.receive(marker(6,{ownerUid:'B'}));
assert.equal(reads,2,'stale/future/wrong owner ignored');
gate.receive(marker(7));
assert.equal(reads,3);
gate.dispose();
resolveRead(999);
await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(paints,[2],'old account cannot repaint after unmount');
gate.receive(marker(8));
assert.equal(reads,3);

assert.match(page,/EXPLORE_OWNER_FOLLOW_REALTIME_526_ENABLED/);
assert.match(page,/createExploreOwnerFollowerGate526/);
assert.match(page,/subscribeExploreOwnerFollowerSync526/);
assert.match(page,/getExplorePublicProfile\(ownerUid526, true\)/);
assert.match(page,/invalidateExploreProfileConnections377\(ownerUid526, 'followers'\)/);
assert.match(page,/profileConnectionsCache376Ref\.current\.delete\(ownerUid526 \+ ':followers'\)/);
assert.match(social,/getExplorePublicProfile = async \(profileRef: string, forceServer = false\)/);
assert.match(social,/forceServer \? 'no-store' : 'default'/);
assert.match(bridge,/EXPLORE_OWNER_FOLLOW_REALTIME_526_ENABLED = false/);
assert.doesNotMatch(bridge,/runTransaction|setDoc|setRealtimeValue/);
assert.equal(rules.rules.userSync.$uid['.read'],'auth != null && auth.uid === $uid');
assert.equal(rules.rules.userSync.$uid.$other['.validate'],false);
const relay=readFileSync('cloudflare/explore-worker/runtime/owner-follower-relay-526.mjs','utf8');
const worker=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(relay,/OWNER_FOLLOW_RELAY_526_ENABLED = false/);
assert.match(relay,/receipt\.canonicalCommitted !== true/);
assert.match(relay,/receipt\.materializedProfileReady !== true/);
assert.match(relay,/receipt\.changed !== true/);
assert.match(worker,/owner-follower-relay-526/);
assert.match(worker,/OWNER_FOLLOW_RELAY_526_ENABLED && isOwnerFollow526/);
assert.match(worker,/ownerFollowRequest526=beforeOwnerFollow526 \? request\.clone\(\)/);
assert.match(worker,/confirmed526!==beforeOwnerFollow526.wasFollowing/);
assert.match(worker,/materialized526===count526/);
assert.ok(worker.indexOf('let response = await baseWorker.fetch(request, env, ctx);') <
  worker.indexOf('const delivery526=invokeOwnerFollowRelay526'));
const webhook=readFileSync('functions/src/exploreOwnerFollowerWebhook526.ts','utf8');
assert.match(webhook,/verifyOwnerFollowSignature526/);
assert.match(webhook,/timingSafeEqual/);
assert.match(webhook,/receipt.at!==Number\(atHeader\)/);
assert.match(webhook,/userSync\/.*exploreFollowerOwner526/);
assert.match(webhook,/ownerRef\.transaction/);
assert.match(webhook,/actorRef\.transaction/);
assert.ok(webhook.indexOf('ownerRef.transaction')<webhook.indexOf('actorRef.transaction'),
  'publish before ACK to keep retry possible');
assert.match(readFileSync('functions/src/index.ts','utf8'),/publishExploreOwnerFollower526/);
console.log('APP526_OWNER_LIVE_SIGNAL_DUPLICATE_RACE_UNMOUNT=PASS');
console.log('APP526_NO_IDLE_READ_NO_PRECOMMIT_SHARED_WRITE=PASS');
console.log('APP526_CLIENT_SERVER_ACTIVATION_OFF=PASS');

const oldCrypto=globalThis.crypto;
if(!oldCrypto)globalThis.crypto=webcrypto;
const server=await import('../cloudflare/explore-worker/runtime/owner-follower-relay-526.mjs');
const operation={actorUid:'B',targetUid:'A',operationId:'realCanonicalOperation_526',
  following:false,canonicalFollowerCount:1,changed:true,
  canonicalCommitted:true,materializedProfileReady:true};
assert.equal(server.prepareOwnerFollowRelay526({...operation,changed:false}),null);
assert.equal(server.prepareOwnerFollowRelay526({...operation,canonicalCommitted:false}),null);
assert.equal(server.prepareOwnerFollowRelay526({...operation,materializedProfileReady:false}),null);
assert.equal(server.prepareOwnerFollowRelay526({...operation,actorUid:'../bad'}),null);
const payload=await server.buildOwnerFollowEnvelope526(operation,1800000000000);
assert.equal(payload?.ownerUid,'A');
assert.match(payload.receiptId,/^[0-9a-f]{64}$/);
const body526=JSON.stringify(payload);
const secret526='unit-test-32-byte-shared-secret-NEVER-DEPLOY';
const signature526=await server.signOwnerFollowEnvelope526(body526,secret526,payload.at);
assert.equal(signature526,createHmac('sha256',secret526)
  .update(String(payload.at)+'.'+body526).digest('hex'));
assert.notEqual(signature526,createHmac('sha256',secret526)
  .update(String(payload.at)+'.'+body526.replace('"following":false','"following":true')).digest('hex'));
assert.equal((await server.invokeOwnerFollowRelay526(operation,{secret:secret526,endpoint:'https://invalid.test'})).skipped,true);
console.log('APP526_SIGNED_SERVER_RELAY_HMAC_TAMPER_AND_PRECOMMIT_GATES=PASS');

// Execute the actual Firebase webhook's pure validation/signature logic,
// not merely a source regex. No Firebase request, token or real database.
const securitySource=webhook.slice(
  webhook.indexOf('const UID_526 ='),
  webhook.indexOf('export const publishExploreOwnerFollower526 ='),
);
const compiledSecurity=ts.transpileModule(
  securitySource+'\nmodule.exports.parseReceipt526 = parseReceipt526;',
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}},
).outputText;
const functionModule={exports:{}};
runInNewContext(compiledSecurity,{
  module:functionModule,exports:functionModule.exports,
  Buffer,Number,String,JSON,Object,Math,createHmac,
  timingSafeEqual:(await import('node:crypto')).timingSafeEqual,
});
const verify526=functionModule.exports.verifyOwnerFollowSignature526;
const parse526=functionModule.exports.parseReceipt526;
const raw526=Buffer.from(body526);
assert.equal(parse526(raw526)?.ownerUid,'A');
assert.equal(verify526(secret526,String(payload.at),raw526,signature526,payload.at),true);
assert.equal(verify526(secret526,String(payload.at),raw526,signature526,payload.at+60_001),false);
assert.equal(verify526(secret526,String(payload.at),raw526,'0'.repeat(64),payload.at),false);
assert.equal(verify526(secret526,String(payload.at),
  Buffer.from(body526.replace('"following":false','"following":true')),
  signature526,payload.at),false);
assert.equal(parse526(Buffer.from(JSON.stringify({...payload, unexpected:'x'}))),null);
assert.equal(parse526(Buffer.from(JSON.stringify({...payload,actorUid:'../forged'}))),null);
assert.equal(parse526(Buffer.from(JSON.stringify({...payload,canonicalFollowerCount:-1}))),null);
console.log('APP526_FIREBASE_WEBHOOK_SIGNING_SECURITY_EXECUTABLE=PASS');
