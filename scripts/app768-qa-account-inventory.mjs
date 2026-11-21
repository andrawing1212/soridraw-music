// APP768: GET-only inventory of EXISTING isolated Cloudflare QA account.
// Never receives production Cloudflare credentials. No D1 rows, R2 objects,
// Worker source/modules, secrets or billing settings are read or changed.
const QA='b60fcd62c679c64db19f0b0e0c2f3429';
const PROD='e1a30fc9ef497fda1d34f4ab3dc1da45';
const BASE='https://api.cloudflare.com/client/v4/accounts/'+QA;
const hold=s=>{throw Error('APP768_QA_INVENTORY_HOLD_'+s)};
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const tokenOK=t=>typeof t==='string'&&t.length>=20;
export async function inventoryApp768Qa({
 readToken=process.env.CLOUDFLARE_QA_API_TOKEN,
 deployToken=process.env.CLOUDFLARE_QA_DEPLOY_TOKEN,send=fetch,
}={}){
 if(QA===PROD||!tokenOK(readToken)&&!tokenOK(deployToken))
  hold('QA_ID_OR_TOKEN_NOT_AVAILABLE');
 const paths={
  worker:BASE+'/workers/scripts/soridraw-owner-qa-583/deployments',
  d1:BASE+'/d1/database',
  r2:BASE+'/r2/buckets',
 };
 async function get(path){
  if(!Object.values(paths).includes(path))hold('CROSS_ACCOUNT_URL');
  let code=0;
  for(const token of [readToken,deployToken].filter(tokenOK)){
   const response=await send(path,{
    method:'GET',headers:{Authorization:'Bearer '+token,
     Accept:'application/json','Cache-Control':'no-store'},
    signal:AbortSignal.timeout(15000),redirect:'error',
   });
   code=response.status;
   if(code===403||code===401)continue;
   if(!response.ok)hold('HTTP_'+String(code));
   const body=await response.json();
   if(body?.success!==true)hold('CF_API_RESPONSE_UNVERIFIED');
   return body.result;
  }
  hold('QA_TOKEN_READ_SCOPE_'+String(code));
 }
 const live=await get(paths.worker);
 const versions=live?.deployments?.[0]?.versions;
 if(!Array.isArray(versions)||versions.length!==1||
    versions[0].version_id!=='4ed70845-6a4b-4a80-9c51-ed95d0becc38'||
    Number(versions[0].percentage)<99.99)
  hold('QA_APP583_ORIGINAL_NOT_100_PERCENT');
 console.log('APP768_QA_WORKER_ORIGINAL_GET=PASS');
 const d1=await get(paths.d1);
 console.log('APP768_QA_D1_METADATA_GET=PASS');
 const r2=await get(paths.r2);
 console.log('APP768_QA_R2_METADATA_GET=PASS');
 const dbs=Array.isArray(d1)?d1:Array.isArray(d1?.databases)?d1.databases:null;
 const buckets=Array.isArray(r2?.buckets)?r2.buckets:Array.isArray(r2)?r2:null;
 if(!dbs||!buckets)hold('RESOURCE_LIST_SHAPE');
 const databases=dbs.map(x=>({
  uuid:x?.uuid,name:x?.name
 }));
 const stores=buckets.map(x=>({name:x?.name,
  location:x?.location||null,storageClass:x?.storageClass||null}));
 if(databases.some(x=>!uuid.test(x.uuid||'')||typeof x.name!=='string')||
    stores.some(x=>typeof x.name!=='string'||!x.name))
  hold('RESOURCE_INVENTORY_INVALID');
 const qaD1=databases.filter(x=>/qa|app768/i.test(x.name));
 const qaR2=stores.filter(x=>/qa|app768/i.test(x.name));
 const result={
  status:'QA_EXISTING_RESOURCES_METADATA_ONLY',qaAccountIdVerified:true,
  originalQaWorker100Percent:true,
  qaD1:qaD1.map(x=>x.name),
  qaR2:qaR2.map(x=>x.name),
  totalQaAccountD1:databases.length,
  totalQaAccountR2:buckets.length,
  safeExistingQaResourcePairPresent:qaD1.length>0&&qaR2.length>0,
  userRowsRead:0,r2ObjectsRead:0,
  productionOrSharedResourcesAccessed:false,mutations:0,
 };
 console.log('APP768_QA_ACCOUNT_WORKER_ORIGINAL_100_PERCENT=PASS');
 console.log('APP768_QA_D1_NAMES='+JSON.stringify(result.qaD1));
 console.log('APP768_QA_R2_NAMES='+JSON.stringify(result.qaR2));
 console.log('APP768_QA_RESOURCE_COUNTS=D1:'+databases.length+',R2:'+buckets.length);
 console.log('APP768_EXISTING_QA_D1_R2_PAIR='+(
  result.safeExistingQaResourcePairPresent?'FOUND':'NOT_FOUND'));
 console.log('APP768_QA_INVENTORY_SHARED_USER_ROWS_READ=0; MUTATIONS=0');
 return result;
}
if(process.argv[1]&&import.meta.url==='file://'+process.argv[1])
 inventoryApp768Qa().catch(e=>{console.error(String(e?.message||e));process.exitCode=2});
