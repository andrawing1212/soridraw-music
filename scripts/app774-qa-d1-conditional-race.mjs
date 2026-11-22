// APP774 — bounded real QA D1 *synthetic* conditional-write race.
// No existing Worker deploy, no new table/bucket, no R2 object, no user rows.
// This does NOT test the real follow canonical Writer or guarantee global cutover.
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const PROD='e1a30fc9ef497fda1d34f4ab3dc1da45';
const API='https://api.cloudflare.com/client/v4/accounts/'+QA;
const DB='soridraw-qa-app768-d1',R2='soridraw-qa-app768-r2';
const TABLE='app768_qa_synthetic_follow';
const WORKER='soridraw-owner-qa-583',VERSION='4ed70845-6a4b-4a80-9c51-ed95d0becc38';
const RUN=process.env.GITHUB_RUN_ID||'',DIR=process.env.RUNNER_TEMP||'';
const STATE=join(DIR||'/not-a-run','app774-exact-row-state.json');
const KEY=/^qa774_[a-f0-9]{16}$/;
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const fail=s=>{throw Error('APP774_QA_HOLD_'+s)};
function guard(){
 if(QA===PROD||!DIR||!/^[0-9]{8,20}$/.test(RUN)||
    process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
    process.env.GITHUB_EVENT_NAME!=='push'||
    process.env.GITHUB_REF!=='refs/heads/main'||
    process.env.CLOUDFLARE_ACCOUNT_ID!==QA)
   fail('EXACT_QA_SCOPE');
 for(const k of ['CLOUDFLARE_QA_API_TOKEN','CLOUDFLARE_QA_DATA_TOKEN'])
  if(typeof process.env[k]!=='string'||process.env[k].length<20)
   fail('EXISTING_QA_CREDENTIAL_UNAVAILABLE');
}
async function api(path,{method='GET',body,token=process.env.CLOUDFLARE_QA_DATA_TOKEN}={}){
 if(!path.startsWith(API+'/')||typeof token!=='string'||token.length<20)
  fail('WRONG_ACCOUNT_OR_TOKEN');
 const res=await fetch(path,{method,redirect:'error',signal:AbortSignal.timeout(18000),
  headers:{Authorization:'Bearer '+token,Accept:'application/json',
   'Cache-Control':'no-store',...(body===undefined?{}:{'Content-Type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await res.json().catch(()=>null);
 return {http:res.status,ok:res.ok&&json?.success===true,data:json?.result};
}
function valid(res,label){
 if(res.http!==200||!res.ok)fail(label+'_HTTP_'+res.http);
 return res.data;
}
async function baseline(){
 const d=valid(await api(API+'/workers/scripts/'+WORKER+'/deployments',{
  token:process.env.CLOUDFLARE_QA_API_TOKEN}),'WORKER');
 const versions=d?.deployments?.[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||
   versions[0]?.version_id!==VERSION||Number(versions[0]?.percentage)<99.99)
  fail('APP583_ACTIVE_VERSION_DRIFT');
 const dbs=valid(await api(API+'/d1/database'),'D1_INVENTORY');
 const buckets=valid(await api(API+'/r2/buckets'),'R2_INVENTORY');
 const databases=Array.isArray(dbs)?dbs:dbs?.databases;
 const bs=Array.isArray(buckets)?buckets:buckets?.buckets;
 if(!Array.isArray(databases)||databases.length!==1||
  databases[0]?.name!==DB||!UUID.test(databases[0]?.uuid||'')||
  !Array.isArray(bs)||bs.length!==1||bs[0]?.name!==R2)
  fail('QA_D1_R2_RESOURCE_DRIFT');
 console.log('APP774_EXISTING_APP583_100_AND_QA_D1_R2=PASS');
 return databases[0].uuid;
}
function state(){
 if(!existsSync(STATE))return null;
 const s=JSON.parse(readFileSync(STATE,'utf8'));
 if(s.run!==RUN||!UUID.test(s.uuid||'')||!KEY.test(s.key||''))
  fail('EXACT_LOCAL_STATE');
 return s;
}
async function query(s,kind,desired){
 const k=s.key;
 // These are the *only* allowed D1 queries. No dynamic SQL supplied by
 // requests, no shared tables/rows, no user identifiers, no DDL.
 let sql;
 if(kind==='count')sql="SELECT COUNT(*) AS n FROM "+TABLE+" WHERE k='"+k+"'";
 else if(kind==='read')sql="SELECT following FROM "+TABLE+" WHERE k='"+k+"'";
 else if(kind==='insert')sql="INSERT INTO "+TABLE+" (k,following) VALUES ('"+k+"',0)";
 else if(kind==='claim')sql="UPDATE "+TABLE+" SET following=1 WHERE k='"+k+"' AND following=0";
 else if(kind==='reset')sql="UPDATE "+TABLE+" SET following=0 WHERE k='"+k+"' AND following=1";
 else if(kind==='delete')sql="DELETE FROM "+TABLE+" WHERE k='"+k+"'";
 else fail('SQL_MODE');
 const out=valid(await api(API+'/d1/database/'+s.uuid+'/query',{
  method:'POST',body:{sql}}),'EXACT_D1_'+kind);
 const row=Array.isArray(out)&&out.length===1?out[0]:null;
 if(row?.success!==true||!Number.isSafeInteger(row?.meta?.rows_written))
  fail('D1_RESULT_INVALID_'+kind);
 return row;
}
async function prepare(){
 guard();if(state())fail('STATE_ALREADY_PRESENT');
 const uuid=await baseline();
 const s={run:RUN,uuid,key:'qa774_'+randomBytes(8).toString('hex')};
 writeFileSync(STATE,JSON.stringify(s),{mode:0o600});
 const count=await query(s,'count');
 if(count.results?.[0]?.n!==0)fail('SYNTHETIC_ROW_EXISTS');
 console.log('APP774_PREPARED_ONE_EXACT_SYNTHETIC_ROW_KEY=PASS');
}
async function exercise(){
 guard();const s=state();if(!s)fail('NO_PREPARED_STATE');
 const initial=await query(s,'count');
 if(initial.results?.[0]?.n!==0)fail('SYNTHETIC_ROW_NOT_EMPTY');
 const setup=await query(s,'insert');
 if(setup.meta.rows_written<1||setup.meta.rows_written>2)
  fail('QA_D1_SYNTHETIC_INSERT_ABOVE_W2');
 // Two *concurrent* conditional SQL updates on exactly one QA-only row.
 // Cloudflare D1 serializes each isolated SQL statement. One should win.
 const rs=await Promise.all([query(s,'claim'),query(s,'claim')]);
 const w=rs.map(x=>x.meta.rows_written);
 if(w.filter(x=>x===1).length!==1||w.filter(x=>x===0).length!==1)
  fail('CONCURRENT_QA_CAS_NOT_SINGLE_WINNER');
 const after=await query(s,'read');
 if(after.results?.length!==1||Number(after.results[0].following)!==1)
  fail('SYNTHETIC_CAS_FINAL_STATE');
 const reset=await query(s,'reset');
 if(reset.meta.rows_written!==1)fail('QA_CAS_RESET_NOT_W1');
 const afterReset=await query(s,'read');
 if(afterReset.results?.length!==1||Number(afterReset.results[0].following)!==0)
  fail('QA_CAS_RESET_UNVERIFIED');
 console.log('APP774_REAL_QA_D1_SAME_ROW_CONCURRENT_REQUESTS=2');
 console.log('APP774_REAL_QA_D1_SYNTHETIC_CAS_W1=1_W0=1_PASS');
 console.log('APP774_REAL_QA_D1_SYNTHETIC_INSERT_W1_W2=PASS');
 console.log('APP774_REAL_CANONICAL_FOLLOW_WRITER_W1_W2=NOT_TESTED_HOLD');
 console.log('APP774_ALL_LEGACY_FOLLOW_WRITERS_UNIFIED=FAIL_HOLD');
}
async function cleanup(){
 guard();const s=state();
 if(!s){console.log('APP774_NO_QA_SYNTHETIC_ROW_TO_CLEAN');return;}
 const errs=[];
 try{
  const del=await query(s,'delete');
  if(del.meta.rows_written>2)fail('UNEXPECTED_QA_DELETE_COST');
  const c=await query(s,'count');
  if(c.results?.[0]?.n!==0)fail('EXACT_QA_ROW_NOT_CLEAN');
  console.log('APP774_QA_EXACT_SYNTHETIC_D1_ROW_CLEANED=PASS');
 }catch(e){errs.push('ROW_'+String(e.message||e));}
 try{await baseline()}catch(e){errs.push('BASELINE_'+String(e.message||e));}
 if(errs.length)fail(errs.join('_'));
 console.log('APP774_EXISTING_QA_RESOURCES_AND_WORKER_PRESERVED=PASS');
}
const cmds={prepare,exercise,cleanup};
const phase=process.argv[2];if(!Object.hasOwn(cmds,phase))fail('INVALID_MODE');
cmds[phase]().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
