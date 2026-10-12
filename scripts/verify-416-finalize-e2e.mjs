import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {finalizePrivateHandoff416} from
 '../cloudflare/explore-worker/runtime/like-private-finalize-416.mjs';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE explore_like_batches_069(batch_id TEXT PRIMARY KEY);'+
 'CREATE TABLE tracks(id TEXT PRIMARY KEY,owner_uid TEXT NOT NULL);'+
 'CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL);'+
 'CREATE TABLE likes(track_id TEXT,user_uid TEXT,PRIMARY KEY(track_id,user_uid));');
const bind=(sql,args=[])=>({bind:(...v)=>bind(sql,v),
 async first(){return sqlite.prepare(sql).get(...args)||null;},
 async all(){return {results:sqlite.prepare(sql).all(...args)}}});
const db={prepare:sql=>bind(sql)};
const uid='same-account',now=1_700_000_000_000;
const op=i=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0');
const rows=Array.from({length:80},(_,i)=>({trackId:'song-'+i,
 liked:i%3===0,operationId:op(i)}));
for(let i=0;i<80;i++){
 sqlite.prepare('INSERT INTO tracks VALUES(?,?)').run('song-'+i,'owner-'+(i%2));
 sqlite.prepare('INSERT INTO track_stats VALUES(?,?)').run('song-'+i,i+1);
 if(i%2===0)sqlite.prepare('INSERT INTO likes VALUES(?,?)').run('song-'+i,uid);
}
const batchIds=[0,1].map(i=>'l069_'+String(now-1000-i).padStart(13,'0')+'_'
 +(i?'b':'a').repeat(64));
let r2puts=0,etag=1;
let personal={schemaVersion:1,uid,canonicalComplete156:true,
 canonicalSource156:'legacy-exact',likedTrackIds:[],exactLikeCount156:0};
const r2={async get(){return {etag:'e'+etag,customMetadata:{},
 text:async()=>JSON.stringify(personal)};},
 async put(_key,body,opts){assert.equal(opts.onlyIf.etagMatches,'e'+etag);
 personal=JSON.parse(body);etag++;r2puts++;return {etag:'e'+etag};}};
const secret='stage416-final-callback-secret-longer-than-32';
let callbacks=0,lastClaim=null;
const http=async(_url,init)=>{
 callbacks++;lastClaim=JSON.parse(init.body);
 assert.equal(init.headers['X-Soridraw-416-Final-Signature'],
  createHmac('sha256',secret).update(init.body).digest('hex'));
 return {ok:true,json:async()=>({ok:true,data:{status:
  callbacks===1?'PUBLISHED':'DUPLICATE'}})};
};
const args={db,r2,uid,windowId:op(500),version:80,batchIds,rows,
 finalEndpoint:'https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/privateLikeFinalReceipt416Candidate',
 secret,nowMs:now,http};
const out=await finalizePrivateHandoff416(args);
assert.equal(out.settled,true);assert.equal(out.rows.length,80);
assert.equal(r2puts,1,'whole account changed-window membership is one R2 CAS');
assert.equal(callbacks,1);
assert.equal(lastClaim.rows.length,80);
for(let i=0;i<80;i++){
 const row=lastClaim.rows.find(x=>x.trackId==='song-'+i);
 assert.equal(row.operationId,op(i));
 assert.equal(row.liked,i%2===0,'final heart comes from canonical relation, not desired input');
 assert.equal(row.likeCount,i+1);assert.match(row.ownerUid,/^owner-/);
}
assert.equal(personal.exactLikeCount156,40);
const retry=await finalizePrivateHandoff416(args);
assert.equal(retry.receiptStatus,'DUPLICATE');
assert.equal(r2puts,1,'exact retry R2 W0');
assert.equal(callbacks,2);
sqlite.prepare('INSERT INTO explore_like_batches_069 VALUES(?)').run(batchIds[0]);
await assert.rejects(finalizePrivateHandoff416({...args,version:81}),/416_FINAL_069_STILL_PENDING/);
assert.equal(r2puts,1);assert.equal(callbacks,2);
const entry=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
const index=readFileSync('functions/src/index.ts','utf8');
assert.match(entry,/const STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE=false/);
assert.match(entry,/finalizePrivateHandoff416\(\{/);
assert.match(index,/privateLikeFinalReceipt416Candidate/);
console.log('STAGE416_069_DRAIN_TO_ONE_R2_CAS_TO_SIGNED_FINAL80=PASS');
console.log('STAGE416_FINAL_RETRY_R2_W0_CALLBACK_IDEMPOTENT=PASS');
console.log('STAGE416_PENDING_069_BLOCKS_FALSE_FINAL_ACK=PASS');
console.log('STAGE416_FINAL_HTTP_PREVIEW_EXPORT_READY=PASS');
