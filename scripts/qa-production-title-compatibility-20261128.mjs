// GET-only production candidate preparation. Never upload or deploy a Worker.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {patchCuratedDirectPublication} from './lib/patch-curated-direct-publication-20261128.mjs';
const account='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const PRE='soridraw-explore-preview',PRO='soridraw-explore-api',OWNER='soridraw-owner-follow-preview-candidate';
const pins={
 [PRE]:'0c437089-d431-4ab4-b872-27029c906048',
 [PRO]:'9257b708-4b76-43fe-9c87-3abe0fb071b7',
 [OWNER]:'c71d7c12-ace4-4405-ab1a-d8c651c90559',
 'soridraw-explore-test':'ddd2255a-75cc-4db9-8905-b47338558cb0',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869'
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const need=(x,m)=>{if(!x)throw Error('READ_ONLY_HOLD_'+m)};
const token=process.env.CLOUDFLARE_API_TOKEN;
const firebase=process.env.FIREBASE_ACCESS_TOKEN;
const core=(s,n)=>{const m=s.modules.find(x=>x.name===n);need(m?.content_base64,'MODULE_'+n);return Buffer.from(m.content_base64,'base64').toString('utf8')};
async function get(path){
 need(/^workers\/(?:scripts\/[^/]+\/(?:deployments\?per_page=1|schedules|versions\/[0-9a-f-]+)|workers\/[^/]+\/versions\/[0-9a-f-]+\?include=modules)$/.test(path),'GET_PATH');
 const r=await fetch(account+path,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 const j=await r.json().catch(()=>null);need(r.ok&&j?.success===true,'CF_GET_'+r.status);
 return j.result;
}
async function checkPins(){
 await Promise.all(Object.entries(pins).map(async([n,id])=>{
  const d=await get('workers/scripts/'+n+'/deployments?per_page=1');
  const v=d?.deployments?.[0]?.versions;
  need(v?.length===1&&v[0].version_id===id&&Number(v[0].percentage)===100,'ACTIVE_DRIFT_'+n);
 }));
}
async function snap(n){
 const id=pins[n];
 const [m,c]=await Promise.all([get('workers/scripts/'+n+'/versions/'+id),get('workers/workers/'+n+'/versions/'+id+'?include=modules')]);
 const bindings=m.resources?.bindings,runtime=m.resources?.script_runtime,modules=c.modules;
 need(m.id===id&&Array.isArray(bindings)&&runtime&&Array.isArray(modules)&&modules.every(x=>x.content_base64)&&new Set(bindings.map(x=>x.name)).size===bindings.length&&new Set(modules.map(x=>x.name)).size===modules.length,'SNAPSHOT_'+n);
 return {bindings,runtime,modules};
}
function productionEquivalent(core){
 const anchor=core.indexOf('SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019');
 need(anchor>=0&&core.indexOf('SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019',anchor+1)===-1,'NOTIFICATION_ANCHOR');
 const leading=core.slice(Math.max(0,anchor-1500),anchor);
 const match=[...leading.matchAll(/^([ \t]*)if\s*\(/gm)].at(-1);
 need(match,'NOTIFICATION_IF');
 const at=Math.max(0,anchor-1500)+match.index;
 const closing=new RegExp('^'+match[1]+'\\}(?:\\r?$|\\s*else\\b)','gm');
 closing.lastIndex=anchor;
 const end=closing.exec(core);
 need(end&&end.index-at<8000,'NOTIFICATION_END');
 const fallback=end.index+match[1].length+1;
 const original=core.slice(at,fallback);
 need(original.includes('validateExploreAuth307')&&original.includes('verifyUid')&&original.includes('verifyAdmin')&&original.includes('ORIGIN_FORBIDDEN'),'AUTH_SCOPE');
 let patch=original;
 const once=(from,to)=>{need(patch.split(from).length===2,'HOST_ANCHOR');patch=patch.replace(from,to)};
 const env=[...patch.matchAll(/env\?\.SORIDRAW_ENVIRONMENT\s*===\s*(['"])preview\1/g)];
 need(env.length===1,'NOTIFICATION_ENV');
 once(env[0][0],"env?.SORIDRAW_ENVIRONMENT === 'production'");
 for(const [a,b] of [['https://preview.soridraw.com','https://soridraw.com'],['https://soridraw-preview.web.app','https://soridraw.web.app'],['https://soridraw-preview.firebaseapp.com','https://soridraw.firebaseapp.com']])once(a,b);
 return core.slice(0,at)+patch+core.slice(fallback);
}
async function receiver(name){
 const r=await fetch('https://cloudfunctions.googleapis.com/v2/projects/soridraw-app-866a5/locations/asia-northeast3/functions/'+name,{method:'GET',headers:{Authorization:'Bearer '+firebase},redirect:'error',signal:AbortSignal.timeout(15000)});
 const f=await r.json().catch(()=>null);
 return {name,http:r.status,active:r.ok&&f?.state==='ACTIVE',revisionKnown:!!f?.serviceConfig?.revision,secretBindingNames:(f?.serviceConfig?.secretEnvironmentVariables||[]).map(x=>x.key).sort()};
}
function refs(s,name){return s.modules.filter(m=>/\.(?:m?js)$/.test(m.name)&&Buffer.from(m.content_base64,'base64').toString('utf8').includes(name)).map(m=>m.name).sort()}
async function main(){
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&process.env.GITHUB_REF==='refs/heads/qa/production-title-compatibility-20261128'&&token&&firebase,'SCOPE');
 await checkPins();
 const [p,d,o,ps,ds]=await Promise.all([snap(PRE),snap(PRO),snap(OWNER),get('workers/scripts/'+PRE+'/schedules'),get('workers/scripts/'+PRO+'/schedules')]);
 const pre=core(p,'preview-entry.mjs'),prod=core(d,'production-main.mjs');
 need(sha(pre)==='bfc1f195228e8fbcb6ed12270315c06b9d58d61c29e860de3f4c1eadda95316c','PRE_CORE_PIN');
 need(sha(prod)==='3e40fefc09f976c560b38b83d9698bd5f36c096e7779258993b702733faa0a48','PROD_CORE_PIN');
 need(!prod.includes('isDirectMusicNotePublication20261128'),'ALREADY_PATCHED');
 const candidate=patchCuratedDirectPublication(prod);
 need(candidate!==prod&&productionEquivalent(pre)===candidate,'EXACT_TITLE_CORE_PARITY');
 const dir=mkdtempSync(join(tmpdir(),'prod-title-'));
 try{
  const file=join(dir,'production-main.mjs');writeFileSync(file,candidate,{mode:0o600});
  const env={PATH:process.env.PATH,HOME:process.env.HOME};
  execFileSync(process.execPath,['--check',file],{env,stdio:'inherit'});
  execFileSync(process.execPath,['--input-type=module','-e',"import {readFileSync} from 'node:fs'; import {verifyCuratedDirectPublicationRouting as verify} from './scripts/lib/verify-curated-direct-publication-routing-20261128.mjs'; await verify(readFileSync(process.argv[1],'utf8'));",file],{env,stdio:'inherit',timeout:60000});
 }finally{rmSync(dir,{recursive:true,force:true})}
 const moduleHashes=d.modules.map(m=>({name:m.name,sha256:m.name==='production-main.mjs'?sha(candidate):sha(Buffer.from(m.content_base64,'base64'))}));
 console.log(JSON.stringify({titleCandidate:'PASS_LOCAL_EXACT_SOURCE',rollback:pins[PRO],previewCoreSha:sha(pre),productionOldCoreSha:sha(prod),productionCandidateCoreSha:sha(candidate),onlyChangedModule:'production-main.mjs',moduleHashes,cloudUpload:false},null,2));
 const pm=new Map(p.bindings.map(b=>[b.name,b])),dm=new Map(d.bindings.map(b=>[b.name,b])),om=new Map(o.bindings.map(b=>[b.name,b]));
 const groups={
  follow:['SORIDRAW_OWNER_FOLLOW_AUTH_PROOF_547','SORIDRAW_OWNER_FOLLOW_BIND_544','SORIDRAW_OWNER_FOLLOW_CANARY_UID_574','SORIDRAW_OWNER_FOLLOW_ENDPOINT_539','SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544','SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653','SORIDRAW_OWNER_FOLLOW_HMAC_539','SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653','SORIDRAW_PUBLIC_FOLLOW_ENDPOINT_669','SORIDRAW_PUBLIC_FOLLOW_READY_669','SORIDRAW_PUBLIC_FOLLOW_SCOPE_669'],
  notification:['SORIDRAW_NOTIFICATION_RETENTION_013'],
  cache:['EXPLORE_CACHE','RATE_DB'],
  identity:['BOOTSTRAP_TOKEN','ENV_NAME','PROD_BASE','TARGET_BASE']
 };
 const expected=Object.values(groups).flat().sort(),missing=[...pm.keys()].filter(n=>!dm.has(n)).sort();
 need(isDeepStrictEqual(expected,missing)&&pm.size===41&&dm.size===27,'BINDING_INVENTORY_DRIFT');
 const shared=['DB','PROFILE_MEDIA'].every(n=>isDeepStrictEqual(pm.get(n),dm.get(n)));need(shared,'SHARED_CANONICAL_DRIFT');
 const on=(m,n)=>m.get(n)?.type==='plain_text'&&m.get(n)?.text==='1';
 const required=['SORIDRAW_OWNER_FOLLOW_PRODUCTION_797','SORIDRAW_OWNER_FOLLOW_W2_PUSH_555','SORIDRAW_OWNER_DO_STANDALONE_600','SORIDRAW_OWNER_FOLLOW_BRIDGE_READY_607','SORIDRAW_OWNER_FOLLOW_RECEIVER_VERIFIED_607','SORIDRAW_PUBLIC_FOLLOW_UNENROLLED_680'];
 const flagChecks=Object.fromEntries(required.map(n=>[n,on(dm,n)]));
 const forward=dm.get('OWNER_FOLLOW_RESERVATION_SERVICE_600'),pf=pm.get('OWNER_FOLLOW_RESERVATION_SERVICE_600'),reverse=om.get('OWNER_FOLLOW_CANONICAL_REPLAY_600');
 const followConnection=forward?.type==='service'&&forward.service===OWNER&&pf?.service===OWNER&&forward.environment===pf.environment&&reverse?.service===PRE&&reverse.entrypoint==='OwnerFollowReplayEntrypoint607'&&dm.get('SORIDRAW_OWNER_DO_BRIDGE_SECRET_600')?.type==='secret_text';
 const wrapper=core(d,'production-follow-797.mjs'),entry=core(d,'entry.mjs');
 const functions=await Promise.all(['verifyExploreFollowActor713','publishExploreOwnerFollower542','enrollOwnerFollow544Candidate','verifyOwnerFollowEpoch547Candidate','publishExplorePublicFollow669','revokePublicFollowOnAuthDelete669'].map(receiver));
 const retention=on(pm,'SORIDRAW_NOTIFICATION_RETENTION_013')&&['SORIDRAW_NOTIFICATION_SCHEMA_READY_013','SORIDRAW_NOTIFICATION_INBOX_READ_ONLY_019'].every(n=>on(pm,n)&&on(dm,n))&&isDeepStrictEqual(ps.schedules?.map(x=>x.cron),['37 * * * *'])&&ds.schedules?.length===0;
 const cacheFallback=/(?:env\?\.EXPLORE_CACHE|env\.EXPLORE_CACHE)\s*\|\|\s*(?:env\?\.PROFILE_MEDIA|env\.PROFILE_MEDIA)/.test(prod);
 console.log(JSON.stringify({bindingCompatibility:'SOURCE_AND_LIVE_METADATA_REVIEW_ONLY',counts:{preview:pm.size,production:dm.size,missing:missing.length},sharedCanonical:shared,
  groups:Object.fromEntries(Object.entries(groups).map(([k,names])=>[k,names.map(n=>({name:n,type:pm.get(n)?.type,previewModuleReferences:refs(p,n),productionModuleReferences:refs(d,n),ownerModuleReferences:refs(o,n)}))])),
  follow:{flagChecks,serviceRouteMatches:followConnection,productionWrapperScopePresent:wrapper.includes('productionFollowScope797')&&wrapper.includes('publicWithoutEpoch'),entryUsesWrapper:entry.includes('composeProductionFollow797'),functions,authenticatedFollowAndRtdbNotRun:true},
  notification:{singleRetentionOwnerConfiguration:retention,productionOriginInCore:prod.includes('https://soridraw.com'),authenticatedInboxNotRun:true},
  cache:{profileMediaFallbackInCore:cacheFallback,productionRateLimiterType:dm.get('LIKE_RATE_LIMITER')?.type||null,actualBillingNotMeasured:true},
  identity:{preview:pm.get('SORIDRAW_ENVIRONMENT')?.text==='preview',production:dm.get('SORIDRAW_ENVIRONMENT')?.text==='production',secretValuesNotReadOrLogged:true},
  productionLegacyServicesPreserved:['EXPLORE_MIRROR_PREVIEW','EXPLORE_MIRROR_TEST'].every(n=>dm.get(n)?.type==='service'),
  releaseGate:'HOLD_UNTIL_REVIEWED_AUTHENTICATED_FEATURE_COST_AND_ROLLBACK_EVIDENCE'},null,2));
 await checkPins();
 console.log('PRODUCTION_TITLE_CANDIDATE_AND_BINDING_REVIEW=PASS_READ_ONLY;CLOUD_UPLOAD=0;CLOUD_WRITE=0;LIVE_DEPLOY=0;RELEASE=HOLD');
}
main().catch(e=>{console.error(String(e?.message||e).slice(0,350));process.exitCode=1});
