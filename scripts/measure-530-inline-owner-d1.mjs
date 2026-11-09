/* APP530: owner-only ephemeral D1, real physical billing of inline-stats
 * alternative. Source-only; NEVER touches shared D1 or deploys any service. */
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {
 INLINE_OWNER_FOLLOW_530_COMPILED_OPEN,INLINE_OWNER_FOLLOW_530_UPDATE_SQL,
 INLINE_OWNER_FOLLOW_530_SELECT_SQL,drainOwnerFollowInline530,
} from '../cloudflare/explore-worker/runtime/owner-follow-inline-530.mjs';
const source=readFileSync('cloudflare/explore-worker/candidates/530-owner-follow-inline-stats.sql','utf8');
assert.equal(INLINE_OWNER_FOLLOW_530_COMPILED_OPEN,false);
assert.match(readFileSync('cloudflare/explore-worker/runtime/owner-follow-outbox-529.mjs','utf8'),
 /OWNER_FOLLOW_OUTBOX_529_COMPILED_OPEN=false/);
assert.match(readFileSync('src/services/exploreOwnerFollowerSync529.ts','utf8'),
 /EXPLORE_OWNER_FOLLOW_REALTIME_529_ENABLED=false/);
const before=source.slice(0,source.indexOf('CREATE TRIGGER IF NOT EXISTS'))
 .replace(/^\s*--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
const triggers=[...source.matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?\bEND;/g)].map(m=>m[0]);
assert.equal(before.length,9,'530_SOURCE_ONLY_CONTROL_6_ALTER_INDEX');
assert.equal(triggers.length,2,'530_TWO_TRIGGERS');
assert.ok(before.every(s=>/^(CREATE TABLE IF NOT EXISTS|INSERT INTO explore_owner_follow_control_530|ALTER TABLE profile_stats ADD COLUMN|CREATE INDEX IF NOT EXISTS)/.test(s)));
assert.equal(before.filter(s=>s.startsWith('ALTER TABLE')).length,6);
assert.ok(triggers[0].includes('NEW.owner_follow_revision_530=OLD.owner_follow_revision_530'));
assert.ok(triggers[1].includes('BEFORE DELETE ON profile_stats'));
assert.doesNotMatch(source,/^\s*DROP TABLE|^\s*DELETE FROM/im);
const createStats='CREATE TABLE profile_stats(uid TEXT PRIMARY KEY NOT NULL,follower_count INTEGER NOT NULL CHECK(follower_count>=0),following_count INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL)';
const ddl=[...before,...triggers];
const local=new DatabaseSync(':memory:');
local.exec(createStats);
local.exec("INSERT INTO profile_stats VALUES('A',0,0,1)");
for(const s of ddl)local.exec(s);
local.exec("UPDATE profile_stats SET follower_count=1,updated_at=2 WHERE uid='A'");
assert.equal(local.prepare("SELECT owner_follow_revision_530 AS r FROM profile_stats WHERE uid='A'").get().r,0);
local.exec('UPDATE explore_owner_follow_control_530 SET enabled=1 WHERE id=1');
local.exec("UPDATE profile_stats SET follower_count=2,updated_at=3 WHERE uid='A'");
assert.equal(local.prepare("SELECT owner_follow_revision_530 AS r FROM profile_stats WHERE uid='A'").get().r,1);
local.prepare(INLINE_OWNER_FOLLOW_530_UPDATE_SQL).run(3,4,'A',3);
assert.equal(local.prepare("SELECT owner_follow_revision_530 AS r FROM profile_stats WHERE uid='A'").get().r,2);
const plan=local.prepare('EXPLAIN QUERY PLAN '+INLINE_OWNER_FOLLOW_530_SELECT_SQL).all(100,12);
assert.ok(plan.some(r=>String(r.detail).includes('idx_owner_follow_due_530')),'DUE_INDEX_NOT_USED');
assert.equal((await drainOwnerFollowInline530({})).skipped,true);
local.close();
console.log('APP530_LOCAL_INLINE_LEGACY_AND_NEW_WRITER_SEQUENCE_AND_INDEX=PASS');
if(process.argv[2]==='--self-test')process.exit(0);

const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const run=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
const temp=process.env.RUNNER_TEMP;
assert.match(account||'',/^[0-9a-f]{32}$/);assert.ok(token&&token.length>15);
assert.match(run||'',/^[1-9][0-9]{5,}$/);assert.equal(attempt,'1');
assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
assert.equal(event.number,914);
assert.equal(event.pull_request?.head?.repo?.full_name,'andrawing1212/soridraw-music');
assert.equal(event.pull_request?.head?.ref,'candidate/app526-owner-follower-live-signal');
assert.ok(temp?.startsWith('/'));
const name='soridraw-owner-inline-530-'+run+'-'+attempt;
const record=join(temp,'soridraw-530-owned-d1.json');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const SHARED='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const safeId=id=>{assert.match(id||'',/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);assert.notEqual(id,SHARED);return id;};
async function api(method,path,payload){
 const response=await fetch(base+path,{method,
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  ...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(30000)});
 const body=await response.json().catch(()=>null);
 if(!response.ok||body?.success!==true){
  const code=String(body?.errors?.[0]?.code||'unknown').replace(/[^a-zA-Z0-9_]/g,'');
  throw Error('CLOUDFLARE_'+method+'_HTTP_'+response.status+'_CODE_'+code);
 }
 return body.result;
}
async function deleteOwned(id){
 const x=await api('GET','/'+safeId(id));
 assert.equal(x?.name,name);assert.equal(x?.uuid,id);
 await api('DELETE','/'+id);
 if(existsSync(record))unlinkSync(record);
 console.log('APP530_EPHEMERAL_D1_DELETED=PASS');
}
async function cleanup(){
 if(!existsSync(record)){console.log('APP530_NO_OWNED_DB_TO_CLEAN=PASS');return;}
 const value=JSON.parse(readFileSync(record,'utf8'));
 assert.equal(value.name,name);
 await deleteOwned(value.uuid);
}
if(process.argv[2]==='cleanup'){await cleanup();process.exit(0);}
assert.equal(process.argv.length,2);
assert.equal(existsSync(record),false);
let owned=null;
try{
 const created=await api('POST','',{name,primary_location_hint:'apac'});
 owned=safeId(created?.uuid);assert.equal(created?.name,name);
 writeFileSync(record,JSON.stringify({name,uuid:owned}),{flag:'wx',mode:0o600});
 assert.equal((await api('GET','/'+owned))?.name,name);
 const measures=[];
 async function query(sql,params=[],label=''){
  safeId(owned);assert.ok(typeof sql==='string'&&sql.length<12000&&params.length<=8);
  const raw=await api('POST','/'+owned+'/query',{sql,params});
  assert.ok(Array.isArray(raw)&&raw.length===1&&raw[0].success===true);
  const m=raw[0].meta||{},read=Number(m.rows_read),write=Number(m.rows_written);
  assert.ok(Number.isSafeInteger(read)&&read>=0&&Number.isSafeInteger(write)&&write>=0);
  if(label)measures.push({label,read,write});
  return {rows:raw[0].results||[],read,write};
 }
 const first=async(sql,params=[])=> (await query(sql,params)).rows[0];
 const state=async(uid)=>await first('SELECT follower_count,owner_follow_revision_530 AS revision,owner_follow_acked_revision_530 AS acked,owner_follow_attempts_530 AS attempts,owner_follow_dead_at_530 AS dead FROM profile_stats WHERE uid=?',[uid]);
 const update=async(uid,count,at,label)=>query(INLINE_OWNER_FOLLOW_530_UPDATE_SQL,[count,at,uid,count],label);
 await query(createStats);
 for(const uid of ['A','B','C'])await query('INSERT INTO profile_stats(uid,follower_count,updated_at) VALUES(?,0,1)',[uid]);
 const baseline=await query("UPDATE profile_stats SET follower_count=1,updated_at=2 WHERE uid='A'",[],'baseline_legacy_no_530');
 for(const s of ddl)await query(s);
 assert.equal(Number((await first('SELECT enabled FROM explore_owner_follow_control_530 WHERE id=1')).enabled),0);
 const off=await query("UPDATE profile_stats SET follower_count=2,updated_at=3 WHERE uid='A'",[],'530_installed_OFF_legacy');
 assert.equal((await state('A')).revision,0);
 await query('UPDATE explore_owner_follow_control_530 SET enabled=1 WHERE id=1');
 const old=await query("UPDATE profile_stats SET follower_count=3,updated_at=4 WHERE uid='A'",[],'530_legacy_writer_fallback');
 assert.equal(Number((await state('A')).revision),1);
 const optimized=await update('A',4,5,'530_new_atomic_writer');
 assert.equal(Number((await state('A')).revision),2);
 const noChange=await update('A',4,6,'530_new_noop');
 assert.equal(noChange.write,0);
 const plan=(await query('EXPLAIN QUERY PLAN '+INLINE_OWNER_FOLLOW_530_SELECT_SQL,[9999999999999,12])).rows;
 assert.ok(plan.some(r=>String(r.detail).includes('idx_owner_follow_due_530')),'PHYSICAL_DUE_INDEX_NOT_USED');
 const stale=await query('UPDATE profile_stats SET owner_follow_acked_revision_530=1 WHERE uid=? AND owner_follow_revision_530=?',['A',1],'530_stale_ack');
 assert.equal(stale.write,0);
 await query("CREATE TRIGGER owned_530_failure BEFORE UPDATE OF owner_follow_revision_530 ON profile_stats WHEN NEW.uid='C' AND NEW.owner_follow_revision_530>OLD.owner_follow_revision_530 BEGIN SELECT RAISE(ABORT,'530_OWNED_FAILURE'); END;");
 let failedOld=false;
 try{await query("UPDATE profile_stats SET follower_count=1,updated_at=7 WHERE uid='C'");}catch{failedOld=true;}
 assert.ok(failedOld);
 assert.equal((await state('C')).follower_count,0,'LEGACY_ROLLBACK_FAILED');
 let failedNew=false;
 try{await update('C',1,8,'new_should_rollback');}catch{failedNew=true;}
 assert.ok(failedNew);
 assert.equal((await state('C')).follower_count,0,'NEW_WRITER_ROLLBACK_FAILED');
 await query('DROP TRIGGER owned_530_failure');
 const db={prepare(sql){
  let params=[];
  return {bind(...p){params=p;return this;},
   async all(){return {results:(await query(sql,params,'drain_select')).rows};},
   async run(){return await query(sql,params,'drain_write');}};
 }};
 const clock=Date.now()+120000;
 let newer=false;
 const one=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock,deliver:async e=>{
  if(e.ownerUid==='A'&&e.version===2&&!newer){
   newer=true;await update('A',5,9,'530_inflight_newer');
  }
  return true;
 }});
 assert.equal(one.delivered,1);
 assert.equal((await state('A')).revision,3);
 assert.equal((await state('A')).acked,0);
 const resumed=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock,deliver:async()=>true});
 assert.equal(resumed.delivered,1);
 assert.equal((await state('A')).acked,3);
 assert.equal((await drainOwnerFollowInline530({db,enabled:true,now:()=>clock,deliver:async()=>true})).selected,0);
 await update('B',1,10,'530_new_owner_B');
 const fail=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock,deliver:async()=>false});
 assert.equal(fail.failed,1);
 assert.equal((await state('B')).attempts,1);
 const early=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock+1000,deliver:async()=>true});
 assert.equal(early.selected,0);
 const retry=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock+16000,deliver:async()=>true});
 assert.equal(retry.delivered,1);
 assert.equal((await state('B')).acked,1);
 await update('B',2,11,'530_B_next_revision');
 await query('UPDATE profile_stats SET owner_follow_attempts_530=7,owner_follow_next_at_530=0 WHERE uid=?',['B']);
 const dead=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock+32000,deliver:async()=>false});
 assert.equal(dead.failed,1);assert.equal((await state('B')).attempts,8);
 assert.ok((await state('B')).dead>0);
 const held=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock+48000,deliver:async()=>true});
 assert.equal(held.selected,0);
 await query('UPDATE profile_stats SET owner_follow_attempts_530=0,owner_follow_next_at_530=0,owner_follow_dead_at_530=0 WHERE uid=? AND owner_follow_revision_530=? AND owner_follow_acked_revision_530<owner_follow_revision_530 AND owner_follow_dead_at_530>0',['B',2],'530_owned_replay');
 const fixed=await drainOwnerFollowInline530({db,enabled:true,now:()=>clock+64000,deliver:async()=>true});
 assert.equal(fixed.delivered,1);assert.equal((await state('B')).acked,2);
 let deleteBlocked=false;try{await query("DELETE FROM profile_stats WHERE uid='C'");}catch{deleteBlocked=true;}
 assert.ok(deleteBlocked,'REVISION_RESET_GUARD_NOT_PRESENT');
 assert.ok(old.write>optimized.write,'OPTIMIZED_PATH_DID_NOT_REDUCE_PHYSICAL_WRITES');
 assert.ok(optimized.write<=(baseline.write+1),'NEW_WRITER_TOO_EXPENSIVE');
 console.log(JSON.stringify({kind:'APP530_ISOLATED_PHYSICAL_D1',metrics:measures,
  comparison:{baseline:baseline.write,off:off.write,oldWriter:old.write,
   atomicNewWriter:optimized.write,newWriterNoop:noChange.write},
  verdicts:{atomicity:'PASS',indexDueNoScan:'PASS',oldWriterFallback:'PASS',
   revisionCAS:'PASS',lostDeliveryRetry:'PASS',deadHoldReplay:'PASS',
   revisionDeletionFence:'PASS-BLOCKS-ACCOUNT-DELETE'},
  limitations:'Synthetic only; changes canonical profile_stats schema. Full three-env writer migration and account-deletion lifecycle are release blockers; no Firebase/RTDB physical test.'
 },null,2));
 console.log('APP530_INLINE_D1_COST_COMPARISON=PASS');
 console.log('APP530_SHARED_D1_WRITES=0;WORKER_FUNCTIONS_RULES_HOSTING_DEPLOY=0');
}finally{if(owned)await deleteOwned(owned);}
