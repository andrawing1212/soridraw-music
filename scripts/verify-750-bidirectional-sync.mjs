import assert from 'node:assert/strict';
import {assessApp750Sync} from './app750-bidirectional-sync-policy.mjs';
import {parseNameStatus,prepareApp750Sync} from './app750-bidirectional-sync-cli.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
const files=[{status:'M',path:'src/components/MusicCard.tsx'},{status:'A',path:'public/new-icon.svg'}];
const input={origin:'preview',sourceSha:A,sourceParentSha:B,sourceLiveHead:A,
 destinationSha:C,destinationLiveHead:C,parents:[B],changedFiles:files};
const plan=assessApp750Sync(input);
assert.equal(plan.status,'CODE_SYNC_PR_ONLY');
assert.equal(plan.destination,'production');
assert.equal(plan.productionDeployAuthorized,false);
assert.equal(plan.previewDeployAuthorized,false);
assert.equal(plan.fullBranchMergeAuthorized,false);
assert.equal(plan.branchName,'sync/app750-preview-aaaaaaaaaaaa');
const back=assessApp750Sync({...input,origin:'production'});
assert.equal(back.destination,'preview');
assert.equal(back.releaseOrder,'PREVIEW_VERIFICATION_THEN_PRODUCTION_GATED');
for(const [patch,reason] of [
 [{sourceLiveHead:C},'SOURCE_BRANCH_MOVED'],
 [{destinationLiveHead:A},'DESTINATION_BRANCH_MOVED'],
 [{parents:[B,C]},'NOT_EXACT_SINGLE_NONMERGE_COMMIT'],
 [{changedFiles:[]},'CHANGED_FILE_COUNT_OUT_OF_SCOPE'],
 [{changedFiles:[{status:'M',path:'.github/workflows/deploy.yml'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 [{changedFiles:[{status:'M',path:'cloudflare/worker/index.js'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 [{changedFiles:[{status:'M',path:'firebase.json'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 [{changedFiles:[{status:'M',path:'.deploy/preview-app-release.trigger'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 [{changedFiles:[{status:'M',path:'DOCS/CURRENT_RELEASE_STATE.md'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 [{changedFiles:[{status:'M',path:'src/../../.env'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 [{changedFiles:[{status:'R100',path:'src/New.tsx'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 [{changedFiles:[{status:'M',path:'src/App.tsx'},{status:'M',path:'src/App.tsx'}]},'PROTECTED_OR_UNSUPPORTED_CHANGE'],
 ])assert.throws(()=>assessApp750Sync({...input,...patch}),new RegExp(reason));
assert.equal(assessApp750Sync({...input,changedFiles:[{status:'M',path:'src/services/follow.ts'}]}).requiresRuntimeCompatibilityCheck,true);
assert.equal(assessApp750Sync({...input,changedFiles:[{status:'D',path:'src/components/Old.tsx'}]}).requiresRuntimeCompatibilityCheck,true);
assert.deepEqual(parseNameStatus('M\0src/App.tsx\0A\0public/new.svg\0'),
 [{status:'M',path:'src/App.tsx'},{status:'A',path:'public/new.svg'}]);
assert.throws(()=>parseNameStatus('R100\0src/New.tsx\0'),/RENAMES_COPIES_TYPES_BLOCKED/);
const mockGit=(binary,args)=>{
 assert.equal(binary,'git');
 const action=args[0];
 if(action==='rev-parse')return args[1].endsWith('/preview')?A:C;
 if(action==='rev-list')return A+' '+B;
 if(action==='diff-tree')return 'M\0src/components/MusicCard.tsx\0A\0public/new-icon.svg\0';
 throw Error('DRY_RUN_MUST_NOT_WRITE: '+action);
};
const dry=prepareApp750Sync({origin:'preview',sourceSha:A,sourceParentSha:B,
 destinationSha:C,dryRun:true,git:mockGit});
assert.equal(dry.status,'CODE_SYNC_PR_ONLY');
assert.equal(dry.fileCount,2);
console.log('APP750_BIDIRECTIONAL_SOURCE_CHANGE_PR_PLAN=PASS');
console.log('APP750_NO_FULL_BRANCH_MERGE_NO_LIVE_DEPLOY=PASS');
console.log('APP750_PROTECTED_BACKEND_AND_STALE_HEAD_HOLD=PASS');

// Real but isolated local git-only rehearsal: no GitHub, Hosting,
// credentials or user data. It exercises the full cherry-pick + push flow.
const tmp=mkdtempSync(join(tmpdir(),'soridraw-app750-'));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
try{
 const remote=join(tmp,'remote.git'),cwd=join(tmp,'work');
 git(tmp,'init','-q','--bare',remote);
 git(tmp,'clone','-q',remote,cwd);
 git(cwd,'config','user.name','CI QA');
 git(cwd,'config','user.email','qa@invalid');
 mkdirSync(join(cwd,'src','components'),{recursive:true});
 writeFileSync(join(cwd,'src','components','MusicCard.tsx'),'old card');
 git(cwd,'add','.');git(cwd,'commit','-qm','base');
 git(cwd,'branch','-M','preview');git(cwd,'push','-q','origin','preview');
 const parent=git(cwd,'rev-parse','HEAD');
 git(cwd,'branch','production',parent);git(cwd,'push','-q','origin','production');
 writeFileSync(join(cwd,'src','components','MusicCard.tsx'),'new card');
 git(cwd,'add','.');git(cwd,'commit','-qm','one-safe-ui-change');
 const source=git(cwd,'rev-parse','HEAD');
 git(cwd,'push','-q','origin','preview');
 git(cwd,'fetch','-q','origin','preview','production');
 const inRepo=(bin,args)=>execFileSync(bin,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const physical=prepareApp750Sync({origin:'preview',sourceSha:source,
  sourceParentSha:parent,destinationSha:parent,git:inRepo});
 assert.equal(physical.createdCommit.length,40);
 assert.equal(git(cwd,'show',physical.createdCommit+':src/components/MusicCard.tsx'),'new card');
 assert.equal(git(cwd,'rev-parse',physical.createdCommit+'^'),parent);
 assert.equal(git(cwd,'ls-remote','--heads','origin',physical.branchName).length>0,true);
 assert.throws(()=>prepareApp750Sync({origin:'preview',sourceSha:source,
  sourceParentSha:parent,destinationSha:parent,git:inRepo}),
  /SYNC_BRANCH_ALREADY_EXISTS/);
 console.log('APP750_LOCAL_GIT_ONE_COMMIT_CHERRY_PICK_AND_NO_FORCE_PUSH=PASS');
}finally{rmSync(tmp,{recursive:true,force:true})}
