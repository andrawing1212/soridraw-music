// APP749 QA584 READ-ONLY diagnosis of failed scoped-CSP release after rollback.
// One GET list + up to 3 GET version details + public HTTP GET. No POST/PATCH.
// Never print OAuth access token, Firebase app config or user data.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const SITE='soridraw-qa-owner-584',PROJECT='soridraw-app';
const API='https://firebasehosting.googleapis.com/v1beta1';
const HOST='https://soridraw-qa-owner-584.web.app';
const versionRe=new RegExp('^sites/'+SITE+'/versions/[a-zA-Z0-9_-]+$');
const project=execFileSync('gcloud',['config','get-value','project'],{
 encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:10000}).trim();
if(project!==PROJECT)throw Error('QA_PROJECT_MISMATCH_STOP');
const token=execFileSync('gcloud',['auth','print-access-token'],{
 encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:10000}).trim();
if(token.length<30)throw Error('QA_AUTH_NOT_READY');
async function get(path){
 if(!path.startsWith('/sites/'+SITE+'/'))throw Error('OUTSIDE_QA_SITE_STOP');
 const response=await fetch(API+path,{method:'GET',redirect:'error',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('QA_API_HTTP_'+response.status);
 return await response.json();
}
const releases=await get('/sites/'+SITE+'/releases?pageSize=8');
if(!Array.isArray(releases.releases))throw Error('QA_RELEASES_UNEXPECTED');
const versions=[...new Set(releases.releases.map(x=>x.version?.name).filter(x=>versionRe.test(x)))].slice(0,3);
if(versions.length<2)throw Error('QA_PREVIOUS_RELEASE_NOT_FOUND');
console.log('APP749_QA_READONLY_ACTIVE_VERSION_SUFFIX='+versions[0].split('/').at(-1));
console.log('APP749_QA_READONLY_RELEASE_HISTORY='+releases.releases.slice(0,4)
 .map(x=>x.version?.name?.split('/').at(-1)).join(','));
const sha=s=>createHash('sha256').update(s).digest('hex').slice(0,14);
for(let i=0;i<versions.length;i++){
 const v=await get('/'+versions[i]);
 const headers=v.config?.headers??[];
 if(!Array.isArray(headers))throw Error('QA_HEADER_FORMAT_UNEXPECTED');
 const rules=[];
 for(let j=0;j<headers.length;j++){
  const rule=headers[j];
  const dict=rule.headers??{};
  const csp=Object.entries(dict).find(([k])=>k.toLowerCase()==='content-security-policy')?.[1];
  if(csp!==undefined)rules.push({index:j,glob:rule.glob??null,regex:rule.regex??null,
    length:String(csp).length,hash:sha(String(csp)),
    hasSelfConnect:/connect-src[^;]*'self'/.test(String(csp)),
    hasAppCheck:String(csp).includes('firebaseappcheck.googleapis.com'),
    hasQaWorker:String(csp).includes('soridraw-owner-qa-583')});
 }
 console.log('APP749_QA_READONLY_VERSION_'+i+' '+JSON.stringify({
  suffix:versions[i].split('/').at(-1),status:v.status,
  created:v.createTime??null,headerRuleCount:headers.length,
  cspRules:rules}));
}
for(const path of ['/','/qa749.html','/qa749.js']){
 const response=await fetch(HOST+path,{method:'GET',redirect:'error',
  headers:{'Cache-Control':'no-store'},signal:AbortSignal.timeout(12000)});
 const body=await response.text();
 const csp=response.headers.get('content-security-policy')||'';
 const cache=response.headers.get('cache-control')||'';
 console.log('APP749_QA_READONLY_LIVE_HTTP '+JSON.stringify({path,status:response.status,
  cspHash:sha(csp),cspLength:csp.length,
  cspHasSelfConnect:/connect-src[^;]*'self'/.test(csp),
  cspHasAppCheck:csp.includes('firebaseappcheck.googleapis.com'),
  bodySha:sha(body),cacheControl:cache.slice(0,110)}));
}
console.log('APP749_QA_READONLY_NO_WRITE=PASS');
