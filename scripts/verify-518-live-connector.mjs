// Offline app518 wiring test: no Firebase project, Worker deployment or R2.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../cloudflare/media-worker/src/index.js';
import {createHmac} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {planApp518FavoriteChange,handleApp518FavoriteEvent,APP518_MUSIC_NOTE_FIELDS}
 =require('../functions/lib/app518LiveConnector.js');
const source=readFileSync('cloudflare/media-worker/src/index.js','utf8');
const match=source.match(/const MUSIC_NOTE_CATALOG_FIELDS = \[([\s\S]*?)\];/);
assert.ok(match);
const canonical=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
assert.deepEqual([...APP518_MUSIC_NOTE_FIELDS],canonical,
  'Firebase event classifier must use the exact existing Worker projection');
const uid='owner',documentId='favorite-1',timestamp='2026-10-28T13:00:00.000000123Z';
const base={uid,title:'Song',saved:true,isPublic:false,
  audioUrl:'https://example.test/audio',appliedKeywords:{style:['indie']}};
const plan=(before,after,u=uid)=>planApp518FavoriteChange({
  uid:u,documentId,before,after});
assert.equal(plan(base,{...base,transientEditorFocus:true}),'IGNORE');
assert.equal(plan(base,{...base,sourceRevisionCounter:99}),'IGNORE');
assert.equal(plan(base,{...base,isPublic:true}),'RECHECK');
assert.equal(plan(base,{...base,audioUrl:'https://example.test/b'}),'RECHECK');
assert.equal(plan(base,{...base,appliedKeywords:{style:['lofi']}}),'RECHECK');
assert.equal(plan(base,{...base,saved:false}),'RECHECK');
assert.equal(plan(base,null),'DELETE_RECEIPT');
assert.equal(plan(null,base),'RECHECK');
assert.equal(plan(null,{uid,saved:false,favoriteRemoved:true}),'RECHECK',
 'newly created server tombstone must not be suppressed by a null projection');
assert.equal(plan(base,{...base,uid:'intruder'}),'DENY');
assert.equal(plan(null,null),'IGNORE');
for(let n=0;n<1000;n++)assert.equal(plan(base,{...base,ephemeral:n}),'IGNORE');
const at=iso=>({seconds:Math.floor(Date.parse(iso.slice(0,19)+'Z')/1000),
 nanoseconds:Number(iso.match(/\.(\d+)Z$/)?.[1]||'0')});
let favorite={...base},receipt=null,reads=0,writes=0,posts=0;
const getSnapshot=which=>{
  reads++;
  const data=which==='favorite'?favorite:receipt;
  return {exists:Boolean(data),data:()=>data,
    updateTime:data?at(data.sourceUpdated||timestamp):undefined};
};
const ref=which=>({which,get:async()=>getSnapshot(which)});
const db={
  collection(name){return{doc(id){
    assert.ok(id);
    return ref(name==='favorites'?'favorite':'receipt');
  }};},
  async runTransaction(cb){
    const actions=[];
    const result=await cb({
      get:async r=>getSnapshot(r.which),
      create:(r,v)=>actions.push([r,v]),
      update:(r,v)=>actions.push([r,v]),
    });
    for(const [r,v] of actions){
      assert.equal(r.which,'receipt');writes++;
      receipt={...receipt,...v,sourceUpdated:'2026-10-28T13:00:01.000000222Z'};
    }
    return result;
  },
};
const secret='app518-fixture-shared-secret-longer-than-32-bytes';
const nowMs=Date.parse('2026-10-28T13:00:02Z');
const send=async(url,options)=>{
  assert.equal(url,'https://soridraw-media-preview.example.test/v1/server/catalog518');
  assert.equal(options.redirect,'error');
  const expected=createHmac('sha256',secret)
    .update(options.headers['x-soridraw-server-time-518']+'\n'+options.body)
    .digest('hex');
  assert.equal(options.headers['x-soridraw-server-signature-518'],expected);
  posts++;
  return Response.json({code:'ENQUEUED'});
};
const deps={db,secret,workerUrl:'https://soridraw-media-preview.example.test/v1/server/catalog518',
 expectedHostname:'soridraw-media-preview.example.test',nowMs,post:send};
const event=async(before,after,id='event-1',ver=timestamp)=>handleApp518FavoriteEvent({
 uid,documentId,before,after,deleteEventId:id,beforeUpdateTime:ver,
 dependencies:deps,
});
const ignored=await event(base,{...base,hoverText:'ignore'});
assert.equal(ignored.code,'IGNORE_NO_CATALOG_CHANGE');
assert.equal(reads,0);assert.equal(posts,0);assert.equal(writes,0);
let result=await event(null,base);
assert.equal(result.code,'ENQUEUED');
assert.equal(reads,1);assert.equal(posts,1);assert.equal(writes,0);
favorite={...base,isPublic:true};
result=await event(base,{...base,isPublic:true});
assert.equal(result.code,'ENQUEUED');
assert.equal(reads,2);assert.equal(posts,2);
favorite=null;
result=await event(base,null,'hard-delete-1',timestamp);
assert.equal(result.code,'ENQUEUED');assert.equal(writes,1);
assert.equal(posts,3);
const again=await event(base,null,'hard-delete-1',timestamp);
assert.equal(again.code,'ENQUEUED');assert.equal(writes,1,'duplicate delete W0');
favorite={...base,sourceUpdated:'2026-10-28T13:00:03.000000555Z'};
const stale=await event(base,null,'hard-delete-1',timestamp);
assert.equal(stale.code,'SKIP_NEWER_SAVE_PRESENT');
assert.equal(writes,1,'delayed delete must not undo newer save');
assert.equal(plan(base,{...base,uid:'foreign'}),'DENY');
const off=await worker.fetch(new Request(
 'https://soridraw-media-preview.example.test/v1/server/catalog518',{method:'POST',
 headers:{'content-type':'application/json'},body:'{}'}),{
  SORIDRAW_CANONICAL_CATALOG_518:'0',
  CATALOG_SERVER_HMAC_518:secret,
});
assert.equal(off.status,503);
assert.equal((await off.json()).code,'HOLD_APP518_RELEASE_OFF');
const offSchedule=await worker.scheduled({scheduledTime:nowMs},
 {SORIDRAW_CANONICAL_CATALOG_518:'0'},
 {waitUntil(){throw Error('No scheduler work while OFF');}});
assert.equal(offSchedule,undefined);
const rules=readFileSync('firestore.rules','utf8');
assert.ok(/match \/\{document=\*\*\} \{[\s\S]*?allow read, write: if false;/.test(rules),
  'private server receipt collection must be denied by the default rule');
const config=readFileSync('cloudflare/media-worker/wrangler.jsonc','utf8');
for(const name of ['CATALOG_SERVER_HMAC_518','CATALOG_OUTBOX_518',
  'SORIDRAW_CANONICAL_CATALOG_518','SORIDRAW_APP518_RELEASE_FENCES_VERIFIED'])
 assert.ok(!config.includes(name),'no live Worker binding/activation may be committed: '+name);
console.log('APP518_LIVE_FAVORITES_EVENT_COST_GATE_R0_W0=PASS');
console.log('APP518_LIVE_SIGNED_TRANSPORT_1_EXACT_READ_NO_BROWSER_SCAN=PASS');
console.log('APP518_LIVE_HARD_DELETE_DUPLICATE_W0_LATER_SAVE_WINS=PASS');
console.log('APP518_LIVE_WORKER_ROUTE_AND_SCHEDULER_DEFAULT_OFF=PASS');
console.log('APP518_LIVE_FIELD_WHITELIST_MATCHES_EXISTING_WORKER=PASS');
