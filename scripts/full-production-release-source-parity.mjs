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
const workers=Object.fromEntries((await Promise.all(Object.entries(pins).map(fetchWorker))).map(x=>[x.name,x]));
const a=workers['soridraw-explore-preview'],b=workers['soridraw-explore-api'];
const mediaA=workers['soridraw-media-preview'],mediaB=workers['soridraw-media'];
const getRow=(w,n)=>w.rows.find(r=>r.name===n);
const lines=w=>w.source.flatMap(m=>m.content.split('\n'));
const featureRoutes=['/v1/me/likes/batch','/v1/public-like-release-manifest-416','/v1/publication-live-card','/v1/me/notifications/inbox','/v1/internal/private-like-handoff-416','/v1/internal/public-like-release-416'];
const symbols=['COMMON_PUBLIC_LIKE_WINDOW_ACTIVE_448','STAGE416_SHARED_D1_INTAKE_ACTIVE','STAGE416_SIGNED_PRIVATE_HANDOFF_ACTIVE','STAGE416_PUBLIC_FIVE_MINUTE_ACTIVE','NOTIFICATION_PREVIEW_INBOX_019_COMPILED_OPEN','publishPublicationInvalidation431','releaseDueCommonPublicLikeWindow448','handleFollowOverlay354','repairFollowProfile354','readFollowStateSnapshot354','validateExploreAuth307'];
const summarize=w=>{
 const ls=lines(w);
 return {name:w.name,id:w.id,moduleHashes:w.source.map(m=>({name:m.name,sha256:sha(m.content)})),
 routes:featureRoutes.map(route=>({route,occurrences:ls.filter(l=>l.includes(route)).length})),
 symbols:symbols.map(symbol=>({symbol,occurrences:ls.filter(l=>l.includes(symbol)).length,booleanDeclaration:ls.map(l=>l.match(new RegExp('(?:const|let|var)\\s+'+symbol+'\\s*=\\s*(true|false)\\b'))?.[1]).filter(Boolean)})),
 missingBindingUse:[],runtimeDate:w.runtime?.compatibility_date};
};
const differences=a.rows.filter(x=>!getRow(b,x.name)).map(row=>{
 const all=a.source.flatMap(m=>m.content.split('\n').flatMap((l,i)=>l.includes(row.name)?[{module:m.name,line:i+1}]:[]));
 return {name:row.name,type:row.type,previewReferences:all.length,locations:all.slice(0,8),productionReferences:lines(b).filter(l=>l.includes(row.name)).length};
});
const fnNames=['privateLikeFinalReceipt416Candidate','privateLikeFinalReceipt416Production','publicLikeRelease416Candidate','publicLikeRelease416Production','publicationRelease431Candidate','publicationRelease431Production','enrollOwnerFollow544Candidate'];
const functions=await Promise.all(fnNames.map(async name=>{
 const f=await get(gcp+name,ft,true);if(!f)return {name,exists:false};
 return {name,exists:true,state:f.state,entryPoint:f.buildConfig?.entryPoint,secretBindings:(f.serviceConfig?.secretEnvironmentVariables||[]).map(x=>x.key),environmentKeys:Object.keys(f.serviceConfig?.environmentVariables||{}).filter(k=>/SORIDRAW/.test(k)).sort()};
}));
const sites=[['soridraw-preview','57ecd3f35da8659b'],['soridraw','aad8597799015e70']];
const configs=await Promise.all(sites.map(async([site,id])=>{
 const l=await get(hosting+'sites/'+site+'/channels/live/releases?pageSize=1',ft);
 if(l.releases?.[0]?.version?.name!=='sites/'+site+'/versions/'+id)throw Error('HOSTING_DRIFT_'+site);
 const x=await get(hosting+'sites/'+site+'/versions/'+id,ft);
 return {site,id,config:x.config||{}};
}));
const configDiff=Object.keys({...configs[0].config,...configs[1].config}).filter(k=>!isDeepStrictEqual(configs[0].config[k],configs[1].config[k]));
const mediaSymbols=['catalogAuthorityPolicy518','catalogSharedWriterRolloutGate518','catalogCutoverOutbox','CATALOG','catalogJournal','catalog-journal','/catalog','/media'];
const media=[mediaA,mediaB].map(w=>({name:w.name,id:w.id,moduleHashes:w.source.map(m=>({name:m.name,sha256:sha(m.content)})),symbols:mediaSymbols.map(symbol=>({symbol,occurrences:lines(w).filter(l=>l.includes(symbol)).length})),sharedCatalog:!!getRow(w,'CATALOG'),mediaBinding:!!getRow(w,'MEDIA')}));
const report={kind:'FULL_RELEASE_ACTUAL_SOURCE_GAPS',readOnly:true,source:'909a911646b774695b3ae88607d15a79c9ab55b8',explore:[summarize(a),summarize(b)],bindingUse:differences,functions,media,hostingConfigChangedKeys:configDiff,hostingConfigDetails:configs.map(x=>({site:x.site,configKeys:Object.keys(x.config),headerRuleCount:x.config.headers?.length||0,rewritesCount:x.config.rewrites?.length||0})),sameCanonicalDB:!!getRow(a,'DB')&&isDeepStrictEqual(getRow(a,'DB'),getRow(b,'DB')),sameProfileMedia:!!getRow(a,'PROFILE_MEDIA')&&isDeepStrictEqual(getRow(a,'PROFILE_MEDIA'),getRow(b,'PROFILE_MEDIA')),newResources:0,serverMutations:0,productionDeploy:false};
console.log('FULL_RELEASE_GAPS '+JSON.stringify(report));
