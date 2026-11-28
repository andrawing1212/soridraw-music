// APP738 source-only common Hosting writer preparation. No cloud auth or
// live Hosting transport is wired here. Existing real APP738 HOLD is unchanged.
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const REPO='andrawing1212/soridraw-music';
const REPO_ID='1188157610', OWNER_ID='268937716';
const WORKFLOW=REPO+'/.github/workflows/app738-direct-hosting-promotion.yml@refs/heads/main';
const ENV='hosting-writer';
const REF='refs/heads/hosting-release-journal';
const SHA=/^[0-9a-f]{40}$/, DIGEST=/^[0-9a-f]{64}$/;
const fail=x=>{throw Error('APP738_WRITER_HOLD_'+x)};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

// Configuration candidate only; no provider, IAM binding or key is created.
// Pin the reviewed controller SHA at cutover, not an arbitrary branch input.
export function buildHostingWifPlan({projectNumber,controllerSha}={}){
 if(!/^[1-9][0-9]{5,19}$/.test(String(projectNumber||''))||
    ['1083981050742'].includes(String(projectNumber))||!SHA.test(controllerSha||''))
   fail('UNVERIFIED_HOSTING_PROJECT_OR_CONTROLLER');
 const pool='soridraw-hosting-github',provider='app738-writer';
 const checks={
  repository:REPO,repository_id:REPO_ID,repository_owner_id:OWNER_ID,
  ref:'refs/heads/main',workflow_ref:WORKFLOW,workflow_sha:controllerSha,
  event_name:'workflow_dispatch',environment:ENV,runner_environment:'github-hosted',
 };
 return {status:'CONFIGURATION_CANDIDATE_ONLY',projectId:'soridraw',
  projectNumber:String(projectNumber),pool,provider,
  issuer:'https://token.actions.githubusercontent.com',
  attributeMapping:{'google.subject':'assertion.sub','attribute.repository_id':'assertion.repository_id'},
  attributeCondition:Object.entries(checks).map(([k,v])=>"assertion."+k+" == '"+v+"'").join(' && '),
  principalSet:'principalSet://iam.googleapis.com/projects/'+projectNumber+
   '/locations/global/workloadIdentityPools/'+pool+'/attribute.repository_id/'+REPO_ID,
  serviceAccount:'soridraw-hosting-writer@soridraw.iam.gserviceaccount.com',
  workloadIdentityProvider:'projects/'+projectNumber+'/locations/global/workloadIdentityPools/'+pool+'/providers/'+provider,
  serviceAccountRole:'roles/iam.workloadIdentityUser',tokenLifetime:'600s',
  requiredEnvironment:ENV,checks,liveAuthorityVerified:false};
}

// A request specifies a fixed operation, not a shell command or arbitrary URL.
// The existing APP738 feature/approval gate must still be used for production.
export function normalizeHostingRequest(x={}){
 const mode=x.mode;
 const sites={preview:'soridraw-preview',production:'soridraw',rollback:'soridraw'};
 if(!Object.hasOwn(sites,mode)||x.site!==sites[mode])fail('DESTINATION_MISMATCH');
 if(!SHA.test(x.sourceSha||'')||!DIGEST.test(x.filesSha256||'')||
    !DIGEST.test(x.configSha256||'')||!DIGEST.test(x.evidenceSha256||''))
   fail('ARTIFACT_IDENTITY_REQUIRED');
 if(mode!=='preview'&&x.approval!==(mode==='production'?'DEPLOY_PRODUCTION':'ROLLBACK_PRODUCTION'))
   fail('DIRECTOR_APPROVAL_REQUIRED');
 if(!validRelease(x.before,sites[mode]))fail('ROLLBACK_BASELINE_REQUIRED');
 return {mode,site:sites[mode],sourceSha:x.sourceSha,filesSha256:x.filesSha256,
  configSha256:x.configSha256,evidenceSha256:x.evidenceSha256,
  approval:mode==='preview'?null:x.approval,
  before:{version:x.before.version,release:x.before.release}};
}
function validRelease(x,site){
 return !!x&&typeof x.version==='string'&&typeof x.release==='string'&&
  new RegExp('^sites/'+site+'/versions/[A-Za-z0-9_-]{4,128}$').test(x.version)&&
  new RegExp('^sites/'+site+'/(?:channels/live/)?releases/[A-Za-z0-9_-]+$').test(x.release);
}

// Durable journal adapter: a dedicated already-initialized Git branch holds
// append-only metadata (no secrets, source files or user data).
// A unique child of the observed parent is pushed without force. Two
// competing children cannot both fast-forward the same branch. Unknown push
// outcomes stop the caller; no retry/force/reset/deletion/timeout unlock.
// Not called by any live workflow in this candidate.
export function createHostingJournal({cwd}={}){
 if(typeof cwd!=='string'||!cwd)fail('JOURNAL_WORKSPACE_REQUIRED');
 const git=(args,input)=>execFileSync('git',args,{cwd,input,encoding:'utf8',
  timeout:20000,stdio:[input===undefined?'ignore':'pipe','pipe','pipe']}).trim();
 const read=()=>{
  const line=git(['ls-remote','--exit-code','origin',REF]).split(/\s+/);
  if(line.length!==2||!SHA.test(line[0])||line[1]!==REF)fail('JOURNAL_REF_INVALID');
  const sha=line[0];
  git(['fetch','--no-tags','origin',sha]);
  const state=JSON.parse(git(['show','-s','--format=%B',sha]));
  if(state?.schema!==1||!['idle','pending'].includes(state.phase)||
    (state.phase==='pending'&&(!state.attempt||!DIGEST.test(state.requestDigest||''))))
   fail('JOURNAL_STATE_INVALID');
  return {sha,state};
 };
 return {read,compareAppend(expected,state){
  if(!SHA.test(expected||''))fail('JOURNAL_PARENT_INVALID');
  if(read().sha!==expected)fail('JOURNAL_CONCURRENT_UPDATE');
  const tree=git(['rev-parse',expected+'^{tree}']);
  const next=git(['-c','user.name=APP738 journal','-c','user.email=app738@invalid.local',
   'commit-tree',tree,'-p',expected],JSON.stringify({...state,nonce:randomUUID()})+'\n');
  if(!SHA.test(next)||next===expected)fail('JOURNAL_CHILD_INVALID');
  // Git rejects non-fast-forward sibling updates at the remote.
  git(['push','--porcelain','origin',next+':'+REF]);
  if(read().sha!==next)fail('JOURNAL_ACK_UNVERIFIED');
  return next;
 }};
}

// Offline transaction coordinator. A pending journal survives runner death.
// Never clear it in finally, on a failed/unknown operation or on timeout.
// Future trusted workflow must wire authenticated transport and separately
// reviewed reconciliation; current real adapter remains permanently HOLD.
export async function runHostingWriterCandidate({journal,request,execute,verify}={}){
 const req=normalizeHostingRequest(request);
 if(!journal||typeof journal.read!=='function'||typeof journal.compareAppend!=='function'||
   typeof execute!=='function'||typeof verify!=='function')fail('WRITER_COMPONENT_MISSING');
 const start=await journal.read();
 if(start.state?.schema!==1||start.state.phase!=='idle')fail('PENDING_OR_UNKNOWN_ATTEMPT');
 const attempt=randomUUID(),requestDigest=hash(req);
 const pending={schema:1,phase:'pending',attempt,requestDigest,request:req};
 const owned=await journal.compareAppend(start.sha,pending);
 const locked=await journal.read();
 if(locked.sha!==owned||locked.state?.attempt!==attempt||
   locked.state?.requestDigest!==requestDigest||locked.state?.phase!=='pending')
   fail('JOURNAL_OWNERSHIP_UNVERIFIED');
 const result=await execute(Object.freeze({...req,before:Object.freeze({...req.before})}));
 const observed=await verify(result,req);
 if(!validRelease(observed,req.site)||observed.release===req.before.release||
   observed.filesSha256!==req.filesSha256||observed.configSha256!==req.configSha256||
   observed.requestDigest!==requestDigest)
   fail('OUTCOME_UNVERIFIED');
 const end=await journal.read();
 if(end.sha!==owned||end.state?.attempt!==attempt)fail('JOURNAL_OWNERSHIP_LOST');
 await journal.compareAppend(owned,{schema:1,phase:'idle',lastAttempt:attempt,
   requestDigest,result:{version:observed.version,release:observed.release}});
 return {status:'CANDIDATE_TRANSACTION_VERIFIED',attempt,site:req.site,
  release:observed.release,liveAuthorityVerified:false};
}
