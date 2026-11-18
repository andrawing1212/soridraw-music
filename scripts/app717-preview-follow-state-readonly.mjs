// APP717: GET-only active PREVIEW Worker contract inspection, zero user-data access.
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {followStateCandidate717,followStateOld717} from
 '../cloudflare/explore-worker/candidates/717-follow-state-target-postread.mjs';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const NAMES=['soridraw-explore-preview','soridraw-explore-test',
 'soridraw-explore-api','soridraw-owner-follow-preview-candidate'];
const sha=s=>createHash('sha256').update(s).digest('hex');
const need=(v,k)=>{if(!v)throw Error('APP717_LIVE_HOLD_'+k)};
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
need(process.env.GITHUB_ACTIONS==='true'&&
 process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&
 process.env.GITHUB_EVENT_NAME==='pull_request'&&
 process.env.GITHUB_HEAD_REF==='candidate/follow-state-r2-read-717'&&
 process.env.GITHUB_BASE_REF==='preview'&&
 process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER==='1211'&&
 process.env.CLOUDFLARE_ACCOUNT_ID===ACCOUNT&&token.length>=24,'SCOPE_OR_CREDENTIALS');
async function get(path){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,{
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  method:'GET',signal:AbortSignal.timeout(30000)
 });
 const j=await r.json().catch(()=>null);
 need(r.ok&&j?.success===true,'CLOUDFLARE_GET_'+r.status);
 return j.result;
}
async function deployment(name){
 const d=await get('workers/scripts/'+name+'/deployments?per_page=1');
 const v=d?.deployments?.[0]?.versions||[];
 need(v.length===1&&Number(v[0].percentage)===100&&
  /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(v[0].version_id||''),'ACTIVE_SPLIT_'+name);
 return v[0].version_id;
}
const versions={};
for(const name of NAMES)versions[name]=await deployment(name);
const active=versions[NAMES[0]];
const [meta,source]=await Promise.all([
 get('workers/scripts/'+NAMES[0]+'/versions/'+active),
 get('workers/workers/'+NAMES[0]+'/versions/'+active+'?include=modules')
]);
need(meta?.id===active,'WRONG_ACTIVE_METADATA');
const bindings=meta?.resources?.bindings||[],modules=source?.modules||[];
need(bindings.length>=5&&bindings.length<=100&&modules.length>0&&modules.length<=64,
 'LIVE_INVENTORY');
const b=new Map(bindings.map(x=>[x.name,x]));
need(b.size===bindings.length,'DUPLICATE_BINDING');
need(b.get('SORIDRAW_ENVIRONMENT')?.text==='preview','ENVIRONMENT');
need(b.get('DB')?.type==='d1'&&
 String(b.get('DB')?.id||b.get('DB')?.database_id)==='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b',
 'D1_SHARED_ID');
need(b.get('RATE_DB')?.type==='d1'&&
 String(b.get('RATE_DB')?.id||b.get('RATE_DB')?.database_id)==='aaaa0fd9-1f34-4c97-9a41-11ef75d31f0f',
 'D1_RATE_ID');
need(b.get('PROFILE_MEDIA')?.type==='r2_bucket'&&
 b.get('PROFILE_MEDIA')?.bucket_name==='soridraw-profile-media','R2_SHARED');
need(b.get('EXPLORE_CACHE')?.type==='r2_bucket'&&
 b.get('EXPLORE_CACHE')?.bucket_name==='soridraw-profile-media-preview','R2_PREVIEW');
need(/^202[0-9]-\d\d-\d\d$/.test(meta?.resources?.script_runtime?.compatibility_date||''),
 'RUNTIME_MISSING');
need(modules.every(m=>typeof m.name==='string'&&typeof m.content_base64==='string'&&
 m.content_base64.length>0)&&new Set(modules.map(m=>m.name)).size===modules.length,
 'SOURCE_INVENTORY');
const print=ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed});
const expectedAst=ts.createSourceFile('old.js',followStateOld717,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const expectedNode=expectedAst.statements.find(n=>ts.isFunctionDeclaration(n)&&
 n.name?.text==='readFollowStateSnapshot354');
need(expectedNode&&expectedAst.parseDiagnostics.length===0,'EXPECTED_AST_INVALID');
const expectedPrinted=print.printNode(ts.EmitHint.Unspecified,expectedNode,expectedAst);
const found=[];
for(const m of modules){
 const original=Buffer.from(m.content_base64,'base64').toString('utf8');
 if(!original.includes('readFollowStateSnapshot354'))continue;
 const parsed=ts.createSourceFile(m.name,original,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 need(parsed.parseDiagnostics.length===0,'LIVE_MODULE_PARSE_'+m.name);
 const fns=parsed.statements.filter(n=>ts.isFunctionDeclaration(n)&&
  n.name?.text==='readFollowStateSnapshot354');
 need(fns.length<=1,'FUNCTION_DUPLICATE_'+m.name);
 if(fns.length===1){
  const fn=fns[0];
  const equivalent=print.printNode(ts.EmitHint.Unspecified,fn,parsed)===expectedPrinted;
  // No code bytes or sensitive bindings are printed.
  console.log('APP717_ACTIVE_FUNCTION_AST='+JSON.stringify({
   module:m.name,ASTEquivalent:equivalent,bytes:fn.end-fn.pos,
  }));
  if(equivalent){
   const patched=original.slice(0,fn.getStart(parsed))+
    followStateCandidate717+original.slice(fn.end);
   found.push({module:m.name,beforeHash:sha(original),afterHash:sha(patched),
    bytes:Buffer.byteLength(original)});
  }
 }
}
need(await deployment(NAMES[0])===active,'CONCURRENT_RELEASE');
console.log('APP717_ACTIVE_PREVIEW='+active);
console.log('APP717_ACTIVE_TEST='+versions[NAMES[1]]);
console.log('APP717_ACTIVE_PRODUCTION='+versions[NAMES[2]]);
console.log('APP717_ACTIVE_OWNER='+versions[NAMES[3]]);
console.log('APP717_ACTIVE_MODULE_COUNT='+modules.length);
console.log('APP717_ACTIVE_MODULE_NAMES='+modules.map(m=>m.name).sort().join(','));
console.log('APP717_EXACT_PATCHABLE='+JSON.stringify(found));
// Read-only diagnostics: report identifiers, never print actual module bytes or secrets.
if(found.length!==1){
 for(const m of modules){
  const v=Buffer.from(m.content_base64,'base64').toString('utf8');
  const count=id=>v.split(id).length-1;
  const keys=['readFollowStateSnapshot354','handleFollowState','readFollowIntent354',
   'readFollowProfile354','readEffectiveFollowMembership348','follow-state'];
  const foundIds=Object.fromEntries(keys.map(x=>[x,count(x)]));
  if(Object.values(foundIds).some(Boolean)){
   const idx=v.indexOf('readFollowStateSnapshot354');
   console.log('APP717_MODULE_DIAGNOSTIC='+JSON.stringify({
    module:m.name,size:v.length,identifiers:foundIds,
    // Source signature only, trimmed to 300 chars; no contents or credentials.
    functionShape:idx<0?'not-present':v.slice(Math.max(0,idx-30),idx+270).replace(/\s+/g,' ').slice(0,300),
   }));
  }
 }
}
need(found.length===1,'FUNCTION_NOT_EXACT_ACTIVE_SOURCE');
console.log('APP717_LIVE_READONLY_EXACT_FUNCTION=PASS');
console.log('APP717_DATA_READ_WRITE=0;CLOUDFLARE_MUTATIONS=0');
