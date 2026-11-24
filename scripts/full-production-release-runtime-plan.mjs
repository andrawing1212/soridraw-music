// One bounded read-only comparison of the exact active release, not a new
// per-feature development project. Never fetch user data or credential values.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const cf='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const gcp='https://cloudfunctions.googleapis.com/v2/projects/soridraw-app-866a5/locations/asia-northeast3/functions/';
const hosting='https://firebasehosting.googleapis.com/v1beta1/';
const pins={
 'soridraw-explore-preview':'cfd40718-6ab5-4133-bdb2-fa69332d6810',
 'soridraw-explore-api':'5313d378-351b-412c-b1d9-a7e6e9eb23fa',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869',
 'soridraw-owner-follow-preview-candidate':'c71d7c12-ace4-4405-ab1a-d8c651c90559'
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const safe=x=>String(x||'').slice(0,160);
const get=async(url,token,optional=false)=>{
 const res=await fetch(url,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
 if(optional&&res.status===404)return null;
 if(!res.ok)throw Error('READ_ONLY_GET_'+new URL(url).hostname+'_'+res.status);
 const j=await res.json();
 if(j.success===false)throw Error('PROVIDER_GET_FAILED');
 return j.result??j;
};
const ct=process.env.CLOUDFLARE_API_TOKEN,ft=process.env.FIREBASE_ACCESS_TOKEN;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||!ct||!ft)throw Error('SCOPE');
const fetchWorker=async([name,id])=>{
 const d=await get(cf+'workers/scripts/'+name+'/deployments?per_page=1',ct);
 const v=d.deployments?.[0]?.versions?.filter(x=>Number(x.percentage)>0);
 if(v?.length!==1||v[0].version_id!==id||Number(v[0].percentage)!==100)throw Error('VERSION_DRIFT_'+name);
 const [meta,body]=await Promise.all([get(cf+'workers/scripts/'+name+'/versions/'+id,ct),get(cf+'workers/workers/'+name+'/versions/'+id+'?include=modules',ct)]);
 const rows=meta.resources?.bindings,mods=body.modules;
 if(!Array.isArray(rows)||!Array.isArray(mods)||!mods.length)throw Error('NO_PINNED_SOURCE_'+name);
 const source=mods.map(m=>({name:m.name,content:Buffer.from(m.content_base64,'base64').toString('utf8')}));
 return {name,id,rows,source,runtime:meta.resources?.script_runtime};
};

const [a,b]=await Promise.all(['soridraw-explore-preview','soridraw-explore-api'].map(n=>fetchWorker([n,pins[n]])));
const pick=(w,n)=>w.rows.find(x=>x.name===n);
const id=x=>x?.namespace_id||x?.id||null;
const flagNames=['SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019','SORIDRAW_NOTIFICATION_RETENTION_013','SORIDRAW_NOTIFICATION_SCHEMA_READY_013','SORIDRAW_CURATED_WRITER_SHADOW471','SORIDRAW_CURATED_SHARED_V466','SORIDRAW_CURATED_ALL_WRITERS_READY466','SORIDRAW_R2_CATALOG_V1','SORIDRAW_R2_HYBRID_READ_V1','SORIDRAW_PUBLICATION_R2_ONLY_READ_V1'];
const flags=w=>Object.fromEntries(flagNames.map(n=>{const x=pick(w,n);return [n,!x?'ABSENT':x.type==='plain_text'&&['0','1'].includes(x.text)?x.text:'OTHER']}));
// Only report known harmless boolean values and resource identities; never
// print environment values, HMACs, token hashes, or secret payloads.
const crons=await Promise.all([a,b].map(async w=>({name:w.name,crons:(await get(cf+'workers/scripts/'+w.name+'/schedules',ct)).schedules.map(x=>x.cron)})));
const endpoints=['privateLikeFinalReceipt416Candidate','publicLikeRelease416Candidate','publicationRelease431Candidate','publicLikeWindowConfig448Candidate'];
const functions=await Promise.all(endpoints.map(async n=>{
 const f=await get(gcp+n,ft,true);return {name:n,state:f?.state||'ABSENT',secretVersion:f?.serviceConfig?.secretEnvironmentVariables?.find(x=>x.key==='SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET')?.version||null};
}));
const secret=await get('https://secretmanager.googleapis.com/v1/projects/soridraw-app-866a5/secrets/SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET',ft,true);
const names=['EXPLORE_LIKE_BATCH_SCHEDULER','RATE_DB','EXPLORE_CACHE','PROFILE_MEDIA','DB'];
const resource=(w,n)=>{const x=pick(w,n);return x?{name:n,type:x.type,namespace:id(x),className:x.class_name||null,script:x.script_name||null,bucket:x.bucket_name||null}:null};
const report={kind:'FULL_RELEASE_RUNTIME_BINDING_PLAN',readOnly:true,crons,flags:{preview:flags(a),production:flags(b)},resources:{preview:names.map(n=>resource(a,n)),production:names.map(n=>resource(b,n))},functions,existingSecretMetadataAccessible:!!secret,existingActionsReleaseSecretAvailable:(process.env.EXISTING_RELEASE_SECRET||'').length>=32,sourceSha:'909a911646b774695b3ae88607d15a79c9ab55b8',cloudWrites:0};
// Preserve existing production settings, no provisioning or secret reads.
// Runtime environment guard inventory (source snippets not printed).
const ls=a.source.find(x=>x.name==='preview-entry.mjs').content.split('\n');
report.previewOnlyEnvGuardLines=ls.flatMap((line,i)=>/SORIDRAW_ENVIRONMENT.*(?:preview|production|test)/.test(line)?[{line:i+1,kind:/notification/i.test(line)?'notification':/follow/i.test(line)?'follow':'other'}]:[]).slice(0,60);
console.log('FULL_RELEASE_RUNTIME_PLAN '+JSON.stringify(report));
