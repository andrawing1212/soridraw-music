// APP518: one-shot, QA-ONLY, additive D1 schema installation.
// No account creation, Worker/Function deploy, DROP/DELETE, or user-row writes.
// This is deliberately not the live one-song E2E test.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {inspectCloudflareQa518} from './readiness518.mjs';
import {getPinnedGithubPublicJwks518} from './inspect-public-github-jwks518.mjs';

export const QA518_D1_SHA='864f796da24413309567198c9de502b13cdedd50';
export const QA518_D1_ACCOUNT='b60fcd62c679c64db19f0b0e0c2f3429';
const files=[
 '518_music_note_catalog_daily_write_budget.sql',
 '518_music_note_catalog_first_change_index.sql',
 '518_music_note_catalog_outbox.sql',
];
export const QA518_SCHEMA_NAMES=[
 'music_note_catalog_daily_budget_518',
 'music_note_catalog_index_meta_518',
 'music_note_catalog_member_518',
 'music_note_catalog_paged_stage_518',
 'music_note_catalog_outbox_518',
 'idx_music_note_catalog_member_518_generation',
 'idx_music_note_catalog_outbox_518_due',
].sort();
const sqlList="SELECT name FROM sqlite_master WHERE type IN ('table','index') "+
 "AND (name LIKE 'music_note_catalog_%_518' OR name LIKE 'idx_music_note_catalog_%_518') "+
 "ORDER BY name LIMIT 20";
const fail=code=>{throw Error(code);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clean=x=>x.replace(/^\s*--[^\n]*(?:\n|$)/gm,'').trim();
export function exactQa518SchemaStatements({candidateDir,read=readFileSync,git=execFileSync}={}){
 if(typeof candidateDir!=='string'||!candidateDir.includes('app518-pinned-candidate'))
  fail('HOLD_QA518_NON_PINNED_CANDIDATE_PATH');
 const root=resolve(candidateDir);
 const revision=String(git('git',['rev-parse','HEAD'],{
  cwd:root,encoding:'utf8',timeout:10000,
 })).trim();
 if(revision!==QA518_D1_SHA)fail('HOLD_QA518_IMMUTABLE_CANDIDATE_DRIFT');
 const parts=[];
 for(const filename of files){
  const sql=read(join(root,'cloudflare/media-worker/migrations',filename),'utf8');
  if(typeof sql!=='string'||sql.length<100||sql.length>16000
   ||sql.includes('/*')||sql.includes('*/'))
   fail('HOLD_QA518_UNEXPECTED_MIGRATION_FILE');
  const body=clean(sql);
  if(/\b(DROP|ALTER|TRUNCATE|INSERT|UPDATE|DELETE|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|WITH)\b|--|\/\*/i.test(body))
   fail('HOLD_QA518_NON_ADDITIVE_MIGRATION');
  for(const statement of body.split(';').map(x=>x.trim()).filter(Boolean)){
   const table=/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)\s*\(/i.exec(statement);
   const index=/^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)\s+ON\s+([a-z0-9_]+)\s*\(/i.exec(statement);
   if(!table&&!index)fail('HOLD_QA518_UNEXPECTED_D1_DDL');
   const name=table?.[1]||index?.[1];
   if(!QA518_SCHEMA_NAMES.includes(name)
    ||(index&&!QA518_SCHEMA_NAMES.includes(index[2]))
    ||statement.length>5000)
    fail('HOLD_QA518_UNKNOWN_D1_TARGET');
   parts.push({name,sql:statement});
  }
 }
 if(parts.length!==7||!equal(parts.map(x=>x.name).sort(),QA518_SCHEMA_NAMES)
  ||new Set(parts.map(x=>x.name)).size!==7)
  fail('HOLD_QA518_D1_SCHEMA_NOT_EXACT_SEVEN');
 return Object.freeze(parts.map(x=>Object.freeze(x)));
}
const isUuid=x=>/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x||'');
const unwrap=(payload)=>{
 if(payload?.success!==true||!Array.isArray(payload.result)||payload.result.length!==1
  ||payload.result[0]?.success!==true)
  fail('HOLD_QA518_D1_API_QUERY_FAILURE');
 return payload.result[0];
};
export function qaD1Request518({call=fetch,token,d1Id}={}){
 if(typeof call!=='function'||typeof token!=='string'||token.length<20
  ||!isUuid(d1Id))fail('HOLD_QA518_D1_CREDENTIAL_OR_UUID');
 return async sql=>{
  const response=await call('https://api.cloudflare.com/client/v4/accounts/'+
   QA518_D1_ACCOUNT+'/d1/database/'+d1Id+'/query',{
   method:'POST',redirect:'error',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',
    Accept:'application/json'},
   body:JSON.stringify({sql}),signal:AbortSignal.timeout(15000),
  });
  if(response?.status!==200)fail('HOLD_QA518_D1_HTTP_'+response?.status);
  let value;try{value=await response.json();}catch{fail('HOLD_QA518_D1_RESPONSE_UNREADABLE');}
  return unwrap(value);
 };
}
export async function applyExactQa518Schema({plan,d1Id,query,approved=false}={}){
 if(approved!==true||!isUuid(d1Id)||typeof query!=='function'
  ||!Array.isArray(plan)||plan.length!==7
  ||!equal(plan.map(x=>x.name).sort(),QA518_SCHEMA_NAMES))
  fail('HOLD_QA518_D1_PLAN_OR_APPROVAL_INVALID');
 // The SELECT must use this exact fixed SQL before any mutation.
 const initial=await query(sqlList);
 if(!Array.isArray(initial.results)||initial.results.some(x=>typeof x.name!=='string')
  ||initial.results.length!==0||Number(initial.meta?.rows_written)!==0)
  fail('HOLD_QA518_D1_EXISTING_OR_PARTIAL_SCHEMA');
 const attempted=[];
 for(const item of plan){
  try{
   attempted.push(item.name); // count attempts even when the API request fails
   const result=await query(item.sql);
   if(!Array.isArray(result.results)||result.results.length>0)
    fail('HOLD_QA518_D1_DDL_UNEXPECTED_RESULT');
  }catch{
   // No automatic DROP. An interrupted additive schema is evidence; preserve.
   fail('HOLD_QA518_D1_PARTIAL_SCHEMA_ATTEMPTS_'+attempted.length);
  }
 }
 const actual=await query(sqlList);
 if(!Array.isArray(actual.results)||Number(actual.meta?.rows_written)!==0
  ||!equal(actual.results.map(x=>x.name).sort(),QA518_SCHEMA_NAMES))
  fail('HOLD_QA518_D1_POST_SCHEMA_NOT_EXACT');
 // Every newly created app518 table must still be completely empty.
 for(const name of QA518_SCHEMA_NAMES.filter(x=>!x.startsWith('idx_'))){
  const rows=await query('SELECT COUNT(*) AS n FROM '+name);
  if(!Array.isArray(rows.results)||rows.results.length!==1
   ||Number(rows.results[0].n)!==0||Number(rows.meta?.rows_written)!==0)
   fail('HOLD_QA518_D1_POST_TABLE_NOT_EMPTY');
 }
 return {code:'APP518_QA_D1_EXACT_ADDITIVE_SCHEMA_PASS',
  createdTables:5,createdIndexes:2,otherTablesModified:0,
  appliedStatements:attempted.length,d1Id};
}
export function assertQaSchemaGithubEvent518({env=process.env,read=readFileSync}={}){
 if(env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'
  ||env.GITHUB_EVENT_NAME!=='issue_comment'
  ||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_RUN_ATTEMPT!=='1'
  ||!/^[0-9]{8,20}$/.test(env.GITHUB_RUN_ID||'')
  ||!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')
  ||typeof env.GITHUB_EVENT_PATH!=='string')
  fail('HOLD_QA518_GITHUB_RUN_UNTRUSTED');
 let event;try{event=JSON.parse(read(env.GITHUB_EVENT_PATH,'utf8'));}
 catch{fail('HOLD_QA518_GITHUB_EVENT_INVALID');}
 if(event?.repository?.id!==1188157610||event?.repository?.owner?.id!==268937716
  ||event?.repository?.full_name!=='andrawing1212/soridraw-music'
  ||event?.issue?.number!==528||!event?.issue?.pull_request
  ||event?.sender?.id!==268937716
  ||event?.comment?.body!=='/app518-qa-d1-additive 864f796da24413309567198c9de502b13cdedd50')
  fail('HOLD_QA518_GITHUB_EXACT_OWNER_COMMAND');
 return {runId:env.GITHUB_RUN_ID,sha:env.GITHUB_SHA};
}
export async function runLiveQa518Schema(){
 const ctx=assertQaSchemaGithubEvent518();
 const candidateDir=process.env.APP518_PINNED_CANDIDATE_DIR;
 const plan=exactQa518SchemaStatements({candidateDir});
 // Independently verify the REAL GitHub-signed OIDC before cloud mutations.
 await getPinnedGithubPublicJwks518({runId:ctx.runId,workflowSha:ctx.sha});
 const target=await inspectCloudflareQa518({
  call:fetch,workerToken:process.env.CLOUDFLARE_QA_API_TOKEN,
  storageToken:process.env.CLOUDFLARE_QA_STORAGE_READ_TOKEN,
  dataToken:process.env.CLOUDFLARE_QA_DATA_TOKEN,
 });
 const query=qaD1Request518({token:process.env.CLOUDFLARE_QA_DATA_TOKEN,d1Id:target.d1Id});
 console.log('APP518_QA_D1_ADDITIVE_PRECHECK=PASS; ORIGINAL_WORKER_UNCHANGED=PASS');
 const result=await applyExactQa518Schema({
  plan,d1Id:target.d1Id,query,approved:true,
 });
 // Never print UUID, private data, D1 rows, or any tokens.
 console.log(result.code);
 console.log('APP518_QA_D1_ONLY_5_NEW_TABLES_2_INDEXES=PASS');
 console.log('APP518_QA_FUNCTION_DEPLOY=0; R2_WRITE=0; QA_FAVORITE_WRITE=0');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 if(process.argv[2]!=='--exact-qa-run')fail('HOLD_QA518_D1_NO_DEFAULT_EXECUTION');
 runLiveQa518Schema().catch(err=>{
  console.error(String(err?.message||'HOLD_QA518_SCHEMA_UNKNOWN').slice(0,100));
  process.exitCode=1;
 });
}
