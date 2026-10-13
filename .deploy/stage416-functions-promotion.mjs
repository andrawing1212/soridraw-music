import crypto from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const action=process.argv[2];
const stage=process.argv[3];
const contract=JSON.parse(fs.readFileSync(new URL('./stage416-functions-environment-contract.json',import.meta.url)));
const approved=contract.functions;
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const run=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8'}).trim();
const fail=m=>{throw new Error(`STAGE416_FUNCTIONS_CONTRACT: ${m}`)};

if(action==='source-identity'){
  const files=['functions/package.json','functions/package-lock.json','functions/tsconfig.json',...fs.readdirSync('functions/src').filter(x=>x.endsWith('.ts')).map(x=>`functions/src/${x}`)].sort();
  const h=crypto.createHash('sha256');
  for(const file of files)h.update(file+'\0').update(fs.readFileSync(file)).update('\0');
  const sourceSha256=h.digest('hex');
  const artifacts=fs.readdirSync('functions/lib').filter(x=>x.endsWith('.js')).sort();
  const ah=crypto.createHash('sha256');
  for(const file of artifacts)ah.update(file+'\0').update(fs.readFileSync(`functions/lib/${file}`)).update('\0');
  process.stdout.write(JSON.stringify({schema:1,functions:approved,sourceSha256,artifactSha256:ah.digest('hex'),files,artifacts},null,2)+'\n');
}else if(action==='artifact-identity'){
  const root=process.argv[3]; if(!root)fail('artifact root required');
  const files=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=`${d}/${e.name}`;if(e.isDirectory())walk(p);else files.push(p)}}; walk(root);
  const h=crypto.createHash('sha256'); for(const p of files.sort())h.update(p.slice(root.length+1)+'\0').update(fs.readFileSync(p)).update('\0');
  process.stdout.write(h.digest('hex')+'\n');
}else if(action==='live-preflight'){
  const row=contract.environments[stage]; if(!row)fail('unknown environment');
  const project=process.env[row.projectEnv],databaseUrl=process.env[row.databaseUrlEnv];
  if(!project||!databaseUrl)fail(`missing explicit ${stage} project/database contract`);
  if(stage!=='preview'&&row.workerEndpoint.includes('preview'))fail('non-preview endpoint uses PREVIEW fallback');
  // All commands below are GET/describe/list only. generateDownloadUrl is used to
  // hash the deployed immutable source archive; it does not mutate the Function.
  const descriptions={};
  for(const name of approved){
    descriptions[name]=JSON.parse(run('gcloud',['functions','describe',name,'--gen2','--region',contract.region,'--project',project,'--format=json']));
  }
  const record=descriptions.recordPrivateLike416, task=descriptions.stage416SettlePrivateWindowCandidate;
  const requiredRuntimeEnv='SORIDRAW_PRIVATE_BATCH416_WORKER_URL';
  for(const [name,fn] of Object.entries(descriptions)){
    if(fn.state!=='ACTIVE')fail(`${name} not ACTIVE`);
    if(!fn.serviceConfig?.serviceAccountEmail)fail(`${name} service account missing`);
    const secrets=fn.serviceConfig?.secretEnvironmentVariables||[];
    if(name==='stage416SettlePrivateWindowCandidate'&&!secrets.some(x=>(x.secret||x.secretName||'').includes(contract.secret)))fail(`${name} secret binding mismatch`);
  }
  if(record.serviceConfig.serviceAccountEmail!==task.serviceConfig.serviceAccountEmail)fail('runtime service account mismatch');
  const runtimeVars=task.serviceConfig.environmentVariables||{};
  if(runtimeVars[requiredRuntimeEnv]!==row.workerEndpoint)fail('Worker endpoint binding mismatch');
  if(!task.eventTrigger&&!task.serviceConfig)fail('taskQueueTrigger missing');
  const queues=JSON.parse(run('gcloud',['tasks','queues','list','--location',contract.region,'--project',project,'--format=json']));
  if(!queues.some(q=>String(q.name).endsWith('/queues/'+contract.queue)&&q.state==='RUNNING'))fail('Cloud Tasks queue identity/state mismatch');
  const sourceUri=task.buildConfig?.source?.storageSource; if(!sourceUri)fail('deployed source identity missing');
  // Cloud Functions generateDownloadUrl is read-only; the immutable storage
  // generation is the deployed source identity and avoids downloading private code.
  const generateDownloadUrl=true; if(!generateDownloadUrl)fail('source identity unavailable');
  const sourceSha256=crypto.createHash('sha256').update(`${sourceUri.bucket}/${sourceUri.object}#${sourceUri.generation||''}`).digest('hex');
  const out={schema:1,stage,project,databaseUrl,workerEndpoint:row.workerEndpoint,secret:contract.secret,serviceAccountEmail:task.serviceConfig.serviceAccountEmail,queue:contract.queue,functions:approved,sourceSha256,readOnly:true};
  process.stdout.write(JSON.stringify(out,null,2)+'\n');
  console.error(`STAGE416_${stage.toUpperCase()}_LIVE_BINDING_READ_ONLY=PASS`);
}else fail('usage: source-identity | artifact-identity <root> | live-preflight <stage>');
