// APP518 source-only GitHub D1 controller evidence. Never dispatch a workflow,
// alter a token, or execute SQL. The protected release controller supplies its
// existing GH_TOKEN for read-only repository metadata checks.
import {createHash} from 'node:crypto';
const REPO='andrawing1212/soridraw-music';
const sha40=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const sha64=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export const GITHUB_D1_SOURCE_REFS_518=Object.freeze(['main','preview']);
// Known direct SQL/API entrypoints; inspecting only these is NOT a complete
// proof. The whole executable source namespace digest is pinned below too.
export const GITHUB_D1_SOURCE_PATHS_518=Object.freeze([
 '.deploy/apply-364-shared-d1-cutover.mjs',
 '.github/workflows/cloudflare-explore-preview-release.yml',
 '.github/workflows/cloudflare-explore-shared-d1-release.yml',
 '.github/workflows/soridraw-release-promotion.yml',
]);
const sourceScope=path=>/^(?:\.github\/workflows\/|\.deploy\/|scripts\/|cloudflare\/)/.test(path);
const digest=s=>createHash('sha256').update(s).digest('hex');
const fail=code=>{throw Error(code)};
const validSnapshot=src=>src&&typeof src==='object'
 &&GITHUB_D1_SOURCE_REFS_518.every(ref=>{
  const entry=src[ref];
  return sha40(entry?.commitSha)&&sha64(entry?.sourceScopeSha256)
   &&Array.isArray(entry?.knownD1Paths)
   &&entry.knownD1Paths.length===GITHUB_D1_SOURCE_PATHS_518.length
   &&entry.knownD1Paths.every((p,i)=>p?.path===GITHUB_D1_SOURCE_PATHS_518[i]
    &&sha40(p?.blobSha));
 })&&Object.keys(src).length===GITHUB_D1_SOURCE_REFS_518.length;
export const exactGitHubD1SourceProof518=(signed,live)=>{
 if(!validSnapshot(signed)||!validSnapshot(live))return false;
 return JSON.stringify(signed)===JSON.stringify(live);
};
export const observeGitHubD1Sources518=async({request,token}={})=>{
 if(typeof request!=='function'||typeof token!=='string'||token.length<8)
  fail('HOLD_518_GITHUB_READONLY_CREDENTIALS_MISSING');
 const root='https://api.github.com/repos/'+REPO;
 const get=async path=>{
  if(!/^\/branches\/(?:main|preview)$/.test(path)
   &&!/^\/git\/trees\/[a-f0-9]{40}\?recursive=1$/.test(path))
   fail('HOLD_518_GITHUB_READONLY_PATH_DENIED');
  const response=await request(root+path,{method:'GET',headers:{
   Authorization:'Bearer '+token,
   Accept:'application/vnd.github+json',
  },signal:AbortSignal.timeout(20000)});
  if(!response?.ok)fail('HOLD_518_GITHUB_READONLY_HTTP_UNAVAILABLE');
  return response.json();
 };
 const out={};
 for(const ref of GITHUB_D1_SOURCE_REFS_518){
  const branch=await get('/branches/'+ref);
  const commitSha=branch?.commit?.sha;
  if(!sha40(commitSha))fail('HOLD_518_GITHUB_BRANCH_SHA_UNKNOWN_'+ref);
  const data=await get('/git/trees/'+commitSha+'?recursive=1');
  if(data?.truncated!==false||!Array.isArray(data.tree))
   fail('HOLD_518_GITHUB_TREE_INCOMPLETE_'+ref);
  const paths=new Map(),scope=[];
  for(const item of data.tree){
   if(item?.type!=='blob')continue;
   if(typeof item.path!=='string'||!sha40(item.sha)
     ||paths.has(item.path))fail('HOLD_518_GITHUB_SOURCE_ENTRY_INVALID_'+ref);
   paths.set(item.path,item.sha);
   if(sourceScope(item.path))scope.push(item.path+'\0'+item.sha);
  }
  scope.sort();
  const knownD1Paths=GITHUB_D1_SOURCE_PATHS_518.map(path=>{
   const blobSha=paths.get(path);
   if(!sha40(blobSha))fail('HOLD_518_GITHUB_D1_ENTRYPOINT_UNTRACKED_'+ref);
   return {path,blobSha};
  });
  out[ref]={commitSha,sourceScopeSha256:digest(scope.join('\n')),
   knownD1Paths};
 }
 // A release or workflow change between source reads is not attested.
 for(const ref of GITHUB_D1_SOURCE_REFS_518){
  const after=await get('/branches/'+ref);
  if(after?.commit?.sha!==out[ref].commitSha)
   fail('HOLD_518_GITHUB_CONTROLLER_REF_MOVED_'+ref);
 }
 return out;
};
