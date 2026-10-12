import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const path=process.argv[2];
const stage=String(process.argv[3]||'UNKNOWN').toUpperCase();
if(!path)throw Error('usage: node verify-416-live-worker-compatibility.mjs <worker-source> <stage>');
const s=readFileSync(path,'utf8');
const fn='function exploreLikeAggregateSnapshotCte039';
const i=s.indexOf(fn);
assert(i>=0,stage+' missing aggregate CTE');
const body=s.slice(i,i+8000);
assert.match(body,/queue_kind = '069'/,stage+' missing 069 branch');
assert.match(body,/json_each\(e\.mutations_json\)/,stage+' missing mutation JSON expansion');
const oldAnchor=[
 "SELECT e.batch_id, e.user_uid, e.created_at, e.queue_kind,",
 "TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id",
 "ORDER BY created_at DESC, batch_id DESC, queue_kind DESC",
].every(x=>body.includes(x));
const compat=[
 "e.queue_kind = '069'",
 "json_type(j.value, '$.operationId') = 'text'",
 "json_type(j.value, '$.mutationAt') = 'integer'",
 "CAST(json_extract(j.value, '$.mutationAt') AS INTEGER) <= e.created_at",
].every(x=>body.includes(x));
if(!oldAnchor&&!compat)throw Error(stage+' aggregate shape is neither known legacy nor Stage416-compatible');
console.log(stage+'_416_AGGREGATE_SHAPE='+(compat?'COMPAT':'LEGACY_PATCHABLE'));
console.log(stage+'_416_COMPATIBILITY_READONLY=PASS');
