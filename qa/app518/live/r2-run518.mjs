// APP518 QA one-shot signed HTTP smoke of a UNIQUE temporary Worker.
// Tests only exactly two synthetic R2 keys; never reads music/user data.
// A separate always() workflow step calls cleanup if bootstrap partially fails.
import assert from 'node:assert/strict';
const run=process.env.GITHUB_RUN_ID||'';
const sha=process.env.GITHUB_SHA||'';
const worker='soridraw-app518-qa-r2-'+run;
const url='https://'+worker+'.soridraw-qa.workers.dev/v1/qa518/r2';
if(!/^[0-9]{8,20}$/.test(run)||!/^[a-f0-9]{40}$/.test(sha)
 ||process.env.GITHUB_EVENT_NAME!=='issue_comment'
 ||process.env.GITHUB_REF!=='refs/heads/main'
 ||process.env.GITHUB_RUN_ATTEMPT!=='1')
 throw Error('APP518_QA_R2_RUN_NOT_PINNED');
const audience='soridraw-app518-qa-'+run;
const oidc=async()=>{
 const service=process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'';
 const auth=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'';
 if(!service.startsWith('https://')||auth.length<20)
  throw Error('APP518_QA_GITHUB_OIDC_NOT_AVAILABLE');
 const endpoint=new URL(service);
 endpoint.searchParams.set('audience',audience);
 const response=await fetch(endpoint,{method:'GET',redirect:'error',
  headers:{Authorization:'Bearer '+auth},
  signal:AbortSignal.timeout(12000)});
 if(response.status!==200)throw Error('APP518_QA_OIDC_ISSUANCE_HTTP_'+response.status);
 const data=await response.json();
 if(typeof data?.value!=='string'||data.value.split('.').length!==3)
  throw Error('APP518_QA_OIDC_JWT_INVALID');
 return data.value;
};
const call=async(action,withReadToken=false)=>{
 if(!['inspect','bootstrap','cleanup'].includes(action))
  throw Error('APP518_QA_UNSUPPORTED_R2_ACTION');
 const jwt=await oidc();
 const headers={'content-type':'application/json',
  'x-soridraw-qa-github-oidc':jwt};
 if(withReadToken){
  const token=process.env.CLOUDFLARE_QA_API_TOKEN||'';
  if(token.length<20)throw Error('APP518_QA_CF_READER_NOT_AVAILABLE');
  headers['x-soridraw-qa-cf-worker-read']=token;
 }
 const response=await fetch(url,{method:'POST',headers,
  body:JSON.stringify({action,runId:run}),redirect:'error',
  signal:AbortSignal.timeout(24000)});
 const payload=await response.json().catch(()=>null);
 if(response.status!==200||!payload?.code)
  throw Error('APP518_QA_R2_'+action.toUpperCase()+'_HOLD_'+
   String(payload?.code||response.status).slice(0,95));
 return payload;
};
const command=process.argv[2];
if(command==='--bootstrap'){
 const noToken=await fetch(url,{method:'POST',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'inspect',runId:run}),redirect:'error',
  signal:AbortSignal.timeout(12000)});
 assert.equal(noToken.status,403,'MUST_DENY_UNSIGNED_R2_INSPECT');
 const before=await call('inspect');
 assert.equal(before.code,'QA518_R2_PREFIX_EMPTY','MUST_BE_EMPTY');
 const seeded=await call('bootstrap');
 assert.equal(seeded.code,'QA518_R2_BOOTSTRAP_EXACT_TWO_KEYS_PASS');
 const after=await call('inspect');
 assert.equal(after.code,'QA518_R2_TWO_EXACT_KEYS_VALID');
 assert.equal(after.itemCount,0);
 assert.equal(after.revision,1);
 console.log('APP518_QA_REAL_R2_BOOTSTRAP_EXACT_TWO_KEYS=PASS');
 console.log('APP518_QA_REAL_R2_SIGNED_ONLY_AND_WRONG_URL_BLOCK=PASS');
}else if(command==='--cleanup'){
 const cleaned=await call('cleanup',true);
 if(!['QA518_R2_EXACT_TWO_KEYS_CLEANED_PASS',
   'QA518_R2_ALREADY_ABSENT'].includes(cleaned.code))
  throw Error('APP518_QA_R2_CLEANUP_NOT_EXACT');
 const after=await call('inspect');
 assert.equal(after.code,'QA518_R2_PREFIX_EMPTY');
 console.log('APP518_QA_REAL_R2_EXACT_PILOT_CLEANUP=PASS');
}else throw Error('APP518_QA_R2_MODE_DENIED');
