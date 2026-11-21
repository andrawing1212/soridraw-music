// APP750 source-to-target GitHub code handoff, invoked ONLY by the pinned
// owner-dispatched GitHub Actions workflow. Creates a reviewable PR; NO deploy.
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {assessApp750Sync} from './app750-bidirectional-sync-policy.mjs';
const SHA=/^[0-9a-f]{40}$/;
const die=why=>{throw Error('APP750_PREPARE_HOLD_'+why)};
function run(bin,args,options={}){
  return execFileSync(bin,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,...options}).trim();
}
export function parseNameStatus(raw){
 const fields=raw.split('\0');if(fields.at(-1)==='')fields.pop();
 if(fields.length===0||fields.length%2!==0)die('DIFF_SHAPE');
 const files=[];
 for(let i=0;i<fields.length;i+=2){
  const status=fields[i],path=fields[i+1];
  // A rename/copy is deliberately not safe for automatic handoff.
  if(!['A','M','D'].includes(status))die('RENAMES_COPIES_TYPES_BLOCKED');
  files.push({status,path});
 }
 return files;
}
export function prepareApp750Sync({origin,sourceSha,sourceParentSha,destinationSha,
  dryRun=false,git=run}={}){
 for(const sha of [sourceSha,sourceParentSha,destinationSha])
  if(!SHA.test(sha||''))die('INVALID_SHA');
 if(!['preview','production'].includes(origin))die('INVALID_ORIGIN');
 const destination=origin==='preview'?'production':'preview';
 const sourceLiveHead=git('git',['rev-parse','refs/remotes/origin/'+origin]);
 const destinationLiveHead=git('git',['rev-parse','refs/remotes/origin/'+destination]);
 const parents=git('git',['rev-list','--parents','-n','1',sourceSha]).split(' ').slice(1);
 const diff=git('git',['diff-tree','--no-commit-id','--root','-r','--name-status','-z',sourceSha]);
 const changedFiles=parseNameStatus(diff);
 const policy=assessApp750Sync({origin,sourceSha,sourceParentSha,
  sourceLiveHead,destinationSha,destinationLiveHead,parents,changedFiles});
 if(dryRun)return policy;
 const branch=policy.branchName;
 // Never update an existing branch or overwrite an existing PR.
 if(git('git',['ls-remote','--heads','origin',branch]))die('SYNC_BRANCH_ALREADY_EXISTS');
 git('git',['switch','--detach',destinationSha]);
 git('git',['switch','-c',branch]);
 git('git',['-c','core.hooksPath=/dev/null','cherry-pick','--no-commit',sourceSha]);
 const staged=parseNameStatus(git('git',['diff','--cached','--name-status','-z']));
 if(JSON.stringify(staged.sort((a,b)=>a.path.localeCompare(b.path)))!==
   JSON.stringify(changedFiles.sort((a,b)=>a.path.localeCompare(b.path))))
   die('CHERRY_PICK_CHANGED_FILE_SCOPE');
 const sha=git('git',['rev-parse','HEAD']);
 if(sha!==destinationSha)die('DESTINATION_DRIFT_BEFORE_COMMIT');
 const live=branch=>git('git',['ls-remote','origin','refs/heads/'+branch]).split(/\s+/)[0];
 if(live(origin)!==sourceSha||live(destination)!==destinationSha)
   die('REMOTE_SOURCE_OR_TARGET_MOVED_BEFORE_PUSH');
 git('git',['config','user.name','soridraw-release-bot']);
 git('git',['config','user.email','release-bot@soridraw.invalid']);
 git('git',['-c','core.hooksPath=/dev/null','commit','-m',
   'sync(APP750): '+origin+' '+sourceSha.slice(0,12)+' -> '+destination]);
 // Race-safe: push only the new nonexisting branch (no --force).
 git('git',['push','origin','refs/heads/'+branch+':refs/heads/'+branch]);
 return {...policy,createdCommit:git('git',['rev-parse','HEAD']),prHead:branch};
}
function main(){
 const [origin,sourceSha,sourceParentSha,destinationSha]=process.argv.slice(2);
 if(!origin||!sourceSha||!sourceParentSha||!destinationSha)die('ARGUMENTS_REQUIRED');
 if(process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||
   process.env.GITHUB_ACTOR!==process.env.GITHUB_REPOSITORY_OWNER)
   die('OWNER_ONLY');
 const result=prepareApp750Sync({origin,sourceSha,sourceParentSha,destinationSha,
   dryRun:process.env.APP750_DRY_RUN==='1'});
 if(process.env.GITHUB_OUTPUT){
   writeFileSync(process.env.GITHUB_OUTPUT,'branch='+result.branchName+'\norigin='+origin+'\ndestination='+result.destination+'\n',{flag:'a'});
 }
 console.log(JSON.stringify(result));
}
if(process.argv[1]?.endsWith('/app750-bidirectional-sync-cli.mjs')){
 try{main()}catch(e){console.error(String(e?.message||e));process.exitCode=2}
}
