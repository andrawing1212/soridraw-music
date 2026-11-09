/* APP529: isolated Cloudflare D1 physical billing + source-order recovery.
 * Creates/deletes only a run-owned synthetic database. No shared D1 IDs,
 * Worker/Function/Rules/Hosting deployment, or real user events. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {drainOwnerFollowOutbox529} from '../cloudflare/explore-worker/runtime/owner-follow-outbox-529.mjs';

const source=readFileSync('cloudflare/explore-worker/candidates/529-owner-follower-durable-outbox.sql','utf8');
const moduleSource=readFileSync('cloudflare/explore-worker/runtime/owner-follow-outbox-529.mjs','utf8');
const clientSource=readFileSync('src/services/exploreOwnerFollowerSync529.ts','utf8');
assert.match(moduleSource,/OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN=false/);
assert.match(clientSource,/EXPLORE_OWNER_FOLLOW_REALTIME_529_ENABLED=false/);
assert.ok(!/\b(?:DROP TABLE|DELETE FROM|ALTER TABLE)\b/i.test(source),'SOURCE_MUST_BE_ADDITIVE');
const get=(regex,label)=>{const part=source.match(regex)?.[0];assert.ok(part,'MISSING_'+label);return part;};
const sql=[
 get(/CREATE TABLE IF NOT EXISTS explore_owner_follow_control_529[\s\S]*?\);/,'CONTROL'),
 get(/INSERT INTO explore_owner_follow_control_529[\s\S]*?;/,'INIT_OFF'),
 get(/CREATE TABLE IF NOT EXISTS explore_owner_follow_outbox_529[\s\S]*?\) WITHOUT ROWID;/,'OUTBOX'),
 get(/CREATE INDEX IF NOT EXISTS idx_explore_owner_follow_pending_529[\s\S]*?;/,'PENDING_INDEX'),
 ...[...source.matchAll(/CREATE TRIGGER IF NOT EXISTS [\s\S]*?\bEND;/g)].map(x=>x[0]),
];
assert.equal(sql.length,6,'EXACT_529_DDL_ONLY');
assert.equal((source.match(/CREATE TRIGGER IF NOT EXISTS/g)||[]).length,2);
assert.match(sql[4],/AFTER UPDATE OF follower_count ON profile_stats/);
assert.match(sql[4],/WHEN NEW.follower_count IS NOT OLD.follower_count/);
assert.match(sql[4],/ON CONFLICT\(owner_uid\) DO UPDATE/);
assert.match(sql[5],/BEFORE DELETE ON explore_owner_follow_outbox_529/);
const createStats='CREATE TABLE profile_stats(uid TEXT PRIMARY KEY NOT NULL, follower_count INTEGER NOT NULL CHECK(follower_count>=0))';
const local=new DatabaseSync(':memory:');
local.exec(createStats);
for(const statement of sql)local.exec(statement);
assert.equal(local.prepare('SELECT enabled FROM explore_owner_follow_control_529 WHERE id=1').get().enabled,0);
local.exec("INSERT INTO profile_stats VALUES('A',0)");
local.exec("UPDATE profile_stats SET follower_count=1 WHERE uid='A'");
assert.equal(local.prepare('SELECT COUNT(*) AS n FROM explore_owner_follow_outbox_529').get().n,0);
local.exec('UPDATE explore_owner_follow_control_529 SET enabled=1 WHERE id=1');
local.exec("UPDATE profile_stats SET follower_count=2 WHERE uid='A'");
const localRow=local.prepare('SELECT revision,follower_count FROM explore_owner_follow_outbox_529').get();
assert.equal(Number(localRow?.revision),1);
assert.equal(Number(localRow?.follower_count),2);
local.close();
console.log('APP529_ISOLATED_SOURCE_DDL_OFF_AND_TRANSACTION_SELF_TEST=PASS');
if(process.argv[2]==='--self-test')process.exit(0);

const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const runId=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
const eventPath=process.env.GITHUB_EVENT_PATH,temp=process.env.RUNNER_TEMP;
assert.match(account||'',/^[a-f0-9]{32}$/);assert.ok(token&&token.length>15);
assert.match(runId||'',/^[1-9][0-9]{5,}$/);assert.equal(attempt,'1');
assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
const event=JSON.parse(readFileSync(eventPath,'utf8'));
assert.equal(event.number,914);
assert.equal(event.pull_request?.head?.repo?.full_name,'andrawing1212/soridraw-music');
assert.equal(event.pull_request?.head?.ref,'candidate/app526-owner-follower-live-signal');
assert.ok(temp&&temp.startsWith('/'));
const name='soridraw-owner-follow-529-'+runId+'-'+attempt;
const record=join(temp,'soridraw-529-owned-d1.json');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const knownShared='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const safeId=id=>{assert.match(id||'',/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);assert.notEqual(id,knownShared);return id;};
async function api(method,suffix,body){
 const response=await fetch(base+suffix,{method,
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 let data;try{data=await response.json()}catch{throw Error('NON_JSON_D1_HTTP_'+response.status);}
 if(!response.ok||data?.success!==true){
  const code=String(data?.errors?.[0]?.code||'unknown').replace(/[^0-9a-zA-Z_]/g,'');
  throw Error('CLOUDFLARE_'+method+'_HTTP_'+response.status+'_CODE_'+code);
 }
 return data.result;
}
async function deleteOwned(id){
 safeId(id);
 const found=await api('GET','/'+id);
 assert.equal(found?.name,name,'REFUSE_FOREIGN_D1_NAME');
 assert.equal(found?.uuid,id,'REFUSE_FOREIGN_D1_ID');
 await api('DELETE','/'+id);
 if(existsSync(record))unlinkSync(record);
 console.log('APP529_EPHEMERAL_D1_DELETED=PASS');
}
async function cleanup(){
 if(!existsSync(record)){console.log('APP529_NO_OWNED_DB_TO_CLEAN=PASS');return;}
 const r=JSON.parse(readFileSync(record,'utf8'));
 assert.equal(r.name,name);await deleteOwned(r.uuid);
}
if(process.argv[2]==='cleanup'){await cleanup();process.exit(0);}
assert.equal(process.argv.length,2);
assert.equal(existsSync(record),false,'PREVIOUS_OWNED_RECORD_EXISTS');
let owned=null,done=false;
try{
 const created=await api('POST','',{name,primary_location_hint:'apac'});
 assert.equal(created?.name,name);
 owned=safeId(created?.uuid);
 writeFileSync(record,JSON.stringify({name,uuid:owned}),{flag:'wx',mode:0o600});
 const check=await api('GET','/'+owned);
 assert.equal(check?.name,name);assert.equal(check?.uuid,owned);
 const ledger=[];
 async function query(statement,params=[],label=''){
  safeId(owned);assert.ok(typeof statement==='string'&&statement.length<12000&&Array.isArray(params)&&params.length<=8);
  const raw=await api('POST','/'+owned+'/query',{sql:statement,params});
  assert.ok(Array.isArray(raw)&&raw.length===1&&raw[0].success===true,'D1_QUERY_FAILED');
  const m=raw[0].meta||{};
  assert.ok(Number.isSafeInteger(Number(m.rows_read))&&Number.isSafeInteger(Number(m.rows_written)),'PHYSICAL_META_MISSING');
  const measurement={read:Number(m.rows_read),write:Number(m.rows_written)};
  if(label)ledger.push({label,...measurement});
  return {rows:raw[0].results||[],measure:measurement,changes:Number(m.changes||0)};
 }
 const value=async(statement,params=[])=> (await query(statement,params)).rows[0];
 const count=async(uid)=>Number((await value('SELECT follower_count FROM profile_stats WHERE uid=?',[uid]))?.follower_count);
 const row=async(uid)=>await value('SELECT * FROM explore_owner_follow_outbox_529 WHERE owner_uid=?',[uid]);
 await query(createStats);
 for(const uid of ['A','B','C'])await query('INSERT INTO profile_stats(uid,follower_count) VALUES(?,0)',[uid]);
 const baseline=await query('UPDATE profile_stats SET follower_count=1 WHERE uid=?',['A'],'baseline_without_529');
 for(const statement of sql)await query(statement);
 assert.equal(Number((await value('SELECT enabled FROM explore_owner_follow_control_529 WHERE id=1')).enabled),0);
 const off=await query('UPDATE profile_stats SET follower_count=2 WHERE uid=?',['A'],'installed_529_off');
 assert.equal(await row('A'),undefined,'OFF_CREATED_OUTBOX');
 await query('UPDATE explore_owner_follow_control_529 SET enabled=1 WHERE id=1');
 const first=await query('UPDATE profile_stats SET follower_count=3 WHERE uid=?',['A'],'on_new_owner');
 assert.equal(Number((await row('A')).revision),1);
 const existing=await query('UPDATE profile_stats SET follower_count=4 WHERE uid=?',['A'],'on_existing_owner');
 assert.equal(Number((await row('A')).revision),2);
 assert.equal(Number((await row('A')).follower_count),4);
 const noChange=await query('UPDATE profile_stats SET follower_count=? WHERE uid=? AND follower_count<>?',[4,'A',4],'canonical_noop');
 assert.equal(noChange.measure.write,0);
 const oldAck=await query('UPDATE explore_owner_follow_outbox_529 SET acked_revision=1 WHERE owner_uid=? AND revision=?',['A',1],'stale_ack');
 assert.equal(oldAck.measure.write,0,'STALE_ACK_WROTE_ROW');
 const beforeRollback=await count('C');
 await query("CREATE TRIGGER owned_rollback_probe_529 BEFORE INSERT ON explore_owner_follow_outbox_529 WHEN NEW.owner_uid='C' BEGIN SELECT RAISE(ABORT,'529_OWNED_ROLLBACK_TEST'); END;");
 let rolledBack=false;
 try{await query("UPDATE profile_stats SET follower_count=1 WHERE uid='C'");}
 catch{rolledBack=true;}
 assert.equal(rolledBack,true,'OUTBOX_INSERT_FAILURE_MUST_REJECT_COMMIT');
 assert.equal(await count('C'),beforeRollback,'ROLLBACK_LOST_CANONICAL_COUNT');
 await query('DROP TRIGGER owned_rollback_probe_529');
 const remote={prepare(statement){
  let bound=[];
  return {bind(...values){bound=values;return this;},
   async all(){const r=await query(statement,bound,'drain_select');return {results:r.rows};},
   async run(){const r=await query(statement,bound,'drain_update');return {meta:r.measure};}};
 }};
 const clock=Date.now()+120_000;
 let delayed=false;
 const d1=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock,deliver:async event=>{
  if(event.ownerUid==='A'&&event.version===2&&!delayed){
   delayed=true;
   await query('UPDATE profile_stats SET follower_count=5 WHERE uid=?',['A'],'newer_count_mid_delivery');
  }
  return true;
 }});
 assert.equal(d1.delivered,1);
 assert.equal(Number((await row('A')).revision),3);
 assert.equal(Number((await row('A')).acked_revision),0,'OLD_DELIVERY_ACKED_NEW_COUNT');
 const d2=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock,deliver:async()=>true});
 assert.equal(d2.delivered,1);
 assert.equal(Number((await row('A')).acked_revision),3);
 const empty=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock,deliver:async()=>true});
 assert.equal(empty.selected,0);
 await query('UPDATE profile_stats SET follower_count=1 WHERE uid=?',['B'],'new_owner_B');
 const failed=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock,deliver:async()=>false});
 assert.equal(failed.failed,1);
 assert.equal(Number((await row('B')).attempts),1);
 const premature=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock+1000,deliver:async()=>true});
 assert.equal(premature.selected,0);
 const retry=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock+16000,deliver:async()=>true});
 assert.equal(retry.delivered,1);
 assert.equal(Number((await row('B')).acked_revision),1);
 await query('UPDATE profile_stats SET follower_count=2 WHERE uid=?',['B'],'next_B_revision');
 await query('UPDATE explore_owner_follow_outbox_529 SET attempts=7,next_attempt_at=0 WHERE owner_uid=?',['B']);
 const dead=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock+32000,deliver:async()=>false});
 assert.equal(dead.failed,1);
 assert.equal(Number((await row('B')).attempts),8);
 assert.ok(Number((await row('B')).dead_at)>0);
 assert.equal((await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock+64000,deliver:async()=>true})).selected,0);
 await query('UPDATE explore_owner_follow_outbox_529 SET attempts=0,next_attempt_at=0,dead_at=0 WHERE owner_uid=? AND revision=? AND acked_revision<revision AND dead_at>0',['B',2],'owned_only_dead_replay');
 const resumed=await drainOwnerFollowOutbox529({db:remote,enabled:true,now:()=>clock+64000,deliver:async()=>true});
 assert.equal(resumed.delivered,1);
 assert.equal(Number((await row('B')).acked_revision),2);
 const outbox=(await query('SELECT owner_uid,revision,acked_revision FROM explore_owner_follow_outbox_529')).rows;
 assert.equal(outbox.length,2,'UNBOUNDED_OWNER_ROWS');
 assert.deepEqual(outbox.map(r=>r.owner_uid).sort(),['A','B']);
 assert.ok(first.measure.write>off.measure.write,'NEW_OWNER_OUTBOX_PHYSICAL_WRITE_NOT_MEASURED');
 assert.ok(existing.measure.write>off.measure.write,'UPSERT_OUTBOX_PHYSICAL_WRITE_NOT_MEASURED');
 console.log(JSON.stringify({
  kind:'APP529_OWNED_CLOUDFLARE_D1_PHYSICAL_ROWS',ownerRows:outbox.length,
  events:{baseline,off,first,existing,noChange,oldAck},
  diagnostics:ledger,
  verdicts:{canonicalAndOutboxAtomicRollback:'PASS',
   changedOnlyAndNoop:'PASS',oneRowPerOwner:'PASS',
   staleAckAndNewerRevisionCAS:'PASS',crashPendingRecovered:'PASS',
   retryBackoff:'PASS',deadHoldAndOwnerSpecificReplay:'PASS'},
  limits:'Synthetic D1 only; no true Worker invocation, Firebase/RTDB delivery, shared 17 triggers or 100k-user billing proof.'
 },null,2));
 console.log('APP529_PHYSICAL_D1_COST_AND_DURABLE_ORDER_RECOVERY=PASS');
 console.log('APP529_SHARED_DB_WRITES=0;WORKER_FUNCTIONS_RULES_HOSTING_DEPLOY=0');
}finally{
 if(owned){await deleteOwned(owned);done=true;}
}
if(!done)throw Error('APP529_NO_EPHEMERAL_DELETION_PROOF');
