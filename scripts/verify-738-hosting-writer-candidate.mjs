import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildHostingWifPlan,normalizeHostingRequest,createHostingJournal,runHostingWriterCandidate,inspectPendingHostingOutcome,reconcileHostingJournalCandidate} from './app738-hosting-writer-candidate.mjs';

const sha='a'.repeat(40),digest='b'.repeat(64);
const plan=buildHostingWifPlan({projectNumber:'450781969193',controllerSha:sha});
assert.equal(plan.liveAuthorityVerified,false);
assert.equal(plan.projectId,'soridraw');
assert.match(plan.attributeCondition,/assertion.repository_id == '1188157610'/);
assert.match(plan.attributeCondition,/assertion.repository_owner_id == '268937716'/);
assert.match(plan.attributeCondition,/assertion.workflow_sha == 'a{40}'/);
assert.match(plan.attributeCondition,/assertion.ref == 'refs\/heads\/main'/);
assert.match(plan.attributeCondition,/assertion.event_name == 'workflow_dispatch'/);
assert.match(plan.attributeCondition,/assertion.event_name == 'workflow_run'/);
assert.match(plan.attributeCondition,/assertion.environment == 'hosting-writer'/);
assert.match(plan.attributeCondition,/assertion.runner_environment == 'github-hosted'/);
assert.match(plan.attributeCondition,/assertion.workflow_ref == 'andrawing1212\/soridraw-music\/.github\/workflows\/app738-hosting-writer.yml@refs\/heads\/main'/);
assert.throws(()=>buildHostingWifPlan({projectNumber:'1083981050742',controllerSha:sha}),/UNVERIFIED/);
assert.throws(()=>buildHostingWifPlan({projectNumber:'450781969193',controllerSha:'main'}),/UNVERIFIED/);
assert.throws(()=>buildHostingWifPlan({projectNumber:'999999999999',controllerSha:sha}),/UNVERIFIED/);
const request=(mode='preview')=>{
 const site=mode==='preview'?'soridraw-preview':'soridraw';
 return {mode,site,sourceSha:sha,filesSha256:digest,configSha256:digest,evidenceSha256:digest,
  approval:mode==='production'?'DEPLOY_PRODUCTION':mode==='rollback'?'ROLLBACK_PRODUCTION':null,
  targetVersion:mode==='production'?null:'sites/'+site+'/versions/newv',
  before:{version:'sites/'+site+'/versions/oldv',release:'sites/'+site+'/releases/old'}};
};
assert.throws(()=>normalizeHostingRequest({...request(),site:'soridraw'}),/DESTINATION/);
assert.throws(()=>normalizeHostingRequest({...request(),mode:'test',site:'soridraw-test'}),/DESTINATION/);
assert.throws(()=>normalizeHostingRequest({...request('production'),approval:'YES'}),/APPROVAL/);
assert.throws(()=>normalizeHostingRequest({...request('rollback'),approval:'DEPLOY_PRODUCTION'}),/APPROVAL/);
assert.throws(()=>normalizeHostingRequest({...request(),filesSha256:'latest'}),/IDENTITY/);
assert.throws(()=>normalizeHostingRequest({...request(),before:request('production').before}),/BASELINE/);
const root=mkdtempSync(join(tmpdir(),'app738-writer-'));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const ref='refs/heads/hosting-release-journal';
try{
 const bare=join(root,'remote.git'),a=join(root,'a'),b=join(root,'b');
 git(root,'init','--bare',bare);
 git(root,'clone',bare,a);
 git(a,'-c','user.name=QA','-c','user.email=qa@invalid.local','commit','--allow-empty','-m',JSON.stringify({schema:1,phase:'idle'}));
 git(a,'push','origin','HEAD:'+ref);
 git(root,'clone','--branch','hosting-release-journal',bare,b);
 const ja=createHostingJournal({cwd:a}),jb=createHostingJournal({cwd:b});
 const r=ja.read();
 ja.compareAppend(r.sha,{schema:1,phase:'idle'});
 assert.throws(()=>jb.compareAppend(r.sha,{schema:1,phase:'idle'}),/CONCURRENT_UPDATE/);
 // Exercise actual Git non-fast-forward rejection for sibling commits,
 // even if the second writer passed its pre-push read.
 const parent=ja.read().sha;
 const tree=git(a,'rev-parse',parent+'^{tree}');
 const child1=git(a,'-c','user.name=QA','-c','user.email=qa@invalid.local','commit-tree',tree,'-p',parent,'-m',JSON.stringify({schema:1,phase:'idle',nonce:'one'}));
 const child2=git(a,'-c','user.name=QA','-c','user.email=qa@invalid.local','commit-tree',tree,'-p',parent,'-m',JSON.stringify({schema:1,phase:'idle',nonce:'two'}));
 git(a,'push','origin',child1+':'+ref);
 assert.throws(()=>git(a,'push','origin',child2+':'+ref));
 assert.equal(jb.read().sha,child1);
 const good=async(req)=>({
  version:'sites/'+req.site+'/versions/newv',release:'sites/'+req.site+'/releases/new',
  filesSha256:req.filesSha256,configSha256:req.configSha256,
  requestDigest:createHash('sha256').update(JSON.stringify(req)).digest('hex')
 });
 const verify=async(x)=>x;
 for(const mode of ['preview','production','rollback']){
  const x=await runHostingWriterCandidate({journal:ja,request:request(mode),execute:good,verify});
  assert.equal(x.status,'CANDIDATE_TRANSACTION_VERIFIED');
  assert.equal(jb.read().state.phase,'idle');
 }
 // Crash / lost acknowledgement leaves durable pending state. A fresh
 // runner cannot write even for the other site.
 await assert.rejects(()=>runHostingWriterCandidate({journal:ja,request:request('production'),
   execute:async()=>{throw Error('lost ACK');},verify}),/lost ACK/);
 let writes=0;
 await assert.rejects(()=>runHostingWriterCandidate({journal:jb,request:request(),
   execute:async()=>{writes++;},verify}),/PENDING_OR_UNKNOWN_ATTEMPT/);
 assert.equal(writes,0);
 assert.equal(jb.read().state.phase,'pending');
 assert.equal(jb.read().state.request.mode,'production');
}finally{rmSync(root,{recursive:true,force:true});}
console.log('APP738_WIF_PINNED_CONFIGURATION_ONLY=PASS');
console.log('APP738_FIXED_SITE_AND_APPROVAL_FENCE=PASS');
console.log('APP738_GIT_JOURNAL_SIBLING_RACE_AND_CROSS_RUN_PENDING_HOLD=PASS_LOCAL');
console.log('APP738_COMMON_WRITER_CANDIDATE_ONLY; LIVE_AUTH=NOT_RUN; LIVE_DEPLOY=NOT_RUN');


// Recovery records are bound to exact release identity, not version alone.
const sum=x=>createHash('sha256').update(x).digest('hex');
const rroot=mkdtempSync(join(tmpdir(),'app738-recovery-'));
try{
 const bare=join(rroot,'remote.git'),a=join(rroot,'a'),b=join(rroot,'b');
 git(rroot,'init','--bare',bare);git(rroot,'clone',bare,a);
 git(a,'-c','user.name=QA','-c','user.email=qa@invalid.local','commit','--allow-empty','-m',JSON.stringify({schema:1,phase:'idle'}));git(a,'push','origin','HEAD:'+ref);
 git(rroot,'clone','--branch','hosting-release-journal',bare,b);
 const ja=createHostingJournal({cwd:a}),jb=createHostingJournal({cwd:b}),req=request('production');
 const baseline={site:req.site,...req.before,filesSha256:'c'.repeat(64),configSha256:digest};
 const live={site:req.site,version:'sites/soridraw/versions/newv',release:'sites/soridraw/releases/new',filesSha256:digest,configSha256:digest};
 const execute=async(_r,checkpoint)=>{
  await checkpoint('baseline',baseline);
  await checkpoint('release-intent',{version:live.version});
  await checkpoint('release-ack',live);
  throw Error('runner lost after acknowledged release');
 };
 await assert.rejects(()=>runHostingWriterCandidate({journal:ja,request:req,execute,verify:async()=>{}}),/runner lost/);
 let record=jb.read(),report=inspectPendingHostingOutcome({record,observed:live});
 assert.equal(report.outcome,'OWNED_RELEASE_OBSERVED');assert.equal(report.canAutoUnlock,false);
 assert.equal(inspectPendingHostingOutcome({record,observed:{...live,release:'sites/soridraw/releases/foreign'}}).outcome,'UNKNOWN_OR_FOREIGN_HOLD');
 const reviewRaw=JSON.stringify({kind:'APP738_JOURNAL_RECONCILIATION_V1',journalSha:record.sha,attempt:report.attempt,requestDigest:report.requestDigest,outcome:report.outcome,observed:report.observed});
 const api={assertExclusiveReleaseAuthority:async()=>true,snapshotLive:async()=>live};
 const opts={journal:jb,api,reviewRaw,reviewSha256:sum(reviewRaw),approval:'RECONCILE_HOSTING_JOURNAL',verifyIndependentReview:async()=>true};
 await assert.rejects(()=>reconcileHostingJournalCandidate({...opts,verifyIndependentReview:async()=>false}),/INDEPENDENT_TERMINAL_REVIEW_REQUIRED/);
 assert.equal(jb.read().sha,record.sha);
 await assert.rejects(()=>reconcileHostingJournalCandidate({...opts,api:{...api,assertExclusiveReleaseAuthority:async()=>false}}),/LIVE_WRITER_UNVERIFIED/);
 let reads=0;await assert.rejects(()=>reconcileHostingJournalCandidate({...opts,api:{...api,snapshotLive:async()=>++reads===1?live:{...live,release:'sites/soridraw/releases/foreign'}}}),/RECONCILIATION_LIVE_DRIFT/);
 assert.equal(jb.read().sha,record.sha);
 assert.equal((await reconcileHostingJournalCandidate(opts)).hostingWrites,0);assert.equal(ja.read().state.phase,'idle');
 await assert.rejects(()=>runHostingWriterCandidate({journal:ja,request:req,execute:async(_r,checkpoint)=>{
  await checkpoint('baseline',baseline);await checkpoint('release-intent',{version:live.version});throw Error('ACK lost');
 },verify:async()=>{}}),/ACK lost/);
 record=jb.read();assert.equal(inspectPendingHostingOutcome({record,observed:live}).outcome,'UNKNOWN_OR_FOREIGN_HOLD');
 await assert.rejects(()=>reconcileHostingJournalCandidate(opts),/UNACKNOWLEDGED_OR_FOREIGN_OUTCOME/);
 assert.equal(jb.read().state.phase,'pending');
}finally{rmSync(rroot,{recursive:true,force:true});}
console.log('APP738_RECEIPT_BOUND_RECOVERY_NO_ACK_HOLD=PASS_LOCAL');
