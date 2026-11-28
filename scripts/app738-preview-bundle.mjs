// Static artifact data only. Never execute candidate source on the writer.
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {readFileSync,readdirSync,lstatSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {runHostingWriterCandidate} from './app738-hosting-writer-candidate.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const digest=x=>sha(JSON.stringify(stable(x)));
const fail=x=>{throw Error('APP738_BUNDLE_HOLD_'+x)};
const HEX=/^[a-f0-9]{64}$/,SHA=/^[a-f0-9]{40}$/;
const SITE='soridraw-preview', PREFIX='sites/'+SITE+'/versions/', MAX=160*1024*1024;
const goodPath=p=>typeof p==='string'&&p.startsWith('/')&&p.length<=1024&&p.split('/').slice(1).every(x=>x&&x!=='.'&&x!=='..'&&!/[\x00-\x20\\?#]/.test(x));
export function verifyHostingOnlyTrigger(raw){
 const rows=raw.trim().split(/\r?\n/);
 for(const [k,v] of Object.entries({deploy_hosting:'true',deploy_shared_rtdb_rules:'false',functions_deploy:'false',worker_deploy:'false',release_shared_d1_migration:'false',release_shared_user_data_change:'false',main_test_change:'false',production_change:'false'})){
  if(rows.filter(x=>x.startsWith(k+'=')).length!==1||!rows.includes(k+'='+v))fail('NOT_HOSTING_ONLY_'+k);
 }
}
export function makePreviewBundle({dir,sourceSha,configRaw,triggerRaw}){
 if(!SHA.test(sourceSha||''))fail('SOURCE_SHA');
 verifyHostingOnlyTrigger(triggerRaw);
 const files=[];let size=0;
 function walk(base,relative=''){
  for(const name of readdirSync(base).sort()){
   const abs=join(base,name),path=relative+'/'+name,st=lstatSync(abs);
   if(!goodPath(path)||st.isSymbolicLink())fail('UNSAFE_PATH');
   if(st.isDirectory())walk(abs,path);
   else if(st.isFile()){
    size+=st.size;if(size>MAX||files.length>=25000)fail('ARTIFACT_LIMIT');
    const data=readFileSync(abs);files.push({path,rawSha256:sha(data),data:data.toString('base64')});
   }else fail('NOT_STATIC_FILE');
  }
 }
 if(!lstatSync(dir).isDirectory()||lstatSync(dir).isSymbolicLink())fail('UNSAFE_ROOT');
 walk(dir);
 return JSON.stringify({schema:1,sourceSha,configSha256:sha(configRaw),triggerSha256:sha(triggerRaw),files});
}
export function inspectPreviewBundle({raw,sourceSha,configRaw,triggerRaw}){
 verifyHostingOnlyTrigger(triggerRaw);
 if(typeof raw!=='string'||raw.length>MAX*1.5||!SHA.test(sourceSha||''))fail('ARTIFACT_LIMIT_OR_SOURCE');
 const x=JSON.parse(raw);
 if(x.schema!==1||x.sourceSha!==sourceSha||x.configSha256!==sha(configRaw)||x.triggerSha256!==sha(triggerRaw)||!Array.isArray(x.files)||x.files.length>25000)fail('PROVENANCE_MISMATCH');
 const files=[],blobs=new Map(),seen=new Set();let size=0,indexSha=null,version=null;
 for(const f of x.files){
  if(!goodPath(f?.path)||seen.has(f.path)||!HEX.test(f.rawSha256||'')||typeof f.data!=='string')fail('FILE_IDENTITY');
  const bytes=Buffer.from(f.data,'base64');size+=bytes.length;
  if(size>MAX||bytes.toString('base64')!==f.data||sha(bytes)!==f.rawSha256)fail('FILE_BYTES_MISMATCH');
  seen.add(f.path);const gz=gzipSync(bytes,{level:9}),h=sha(gz);
  blobs.set(h,gz);files.push([f.path,h]);
  if(f.path==='/index.html')indexSha=f.rawSha256;
  if(f.path==='/app-version.json')version=String(JSON.parse(bytes.toString()).version||'');
 }
 if(!indexSha||!version)fail('ENTRYPOINT_REQUIRED');
 files.sort(([a],[b])=>a.localeCompare(b));
 return {files,blobs,filesSha256:digest(files),evidenceSha256:sha(raw),indexSha,version};
}
// Pure orchestration; actual adapter checks hard HOLD before invocation.
export async function stagePreviewVersion({bundle,config,request,upload}){
 const draft=await request('POST','sites/'+SITE+'/versions',{config}),name=draft?.name;
 if(!new RegExp('^'+PREFIX+'[A-Za-z0-9_-]{4,128}$').test(name||'')||draft.status!=='CREATED')fail('VERSION_CREATE_ACK');
 for(let i=0;i<bundle.files.length;i+=1000){
  const batch=bundle.files.slice(i,i+1000),allowed=new Set(batch.map(x=>x[1]));
  const out=await request('POST',name+':populateFiles',{files:Object.fromEntries(batch)});
  const url='https://upload-firebasehosting.googleapis.com/upload/'+name+'/files';
  if(!Array.isArray(out.uploadRequiredHashes)||out.uploadRequiredHashes.some(h=>!allowed.has(h)||!bundle.blobs.has(h)))fail('UPLOAD_HASH_SCOPE');
  if(out.uploadRequiredHashes.length&&out.uploadUrl!==url)fail('UPLOAD_URL_SCOPE');
  for(const h of new Set(out.uploadRequiredHashes))await upload(url+'/'+h,bundle.blobs.get(h));
 }
 const final=await request('PATCH',name+'?updateMask=config,status',{config,status:'FINALIZED'});
 if(final.name!==name||final.status!=='FINALIZED'||digest(final.config)!==digest(config))fail('FINALIZE_ACK');
 return name;
}
export async function runPreviewBundleCandidate({journal,api,bundle,sourceSha,readCurrentPreviewSha,smoke}){
 if(await api.assertExclusiveReleaseAuthority()!==true)fail('LIVE_WRITER_UNVERIFIED');
 const before=await api.snapshotLive(SITE);
 const req={mode:'preview',site:SITE,stageFromBundle:true,sourceSha,filesSha256:bundle.filesSha256,configSha256:before.configSha256,evidenceSha256:bundle.evidenceSha256,before:{version:before.version,release:before.release}};
 const equal=(a,b)=>a.version===b.version&&a.release===b.release;
 return runHostingWriterCandidate({journal,request:req,async execute(){
  if(await readCurrentPreviewSha()!==sourceSha||!equal(await api.live(SITE),before))fail('SOURCE_OR_BASELINE_CHANGED');
  const name=await api.stagePreview(bundle,before.config),staged=await api.snapshotVersion(name);
  if(staged.version!==name||staged.site!==SITE||staged.filesSha256!==req.filesSha256||staged.configSha256!==req.configSha256)fail('STAGED_CONTENT_MISMATCH');
  if(await readCurrentPreviewSha()!==sourceSha||!equal(await api.live(SITE),before))fail('SOURCE_OR_BASELINE_CHANGED');
  const ack=await api.releasePreview(name,'APP738 preview '+sourceSha);
  if(ack.version?.name!==name||!ack.name||ack.name===before.release)fail('RELEASE_ACK_UNVERIFIED');
  return {version:name,release:ack.name};
 },async verify(result,normalized){
  const live=await api.snapshotLive(SITE);
  if(!equal(live,result)||live.filesSha256!==req.filesSha256||live.configSha256!==req.configSha256||await smoke(bundle)!==true)fail('POST_RELEASE_UNVERIFIED');
  return {...live,requestDigest:sha(JSON.stringify(normalized))};
 }});
}
if(process.argv[2]==='pack'){
 const [, , ,dir,sourceSha,output]=process.argv;
 writeFileSync(output,makePreviewBundle({dir,sourceSha,configRaw:readFileSync('firebase.hosting-preview.json','utf8'),triggerRaw:readFileSync('.deploy/preview-app-release.trigger','utf8')}));
}
