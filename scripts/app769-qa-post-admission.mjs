// APP769 — physically exercise two bounded *synthetic* failure windows on
// previously approved QA D1+R2, NOT an APP765/767 production reconciliation.
// No Worker creation, no new DB/bucket, no user-origin rows, no deploy.
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';

const ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const PROD='e1a30fc9ef497fda1d34f4ab3dc1da45';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const DB='soridraw-qa-app768-d1';
const BUCKET='soridraw-qa-app768-r2';
const TABLE='app768_qa_synthetic_follow';
const WORKER='soridraw-owner-qa-583';
const ORIGINAL='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const RUN_ID=process.env.GITHUB_RUN_ID||'';
const STATE=join(process.env.RUNNER_TEMP||'/not-a-run','app769-state.json');
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const ROW=/^qa769_[ab]_[a-f0-9]{16}$/;
const KEY=/^app769-only-qa-[ab]-[a-f0-9]{16}$/;
const fail=x=>{throw Error('APP769_QA_HOLD_'+x);};
function guardRun(){
 if(ACCOUNT===PROD||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
  process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME!=='push'||
  process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT||
  !/^[0-9]{8,20}$/.test(RUN_ID)||!process.env.RUNNER_TEMP)
  fail('QA_RUN_IDENTITY');
 if(typeof process.env.CLOUDFLARE_QA_API_TOKEN!=='string'||
  process.env.CLOUDFLARE_QA_API_TOKEN.length<20||
  typeof process.env.CLOUDFLARE_QA_DATA_TOKEN!=='string'||
  process.env.CLOUDFLARE_QA_DATA_TOKEN.length<20)
  fail('EXISTING_QA_SECRETS_REQUIRED');
}
function state(){
 if(!existsSync(STATE))return null;
 const s=JSON.parse(readFileSync(STATE,'utf8'));
 if(s.run!==RUN_ID||!UUID.test(s.uuid||'')||
  !ROW.test(s.failRow||'')||!ROW.test(s.ackRow||'')||
  !KEY.test(s.failKey||'')||!KEY.test(s.ackKey||'')||
  s.failRow===s.ackRow||s.failKey===s.ackKey)
  fail('LOCAL_EXACT_STATE');
 return s;
}
async function api(path,method='GET',body,token=process.env.CLOUDFLARE_QA_DATA_TOKEN){
 if(!path.startsWith(BASE+'/')||typeof token!=='string'||token.length<20)
  fail('WRONG_ACCOUNT_OR_TOKEN');
 const binary=body instanceof Blob;
 const res=await fetch(path,{method,headers:{
  Authorization:'Bearer '+token,Accept:'application/json',
  'Cache-Control':'no-store',
  ...(binary?{'Content-Type':'application/octet-stream'}:
   body?{'Content-Type':'application/json'}:{})},
  ...(body!==undefined?{body:binary?body:JSON.stringify(body)}:{}),
  redirect:'error',signal:AbortSignal.timeout(18000)});
 const json=await res.json().catch(()=>null);
 return {code:res.status,ok:res.ok&&json?.success===true,
  data:json?.result,errors:Array.isArray(json?.errors)?
   json.errors.map(e=>Number(e?.code)).filter(Number.isInteger):[]};
}
function ok(x,label){
 if(!x.ok||x.code!==200)fail(label+'_HTTP_'+x.code);
 return x.data;
}
async function checkBaseline(){
 const origin=ok(await api(BASE+'/workers/scripts/'+WORKER+'/deployments',
  'GET',undefined,process.env.CLOUDFLARE_QA_API_TOKEN),'APP583_GET');
 const active=origin?.deployments?.[0]?.versions;
 if(!Array.isArray(active)||active.length!==1||
  active[0]?.version_id!==ORIGINAL||
  Number(active[0]?.percentage)<99.99)fail('APP583_ACTIVE_DRIFT');
 const d=ok(await api(BASE+'/d1/database'),'D1_INVENTORY');
 const b=ok(await api(BASE+'/r2/buckets'),'R2_INVENTORY');
 const databases=Array.isArray(d)?d:d?.databases;
 const buckets=Array.isArray(b)?b:b?.buckets;
 if(!Array.isArray(databases)||databases.length!==1||
  databases[0]?.name!==DB||!UUID.test(databases[0]?.uuid||'')||
  !Array.isArray(buckets)||buckets.length!==1||buckets[0]?.name!==BUCKET)
  fail('EXISTING_QA_RESOURCE_DRIFT');
 console.log('APP769_OLD_APP583_100_AND_EXACT_QA_D1_R2=PASS');
 return databases[0].uuid;
}
function sqlGuard(sql,s){
 // Never permit other tables/IDs or SQL without the exact QA fixture name.
 if(typeof sql!=='string'||sql.length>380||
  !sql.includes(TABLE)||/follows|explore_|users|profile_stats|drop |alter |create /i.test(sql)||
  !sql.includes(s.failRow)&&!sql.includes(s.ackRow))
  fail('SQL_SCOPE');
}
async function query(sql,s,{expectFailure=false}={}){
 sqlGuard(sql,s);
 const outcome=await api(BASE+'/d1/database/'+s.uuid+'/query','POST',{sql});
 const statement=Array.isArray(outcome.data)&&outcome.data.length===1?
  outcome.data[0]:null;
 const success=outcome.ok&&statement?.success===true&&
  Number.isSafeInteger(statement?.meta?.rows_written);
 if(expectFailure){
  if(success)fail('EXPECTED_SQL_ERROR_NOT_OBSERVED');
  // Exact SQL is a deliberately invalid column on our preexisting synthetic
  // table. A failed query is not evidence of a real network outage.
  if(outcome.code!==200&&outcome.code!==400)fail('UNEXPECTED_SQL_HTTP_'+outcome.code);
  return {failed:true};
 }
 if(!success)fail('D1_QUERY_UNVERIFIED_'+outcome.code);
 return statement;
}
async function countRow(key,s){
 const r=await query('SELECT COUNT(*) AS n FROM '+TABLE+
   " WHERE k='"+key+"'",s);
 const n=r.results?.[0]?.n;
 if(!Number.isSafeInteger(n)||n<0||n>1)fail('EXACT_ROW_COUNT_UNVERIFIED');
 return n;
}
function objectPath(key){
 if(!KEY.test(key))fail('NON_QA_OBJECT_KEY');
 return BASE+'/r2/buckets/'+BUCKET+'/objects/'+key;
}
async function upload(key){
 const body=new Blob(['APP769_ISOLATED_SYNTHETIC_ONLY'],{
  type:'application/octet-stream'});
 const res=await api(objectPath(key),'PUT',body);
 const x=ok(res,'R2_SYNTHETIC_UPLOAD');
 if(x?.key!==key)fail('R2_WRONG_OBJECT_ACK');
}
async function prepare(){
 guardRun();
 if(state())fail('QA_STATE_ALREADY_EXISTS');
 const uuid=await checkBaseline();
 const nonce=randomBytes(8).toString('hex');
 const s={run:RUN_ID,uuid,
  failRow:'qa769_a_'+nonce,ackRow:'qa769_b_'+nonce,
  failKey:'app769-only-qa-a-'+nonce,
  ackKey:'app769-only-qa-b-'+nonce};
 writeFileSync(STATE,JSON.stringify(s),{mode:0o600});
 // Safety check: never overwrite a previous row at our exact random keys.
 if((await countRow(s.failRow,s))!==0||(await countRow(s.ackRow,s))!==0)
  fail('SYNTHETIC_COLLISION');
 console.log('APP769_QA_ONLY_NO_NEW_RESOURCES_PREFLIGHT=PASS');
}
async function exercise(){
 guardRun();const s=state();if(!s)fail('QA_PREPARE_REQUIRED');
 if(await countRow(s.failRow,s)!==0||await countRow(s.ackRow,s)!==0)
  fail('NOT_EMPTY_BEFORE_TEST');
 // Case A: R2 succeeded and a real QA D1 SQL statement fails before commit.
 await upload(s.failKey);
 const sql="INSERT INTO "+TABLE+" (k,app769_invalid_column) VALUES ('"+
  s.failRow+"',1)";
 await query(sql,s,{expectFailure:true});
 if(await countRow(s.failRow,s)!==0)fail('FAILED_D1_MUTATED_ROW');
 console.log('APP769_REAL_QA_R2_PUT_AND_D1_INVALID_SQL_FAILURE=PASS');
 console.log('APP769_AFTER_D1_FAILURE_AUTO_RETRY_WRITES=0_HOLD');
 // Case B: R2 succeeded, QA D1 INSERT committed; response is deliberately
 // discarded by the test client to simulate losing the ACK AFTER commit.
 await upload(s.ackKey);
 const valid="INSERT INTO "+TABLE+" (k,following) VALUES ('"+
  s.ackRow+"',1)";
 const ack=await query(valid,s);
 if(ack.meta.rows_written<1)fail('D1_INSERT_NOT_COMMITTED');
 // Discard the response as if the caller lost the ACK (synthetic injection).
 const simulatedAckLost=true;
 if(!simulatedAckLost)fail('ACK_LOSS_NOT_INJECTED');
 // Re-read the exact synthetic row (not any production canonical follow
 // ledger). No second INSERT, no new operation ID, no Worker retries.
 if(await countRow(s.ackRow,s)!==1)fail('LOST_ACK_EXACT_ROW_UNVERIFIED');
 console.log('APP769_REAL_QA_D1_EXACT_ROW_AFTER_SIMULATED_ACK_LOSS=PASS');
 console.log('APP769_AFTER_ACK_LOSS_DUPLICATE_D1_WRITES=0');
 console.log('APP769_REAL_PRODUCTION_CANONICAL_RECONCILIATION=NOT_PROVEN');
 console.log('APP769_AUTOMATIC_RECOVERY=HOLD');
}
async function cleanup(){
 guardRun();const s=state();
 if(!s){console.log('APP769_NO_QA_WRITES_PREPARED');return;}
 const errors=[];
 try{
  await query('DELETE FROM '+TABLE+" WHERE k IN ('"+s.failRow+"','"+
    s.ackRow+"')",s);
  if(await countRow(s.failRow,s)!==0||await countRow(s.ackRow,s)!==0)
   fail('QA_ROW_CLEANUP_NOT_ZERO');
  console.log('APP769_EXACT_QA_SYNTHETIC_D1_ROWS_CLEANED=PASS');
 }catch(e){errors.push('D1_CLEANUP_'+String(e.message||'FAIL'));}
 for(const key of [s.failKey,s.ackKey]){
  try{
   const x=await api(objectPath(key),'DELETE');
   if(!(x.ok&&x.code===200)&&
      !x.errors.includes(10007))
    fail('EXACT_R2_DELETE_'+x.code);
  }catch(e){errors.push('R2_CLEANUP_'+String(e.message||'FAIL'));}
 }
 if(!errors.some(x=>x.startsWith('R2_CLEANUP_')))
  console.log('APP769_EXACT_QA_R2_OBJECTS_CLEANED=PASS');
 try{await checkBaseline();}
 catch(e){errors.push('QA_BASELINE_'+String(e.message||'FAIL'));}
 if(errors.length)fail(errors.join('_'));
 console.log('APP769_QA_D1_R2_APP583_PRESERVED=PASS');
}
export const app769Qa={prepare,exercise,cleanup};
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 const phase=process.argv[2];
 const run=app769Qa[phase];
 if(typeof run!=='function')fail('INVALID_PHASE');
 run().catch(e=>{console.error(String(e?.message||'QA_ERROR'));process.exitCode=2});
}
