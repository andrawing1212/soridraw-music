// APP766: ONE schema-only SELECT against the existing shared canonical D1.
// This is NOT a Worker deployment, a user-row query, a new ledger, or an
// independent 'never seen' attestation. All releases remain HOLD.
// Run only from a trusted main SHA with the existing Cloudflare Actions token.
const CF_ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const D1_DATABASE='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const D1_NAME='soridraw-explore-db';
const QUERY="SELECT type, name, sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 250";
const hold=why=>{throw Error('APP766_READONLY_HOLD_'+why)};
const known=/^[a-zA-Z_][a-zA-Z_0-9]{0,127}$/;
export function assessApp766Schema(rows){
 if(!Array.isArray(rows)||rows.length>250)hold('SCHEMA_RESULTS_UNVERIFIED');
 const tables=[];
 const seen=new Set();
 for(const v of rows){
  if(v?.type!=='table'||!known.test(String(v.name||''))||
     typeof v.sql!=='string'||v.sql.length>50000||
     seen.has(v.name))hold('SCHEMA_ROW_INVALID');
  seen.add(v.name);
  const sql=v.sql.replace(/\s+/g,' ').trim();
  tables.push({name:v.name,sql});
 }
 if(!tables.length)hold('SCHEMA_EMPTY');
 const byName=new Map(tables.map(x=>[x.name,x.sql]));
 const edge=byName.get('explore_follow_overrides_348');
 const overlayPairUnique=!!edge&&
  /PRIMARY\s+KEY\s*\(\s*follower_uid\s*,\s*following_uid\s*\)/i.test(edge)&&
  /mutation_id\s+TEXT/i.test(edge);
 const candidateTables=tables.filter(v=>
  /follow|receipt|operation|journal|event|epoch|outbox/i.test(v.name));
 // No finite snapshot of sqlite_schema proves a ledger is complete from
 // origin, survives DO PITR, or is authoritatively written on every change.
 // APP765 demands those facts, not simply an operation_id column.
 return Object.freeze({
  status:'SCHEMA_OBSERVED_APP765_HOLD',
  schemaOnlyRead:true,
  sharedUserRowsRead:0,
  sharedDatabaseWrites:0,
  tableCount:tables.length,
  overlayPairUnique,
  possibleHistoryTableNames:candidateTables.map(v=>v.name).sort(),
  independentFromOwnerDoPitr:'UNVERIFIED',
  operationCoverageFromOrigin:'UNVERIFIED',
  exactOperationStatus:'UNVERIFIED',
  externallyPinnedRevisionFloor:'UNVERIFIED',
  productionDeploymentAuthorized:false,
 });
}
const request=async(url,token,{method='GET',sql}={})=>{
 const res=await fetch(url,{method,redirect:'error',
  headers:{Authorization:'Bearer '+token,Accept:'application/json',
   ...(method==='POST'?{'Content-Type':'application/json'}:{})},
  ...(sql?{body:JSON.stringify({sql})}:{})});
 if(!res.ok)hold('CF_HTTP_'+res.status);
 const json=await res.json();
 if(json?.success!==true)hold('CF_API_ERROR');
 return json.result;
};
export async function runApp766LiveSchema({token=process.env.CLOUDFLARE_API_TOKEN}={}){
 if(typeof token!=='string'||token.length<20)hold('TOKEN_MISSING');
 const db='https://api.cloudflare.com/client/v4/accounts/'+CF_ACCOUNT+
  '/d1/database/'+D1_DATABASE;
 const details=await request(db,token);
 if(details?.uuid!==D1_DATABASE||details.name!==D1_NAME)
  hold('CANONICAL_D1_IDENTITY_MISMATCH');
 // D1 query endpoint requires POST even for SQL SELECT; the fixed SQL is
 // string-literal read-only against sqlite_schema. No user row access.
 const result=await request(db+'/query',token,{method:'POST',sql:QUERY});
 if(!Array.isArray(result)||result.length!==1||
    result[0]?.success!==true||
    !Array.isArray(result[0].results))
  hold('D1_METADATA_RESPONSE_UNVERIFIED');
 const outcome=assessApp766Schema(result[0].results);
 console.log('APP766_LIVE_D1_SCHEMA_METADATA_SELECT=PASS; SHARED_USER_ROWS=0; WRITES=0');
 console.log('APP766_EXISTING_CANONICAL_OVERLAY_PAIR_KEY='+outcome.overlayPairUnique);
 console.log('APP766_D1_TABLES_TOTAL='+outcome.tableCount);
 console.log('APP766_RELEVANT_TABLE_NAMES='+outcome.possibleHistoryTableNames.join(','));
 console.log('APP766_COMPLETE_INDEPENDENT_OPERATION_HISTORY=UNVERIFIED_HOLD');
 console.log('APP766_EXTERNAL_OWNER_REVISION_FLOOR=UNVERIFIED_HOLD');
 console.log('APP766_PRODUCTION_DEPLOY=0; ACTIVE_WORKER_UNCHANGED=YES');
 return outcome;
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1]){
 runApp766LiveSchema().catch(e=>{
  console.error(String(e.message||'APP766_METADATA_UNAVAILABLE'));
  process.exitCode=2;
 });
}
