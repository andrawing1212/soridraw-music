/* APP532 source-only — real owned Cloudflare D1 comparison + fake Auth.
 * No shared D1, no user identities, no Firebase/Worker/Hosting actions.
 * Test a NEW non-tombstone alternative; never load APP531 retention DDL.
 */
import assert from 'node:assert/strict';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {
 APP540_INLINE_CANONICAL_COMPILED_OPEN,adjustExploreFollowCountersDelta540,
} from '../cloudflare/explore-worker/runtime/owner-follow-inline-canonical-540.mjs';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {
 OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN,INLINE_OWNER_FOLLOW_532_UPDATE_SQL,
 INLINE_OWNER_FOLLOW_532_SELECT_SQL,authorizeOwnerFollowEpoch532,
 nextOwnerFollowMarker532,drainOwnerFollowAuthEpoch532,
} from '../cloudflare/explore-worker/runtime/owner-follow-auth-epoch-532.mjs';
const candidate=readFileSync('cloudflare/explore-worker/candidates/530-owner-follow-inline-stats.sql','utf8');
const migration=readFileSync('cloudflare/explore-worker/candidates/532-owner-auth-epoch-no-tombstone.sql','utf8');
assert.equal(OWNER_FOLLOW_AUTH_EPOCH_532_COMPILED_OPEN,false);
assert.equal(APP540_INLINE_CANONICAL_COMPILED_OPEN,false);
assert.match(readFileSync('src/services/exploreOwnerFollowerSync529.ts','utf8'),
 /EXPLORE_OWNER_FOLLOW_REALTIME_529_ENABLED=false/);
assert.match(readFileSync('cloudflare/explore-worker/runtime/owner-follow-inline-530.mjs','utf8'),
 /INLINE_OWNER_FOLLOW_530_COMPILED_OPEN=false/);
assert.ok(candidate.includes('-- APP531 / APP530 lifecycle extension'));
const common=candidate.split('-- APP531 / APP530 lifecycle extension')[0];
const firstTrigger=common.indexOf('CREATE TRIGGER IF NOT EXISTS');
assert.ok(firstTrigger>0);
const pre=common.slice(0,firstTrigger).replace(/^\s*--.*$/gm,'')
 .split(';').map(x=>x.trim()).filter(Boolean);
const triggers=[...common.slice(firstTrigger).matchAll(/CREATE TRIGGER IF NOT EXISTS[\s\S]*?\bEND;/g)].map(x=>x[0]);
assert.equal(pre.length,9);
assert.equal(triggers.length,1);
assert.match(triggers[0],/AFTER UPDATE OF follower_count/);
const epochSql=migration.replace(/^\s*--.*$/gm,'').trim();
assert.match(epochSql,/^ALTER TABLE profile_stats\s+ADD COLUMN owner_follow_auth_epoch_532/);
assert.equal((epochSql.match(/;/g)||[]).length,1);
assert.doesNotMatch(epochSql,/CREATE TABLE|CREATE TRIGGER|DELETE FROM|DROP TABLE/i);
const createStats='CREATE TABLE profile_stats(uid TEXT PRIMARY KEY NOT NULL, follower_count INTEGER NOT NULL CHECK(follower_count>=0), following_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)';
const ddl=[...pre,triggers[0],epochSql];
const E1='0123456789abcdef0123456789abcdef';
const E2='fedcba9876543210fedcba9876543210';
const secret='synthetic-HMAC-key-for-532-not-deployed-12345';
const signed=({ownerUid,authEpoch,version,followerCount,updatedAt,at=1800000000000})=>{
 const body=JSON.stringify({version:1,ownerUid,authEpoch,revision:version,followerCount,updatedAt,at});
 const signature=createHmac('sha256',secret).update(String(at)+'.'+body).digest();
 assert.ok(timingSafeEqual(signature,
  createHmac('sha256',secret).update(String(at)+'.'+body).digest()));
 const tampered=body.replace('"followerCount":1','"followerCount":9');
 if(tampered!==body)assert.ok(!timingSafeEqual(signature,
  createHmac('sha256',secret).update(String(at)+'.'+tampered).digest()));
 return {ownerUid,authEpoch,version,followerCount,updatedAt,at};
};
const user=(epoch)=>({uid:'A',customClaims:{soridrawFollowEpoch532:epoch}});
const oldReceipt=signed({ownerUid:'A',authEpoch:E1,version:1,followerCount:1,updatedAt:5});
assert.equal((await authorizeOwnerFollowEpoch532(oldReceipt,{getAuthUser:async()=>user(E1)})).allowed,true);
assert.equal((await authorizeOwnerFollowEpoch532(oldReceipt,{getAuthUser:async()=>null})).reason,'deleted');
assert.equal((await authorizeOwnerFollowEpoch532(oldReceipt,{getAuthUser:async()=>user(E2)})).reason,'incarnation-mismatch');
assert.equal((await authorizeOwnerFollowEpoch532(oldReceipt,{getAuthUser:async()=>({uid:'A'})})).allowed,false);
assert.equal((await authorizeOwnerFollowEpoch532(oldReceipt,{getAuthUser:async()=>({uid:'B',customClaims:{soridrawFollowEpoch532:E1}})})).allowed,false);
await assert.rejects(()=>authorizeOwnerFollowEpoch532(oldReceipt,{getAuthUser:async()=>{
 throw Error('AUTH_UNAVAILABLE');}}),/AUTH_UNAVAILABLE/);
const oldMarker=nextOwnerFollowMarker532(null,oldReceipt,E1,100);
assert.equal(nextOwnerFollowMarker532(oldMarker,oldReceipt,E1,101),undefined);
assert.throws(()=>nextOwnerFollowMarker532(oldMarker,oldReceipt,E2,102),/UNVERIFIED_AUTH_EPOCH/);
const newReceipt=signed({ownerUid:'A',authEpoch:E2,version:1,followerCount:1,updatedAt:8});
const newMarker=nextOwnerFollowMarker532(oldMarker,newReceipt,E2,200);
assert.equal(newMarker.version,1);assert.equal(newMarker.authEpoch,E2);
assert.equal(nextOwnerFollowMarker532(newMarker,newReceipt,E2,201),undefined);

const local=new DatabaseSync(':memory:');
local.exec(createStats);
for(const q of ddl)local.exec(q);
const upsert="INSERT INTO profile_stats(uid,follower_count,following_count,updated_at,owner_follow_auth_epoch_532) VALUES('A',0,0,1,?)";
local.prepare(upsert).run(E1);
const write=(epoch,count,at=100)=>local.prepare(INLINE_OWNER_FOLLOW_532_UPDATE_SQL)
 .run(count,at,'A',count,epoch);
assert.equal(write(E2,1).changes,0,'WRONG_GENERATION_WRITER_MUST_NOT_UPDATE');
assert.equal(write(E1,1).changes,1);
const old=local.prepare('SELECT owner_follow_revision_530 AS revision FROM profile_stats WHERE uid=?').get('A');
assert.equal(old.revision,1);
local.exec("DELETE FROM profile_stats WHERE uid='A'");
assert.equal(local.prepare("SELECT COUNT(*) AS n FROM profile_stats").get().n,0);
assert.equal(local.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'explore_owner_follow_retired%'").get().n,0);
local.prepare(upsert).run(E2);
assert.equal(write(E1,1).changes,0,'OLD_WRITER_MUST_FAIL_AFTER_RECREATION');
assert.equal(write(E2,1).changes,1);
const plan=local.prepare('EXPLAIN QUERY PLAN '+INLINE_OWNER_FOLLOW_532_SELECT_SQL).all(100,12);
assert.ok(plan.some(x=>String(x.detail).includes('idx_owner_follow_due_530')));
assert.equal((await drainOwnerFollowAuthEpoch532({})).skipped,true);
local.close();
console.log('APP532_LOCAL_NON_RETENTION_AUTH_INCARCATION_AND_W2_SCHEMA=PASS');
if(process.argv[2]==='--self-test')process.exit(0);

// No shared account identifier or D1 ref can be specified by caller.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const run=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
const temp=process.env.RUNNER_TEMP,evfile=process.env.GITHUB_EVENT_PATH;
assert.match(account||'',/^[0-9a-f]{32}$/);assert.ok(token&&token.length>15);
assert.match(run||'',/^[1-9][0-9]{5,}$/);assert.equal(attempt,'1');
assert.equal(process.env.GITHUB_REPOSITORY,'andrawing1212/soridraw-music');
assert.equal(process.env.GITHUB_EVENT_NAME,'pull_request');
const event=JSON.parse(readFileSync(evfile,'utf8'));
assert.equal(event.number,914);
assert.equal(event.pull_request?.head?.ref,'candidate/app526-owner-follower-live-signal');
assert.equal(event.pull_request?.head?.repo?.full_name,'andrawing1212/soridraw-music');
assert.ok(temp?.startsWith('/'));
const dbname='soridraw-auth-epoch-532-'+run+'-'+attempt;
const record=join(temp,'soridraw-532-owned-d1.json');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database';
const SHARED='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const safe=id=>{assert.match(id||'',/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);assert.notEqual(id,SHARED);return id;};
async function api(method,suffix,payload){
 const response=await fetch(base+suffix,{method,headers:{
 Authorization:'Bearer '+token,'Content-Type':'application/json'},
 ...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(30000)});
 const body=await response.json().catch(()=>null);
 if(!response.ok||body?.success!==true){
  const code=String(body?.errors?.[0]?.code||'unknown').replace(/[^a-zA-Z0-9_]/g,'');
  throw Error('532_REMOTE_'+method+'_HTTP_'+response.status+'_CODE_'+code);
 }
 return body.result;
}
async function cleanup(){
 if(!existsSync(record)){console.log('APP532_NO_OWNED_DB_TO_CLEAN=PASS');return;}
 const r=JSON.parse(readFileSync(record,'utf8'));
 assert.equal(r.name,dbname);
 const info=await api('GET','/'+safe(r.uuid));
 assert.equal(info?.name,dbname);assert.equal(info?.uuid,r.uuid);
 await api('DELETE','/'+safe(r.uuid));unlinkSync(record);
 console.log('APP532_EPHEMERAL_D1_DELETED=PASS');
}
if(process.argv[2]==='cleanup'){await cleanup();process.exit(0);}
assert.equal(process.argv.length,2);
assert.equal(existsSync(record),false);
let owned=null;
try{
 const info=await api('POST','',{name:dbname,primary_location_hint:'apac'});
 owned=safe(info?.uuid);assert.equal(info?.name,dbname);
 writeFileSync(record,JSON.stringify({name:dbname,uuid:owned}),{flag:'wx',mode:0o600});
 const check=await api('GET','/'+owned);
 assert.equal(check?.name,dbname);assert.equal(check?.uuid,owned);
 const meters=[];
 async function query(sql,params=[],label=''){
  safe(owned);
  assert.ok(typeof sql==='string'&&sql.length<13000&&params.length<=8);
  const x=await api('POST','/'+owned+'/query',{sql,params});
  assert.ok(Array.isArray(x)&&x.length===1&&x[0].success===true);
  const m=x[0].meta||{},r=Number(m.rows_read),w=Number(m.rows_written);
  assert.ok(Number.isSafeInteger(r)&&Number.isSafeInteger(w)&&r>=0&&w>=0);
  if(label)meters.push({label,read:r,write:w});
  return {rows:x[0].results||[],r,w};
 }
 const first=async(q,args=[])=> (await query(q,args)).rows[0];
 await query(createStats);
 for(const q of ddl)await query(q);
 await query('UPDATE explore_owner_follow_control_530 SET enabled=1 WHERE id=1');
 const ins='INSERT INTO profile_stats(uid,follower_count,following_count,updated_at,owner_follow_auth_epoch_532) VALUES(?,0,0,?,?)';
 await query(ins,['A',1,E1],'new_auth_generation_A');
 const update=async(c,epoch,at,label)=>query(INLINE_OWNER_FOLLOW_532_UPDATE_SQL,[c,at,'A',c,epoch],label);
 const wrong=await update(1,E2,2,'wrong_generation_update');
 assert.equal(wrong.w,0);
 const changed=await update(1,E1,3,'same_generation_changed_count');
 assert.equal(changed.w,2,'NEW_WORKER_MUST_STAY_W2');
 const noChange=await update(1,E1,4,'canonical_noop');
 assert.equal(noChange.w,0);
 const row=async()=>await first('SELECT owner_follow_revision_530 AS rev,owner_follow_acked_revision_530 AS ack,owner_follow_auth_epoch_532 AS epoch,follower_count AS n FROM profile_stats WHERE uid=?',['A']);
 assert.equal((await row()).rev,1);
 const oldPending={...oldReceipt,updatedAt:3};
 const saved=nextOwnerFollowMarker532(null,oldPending,E1,5);
 // Auth deletion: the D1 row is deliberately retained by the ACTUAL
 // adminDeleteUserAccount path, but its pending signal becomes unauthorizable.
 assert.equal((await authorizeOwnerFollowEpoch532(oldPending,{getAuthUser:async()=>null})).reason,'deleted');
 // Separate FULL-ERASURE path must remove canonical row and all other resources.
 const deletion=await query("DELETE FROM profile_stats WHERE uid='A'",[],'full_erasure_d1_row_delete');
 assert.ok(deletion.w>=1);
 assert.equal(await row(),undefined);
 assert.equal((await first("SELECT count(*) AS n FROM sqlite_master WHERE name LIKE 'explore_owner_follow_retired%'")).n,0,'TOMBSTONE_SCHEMA_MUST_NOT_EXIST');
 const recreated=await query(ins,['A',10,E2],'new_auth_generation_same_uid');
 assert.ok(recreated.w>=1);
 const oldWriter=await update(1,E1,11,'old_generation_writer_after_recreate');
 assert.equal(oldWriter.w,0);
 // The old generation has revision=1; the new one will also have revision=1.
 // Crucial: both delivery authorization and D1 CAS ACK include Auth epoch.
 const newChanged=await update(1,E2,12,'new_generation_first_follow');
 assert.equal(newChanged.w,2);
 const oldAck=await query(`UPDATE profile_stats
  SET owner_follow_acked_revision_530=1 WHERE uid=? AND
  owner_follow_revision_530=1 AND owner_follow_auth_epoch_532=?`,
  ['A',E1],'inflight_old_ack_same_revision');
 assert.equal(oldAck.w,0,'REUSED_UID_OLD_ACK_MUST_NOT_ACK_NEW_GENERATION');
 const oldValidation=await authorizeOwnerFollowEpoch532(oldPending,{getAuthUser:async()=>user(E2)});
 assert.equal(oldValidation.reason,'incarnation-mismatch');
 const valid=await authorizeOwnerFollowEpoch532(newReceipt,{getAuthUser:async()=>user(E2)});
 assert.equal(valid.allowed,true);
 const marker=nextOwnerFollowMarker532(saved,newReceipt,E2,30);
 assert.equal(marker.authEpoch,E2);assert.equal(marker.version,1);
 const db={prepare(sql){
  let params=[];return {bind(...a){params=a;return this;},
   async all(){return {results:(await query(sql,params,'due_select')).rows};},
   async run(){return await query(sql,params,'drain_cas');}};
 }};
 const clock=Date.now()+120000;
 let failed=false;
 const d1=await drainOwnerFollowAuthEpoch532({db,enabled:true,now:()=>clock,
  deliver:async ev=>{assert.equal(ev.authEpoch,E2);failed=true;return false;}});
 assert.equal(failed,true);assert.equal(d1.failed,1);
 assert.equal((await row()).ack,0);
 assert.equal((await drainOwnerFollowAuthEpoch532({db,enabled:true,now:()=>clock+1000,deliver:async()=>true})).selected,0);
 const d2=await drainOwnerFollowAuthEpoch532({db,enabled:true,now:()=>clock+16000,deliver:async ev=>{
  assert.equal((await authorizeOwnerFollowEpoch532(ev,{getAuthUser:async()=>user(E2)})).allowed,true);
  return true;}});
 assert.equal(d2.delivered,1);assert.equal((await row()).ack,1);

 // APP541: meter EXACT owner SQL emitted from the unchanged legacy Worker
 // and the OFF APP540 Worker-shaped candidate in this same owned D1.
 // It does NOT execute the entire live Worker route or cloud transaction.
 const source=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
 const begin=source.indexOf('async function adjustExploreFollowCountersDelta(');
 const end=source.indexOf(String.fromCharCode(10)+'__name(',begin);
 assert.ok(begin>0&&end>begin&&end-begin<8000);
 const legacy=new Function(source.slice(begin,end)+String.fromCharCode(10)+'return adjustExploreFollowCountersDelta;')();
 async function captured(fn,follow,epoch,at){
  let saved=null;const stop='APP541_CAPTURE_STATEMENTS';
  const facade={DB:{
   prepare(sql){return {bind(...params){return {query:sql,params}}}},
   async batch(rows){saved=rows;throw Error(stop)},
  }};
  await assert.rejects(()=>fn(facade,'B','A',follow,at,epoch),new RegExp(stop));
  assert.equal(saved?.length,3);
  return saved;
 }
 const at=541000;
 await query('CREATE TABLE follows (follower_uid TEXT, following_uid TEXT, created_at INTEGER, PRIMARY KEY(follower_uid,following_uid))');
 await query('INSERT INTO follows(follower_uid,following_uid,created_at) VALUES(?,?,?)',['B','A',at]);
 const nf=(await captured(adjustExploreFollowCountersDelta540,true,E2,at))[2];
 const of=(await captured(legacy,true,E2,at))[2];
 const nu=(await captured(adjustExploreFollowCountersDelta540,false,E2,at))[1];
 const ou=(await captured(legacy,false,E2,at))[1];
 assert.ok(nf.query.includes('UPDATE profile_stats') && nf.query.includes('owner_follow_revision_530'));
 assert.match(of.query,/INSERT INTO profile_stats/);
 const n1=await query(nf.query,nf.params,'541_real_candidate_follow_target');
 assert.equal(n1.w,2,'APP541_EXACT_FOLLOW_WRITER_MUST_BE_W2');
 const stale=(await captured(adjustExploreFollowCountersDelta540,true,E1,at))[2];
 assert.equal((await query(stale.query,stale.params,'541_stale_auth_epoch')).w,0);
 const noop=(await captured(adjustExploreFollowCountersDelta540,true,E2,at+1))[2];
 assert.equal((await query(noop.query,noop.params,'541_no_edge_noop')).w,0);
 const o1=await query(of.query,of.params,'541_exact_legacy_follow_target');
 assert.ok(o1.w>=n1.w);
 const n2=await query(nu.query,nu.params,'541_real_candidate_unfollow_target');
 assert.equal(n2.w,2,'APP541_EXACT_UNFOLLOW_WRITER_MUST_BE_W2');
 const o2=await query(ou.query,ou.params,'541_exact_legacy_unfollow_target');
 assert.ok(o2.w>=n2.w);
 const current=await row();
 assert.equal(current.epoch,E2);
 console.log('APP541_EXACT_TARGET_D1_COST=PASS '+JSON.stringify({
  candidateFollow:{R:n1.r,W:n1.w},legacyFollow:{R:o1.r,W:o1.w},
  candidateUnfollow:{R:n2.r,W:n2.w},legacyUnfollow:{R:o2.r,W:o2.w},
  staleEpochW0:true,noEdgeW0:true,
 }));
 // Erase again, leave no D1 record; no permanent UID retention even after ACK.
 await query("DELETE FROM profile_stats WHERE uid='A'",[],'second_complete_erasure');
 assert.equal(await row(),undefined);
 assert.equal((await first("SELECT COUNT(*) AS n FROM profile_stats")).n,0);
 console.log(JSON.stringify({kind:'APP532_ISOLATED_CLOUDFLARE_D1_AUTH_EPOCH',measures:meters,
  noUidTombstone:true,
  checks:{normalChangedW2:true,noOpW0:true,authDeletedFailClosed:true,
   sameUidNewEpochW2:true,staleSenderRejected:true,staleAckW0:true,
   outageNoAck:true,backoffRetry:true,signedMockEvent:true},
  caveat:'Only synthetic Auth user records; no actual Firebase Auth custom claim enrollment, no RTDB/Rules or source-to-runtime integration.'},null,2));
 console.log('APP532_PHYSICAL_NORMAL_W2_AND_NO_UID_TOMBSTONE=PASS');
 console.log('APP532_SHARED_D1_WORKER_FUNCTIONS_RULES_HOSTING=UNCHANGED');
}finally{if(owned)await cleanup();}
