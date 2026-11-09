import assert from 'node:assert/strict';
import { createHmac, webcrypto, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require=createRequire(import.meta.url);
const ts=require('typescript');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const outbox=await import('../cloudflare/explore-worker/runtime/owner-follow-outbox-529.mjs');
const n=1800000000000;
const event={event_id:17,owner_uid:'A',follower_count:2,created_at:n-3000,attempts:0};
assert.deepEqual(outbox.validateOwnerFollowOutboxEvent529(event),
  {eventId:17,ownerUid:'A',followerCount:2,createdAt:n-3000,attempts:0});
assert.equal(outbox.validateOwnerFollowOutboxEvent529({...event,follower_count:-1}),null);
assert.equal(outbox.validateOwnerFollowOutboxEvent529({...event,event_id:1.5}),null);
assert.equal(outbox.validateOwnerFollowOutboxEvent529({...event,owner_uid:'../B'}),null);
const secret='isolated-test-secret-never-deploy-123456789';
const endpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExploreOwnerFollower529';
let sent=0,receipt;
const ok=await outbox.sendOwnerFollowOutboxEvent529(event,{
  endpoint,secret,now:()=>n,
  send:async(url,init)=>{
    sent++;
    assert.equal(url,endpoint);
    receipt=JSON.parse(init.body);
    assert.equal(receipt.eventId,17);
    assert.equal(receipt.followerCount,2);
    const expected=createHmac('sha256',secret).update(String(n)+'.'+init.body).digest('hex');
    assert.equal(init.headers['X-Soridraw-Follow-Relay529-Signature'],expected);
    return {ok:true};
  },
});
assert.equal(ok,true);assert.equal(sent,1);
await assert.rejects(()=>outbox.sendOwnerFollowOutboxEvent529(event,{
 endpoint:'https://evil.example/test',secret,now:()=>n,send:async()=>({ok:true}),
}),/ENDPOINT_NOT_PINNED/);
assert.equal((await outbox.drainOwnerFollowOutbox529({enabled:false})).skipped,true);

// D1 mock: two pending events; first succeeds, second fails then retries.
// No real D1, Firebase, R2 or network is contacted.
const rows=[
 {...event,delivered_at:0,dead_at:0,next_attempt_at:0},
 {...event,event_id:18,follower_count:1,attempts:0,delivered_at:0,dead_at:0,next_attempt_at:0},
];
let reads=0,writes=0,clock=n,failedOnce=false;
const db={prepare(sql){
  let args=[];
  return {bind(...x){args=x;return this;},
    async all(){
      reads++;
      assert.match(sql,/ORDER BY event_id ASC LIMIT/);
      return {results:rows.filter(r=>r.delivered_at===0&&r.dead_at===0&&r.attempts<8&&r.next_attempt_at<=args[0])
        .sort((a,b)=>a.event_id-b.event_id).slice(0,args[1])};
    },
    async run(){
      writes++;
      if(sql.includes('SET delivered_at')){
        const r=rows.find(r=>r.event_id===args[1]);if(r&&r.delivered_at===0)r.delivered_at=args[0];
      }else if(sql.includes('SET attempts')){
        const r=rows.find(r=>r.event_id===args[3]);
        if(r&&r.attempts===args[4]&&r.delivered_at===0){
          r.attempts=args[0];r.next_attempt_at=args[1];r.dead_at=args[2];
        }
      }else throw Error('unexpected SQL');
      return {success:true};
    },
  };
}};
const deliveredOrder=[];
const deliver=async ev=>{
 deliveredOrder.push(ev.eventId);
 if(ev.eventId===18&&!failedOnce){failedOnce=true;return false;}
 return true;
};
let result=await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock});
assert.equal(result.selected,2);assert.equal(result.delivered,1);assert.equal(result.failed,1);
assert.equal(rows[0].delivered_at,n);assert.equal(rows[1].attempts,1);
assert.equal(rows[1].next_attempt_at,n+15000);
clock=n+1000;
result=await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock});
assert.equal(result.selected,0);assert.equal(writes,2);
clock=n+15_001;
result=await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock});
assert.equal(result.delivered,1);assert.deepEqual(deliveredOrder,[17,18,18]);
assert.equal((await outbox.drainOwnerFollowOutbox529({enabled:true,db,deliver,now:()=>clock})).selected,0);
assert.equal(writes,3);assert.equal(reads,4);
assert.equal(outbox.nextOwnerFollowRetryAt529(20,clock),clock+60*60_000);

const compiled=(source,append='')=>ts.transpileModule(source+append,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const gateModule={exports:{}};
runInNewContext(compiled(readFileSync('src/services/exploreOwnerFollowerSyncCore529.ts','utf8')),
 {module:gateModule,exports:gateModule.exports,Date,Number,String,Object,Array});
const gateApi=gateModule.exports;
const values=[],versions=[];
const gate=gateApi.createOwnerFollowerGate529('A',(count,ver)=>values.push([count,ver]),
 ()=>clock,16,version=>versions.push(version));
gate.receive(null);
gate.receive({ownerUid:'A',version:17,followerCount:2,at:n,receiptId:'17'});
gate.receive({ownerUid:'A',version:16,followerCount:100,at:n,receiptId:'16'});
gate.receive({ownerUid:'B',version:19,followerCount:99,at:n,receiptId:'19'});
gate.receive({ownerUid:'A',version:18,followerCount:1,at:n,receiptId:'18'});
assert.deepEqual(values,[[2,17],[1,18]]);
assert.deepEqual(versions,[17,18]);
gate.dispose();
gate.receive({ownerUid:'A',version:19,followerCount:3,at:n,receiptId:'19'});
assert.equal(values.length,2);

// Execute the webhook's real signature parser and ordering helper without
// importing Firebase or touching a live database.
const f=readFileSync('functions/src/exploreOwnerFollowerWebhook529.ts','utf8');
const start=f.indexOf('const UID_529=');
const end=f.indexOf('export const publishExploreOwnerFollower529=',start);
assert.ok(start>=0&&end>start);
const mod={exports:{}};
runInNewContext(compiled(f.slice(start,end)),
 {module:mod,exports:mod.exports,Buffer,Number,String,Object,Array,Math,JSON,Date,
   createHmac,timingSafeEqual});
const web=mod.exports;
const body=Buffer.from(JSON.stringify(receipt));
assert.equal(web.parseOwnerFollowReceipt529(body)?.eventId,17);
const signature=createHmac('sha256',secret).update(String(n)+'.'+body).digest('hex');
assert.equal(web.verifyOwnerFollowRequest529(secret,String(n),signature,body,n),true);
assert.equal(web.verifyOwnerFollowRequest529(secret,String(n),signature,body,n+60_001),false);
assert.equal(web.verifyOwnerFollowRequest529(secret,String(n),'0'.repeat(64),body,n),false);
const tampered=Buffer.from(JSON.stringify({...receipt,followerCount:999}));
assert.equal(web.verifyOwnerFollowRequest529(secret,String(n),signature,tampered,n),false);
assert.equal(web.parseOwnerFollowReceipt529(Buffer.from(JSON.stringify({...receipt,other:'x'}))),null);
assert.equal(web.parseOwnerFollowReceipt529(Buffer.from(JSON.stringify({...receipt,eventId:-1}))),null);
let owner=null;
const rec=(eventId,followerCount)=>({version:1,eventId,ownerUid:'A',followerCount,createdAt:n,at:n});
owner=web.nextOwnerFollowerMarker529(owner,rec(18,1),clock);
assert.equal(owner.version,18);assert.equal(owner.followerCount,1);
assert.equal(web.nextOwnerFollowerMarker529(owner,rec(17,2),clock),undefined);
assert.equal(web.nextOwnerFollowerMarker529(owner,rec(18,1),clock),undefined);
owner=web.nextOwnerFollowerMarker529(owner,rec(19,2),clock);
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
assert.match(sql,/enabled INTEGER NOT NULL DEFAULT 0/);
assert.match(sql,/NEW\.follower_count IS NOT OLD\.follower_count/);
assert.doesNotMatch(worker,/beforeOwnerFollow526|followOperationId\|\|crypto\.randomUUID/);
console.log('APP529_DURABLE_RETRY_BOUNDED_AND_NO_IDLE_D1=PASS');
console.log('APP529_RTDB_CANONICAL_VERSION_ORDER_AND_TAMPER_REJECT=PASS');
console.log('APP529_COMPILATION_AND_SHARED_RESOURCE_GATES_OFF=PASS');
