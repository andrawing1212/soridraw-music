import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('functions/src/exploreLikePrivateFinal416.ts','utf8');
const start=source.indexOf('type PublicRow416=');
const end=source.indexOf('export async function publishAuthenticatedPrivateFinal416(');
assert(start>=0&&end>start);
const js=ts.transpileModule(source.slice(start,end)+'\nexport {notifySettledPublicLikes416};',{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const exports={};
vm.runInNewContext(js,{exports,Map,Object,Number,Error});
const deliver=exports.notifySettledPublicLikes416;
let state=null,writes=0;const now=1_700_000_000_000;
const db={ref:p=>{assert.equal(p,'publicSync/exploreLike');return {
 transaction:async fn=>{const next=fn(state);if(next===undefined)return {committed:false};
 state=next;writes++;return {committed:true};}
}}};
const claim=(n,prefix='t')=>({uid:'A',signedAtMs:now,
 batchIds:['l069_'+(now-500)+'_'+'a'.repeat(64)],
 rows:Array.from({length:n},(_,i)=>({trackId:prefix+i,ownerUid:'owner'}))});
const allRows=()=>[...Object.values(state.rows||{}),
 ...Object.values(state.overflow416||{})];
await deliver(db,claim(80),now);
assert.equal(writes,1);assert.equal(state.rows.length,50);
assert.equal(state.overflow416.length,30);
assert.equal(new Set(allRows().map(r=>r.trackId)).size,80);
await deliver(db,claim(80),now);
assert.equal(writes,1,'completed duplicate must not write');
state=null;writes=0;await deliver(db,claim(256),now);
assert.equal(writes,1);assert.equal(state.overflow416.length,206);
assert.equal(new Set(allRows().map(r=>r.trackId)).size,256);
state={version:now+10,at:now,actorUid:'B',
 rows:[{trackId:'t0',ownerUid:'owner',at:now-10},
 {trackId:'unrelated',ownerUid:'B',at:now-20}]};
await deliver(db,claim(80),now);
assert.equal(allRows().find(x=>x.trackId==='t0').at,now-10);
assert(allRows().some(x=>x.trackId==='unrelated'));
console.log('STAGE416_ATOMIC_80_256_DELAYED_OBSERVER_AND_REPLAY_W0=PASS');