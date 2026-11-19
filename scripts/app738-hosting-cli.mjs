// APP738 CLI: inventory is GET-only, deploy needs separately reviewed evidence.
// It NEVER modifies Workers, Functions, RTDB, Rules, TEST or original user data.
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createApp738HostingApi} from './app738-firebase-hosting-runtime.mjs';
import {runApp738HostingPromotion} from './app738-production-hosting-transaction.mjs';

const fail=s=>{throw Error('APP738_RUN_HOLD_'+s)};
const sha=s=>createHash('sha256').update(s).digest('hex');
const mode=process.argv[2];
const proofPath='DOCS/APP738_APPROVED_DIRECT_RELEASE_EVIDENCE.json';
const token=process.env.FIREBASE_ACCESS_TOKEN||'';
const api=createApp738HostingApi(token);
const clean=x=>JSON.stringify(x,null,2);
const HEAD=/^[0-9a-f]{40}$/;
const FULL=/^[0-9a-f]{64}$/;
const currentPreviewHead=()=>execFileSync('git',['ls-remote','origin','refs/heads/preview'],{
  encoding:'utf8',timeout:15000,
}).trim().split(/\s+/)[0];
const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function smoke({expectedAppVersion}){
  for(const origin of ['https://soridraw.web.app','https://soridraw.com']){
    let confirmed=false;
    for(let attempt=0;attempt<5;attempt++){
      try{
        const page=await fetch(origin+'/?app738='+Date.now(),{
          method:'GET',headers:{'Cache-Control':'no-cache'},redirect:'error',
        });
        const version=await fetch(origin+'/app-version.json?app738='+Date.now(),{
          method:'GET',headers:{'Cache-Control':'no-cache'},redirect:'error',
        });
        if(page.ok&&version.ok){
          const data=await version.json();
          if(String(data.version)===String(expectedAppVersion)){
            confirmed=true;break;
          }
        }
      }catch{}
      await nap(2000);
    }
    if(!confirmed)return false;
  }
  return true;
}
async function run(){
  if(mode==='inventory'){
    const [a,b]=await Promise.all([
      api.snapshotLive('soridraw-preview'),
      api.snapshotLive('soridraw'),
    ]);
    console.log(clean({status:'GET_ONLY_LIVE_HOSTING_SNAPSHOT',testTouched:false,
      productionChanged:false,preview:{
        version:a.version,files:a.assetCount,filesSha256:a.filesSha256,
        configSha256:a.configSha256,
      },production:{
        rollbackVersion:b.version,files:b.assetCount,filesSha256:b.filesSha256,
        configSha256:b.configSha256,
      },sameFiles:a.filesSha256===b.filesSha256,
      sameConfig:a.configSha256===b.configSha256,
      deployStatus:'HOLD_UNTIL_APPROVED_COMPLETE_FEATURE_PARITY',
    }));
    return;
  }
  if(mode!=='deploy')fail('UNKNOWN_MODE');
  if(process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
     process.env.GITHUB_ACTOR!==process.env.GITHUB_REPOSITORY_OWNER)
    fail('DIRECTOR_GITHUB_OWNER_ONLY');
  if(process.env.APP738_PRODUCTION_APPROVAL!=='DEPLOY_PRODUCTION')
    fail('EXPLICIT_PRODUCTION_APPROVAL_MISSING');
  const previewSha=process.env.APP738_PREVIEW_SHA||'';
  if(!HEAD.test(previewSha)||currentPreviewHead()!==previewSha)
    fail('LIVE_PREVIEW_SHA_CHANGED');
  if(!existsSync(proofPath))fail('INDEPENDENT_APPROVED_RELEASE_EVIDENCE_MISSING');
  const raw=readFileSync(proofPath,'utf8'),fingerprint=sha(raw);
  if(!FULL.test(process.env.APP738_EVIDENCE_SHA256||'')||
     fingerprint!==process.env.APP738_EVIDENCE_SHA256)
    fail('REVIEWED_EVIDENCE_DIGEST_MISMATCH');
  const item=JSON.parse(raw);
  if(item?.kind!=='APP738_DIRECT_RELEASE_EVIDENCE_V1'||
     item?.reviewedForActualProductionDeployment!==true||
     item?.approvedPreviewSha!==previewSha||
     item?.verifiedByIndependentQa!==true ||
     item?.appVersion===undefined ||
     item?.app737Evidence?.previewSha!==previewSha)
    fail('RELEASE_EVIDENCE_SCOPE_OR_QA_NOT_VERIFIED');
  const result=await runApp738HostingPromotion({
    api,previewSha,evidence:item.app737Evidence,
    approval:process.env.APP738_PRODUCTION_APPROVAL,
    readCurrentPreviewSha:async()=>currentPreviewHead(),
    smokeProduction:async()=>smoke({expectedAppVersion:item.appVersion}),
  });
  console.log(clean({...result,verifiedAppVersion:item.appVersion,
    evidenceSha256:fingerprint,
  }));
}
run().catch(error=>{
 console.error(String(error?.message||error).replace(/Bearer [^\s]+/gi,'Bearer [REDACTED]'));
 process.exitCode=2;
});
