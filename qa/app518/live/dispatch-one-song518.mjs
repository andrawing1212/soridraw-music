// APP518 exact QA-only Firebase -> signed Cloudflare -> D1/R2 ACK proof.
// No public endpoint invocation without signed GitHub OIDC + HMAC.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const validRun=s=>/^[0-9]{8,20}$/.test(String(s||''));
const versionOf=t=>{
 const x=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(t||'');
 assert.ok(x,'HOLD_QA518_CANONICAL_TIME');
 const ms=Date.parse(x[1]+'Z');
 assert.ok(Number.isSafeInteger(ms)&&ms>0,'HOLD_QA518_CANONICAL_EPOCH');
 return (BigInt(ms)*1000000n+BigInt((x[2]||'').padEnd(9,'0')||'0')).toString().padStart(21,'0');
};
const oidc=async run=>{
 const raw=process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'';
 const key=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'';
 assert.ok(raw.startsWith('https://')&&key.length>20,'HOLD_QA518_GITHUB_OIDC');
 const url=new URL(raw);
 url.searchParams.set('audience','soridraw-app518-qa-'+run);
 const response=await fetch(url,{method:'GET',redirect:'error',
  headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});
 assert.equal(response.status,200,'HOLD_QA518_OIDC_ISSUANCE');
 const jwt=(await response.json()).value;
 assert.ok(typeof jwt==='string'&&jwt.split('.').length===3,'HOLD_QA518_OIDC_FORMAT');
 return jwt;
};
export async function dispatchExactQa518({runId,source,state,expectedCount,secret}={}){
 assert.ok(validRun(runId)&&
  process.env.GITHUB_RUN_ID===String(runId)&&
  process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&
  process.env.GITHUB_EVENT_NAME==='issue_comment'&&
  process.env.GITHUB_RUN_ATTEMPT==='1','HOLD_QA518_GITHUB_RUN');
 assert.ok(typeof secret==='string'&&Buffer.byteLength(secret)>=32,'HOLD_QA518_HMAC');
 const uid='qa518-'+runId+'-owner',id='qa518-'+runId+'-song';
 assert.equal(source?.uid,uid,'HOLD_QA518_SOURCE_OWNER');
 assert.equal(source?.documentId,id,'HOLD_QA518_SOURCE_ID');
 assert.equal(source?.state,state,'HOLD_QA518_SOURCE_STATE');
 assert.equal(source?.verifiedByServer,true,'HOLD_QA518_SOURCE_NOT_SERVER_VERIFIED');
 assert.ok(['saved','removed'].includes(state),'HOLD_QA518_STATE');
 assert.equal(expectedCount,state==='saved'?1:0,'HOLD_QA518_EXPECTED_COUNT');
 const version=versionOf(source.updateTime);
 const worker='https://soridraw-app518-qa-catalog-'+runId+'.soridraw-qa.workers.dev';
 const payload=JSON.stringify({action:'enqueue',uid,documentId:id,
  sourceVersionNs:version,desiredState:state});
 let result;
 for(let attempt=0;attempt<3;attempt++){
  const stamp=String(Date.now());
  const signature=createHmac('sha256',secret).update(stamp+'\n'+payload).digest('hex');
  const jwt=await oidc(runId);
  const response=await fetch(worker+'/v1/server/catalog518',{
    method:'POST',redirect:'error',
    headers:{'content-type':'application/json',
      'x-soridraw-qa-github-oidc':jwt,
      'x-soridraw-server-time-518':stamp,
      'x-soridraw-server-signature-518':signature},
    body:payload,signal:AbortSignal.timeout(24000),
  });
  const data=await response.json().catch(()=>({}));
  result={http:response.status,code:data?.code,acked:data?.r2Acked};
  if(response.status!==200||
    !['ENQUEUED','STALE_OR_DUPLICATE'].includes(data?.code))
   throw Error('APP518_QA_D1_R2_DISPATCH_'+response.status+'_'+String(data?.code||'').slice(0,85));
  if(data.r2Acked===true)break;
  if(attempt<2)await new Promise(r=>setTimeout(r,650));
 }
 const inspection=await fetch(worker+'/v1/qa518/inspect',{
  method:'POST',redirect:'error',
  headers:{'x-soridraw-qa-github-oidc':await oidc(runId)},
  signal:AbortSignal.timeout(20000),
 });
 const actual=await inspection.json().catch(()=>({}));
 if(inspection.status!==200)
  throw Error('APP518_QA_R2_INSPECT_'+inspection.status+'_'+String(actual.code||''));
 assert.equal(actual.code,'QA518_EXACT_CATALOG_READ');
 assert.equal(actual.uid,uid);
 assert.equal(actual.id,id);
 assert.equal(actual.itemCount,expectedCount,'APP518_QA_R2_ITEM_COUNT');
 assert.equal(actual.outbox?.version,version,'APP518_QA_D1_SOURCE_VERSION');
 assert.equal(actual.outbox?.state,state,'APP518_QA_D1_STATE');
 assert.equal(actual.outbox?.ack,version,'APP518_QA_D1_R2_ACK_VERSION');
 assert.equal(actual.outbox?.hold,null,'APP518_QA_D1_OUTBOX_HOLD');
 assert.equal(actual.lastDelta?.upsert,state==='saved');
 assert.equal(actual.lastDelta?.deleted,state==='removed');
 assert.ok(actual.recentMutations?.includes('canonical518:'+id+':'+version),
  'APP518_QA_R2_MUTATION_NOT_PERSISTED');
 console.log('APP518_QA_REAL_CLOUDFLARE_'+state.toUpperCase()+'_D1_R2=PASS');
 return {code:'APP518_QA_EXACT_D1_R2_ACK',version,state};
}
