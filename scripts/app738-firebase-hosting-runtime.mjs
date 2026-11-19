// APP738: exact Firebase Hosting version snapshot, no mutable "latest" fallback.
// Strictly restricted to the two existing SORIDRAW Hosting sites.
// The GET-only mode never reads user data or mutates any backend.
import {createHash} from 'node:crypto';
const BASE='https://firebasehosting.googleapis.com/v1beta1/';
export const SITES=Object.freeze({preview:'soridraw-preview',production:'soridraw'});
const PATTERN=/^sites\/(soridraw-preview|soridraw)\/versions\/[A-Za-z0-9_-]{4,128}$/;
const fail=(why)=>{throw Error('APP738_HOSTING_HOLD_'+why)};
const sha=(text)=>createHash('sha256').update(text).digest('hex');
const stable=(v)=>Array.isArray(v)?v.map(stable):
  v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,stable(x)])):v;
const digest=(value)=>sha(JSON.stringify(stable(value)));
function requireSite(site){
 if(site!==SITES.preview&&site!==SITES.production)fail('FOREIGN_SITE');
 return site;
}
function requireVersion(name,site){
 if(!PATTERN.test(name)||!name.startsWith('sites/'+requireSite(site)+'/versions/'))
   fail('VERSION_SITE_MISMATCH');
 return name;
}
export function createApp738HostingApi(token,{send=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(typeof token!=='string'||!token.trim())fail('FIREBASE_TOKEN_MISSING');
 async function request(method,path,body){
  if(!/^(sites\/(soridraw-preview|soridraw)\/(channels\/live\/releases|versions\/[A-Za-z0-9_-]{4,128}(?:\/files)?|versions:clone|releases)|projects\/soridraw\/operations\/[A-Za-z0-9_-]+)(?:\?.*)?$/.test(path))
    fail('FOREIGN_RESOURCE_OR_OPERATION');
  if(method!=='GET'&&method!=='POST')fail('HTTP_METHOD_FORBIDDEN');
  if(method==='POST'&&!(/^(sites\/soridraw\/versions:clone|sites\/soridraw\/releases\?versionName=)/.test(path)))
    fail('NONPRODUCTION_WRITE_FORBIDDEN');
  const result=await send(BASE+path,{
    method,headers:{
      Authorization:'Bearer '+token,
      'Content-Type':'application/json',
      'Cache-Control':'no-store',
    },
    ...(method==='POST'?{body:JSON.stringify(body||{})}:{}),
    redirect:'error',
  });
  if(!result?.ok)fail('API_'+method+'_HTTP_'+String(result?.status||'UNKNOWN'));
  const data=await result.json();
  if(!data||typeof data!=='object'||data.error)fail('API_RESPONSE_INVALID');
  return data;
 }
 async function live(site){
  requireSite(site);
  const data=await request('GET','sites/'+site+'/channels/live/releases?pageSize=1');
  const row=data.releases?.[0];
  if(!row?.name||!row?.version?.name)fail('LIVE_RELEASE_UNVERIFIED_'+site);
  return {site,release:row.name,version:requireVersion(row.version.name,site)};
 }
 async function snapshotVersion(name){
  if(!PATTERN.test(name))fail('FOREIGN_VERSION');
  const site=name.split('/')[1];
  const info=await request('GET',name);
  if(info.name!==name||info.status!=='FINALIZED'||!info.config)
    fail('VERSION_NOT_FINALIZED_OR_CONFIG_UNVERIFIED');
  let rows=[],page='',pages=0;
  do{
    if(++pages>50)fail('FILES_PAGINATION_LIMIT');
    const path=name+'/files?pageSize=1000'+(page?'&pageToken='+encodeURIComponent(page):'');
    const resp=await request('GET',path);
    if(!Array.isArray(resp.files))fail('VERSION_FILES_NOT_LISTED');
    rows.push(...resp.files.map(f=>{
      if(typeof f.path!=='string'||!f.path.startsWith('/')||
         typeof f.hash!=='string'||f.hash.length<32||f.status!=='ACTIVE')
        fail('VERSION_FILE_INVALID_OR_NOT_ACTIVE');
      return [f.path,f.hash];
    }));
    page=String(resp.nextPageToken||'');
  }while(page);
  if(rows.length===0||rows.length>25000||new Set(rows.map(x=>x[0])).size!==rows.length)
    fail('VERSION_FILE_COUNT_OR_DUPLICATE');
  if(info.fileCount!==undefined&&Number(info.fileCount)!==rows.length)
    fail('VERSION_FILECOUNT_METADATA_DRIFT');
  rows.sort(([a],[b])=>a.localeCompare(b));
  return {site,version:name,assetCount:rows.length,filesSha256:digest(rows),
    configSha256:digest(info.config),
    config:info.config,versionBytes:info.versionBytes||null};
 }
 async function snapshotLive(site){
  const release=await live(site);
  const detail=await snapshotVersion(release.version);
  if(detail.site!==site)fail('LIVE_VERSION_SITE_MISMATCH');
  const again=await live(site);
  if(again.version!==release.version||again.release!==release.release)
    fail('LIVE_CHANGED_DURING_SNAPSHOT');
  return {...detail,release:release.release};
 }
 async function clone(sourceVersion){
  requireVersion(sourceVersion,SITES.preview);
  const op=await request('POST','sites/soridraw/versions:clone',{
    sourceVersion,finalize:true,
  });
  if(typeof op.name!=='string'||!/^projects\/soridraw\/operations\/[A-Za-z0-9_-]+$/.test(op.name))
    fail('CLONE_OPERATION_IDENTITY');
  let result=op;
  for(let n=0;!result.done&&n<24;n++){
    await sleep(1500);
    result=await request('GET',op.name);
  }
  if(!result.done||result.error)fail('CLONE_OPERATION_NOT_FINALIZED');
  const name=result.response?.name;
  requireVersion(name,SITES.production);
  return name;
 }
 async function release(version,message){
  requireVersion(version,SITES.production);
  if(typeof message!=='string'||!/^APP738 direct PREVIEW [0-9a-f]{40} rollback=[A-Za-z0-9_-]{4,128}$/.test(message)&&
     !/^APP738 rollback to [A-Za-z0-9_-]{4,128}$/.test(message))
    fail('RELEASE_MESSAGE_INVALID');
  const path='sites/soridraw/releases?versionName='+encodeURIComponent(version);
  const out=await request('POST',path,{message});
  if(out.version?.name!==version||!out.name?.startsWith('sites/soridraw/releases/'))
    fail('RELEASE_ACK_UNVERIFIED');
  return out;
 }
 return {live,snapshotLive,snapshotVersion,clone,release};
}
export function compareHostingArtifacts(source,candidate){
 if(source?.site!==SITES.preview||candidate?.site!==SITES.production)
   fail('ARTIFACT_SITE_WRONG');
 const assetsMatch=source.assetCount===candidate.assetCount &&
  source.filesSha256===candidate.filesSha256;
 const configMatch=source.configSha256===candidate.configSha256;
 return {assetsMatch,configMatch,
   sourceFiles:source.assetCount,targetFiles:candidate.assetCount,
   sourceConfigSha256:source.configSha256,targetConfigSha256:candidate.configSha256,
   filesSha256:source.filesSha256};
}
