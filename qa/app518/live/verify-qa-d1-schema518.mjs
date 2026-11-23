// In-memory SQLite exercises the EXACT pinned candidate DDL/last-write SQL.
// The test never calls any Cloudflare/Firebase endpoint or writes user data.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {applyExactQa518Schema,exactQa518SchemaStatements,QA518_SCHEMA_NAMES} from './apply-qa-d1-schema518.mjs';
const candidateDir=process.env.APP518_PINNED_CANDIDATE_DIR;
assert.ok(candidateDir?.includes('app518-pinned-candidate'));
const plan=exactQa518SchemaStatements({candidateDir});
assert.equal(plan.length,7);
const D1='01234567-0123-4123-8123-0123456789ab';
const make=()=>new DatabaseSync(':memory:');
const queryFor=db=>async sql=>{
 const text=sql.trim();
 if(/^SELECT\b/i.test(text))return {results:db.prepare(text).all(),meta:{rows_written:0}};
 if(!/^CREATE (TABLE|INDEX) IF NOT EXISTS /i.test(text))
  throw Error('TEST_DENY_UNREVIEWED_DDL');
 db.exec(text);
 return {results:[],meta:{rows_written:0}};
};
const db=make();
db.exec("CREATE TABLE qa583_protected (id TEXT PRIMARY KEY, value TEXT);"+
 "INSERT INTO qa583_protected VALUES ('preserve','keep')");
const result=await applyExactQa518Schema({plan,d1Id:D1,query:queryFor(db),approved:true});
assert.equal(result.code,'APP518_QA_D1_EXACT_ADDITIVE_SCHEMA_PASS');
assert.equal(db.prepare("SELECT value FROM qa583_protected WHERE id='preserve'").get().value,'keep');
const names=db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') "+
 "AND (name LIKE 'music_note_catalog_%_518' OR name LIKE 'idx_music_note_catalog_%')").all().map(r=>r.name).sort();
assert.deepEqual(names,QA518_SCHEMA_NAMES);
console.log('APP518_QA_D1_REAL_SQLITE_PINNED_SCHEMA=PASS');
console.log('APP518_QA_OTHER_QA_TABLE_PRESERVED=PASS');
// Exact outbox SQL: new and newer versions advance, stale versions cannot overwrite.
const candidateOutbox=await import(pathToFileURL(join(
 candidateDir,'cloudflare/media-worker/src/catalogD1Outbox518.js')).href);
const newer='017000000000000000001',stale='016000000000000000001';
const owner='qa518-45123456789-owner',song='qa518-45123456789-song';
const up=sql=>db.prepare(sql);
const a=up(candidateOutbox.UPSERT_CANONICAL_518);
const now=Date.parse('2026-11-23T00:00:00Z');
assert.equal(a.run(owner,song,newer,'saved',now).changes,1);
assert.equal(a.run(owner,song,stale,'removed',now+100).changes,0);
const current=up(candidateOutbox.READ_ONE_518).get(owner,song);
assert.equal(current.desired_state,'saved');
assert.equal(current.source_version_ns,newer);
const ack=up(candidateOutbox.ACK_EXACT_518);
assert.equal(ack.run(now+200,owner,song,stale).changes,0);
assert.equal(ack.run(now+201,owner,song,newer).changes,1);
console.log('APP518_QA_D1_PINNED_OUTBOX_STALE_REPLAY_DENIED=PASS');
await assert.rejects(()=>applyExactQa518Schema({
 plan,d1Id:D1,query:queryFor(db),approved:true,
}),/HOLD_QA518_D1_EXISTING_OR_PARTIAL_SCHEMA/);
const orphan=make();
orphan.exec("CREATE TABLE unrelated_qa_holder (id TEXT);"+
 "CREATE INDEX idx_music_note_catalog_member_518_generation ON unrelated_qa_holder(id)");
await assert.rejects(()=>applyExactQa518Schema({
 plan,d1Id:D1,query:queryFor(orphan),approved:true,
}),/HOLD_QA518_D1_EXISTING_OR_PARTIAL_SCHEMA/);
assert.equal(orphan.prepare("SELECT COUNT(*) AS n FROM unrelated_qa_holder").get().n,0);
orphan.close();
console.log('APP518_QA_D1_ORPHAN_SUFFIXED_INDEX_COLLISION_DENIED=PASS');
const another=make();
const partial=plan.map(x=>({...x}));
let steps=0;
await assert.rejects(()=>applyExactQa518Schema({
 plan:partial,d1Id:D1,approved:true,
 query:async sql=>{
  if(/^SELECT/.test(sql))return {results:[],meta:{rows_written:0}};
  steps++;
  if(steps===3)throw Error('SIMULATED_NETWORK_DISCONNECT');
  return {results:[],meta:{rows_written:0}};
 },
}),/HOLD_QA518_D1_PARTIAL_SCHEMA_ATTEMPTS_3/);
assert.equal(steps,3);
await assert.rejects(()=>applyExactQa518Schema({
 plan,d1Id:D1,query:queryFor(another),approved:false,
}),/HOLD_QA518_D1_PLAN_OR_APPROVAL_INVALID/);
const maliciousName=plan.map(x=>({...x}));
maliciousName[0].name='unrelated_production';
await assert.rejects(()=>applyExactQa518Schema({
 plan:maliciousName,d1Id:D1,query:queryFor(another),approved:true,
}),/HOLD_QA518_D1_PLAN_OR_APPROVAL_INVALID/);
const files=['518_music_note_catalog_daily_write_budget.sql',
 '518_music_note_catalog_first_change_index.sql',
 '518_music_note_catalog_outbox.sql'];
await assert.throws(()=>exactQa518SchemaStatements({
 candidateDir,read:(p)=>{
  let s=readFileSync(p,'utf8');
  if(p.endsWith(files[0]))s=s.replace('CREATE TABLE','DROP TABLE');
  return s;
 },
}),/HOLD_QA518_NON_ADDITIVE_MIGRATION/);
db.close();another.close();
console.log('APP518_QA_D1_REPLAY_PARTIAL_FAILED_OR_FOREIGN_PLAN=DENIED');
console.log('APP518_QA_D1_SOURCE_ONLY_CLOUD_WRITES=0');
