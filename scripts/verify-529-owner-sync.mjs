import assert from 'node:assert/strict';
import { createHmac, webcrypto, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const outbox=await import('../cloudflare/explore-worker/runtime/owner-follow-outbox-529.mjs');
const n=1800000000000;
const a={owner_uid:'A',revision:17,follower_count:2,updated_at:n-3000,
 acked_revision:16,attempts:0,delivered_at:0,dead_at:0,next_attempt_at:0};
const c={...a,owner_uid:'C',revision:1,acked_revision:0,follower_count:1,updated_at:n-2000};
assert.deepEqual(outbox.validateOwnerFollowOutboxEvent529(a),
 {ownerUid:'A',version:17,followerCount:2,updatedAt:n-3000,attempts:0,ackedRevision:16});
assert.equal(outbox.validateOwnerFollowOutboxEvent529({...a,acked_revision:17}),null);
assert.equal(outbox.validateOwnerFollowOutboxEvent529({...a,owner_uid:'../B'}),null);
assert.equal(outbox.validateOwnerFollowOutboxEvent529({...a,follower_count:-1}),null);
const secret='isolated-test-secret-never-deploy-123456789';
const endpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower529';
let receipt;
assert.equal(await outbox.sendOwnerFollowOutboxEvent529(a,{
 endpoint,secret,now:()=>n,send:async(url,init)=>{
   assert.equal(url,endpoint);
   receipt=JSON.parse(init.body);
   assert.equal(receipt.revision,17);assert.equal(receipt.followerCount,2);
   assert.equal(init.headers['X-Soridraw-Follow-Relay529-Signature'],
      createHmac('sha256',secret).update(String(n)+'.'+init.body).digest('hex'));
   return {ok:true};
 }}),true);
await assert.rejects(()=>outbox.sendOwnerFollowOutboxEvent529(a,{
 endpoint:'https://evil.example',secret,now:()=>n,send:async()=>({ok:true}),
}),/ENDPOINT_NOT_PINNED/);
assert.equal((await outbox.drainOwnerFollowOutbox529({enabled:false})).skipped,true);

// One row per owner: old successful delivery races with a newer revision.
// CAS must not acknowledge that newer revision; stale delivery remains harmless.
const rows=[{...a},{...c}], order=[];
let reads=0,writes=0,clock=n,failedOnce=false;
const db={prepare(sql){
  let args=[];
  return {bind(...x){args=x;return this;},
    async all(){
      reads++;
      assert.match(sql,/ORDER BY updated_at ASC,owner_uid ASC LIMIT/);
      return {results:rows.filter(r=>r.revision>r.acked_revision&&r.dead_at===0&&
        r.attempts<8&&r.next_attempt_at<=args[0])
       .sort((l,r)=>l.updated_at-r.updated_at).slice(0,args[1]).map(r=>({...r}))};
    },
    async run(){
      writes++;
      if(sql.includes('SET acked_revision')){
        const r=rows.find(r=>r.owner_uid===args[2]);
        if(r&&r.revision===args[3]&&r.acked_revision<args[4]){
          r.acked_revision=args[0];r.delivered_at=args[1];
        }
      }else if(sql.includes('SET attempts')){
        const r=rows.find(r=>r.owner_uid===args[3]);
        if(r&&r.revision===args[4]&&r.attempts===args[5]&&r.acked_revision<args[6]){
          r.attempts=args[0];r.next_attempt_at=args[1];r.dead_at=args[2];
        }
      }else throw Error('unexpected SQL');
      return {success:true};
    },
  };
}};
const deliver=async e=>{
 order.push(e.ownerUid+':'+e.version);
 if(e.ownerUid==='A'&&e.version===17){
   rows[0].revision=18;rows[0].follower_count=3;rows[0].updated_at=n+1;
   rows[0].attempts=0;rows[0].next_attempt_at=0;
 }
 if(e.ownerUid==='C'&&!failedOnce){failedOnce=true;return false;}
 return true;
};
let result=await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock});
assert.equal(result.selected,2);assert.equal(result.delivered,1);assert.equal(result.failed,1);
assert.equal(rows[0].acked_revision,16,'stale in-flight ACK must not ACK A18');
assert.equal(rows[1].attempts,1);assert.equal(rows[1].next_attempt_at,n+15000);
clock=n+1000;
result=await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock});
assert.equal(result.selected,1);assert.equal(rows[0].acked_revision,18);
clock=n+15_001;
result=await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock});
assert.equal(result.delivered,1);assert.equal(rows[1].acked_revision,1);
assert.deepEqual(order,['A:17','C:1','A:18','C:1']);
assert.equal((await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock})).selected,0);
assert.equal(reads,4);assert.equal(writes,4);
assert.equal(outbox.nextOwnerFollowRetryAt529(20,clock),clock+32*60_000);

const compile=(s)=>ts.transpileModule(s,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const mod={exports:{}};
runInNewContext(compile(readFileSync('src/services/exploreOwnerFollowerSyncCore529.ts','utf8')),
 {module:mod,exports:mod.exports,Date,Number,String,Object,Array});
const ui=mod.exports,values=[],versions=[];
const gate=ui.createOwnerFollowerGate529('A',(count,ver,isNew)=>values.push([count,ver,isNew]),
 ()=>clock,16,ver=>versions.push(ver));
gate.receive(null);
gate.receive({ownerUid:'A',version:17,followerCount:2,at:n,receiptId:'17'});
gate.receive({ownerUid:'A',version:16,followerCount:99,at:n,receiptId:'16'});
gate.receive({ownerUid:'A',version:18,followerCount:1,at:n,receiptId:'18'});
gate.receive({ownerUid:'A',version:18,followerCount:99,at:n,receiptId:'18'});
assert.deepEqual(values,[[2,17,true],[1,18,true]]);
assert.deepEqual(versions,[17,18]);
gate.dispose();gate.receive({ownerUid:'A',version:19,followerCount:3,at:n,receiptId:'19'});
assert.equal(values.length,2);
const retained=[];
const warm=ui.createOwnerFollowerGate529('A',(count,ver,isNew)=>retained.push([count,ver,isNew]),
 ()=>clock,18);
warm.receive({ownerUid:'A',version:18,followerCount:1,at:n,receiptId:'18'});
assert.deepEqual(retained,[[1,18,false]],'retained event must not invalidate warm list');

const webhook=readFileSync('functions/src/exploreOwnerFollowerWebhook529.ts','utf8');
const from=webhook.indexOf('const UID_529=');
const to=webhook.indexOf('export const publishExploreOwnerFollower529=',from);
assert.ok(from>=0&&to>from);
const wmod={exports:{}};
runInNewContext(compile(webhook.slice(from,to)),
 {module:wmod,exports:wmod.exports,Buffer,Number,String,Object,Array,Math,JSON,Date,
  createHmac,timingSafeEqual});
const receiver=wmod.exports;
const raw=Buffer.from(JSON.stringify(receipt));
assert.equal(receiver.parseOwnerFollowReceipt529(raw)?.revision,17);
const signature=createHmac('sha256',secret).update(String(n)+'.'+raw).digest('hex');
assert.equal(receiver.verifyOwnerFollowRequest529(secret,String(n),signature,raw,n),true);
assert.equal(receiver.verifyOwnerFollowRequest529(secret,String(n),signature,raw,n+60001),false);
assert.equal(receiver.verifyOwnerFollowRequest529(secret,String(n),'0'.repeat(64),raw,n),false);
assert.equal(receiver.verifyOwnerFollowRequest529(secret,String(n),signature,
 Buffer.from(JSON.stringify({...receipt,followerCount:1000})),n),false);
assert.equal(receiver.parseOwnerFollowReceipt529(Buffer.from(
 JSON.stringify({...receipt,extra:'forbidden'}))),null);
let owner=null;
const rec=(revision,count)=>({version:1,revision,ownerUid:'A',followerCount:count,updatedAt:n,at:n});
owner=receiver.nextOwnerFollowerMarker529(owner,rec(18,1),clock);
assert.equal(owner.version,18);assert.equal(owner.followerCount,1);
assert.equal(receiver.nextOwnerFollowerMarker529(owner,rec(17,2),clock),undefined);
assert.equal(receiver.nextOwnerFollowerMarker529(owner,rec(18,1),clock),undefined);
owner=receiver.nextOwnerFollowerMarker529(owner,rec(19,2),clock);
assert.equal(owner.version,19);assert.equal(owner.followerCount,2);

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const bridge=readFileSync('src/services/exploreOwnerFollowerSync529.ts','utf8');
const sql=readFileSync('cloudflare/explore-worker/candidates/529-owner-follower-durable-outbox.sql','utf8');
assert.match(worker,/OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN/);
assert.match(worker,/controller\?\.cron==='soridraw-owner-follow-retry-529'/);
assert.match(worker,/ctx\.waitUntil\(runOwnerFollowDelivery529/);
assert.match(bridge,/EXPLORE_OWNER_FOLLOW_REALTIME_529_ENABLED=false/);
assert.match(page,/OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523 = 120_000/);
assert.doesNotMatch(page,/onOwnFollowersFocus525/);
assert.match(page,/createOwnerFollowerGate529/);
assert.match(page,/const changedList=isNewEvent\|\|\(!previousMarker&&profile\?\.followerCount!==count\)/);
assert.match(sql,/owner_uid TEXT PRIMARY KEY/);
assert.match(sql,/ON CONFLICT\(owner_uid\) DO UPDATE/);
assert.match(sql,/enabled INTEGER NOT NULL DEFAULT 0/);
assert.doesNotMatch(worker,/beforeOwnerFollow526|followOperationId\|\|crypto\.randomUUID/);
console.log('APP529_COALESCED_CAS_ACK_AND_RETRY=PASS');
console.log('APP529_RTDB_CANONICAL_OWNER_REVISION_AND_HMAC=PASS');
console.log('APP529_WARM_RETAINED_NO_D1_AND_COMPILED_OFF=PASS');
