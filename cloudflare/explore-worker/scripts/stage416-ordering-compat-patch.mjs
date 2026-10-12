import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

const file=process.argv[2];
if(!file)throw Error('usage: node stage416-ordering-compat-patch.mjs <worker-source>');
let source=readFileSync(file,'utf8');
const beforeHash=createHash('sha256').update(source).digest('hex');
const compatNeedles=[
 "e.queue_kind = '069'",
 "json_type(j.value, '$.operationId') = 'text'",
 "json_type(j.value, '$.mutationAt') = 'integer'",
 "CAST(json_extract(j.value, '$.mutationAt') AS INTEGER) <= e.created_at",
];
const fn='function exploreLikeAggregateSnapshotCte039';
const start=source.indexOf(fn);
if(start<0)throw Error('416_COMPAT_AGGREGATE_CTE_MISSING');
const end=source.indexOf('\n}\n',start);
if(end<0)throw Error('416_COMPAT_AGGREGATE_CTE_UNTERMINATED');
const current=source.slice(start,end+3);
if(compatNeedles.every(x=>current.includes(x))){
 console.log('STAGE416_ORDERING_COMPAT_ALREADY_APPLIED=PASS');
 console.log('STAGE416_ORDERING_COMPAT_SHA256='+beforeHash);
 process.exit(0);
}
const old=[
 "      SELECT e.batch_id, e.user_uid, e.created_at, e.queue_kind,",
 "        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,",
 "        CASE WHEN json_extract(j.value, '$.liked') THEN 1 ELSE 0 END AS desired_liked",
].join('\n');
const replacement=[
 "      SELECT e.batch_id, e.user_uid,",
 "        CASE",
 "          WHEN e.queue_kind = '069'",
 "           AND json_type(j.value, '$.operationId') = 'text'",
 "           AND json_type(j.value, '$.mutationAt') = 'integer'",
 "           AND CAST(json_extract(j.value, '$.mutationAt') AS INTEGER) > 0",
 "           AND CAST(json_extract(j.value, '$.mutationAt') AS INTEGER) <= e.created_at",
 "          THEN CAST(json_extract(j.value, '$.mutationAt') AS INTEGER)",
 "          ELSE e.created_at",
 "        END AS created_at,",
 "        e.queue_kind,",
 "        TRIM(CAST(json_extract(j.value, '$.trackId') AS TEXT)) AS track_id,",
 "        CASE WHEN json_extract(j.value, '$.liked') THEN 1 ELSE 0 END AS desired_liked",
].join('\n');
const count=current.split(old).length-1;
if(count!==1)throw Error('416_COMPAT_EXACT_ANCHOR_COUNT_'+count);
const nextFn=current.replace(old,replacement);
for(const required of compatNeedles)if(!nextFn.includes(required))
 throw Error('416_COMPAT_MATERIALIZATION_MISSING');
const next=source.slice(0,start)+nextFn+source.slice(end+3);
if(next.length<=source.length)throw Error('416_COMPAT_UNEXPECTED_SIZE');
source=next;
writeFileSync(file,source,'utf8');
const afterHash=createHash('sha256').update(source).digest('hex');
console.log('STAGE416_ORDERING_COMPAT_PATCHED=PASS');
console.log('STAGE416_ORDERING_COMPAT_BEFORE_SHA256='+beforeHash);
console.log('STAGE416_ORDERING_COMPAT_AFTER_SHA256='+afterHash);
