// Trusted main controller; no credentials or inputs can release hard HOLD.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createApp738HostingApi,assertApp738ProductionWriteAuthority} from './app738-firebase-hosting-runtime.mjs';
import {createHostingJournal,runCommonHostingCandidate} from './app738-hosting-writer-candidate.mjs';
import {inspectPreviewBundle,runPreviewBundleCandidate} from './app738-preview-bundle.mjs';
import {verifyApp738GitSourcePin} from './app738-production-hosting-transaction.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',timeout:20000}).trim();
const head=async()=>git('ls-remote','origin','refs/heads/preview').split(/\s+/)[0];
async function smoke(origin,indexSha,version){
 for(let n=0;n<5;n++){
  try{
   const opt={headers:{'Cache-Control':'no-cache'},redirect:'error'};
   const a=await fetch(origin+'/?app738='+Date.now(),opt),b=await fetch(origin+'/app-version.json?app738='+Date.now(),opt);
   if(a.ok&&b.ok&&(!indexSha||sha(Buffer.from(await a.arrayBuffer()))===indexSha)&&String((await b.json()).version)===String(version))return true;
  }catch{}
  await new Promise(r=>setTimeout(r,2000));
 }
 return false;
}
async function main(){
 assertApp738ProductionWriteAuthority();
 const api=createApp738HostingApi(process.env.FIREBASE_ACCESS_TOKEN||'');
 const journal=createHostingJournal({cwd:process.cwd()}),sourceSha=process.env.APP738_SOURCE_SHA;
 if(!/^[a-f0-9]{40}$/.test(sourceSha||'')||await head()!==sourceSha)throw Error('PREVIEW_HEAD_CHANGED');
 git('fetch','--no-tags','origin',sourceSha);
 if(process.argv[2]==='preview'){
  // The credentialed main controller never accepts a modified producer or
  // packer as trusted provenance merely because its run name/path matched.
  for(const path of ['.github/workflows/app738-preview-artifact.yml','scripts/app738-preview-bundle.mjs']){
   const source=execFileSync('git',['show',sourceSha+':'+path]);
   if(sha(source)!==sha(readFileSync(path)))throw Error('PREVIEW_PRODUCER_REVISION_REQUIRES_REVIEW');
  }
  const configRaw=execFileSync('git',['show',sourceSha+':firebase.hosting-preview.json'],{encoding:'utf8'});
  if(sha(configRaw)!==sha(readFileSync('firebase.hosting-preview.json','utf8')))throw Error('PREVIEW_CONFIG_CHANGE_REQUIRES_REVIEW');
  const triggerRaw=execFileSync('git',['show',sourceSha+':.deploy/preview-app-release.trigger'],{encoding:'utf8'});
  const bundle=inspectPreviewBundle({raw:readFileSync(process.argv[3],'utf8'),sourceSha,configRaw,triggerRaw});
  console.log(await runPreviewBundleCandidate({journal,api,bundle,sourceSha,readCurrentPreviewSha:head,smoke:b=>smoke('https://preview.soridraw.com',b.indexSha,b.version)}));
 }else if(process.argv[2]==='production'){
  const raw=readFileSync('DOCS/APP738_APPROVED_DIRECT_RELEASE_EVIDENCE.json','utf8');
  if(sha(raw)!==process.env.APP738_EVIDENCE_SHA256||process.env.APP738_APPROVAL!=='DEPLOY_PRODUCTION')throw Error('APPROVAL_OR_EVIDENCE_MISMATCH');
  const item=JSON.parse(raw),e=item.app737Evidence;
  verifyApp738GitSourcePin({head:sourceSha,source:e.source});
  const before=await api.snapshotLive('soridraw');
  if(!e.hosting.production.release||e.hosting.production.release!==before.release)throw Error('APPROVED_RELEASE_ID_REQUIRED');
  console.log(await runCommonHostingCandidate({journal,api,evidenceRaw:raw,request:{mode:'production',site:'soridraw',sourceSha,filesSha256:e.hosting.preview.filesSha256,configSha256:e.hosting.production.configSha256,evidenceSha256:sha(raw),approval:process.env.APP738_APPROVAL,before:{version:before.version,release:before.release}},readCurrentPreviewSha:head,smokeProduction:async()=>await smoke('https://soridraw.web.app',null,item.appVersion)&&await smoke('https://soridraw.com',null,item.appVersion)}));
 }else throw Error('UNKNOWN_MODE');
}
main().catch(e=>{console.error(String(e.message||e).replace(/Bearer \S+/g,'Bearer [REDACTED]'));process.exitCode=2;});
