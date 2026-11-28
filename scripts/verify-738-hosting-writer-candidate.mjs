import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildHostingWifPlan,normalizeHostingRequest,createHostingJournal,runHostingWriterCandidate} from './app738-hosting-writer-candidate.mjs';

const sha='a'.repeat(40),digest='b'.repeat(64);
const plan=buildHostingWifPlan({projectNumber:'450781969193',controllerSha:sha});
assert.equal(plan.liveAuthorityVerified,false);
assert.equal(plan.projectId,'soridraw');
assert.match(plan.attributeCondition,/assertion.repository_id == '1188157610'/);
assert.match(plan.attributeCondition,/assertion.repository_owner_id == '268937716'/);
assert.match(plan.attributeCondition,/assertion.workflow_sha == 'a{40}'/);
assert.match(plan.attributeCondition,/assertion.ref == 'refs\/heads\/main'/);
assert.match(plan.attributeCondition,/assertion.event_name == 'workflow_dispatch'/);
assert.match(plan.attributeCondition,/assertion.environment == 'hosting-writer'/);
assert.match(plan.attributeCondition,/assertion.runner_environment == 'github-hosted'/);
assert.match(plan.attributeCondition,/assertion.workflow_ref == 'andrawing1212\/soridraw-music\/.github\/workflows\/app738-direct-hosting-promotion.yml@refs\/heads\/main'/);
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
