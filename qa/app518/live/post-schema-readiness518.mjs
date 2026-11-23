// APP518 isolated QA post-migration read only: exact 5 tables/2 indexes,
// no pilot/user rows, original QA583 unchanged. Never a migration/cleanup.
import {inspectCloudflareQa518} from './readiness518.mjs';
import {QA518_SCHEMA_NAMES,qaD1Request518} from './apply-qa-d1-schema518.mjs';
const tables=QA518_SCHEMA_NAMES.filter(x=>x.startsWith('music_note_catalog_'));
export async function inspectQa518PostSchema({
 call=fetch,workerToken,storageToken,dataToken,
}={}){
 const cf=await inspectCloudflareQa518({
  call,workerToken,storageToken,dataToken,
  expectedApp518Names:QA518_SCHEMA_NAMES,
 });
 if(cf.app518TablesPresent!==5||cf.app518IndexesPresent!==2
  ||cf.existingWorkerCount!==1)
  throw Error('HOLD_QA518_POST_SCHEMA_INVENTORY_INCORRECT');
 const query=qaD1Request518({call,token:dataToken,d1Id:cf.d1Id});
 for(const name of tables){
  const result=await query('SELECT COUNT(*) AS n FROM '+name);
  if(result?.results?.length!==1||Number(result.results[0].n)!==0
   ||Number(result.meta?.rows_written)!==0)
   throw Error('HOLD_QA518_POST_SCHEMA_NONEMPTY_OR_WRITE');
 }
 return {code:'APP518_QA_D1_POST_SCHEMA_LIVE_READONLY_PASS',
  qaTables:5,qaIndexes:2,tableRows:0,d1RowsWritten:0,
  originalWorkerPreserved:true,cloudMutations:0};
}
async function main(){
 const result=await inspectQa518PostSchema({
  workerToken:process.env.CLOUDFLARE_QA_API_TOKEN,
  storageToken:process.env.CLOUDFLARE_QA_STORAGE_READ_TOKEN,
  dataToken:process.env.CLOUDFLARE_QA_DATA_TOKEN,
 });
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 if(process.argv[2]!=='--live-post-schema-readonly')
  throw Error('HOLD_QA518_POST_SCHEMA_MODE');
 main().catch(e=>{console.error(String(e?.message||e).slice(0,120));process.exitCode=1;});
}
