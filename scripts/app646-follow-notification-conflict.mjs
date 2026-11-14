// APP646: repair the confirmed UNIQUE notification conflict blocking Follow.
// SOURCE-ONLY UNTIL SEPARATE DIRECTOR APPROVAL FOR SHARED D1 SCHEMA.
// Exact allowed writes: replace 2 existing notification triggers atomically.
// No user rows, records, Workers, Hosting, Firebase, R2, TEST or PROD code writes.
import assert from 'node:assert/strict';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const DB='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const EXPECTED_PREVIEW='962ee432-fadb-456e-8836-50675aa76b84';
const EXPERIMENT='6b13cde4-4a53-42d2-873f-361f7cf5a931';
const INSERT='soridraw_notification_follow_overlay_insert_002';
const UPDATE='soridraw_notification_follow_overlay_update_002';
const TABLE='soridraw_notification_inbox_001';
const names=[INSERT,UPDATE];
const old={
 [INSERT]:`CREATE TRIGGER soridraw_notification_follow_overlay_insert_002
AFTER INSERT ON explore_follow_overrides_348
WHEN NEW.following = 1 AND NEW.baseline_following = 0
  AND (SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1) = 1
BEGIN
  INSERT OR IGNORE INTO soridraw_notification_inbox_001(
    receiver_uid,bucket_ms,category,actor_uid,subject_id,
    actor_name,subject_title,created_at)
  SELECT NEW.following_uid, (NEW.updated_at / 7200000) * 7200000,
    'follow', NEW.follower_uid, NEW.following_uid,
    COALESCE(NULLIF(actor.nickname,''), '사용자'), '', NEW.updated_at
  FROM public_profiles AS target
  LEFT JOIN public_profiles AS actor ON actor.uid = NEW.follower_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid;
END`,
 [UPDATE]:`CREATE TRIGGER soridraw_notification_follow_overlay_update_002
AFTER UPDATE OF following ON explore_follow_overrides_348
WHEN OLD.following = 0 AND NEW.following = 1
  AND (SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1) = 1
BEGIN
  INSERT OR IGNORE INTO soridraw_notification_inbox_001(
    receiver_uid,bucket_ms,category,actor_uid,subject_id,
    actor_name,subject_title,created_at)
  SELECT NEW.following_uid, (NEW.updated_at / 7200000) * 7200000,
    'follow', NEW.follower_uid, NEW.following_uid,
    COALESCE(NULLIF(actor.nickname,''), '사용자'), '', NEW.updated_at
  FROM public_profiles AS target
  LEFT JOIN public_profiles AS actor ON actor.uid = NEW.follower_uid
  WHERE target.uid = NEW.following_uid AND target.is_public = 1
    AND NEW.following_uid <> NEW.follower_uid;
END`
};
const needle='AND NEW.following_uid <> NEW.follower_uid;';
const guard=`AND NEW.following_uid <> NEW.follower_uid
    AND NOT EXISTS (
      SELECT 1 FROM soridraw_notification_inbox_001
      WHERE receiver_uid = NEW.following_uid
        AND bucket_ms = (NEW.updated_at / 7200000) * 7200000
        AND category = 'follow'
        AND actor_uid = NEW.follower_uid
        AND subject_id = NEW.following_uid
    );`;
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
function patched(name,sql){
 assert(names.includes(name),'APP646_UNEXPECTED_TRIGGER_NAME');
 assert(normalize(sql)===normalize(old[name]),
  'APP646_HOLD_LIVE_TRIGGER_DRIFT_'+name);
 assert(sql.split(needle).length===2,'APP646_HOLD_NO_SINGLE_PREDICATE');
 const next=sql.replace(needle,guard);
 assert(next.includes('AND NOT EXISTS')&&next.length>sql.length&&
  next.split('NOT EXISTS').length===2,'APP646_GUARD_NOT_EXACT');
 return next;
}
const proposed=Object.fromEntries(names.map(n=>[n,patched(n,old[n])]));
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
const must=(x,msg)=>{if(!x)throw Error('APP646_HOLD_'+msg)};
const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
async function api(path,body=null){
 const r=await fetch(base+path,{method:'POST',headers:{
  Authorization:'Bearer '+token,Accept:'application/json',
  'Content-Type':'application/json'
 },body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 let j;try{j=await r.json()}catch{throw Error('APP646_HOLD_UNCERTAIN_D1_RESPONSE')}
 if(!r.ok||j?.success!==true)throw Error(
  'APP646_HOLD_D1_HTTP_'+r.status+'_'+(j?.errors||[]).map(e=>e.code).slice(0,3).join('_'));
 return j.result;
}
async function cfget(path){
 const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token},
  signal:AbortSignal.timeout(15000)});
 const j=await r.json();
 must(r.ok&&j?.success===true&&j.result,'CF_GET_'+r.status);
 return j.result;
}
const SQL_SELECT="SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN ('"+
 INSERT+"','"+UPDATE+"') ORDER BY name";
async function queryRead(sql){
 must(/^SELECT\s/.test(sql),'UNSAFE_READ_SQL');
 const results=await api('/d1/database/'+DB+'/query',{sql,params:[]});
 const v=results?.[0];
 must(results?.length===1&&v?.success===true&&
  Number(v?.meta?.rows_written)===0&&Array.isArray(v?.results),
  'READONLY_ACK');
 return v.results;
}
async function liveTriggers(){
 const rows=await queryRead(SQL_SELECT);
 must(rows.length===2,'EXPECTED_TWO_NOTIFICATION_TRIGGERS');
 return Object.fromEntries(rows.map(r=>[r.name,String(r.sql)]));
}
async function checkEnvironment(){
 const r=await cfget('/workers/scripts/soridraw-explore-preview/deployments?per_page=1');
 const vs=r?.deployments?.[0]?.versions;
 must(vs?.length===2&&vs.some(v=>v.version_id===EXPECTED_PREVIEW&&v.percentage===100)&&
  vs.some(v=>v.version_id===EXPERIMENT&&v.percentage===0),'EXPECTED_SAFE_WORKER_100');
 const active=await queryRead('SELECT id,enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1');
 must(active.length===1&&active[0].id===1&&active[0].enabled===1,'NOTIFICATION_ACTIVATION_DRIFT');
 console.log('APP646_LIVE_SAFE_WORKER_100_CANARY_0_AND_NOTIFICATION_ON=PASS');
}
async function postflight(expected){
 const actual=await liveTriggers();
 for(const name of names)
  must(normalize(actual[name])===normalize(expected[name]),'POST_SCHEMA_MISMATCH_'+name);
 console.log('APP646_POST_TWO_TRIGGER_DEFINITIONS=PASS');
}
async function preflightOnly(){
 must(process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,
  'PREFLIGHT_READONLY_CONTEXT');
 await checkEnvironment();
 const before=await liveTriggers();
 for(const name of names)patched(name,before[name]);
 console.log('APP646_LIVE_TWO_ORIGINAL_TRIGGERS_MATCH_EXACTLY=PASS');
 console.log('APP646_D1_READONLY_SCHEMA_AND_ACTIVATION_NO_WRITES=PASS');
}
async function apply(){
 must(process.env.GITHUB_ACTIONS==='true'&&
  process.env.GITHUB_REF==='refs/heads/preview'&&
  process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>20,
  'APPROVED_DEPLOY_CONTEXT');
 must(process.env.APP646_EXPLICIT_SHARED_D1_APPROVAL==='YES_EXACT_TWO_TRIGGERS',
  'SEPARATE_SHARED_D1_APPROVAL_REQUIRED');
 await checkEnvironment();
 const before=await liveTriggers();
 const state=names.map(n=>normalize(before[n])===normalize(old[n])?'old':
    normalize(before[n])===normalize(proposed[n])?'new':'drift');
 must(state.every(x=>x!=='drift'),'DRIFT_OR_PARTIAL_SCHEMA');
 if(state.every(x=>x==='new')){
  console.log('APP646_ALREADY_PATCHED_IDEMPOTENT_NO_WRITES=PASS');return;
 }
 must(state.every(x=>x==='old'),'PARTIAL_SCHEMA_HOLD');
 // Cloudflare D1 REST /query batch is transactional. If any statement fails,
 // the transaction rolls back. DDL is changed only, no original user rows.
 const batch=[];
 for(const n of names){
  batch.push({sql:'DROP TRIGGER '+n});
  batch.push({sql:patched(n,before[n])});
 }
 must(batch.length===4&&batch.every(x=>/^(DROP TRIGGER|CREATE TRIGGER)\s/.test(x.sql)),
  'DDL_SCOPE');
 const now=await liveTriggers();
 for(const n of names)must(normalize(now[n])===normalize(before[n]),'PREFLIGHT_DRIFT_'+n);
 console.log('APP646_EXACT_ATOMIC_DDL_FOUR_STATEMENTS_TWO_TRIGGERS=READY');
 let changed=false;
 try{
  const results=await api('/d1/database/'+DB+'/query',{batch});
  must(results?.length===4&&results.every(x=>x?.success===true),
    'BATCH_ACK_MISSING');
  changed=true;
 }catch(err){
  // On unknown API outcome, inspect the exact two triggers but do not
  // blindly replay DDL. Never risk overwriting a concurrent change.
  const seen=await liveTriggers().catch(()=>null);
  if(seen&&names.every(n=>normalize(seen[n])===normalize(proposed[n]))){
   changed=true;
  }else{
   throw Error('APP646_HOLD_D1_BATCH_UNCERTAIN_VERIFY_BEFORE_ANY_RETRY');
  }
 }
 must(changed,'D1_NOT_COMMITTED');
 await postflight(proposed);
 console.log('APP646_SHARED_FOLLOW_NOTIFICATION_UNIQUE_GUARD=APPLIED');
 console.log('APP646_USER_ROWS_WRITTEN=ZERO; WORKER_HOSTING_FUNCTIONS_RULES=UNCHANGED');
 console.log('APP646_REAL_TWO_ACCOUNT_FOLLOW=NOT_TESTED');
}
async function rollback(){
 must(process.env.APP646_EXPLICIT_SHARED_D1_APPROVAL==='YES_EXACT_TWO_TRIGGERS'&&
  process.env.APP646_ROLLBACK_APPROVAL==='ROLLBACK_APP646_EXACT','ROLLBACK_APPROVAL');
 const before=await liveTriggers();
 must(names.every(n=>normalize(before[n])===normalize(proposed[n])),
  'ROLLBACK_DRIFT_OR_UNPATCHED');
 const batch=names.flatMap(n=>[{sql:'DROP TRIGGER '+n},{sql:old[n]}]);
 const r=await api('/d1/database/'+DB+'/query',{batch});
 must(r.length===4&&r.every(x=>x.success===true),'ROLLBACK_BATCH_UNCERTAIN');
 await postflight(old);
 console.log('APP646_ORIGINAL_TWO_NOTIFICATION_TRIGGERS_RESTORED=PASS');
}
if(process.argv[2]==='--fixture-json')console.log(JSON.stringify({original:old,patched:proposed}));
else if(process.argv[2]==='--self-test'){
 for(const n of names)assert.equal(normalize(patched(n,old[n])),normalize(proposed[n]));
 assert.throws(()=>patched(INSERT,proposed[INSERT]));
 assert.throws(()=>patched(UPDATE,old[INSERT]));
 console.log('APP646_SOURCE_ONLY_EXACT_TWO_TRIGGERS_AND_GUARD=PASS');
}else if(process.argv[2]==='--preflight-live'){
 preflightOnly().catch(e=>{console.error(String(e?.message||e).slice(0,180));process.exitCode=2});
}else if(process.argv[2]==='--apply-once'){
 apply().catch(e=>{console.error(String(e?.message||e).slice(0,200));process.exitCode=2});
}else if(process.argv[2]==='--rollback'){
 rollback().catch(e=>{console.error(String(e?.message||e).slice(0,200));process.exitCode=2});
}else{console.error('APP646_HOLD_MODE');process.exitCode=2}
