// APP738 source-only common Hosting writer preparation. No cloud auth or
// live Hosting transport is wired here. Existing real APP738 HOLD is unchanged.
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {runApp738HostingPromotion,verifyApp738ReleaseGate} from './app738-production-hosting-transaction.mjs';

const REPO='andrawing1212/soridraw-music';
const REPO_ID='1188157610', OWNER_ID='268937716';
const WORKFLOW=REPO+'/.github/workflows/app738-hosting-writer.yml@refs/heads/main';
const ENV='hosting-writer';
const REF='refs/heads/hosting-release-journal';
const SHA=/^[0-9a-f]{40}$/, DIGEST=/^[0-9a-f]{64}$/;
const fail=x=>{throw Error('APP738_WRITER_HOLD_'+x)};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

// Configuration candidate only; no provider, IAM binding or key is created.
// Pin the reviewed controller SHA at cutover, not an arbitrary branch input.
export function buildHostingWifPlan({projectNumber,controllerSha}={}){
 if(String(projectNumber)!=='450781969193'||!SHA.test(controllerSha||''))
   fail('UNVERIFIED_HOSTING_PROJECT_OR_CONTROLLER');
 const pool='soridraw-hosting-github',provider='app738-writer';
 const checks={
  repository:REPO,repository_id:REPO_ID,repository_owner_id:OWNER_ID,
  ref:'refs/heads/main',workflow_ref:WORKFLOW,workflow_sha:controllerSha,
  environment:ENV,runner_environment:'github-hosted',
 };
 return {status:'CONFIGURATION_CANDIDATE_ONLY',projectId:'soridraw',
  projectNumber:String(projectNumber),pool,provider,
  issuer:'https://token.actions.githubusercontent.com',
  attributeMapping:{'google.subject':'assertion.sub','attribute.repository_id':'assertion.repository_id'},
  attributeCondition:Object.entries(checks).map(([k,v])=>"assertion."+k+" == '"+v+"'").join(' && ')+" && (assertion.event_name == 'workflow_run' || (assertion.event_name == 'workflow_dispatch' && assertion.actor_id == '268937716'))",
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
 if(x.stageFromBundle===true&&mode!=='preview')fail('BUNDLE_PREVIEW_ONLY');
 if(mode!=='production'&&x.stageFromBundle!==true&&!validVersion(x.targetVersion,sites[mode]))fail('TARGET_VERSION_REQUIRED');
 return {mode,site:sites[mode],sourceSha:x.sourceSha,filesSha256:x.filesSha256,
  configSha256:x.configSha256,evidenceSha256:x.evidenceSha256,
  approval:mode==='preview'?null:x.approval,
  targetVersion:mode==='production'||x.stageFromBundle===true?null:x.targetVersion,
  stageFromBundle:x.stageFromBundle===true,
  before:{version:x.before.version,release:x.before.release}};
}
function validVersion(version,site){
 return typeof version==='string'&&new RegExp('^sites/'+site+'/versions/[A-Za-z0-9_-]{4,128}$').test(version);
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
export function createHostingJournal({cwd,pushToken}={}){
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
  if(pushToken!==undefined){
   if(typeof pushToken!=='string'||!pushToken||git(['remote','get-url','--push','origin'])!=='https://github.com/'+REPO+'.git'&&
      git(['remote','get-url','--push','origin'])!=='https://github.com/'+REPO)fail('JOURNAL_APP_TOKEN_OR_ORIGIN');
   // Override the checkout read credential only for the fixed journal push.
   // No token in argv, remote URL, repository config, stdout or error text.
   const header='AUTHORIZATION: basic '+Buffer.from('x-access-token:'+pushToken).toString('base64');
   try{execFileSync('git',['push','--porcelain','origin',next+':'+REF],{
    cwd,timeout:20000,stdio:['ignore','pipe','pipe'],
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'2',
     GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:'',
     GIT_CONFIG_KEY_1:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_1:header}
   });}catch{fail('JOURNAL_APP_PUSH_UNCERTAIN');}
  }else git(['push','--porcelain','origin',next+':'+REF]);
  if(read().sha!==next)fail('JOURNAL_ACK_UNVERIFIED');
  return next;
 }};
}

// Offline transaction coordinator. A pending journal survives runner death.
// Never clear it in finally, on a failed/unknown operation or on timeout.
// Future trusted workflow must wire authenticated transport and separately
// reviewed reconciliation; current real adapter remains permanently HOLD.
export async function runHostingWriterCandidate({journal,request,execute,verify,confirm,guardedMutationProtocol=false}={}){
 const req=normalizeHostingRequest(request);
 if(!journal||typeof journal.read!=='function'||typeof journal.compareAppend!=='function'||
   typeof execute!=='function'||typeof verify!=='function')fail('WRITER_COMPONENT_MISSING');
 const start=await journal.read();
 if(start.state?.schema!==1||start.state.phase!=='idle')fail('PENDING_OR_UNKNOWN_ATTEMPT');
 const attempt=randomUUID(),requestDigest=hash(req);
 // Only the integrated, checkpoint-fenced mutation paths opt into the
 // no-write recovery protocol. Older records and generic fixtures cannot.
 if(guardedMutationProtocol&&typeof confirm!=='function')fail('FINAL_CONFIRM_REQUIRED');
 let pending={schema:1,phase:'pending',attempt,requestDigest,request:req,checkpoints:[],checkpointProtocol:guardedMutationProtocol?2:1};
 let owned=await journal.compareAppend(start.sha,pending);
 const locked=await journal.read();
 if(locked.sha!==owned||locked.state?.attempt!==attempt||
   locked.state?.requestDigest!==requestDigest||locked.state?.phase!=='pending')
   fail('JOURNAL_OWNERSHIP_UNVERIFIED');
 // Each acknowledged append pins the next ownership check. Never continue
 // after an uncertain journal append, even if the Hosting request succeeded.
 let journalFault=false;
 async function checkpoint(kind,detail){
  if(journalFault)fail('JOURNAL_CHECKPOINT_UNCERTAIN');
  try{
   const current=await journal.read();
   if(current.sha!==owned||current.state?.phase!=='pending'||current.state.attempt!==attempt||
      current.state.requestDigest!==requestDigest)fail('JOURNAL_OWNERSHIP_LOST');
   const entry=validateCheckpoint(req,pending.checkpoints,kind,detail);
   const next={...pending,checkpoints:[...pending.checkpoints,entry]};
   const nextSha=await journal.compareAppend(owned,next);
   const ack=await journal.read();
   if(ack.sha!==nextSha||ack.state?.attempt!==attempt||ack.state?.requestDigest!==requestDigest||
      hash(ack.state.checkpoints)!==hash(next.checkpoints))fail('JOURNAL_CHECKPOINT_ACK_UNVERIFIED');
   owned=nextSha;pending=next;
  }catch(e){journalFault=true;throw e;}
 }
 const result=await execute(Object.freeze({...req,before:Object.freeze({...req.before})}),checkpoint);
 if(journalFault)fail('JOURNAL_CHECKPOINT_UNCERTAIN');
 const observed=await verify(result,req);
 if(!validRelease(observed,req.site)||observed.release===req.before.release||
   observed.filesSha256!==req.filesSha256||observed.configSha256!==req.configSha256||
   observed.requestDigest!==requestDigest)
   fail('OUTCOME_UNVERIFIED');
 const end=await journal.read();
 if(end.sha!==owned||end.state?.attempt!==attempt)fail('JOURNAL_OWNERSHIP_LOST');
 // The smoke check may take time. Confirm the exact live release again
 // immediately before writing success; exclusive writer is still required.
 if(confirm&&await confirm(observed,req)!==true)fail('FINAL_LIVE_OUTCOME_DRIFT');
 await journal.compareAppend(owned,{schema:1,phase:'idle',lastAttempt:attempt,
   requestDigest,checkpoints:pending.checkpoints,result:{version:observed.version,release:observed.release}});
 return {status:'CANDIDATE_TRANSACTION_VERIFIED',attempt,site:req.site,
  release:observed.release,liveAuthorityVerified:false};
}


// Connect the existing APP738 transaction to the common journal. This is a
// source-only adapter, not a live writer or credential issuer. The real
// APP738 API still unconditionally denies writes; no env/evidence bypass.
// PREVIEW takes an already-finalized, verified artifact (future isolated
// trusted uploader), never builds or executes arbitrary candidate code here.
export async function runCommonHostingCandidate({
 journal,api,request,evidenceRaw,readCurrentPreviewSha,smokeProduction,
}={}){
 const req=normalizeHostingRequest(request);
 if(req.stageFromBundle)fail('USE_PREVIEW_BUNDLE_ENTRYPOINT');
 if(typeof evidenceRaw!=='string'||createHash('sha256').update(evidenceRaw).digest('hex')!==req.evidenceSha256)
   fail('EVIDENCE_DIGEST_MISMATCH');
 const item=JSON.parse(evidenceRaw);
 if(req.mode==='production'){
  if(item.kind!=='APP738_DIRECT_RELEASE_EVIDENCE_V1'||item.reviewedForActualProductionDeployment!==true||
    item.verifiedByIndependentQa!==true||item.approvedPreviewSha!==req.sourceSha||
    item.app737Evidence?.hosting?.preview?.filesSha256!==req.filesSha256||
    item.app737Evidence?.hosting?.production?.configSha256!==req.configSha256||
    item.app737Evidence?.hosting?.production?.version!==req.before.version)
   fail('PRODUCTION_EVIDENCE_SCOPE');
  verifyApp738ReleaseGate({evidence:item.app737Evidence,previewSha:req.sourceSha,approval:req.approval,mode:'deploy'});
 }else{
  if(item.kind!=='APP738_FINALIZED_ARTIFACT_CANDIDATE_V1'||item.mode!==req.mode||
    item.sourceSha!==req.sourceSha||item.site!==req.site||item.version!==req.targetVersion||
    item.filesSha256!==req.filesSha256||item.configSha256!==req.configSha256||
    item.before?.version!==req.before.version||item.before?.release!==req.before.release)
   fail('FINALIZED_ARTIFACT_EVIDENCE_SCOPE');
 }
 // Before touching even the journal, fail closed with the actual adapter.
 if(!api||typeof api.assertExclusiveReleaseAuthority!=='function'||
    await api.assertExclusiveReleaseAuthority()!==true)fail('LIVE_WRITER_UNVERIFIED');
 const exact=(a,b)=>a?.version===b.version&&a?.release===b.release;
 const contents=x=>x?.site===req.site&&x.filesSha256===req.filesSha256&&x.configSha256===req.configSha256;
 return runHostingWriterCandidate({journal,request:req,guardedMutationProtocol:true,
  async execute(_request,checkpoint){
   if(await api.assertExclusiveReleaseAuthority()!==true)fail('LIVE_WRITER_UNVERIFIED');
   const before=await api.snapshotLive(req.site);
   if(!exact(before,req.before))fail('BASELINE_DRIFT');
   if(req.mode==='production'){
    // All APP737/738 feature, clone, source pin, smoke and auto-rollback
    // checks remain inside the durable lock. Unknown/failure holds journal.
    const result=await runApp738HostingPromotion({
     api,previewSha:req.sourceSha,evidence:item.app737Evidence,approval:req.approval,
     readCurrentPreviewSha,smokeProduction,expectedBefore:req.before,checkpoint,
    });
    return {version:result.releasedProductionVersion,release:result.releasedProductionRelease};
   }
   const candidate=await api.snapshotVersion(req.targetVersion);
   if(candidate.version!==req.targetVersion||!contents(candidate))fail('FINALIZED_ARTIFACT_DRIFT');
   if(req.mode==='preview'){
    if(typeof readCurrentPreviewSha!=='function'||await readCurrentPreviewSha()!==req.sourceSha)
     fail('PREVIEW_SOURCE_DRIFT');
   }
   if(!exact(await api.live(req.site),req.before))fail('BASELINE_DRIFT');
   // These scoped operations are future trusted-adapter ports. No actual
   // preview upload, credential issuance or live release is wired here.
   const release=req.mode==='preview'?api.releasePreview:api.release;
   if(typeof release!=='function')fail('SCOPED_RELEASE_ADAPTER_MISSING');
   await checkpoint('baseline',before);
   await checkpoint('release-intent',{version:req.targetVersion});
   const ack=await release.call(api,req.targetVersion,req.mode==='preview'
     ?'APP738 preview '+req.sourceSha:'APP738 rollback to '+req.targetVersion.split('/').pop());
   const result={version:ack?.version?.name,release:ack?.name};
   if(!validRelease(result,req.site)||result.version!==req.targetVersion||result.release===req.before.release)
    fail('RELEASE_ACK_UNVERIFIED');
   await checkpoint('release-ack',result);
   return result;
  },
  async verify(result){
   const actual=await api.snapshotLive(req.site);
   if(!exact(actual,result)||!contents(actual))fail('LIVE_OUTCOME_DRIFT');
   return {...actual,requestDigest:hash(req)};
  },
  async confirm(observed){
   const current=await api.snapshotLive(req.site);
   return exact(current,observed)&&contents(current);
  },
 });
}


// Ordered, metadata-only receipts. A lost response is NOT a release receipt.
// A pending attempt may only be reviewed, never automatically replayed.
function validateCheckpoint(req,entries,kind,detail){
 if(!Array.isArray(entries)||entries.length>5||!detail||typeof detail!=='object')fail('CHECKPOINT_INVALID');
 const previous=entries.at(-1);
 const expected={baseline:[undefined],'stage-intent':['baseline'],'release-intent':['baseline','stage-intent'],'release-ack':['release-intent'],'rollback-intent':['release-ack'],'rollback-ack':['rollback-intent']};
 if(!Object.hasOwn(expected,kind)||!expected[kind].includes(previous?.kind))fail('CHECKPOINT_ORDER');
 const entry={kind,version:detail.version};
 if(!validVersion(entry.version,req.site))fail('CHECKPOINT_SITE');
 if(kind==='baseline'){
  if(!validRelease(detail,req.site)||detail.version!==req.before.version||detail.release!==req.before.release||
     !DIGEST.test(detail.filesSha256||'')||!DIGEST.test(detail.configSha256||''))fail('CHECKPOINT_BASELINE');
  Object.assign(entry,{release:detail.release,filesSha256:detail.filesSha256,configSha256:detail.configSha256});
 }else if(kind==='stage-intent'){
  if((req.mode!=='production'&&!req.stageFromBundle)||entry.version!==req.before.version)fail('CHECKPOINT_STAGE_TARGET');
 }else if(kind==='release-intent'){
  if(entry.version===req.before.version||(req.targetVersion&&entry.version!==req.targetVersion))fail('CHECKPOINT_RELEASE_TARGET');
 }else if(kind==='rollback-intent'){
  if(req.mode!=='production'||entry.version!==req.before.version)fail('CHECKPOINT_ROLLBACK_TARGET');
 }else{
  if(!validRelease(detail,req.site)||entry.version!==previous.version||detail.release===req.before.release||
     entries.some(x=>x.release===detail.release))fail('CHECKPOINT_RELEASE_RECEIPT');
  entry.release=detail.release;
 }
 return entry;
}

// Read-only classification for a separately approved reconciliation. Never
// writes Firebase, never unlocks the journal and never infers ownership from
// a matching version alone. Unknown ACK/in-flight operations remain HOLD.
export function inspectPendingHostingOutcome({record,observed}={}){
 const state=record?.state;
 if(!SHA.test(record?.sha||'')||state?.phase!=='pending'||state.schema!==1||!state.attempt)
  fail('PENDING_RECORD_REQUIRED');
 const req=normalizeHostingRequest(state.request);
 if(hash(req)!==state.requestDigest)fail('JOURNAL_REQUEST_DIGEST_DRIFT');
 const entries=[];
 for(const x of state.checkpoints||[])entries.push(validateCheckpoint(req,entries,x.kind,x));
 const last=entries.at(-1),base=entries[0];
 const current=validRelease(observed,req.site)&&observed.site===req.site&&
  DIGEST.test(observed.filesSha256||'')&&DIGEST.test(observed.configSha256||'');
 let outcome='UNKNOWN_OR_FOREIGN_HOLD';
 // No write is possible on the integrated v2 paths until a durable
 // stage-intent or release-intent exists. Require unchanged exact baseline;
 // a legacy record, staging intent, lost ACK or foreign release never qualifies.
 if(current&&state.checkpointProtocol===2&&Array.isArray(state.checkpoints)&&
    (entries.length===0||last?.kind==='baseline')&&observed.version===req.before.version&&observed.release===req.before.release&&
    (!base||(observed.filesSha256===base.filesSha256&&observed.configSha256===base.configSha256)))outcome='NO_HOSTING_WRITE_BASELINE_OBSERVED';
 if(current&&last?.kind==='release-ack'&&last.release===observed.release&&last.version===observed.version&&
    observed.filesSha256===req.filesSha256&&observed.configSha256===req.configSha256)outcome='OWNED_RELEASE_OBSERVED';
 if(current&&last?.kind==='rollback-ack'&&last.release===observed.release&&last.version===observed.version&&
    observed.filesSha256===base.filesSha256&&observed.configSha256===base.configSha256)outcome='OWNED_ROLLBACK_OBSERVED';
 return {status:'MANUAL_RECONCILIATION_HOLD',outcome,journalSha:record.sha,attempt:state.attempt,requestDigest:state.requestDigest,
  site:req.site,observed:current?{version:observed.version,release:observed.release,filesSha256:observed.filesSha256,configSha256:observed.configSha256}:null,
  writes:0,canAutoUnlock:false};
}

// Candidate journal-only reconciliation. Real transport hard-HOLD applies;
// no production workflow or CLI calls this. The external review port must
// be independently authenticated at cutover, not an input boolean or timer.
// An owned acknowledged terminal state or fenced pre-write abort is eligible;
// a missing ACK after any mutation intent still means HOLD.
export async function reconcileHostingJournalCandidate({journal,api,reviewRaw,reviewSha256,approval,verifyIndependentReview}={}){
 if(approval!=='RECONCILE_HOSTING_JOURNAL'||typeof reviewRaw!=='string'||hashRaw(reviewRaw)!==reviewSha256||
    typeof verifyIndependentReview!=='function')fail('RECONCILIATION_APPROVAL_REQUIRED');
 if(!api||typeof api.assertExclusiveReleaseAuthority!=='function'||await api.assertExclusiveReleaseAuthority()!==true)
   fail('LIVE_WRITER_UNVERIFIED');
 const record=await journal.read(),req=normalizeHostingRequest(record.state.request);
 const first=inspectPendingHostingOutcome({record,observed:await api.snapshotLive(req.site)});
 if(first.outcome==='UNKNOWN_OR_FOREIGN_HOLD')fail('UNACKNOWLEDGED_OR_FOREIGN_OUTCOME');
 const evidence=JSON.parse(reviewRaw);
 if(evidence.kind!=='APP738_JOURNAL_RECONCILIATION_V1'||evidence.journalSha!==first.journalSha||
    evidence.attempt!==first.attempt||evidence.requestDigest!==first.requestDigest||
    evidence.outcome!==first.outcome||hash(evidence.observed)!==hash(first.observed)||
    await verifyIndependentReview({raw:reviewRaw,sha256:reviewSha256,report:first})!==true)
    fail('INDEPENDENT_TERMINAL_REVIEW_REQUIRED');
 // Review must establish no in-flight request/runner and actual feature
 // health for the exact release. Re-read before append; no Firebase writes.
 const again=await journal.read();
 if(again.sha!==record.sha)fail('RECONCILIATION_JOURNAL_DRIFT');
 const second=inspectPendingHostingOutcome({record:again,observed:await api.snapshotLive(req.site)});
 if(hash(first)!==hash(second)||await api.assertExclusiveReleaseAuthority()!==true)fail('RECONCILIATION_LIVE_DRIFT');
 await journal.compareAppend(record.sha,{schema:1,phase:'idle',lastAttempt:first.attempt,requestDigest:first.requestDigest,
  result:first.observed,reconciliation:{outcome:first.outcome,reviewSha256,previousJournalSha:record.sha}});
 return {status:'CANDIDATE_JOURNAL_RECONCILED',hostingWrites:0,liveAuthorityVerified:false};
}
const hashRaw=x=>createHash('sha256').update(x).digest('hex');
