import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
assert.match(worker,/e\.queue_kind = '069'[\s\S]{0,300}json_type\(j\.value, '\$\.operationId'\) = 'text'[\s\S]{0,300}json_type\(j\.value, '\$\.mutationAt'\) = 'integer'/);
assert.match(worker,/CAST\(json_extract\(j\.value, '\$\.mutationAt'\) AS INTEGER\) <= e\.created_at/);
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE q(batch_id TEXT,user_uid TEXT,created_at INTEGER,queue_kind TEXT,mutations_json TEXT)');
const uid='u',track='song',t0=1_000_000;
const op='00000000-0000-4000-8000-000000000001';
db.prepare('INSERT INTO q VALUES(?,?,?,?,?)').run('preview',uid,t0+300000,'069',
 JSON.stringify([{trackId:track,liked:true,operationId:op,mutationAt:t0}]));
db.prepare('INSERT INTO q VALUES(?,?,?,?,?)').run('legacy',uid,t0+240000,'069',
 JSON.stringify([{trackId:track,liked:false}]));
const latest=db.prepare(`
 WITH expanded AS (
  SELECT user_uid,batch_id,
   CASE WHEN queue_kind='069' AND json_type(j.value,'$.operationId')='text'
     AND json_type(j.value,'$.mutationAt')='integer'
     AND CAST(json_extract(j.value,'$.mutationAt') AS INTEGER)>0
     AND CAST(json_extract(j.value,'$.mutationAt') AS INTEGER)<=created_at
    THEN CAST(json_extract(j.value,'$.mutationAt') AS INTEGER) ELSE created_at END created_at,
   CAST(json_extract(j.value,'$.liked') AS INTEGER) liked
  FROM q,json_each(q.mutations_json) j
 )
 SELECT liked,created_at,batch_id FROM expanded ORDER BY created_at DESC,batch_id DESC LIMIT 1
`).get();
assert.equal(latest.batch_id,'legacy');
assert.equal(latest.liked,0);
assert.equal(latest.created_at,t0+240000);
console.log('STAGE416_CROSS_ENV_LATER_LEGACY_CLICK_WINS_OVER_LATE_5MIN_SEAL=PASS');
console.log('STAGE416_OLD_069_ROWS_FALL_BACK_TO_BATCH_CREATED_AT=PASS');
