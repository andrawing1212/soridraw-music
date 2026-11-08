// Notification trigger-only OFF one-use release. Never use a static trigger as approval.
// Requires the repository owner's exact comment on an owner-approved trigger-only PR.
import assert from 'node:assert/strict';
import {readFileSync,appendFileSync} from 'node:fs';
const REPO='andrawing1212/soridraw-music';
const PATH='.deploy/notification-d1-triggers-off.release';
const demand=(ok,why)=>{if(!ok)throw Error('NOTIFICATION_RELEASE_BLOCKED_'+why);};
const parse=text=>{
 const lines=String(text||'').trim().split(/\r?\n/);
 const pairs=lines.map(l=>{const i=l.indexOf('=');demand(i>0,'TRIGGER_PARSE');return[l.slice(0,i),l.slice(i+1)];});
 const t=Object.fromEntries(pairs);
 const keys=['approval_pr','product_code_sha','triggers_only_off','no_drop_rollback'];
 demand(lines.length===keys.length&&Object.keys(t).length===keys.length&&
   Object.keys(t).every(k=>keys.includes(k)),'TRIGGER_EXTRA_OR_DUPLICATE');
 demand(/^[1-9]\d{0,7}$/.test(t.approval_pr)&&/^[a-f0-9]{40}$/.test(t.product_code_sha),'BAD_APPROVAL_ID');
 demand(t.triggers_only_off==='true'&&t.no_drop_rollback==='true','NOT_INERT');
 return t;
};
export function verifyApproval009({meta,trigger,prs,pr,comments,commit,files,branch,runs}){
 const t=parse(trigger);
 demand(meta.event==='push'&&meta.ref==='refs/heads/preview'&&meta.repo===REPO,'NOT_PREVIEW_PUSH');
 demand(/^[a-f0-9]{40}$/.test(meta.sha)&&String(meta.attempt)==='1','HEAD_OR_RERUN');
 demand(branch?.commit?.sha===meta.sha,'PREVIEW_HEAD_MOVED');
 demand(Array.isArray(prs)&&prs.length===1,'MERGED_PR_UNPROVEN');
 const m=prs[0];
 demand(String(m.number)===t.approval_pr&&m.merged_at&&m.merge_commit_sha===meta.sha
  &&m.base?.ref==='preview'&&/^[a-f0-9]{40}$/.test(m.head?.sha||''),'MERGED_PR_DRIFT');
 demand(pr?.number===m.number&&pr?.merged_at===m.merged_at&&pr?.head?.sha===m.head.sha,'APPROVAL_PR_DRIFT');
 demand(Array.isArray(commit?.files)&&commit.files.length===1&&commit.files[0].filename===PATH,'MERGE_NOT_TRIGGER_ONLY');
 demand(Array.isArray(files)&&files.length===1&&files[0].filename===PATH,'PR_NOT_TRIGGER_ONLY');
 const approval='APPROVE_SORIDRAW_NOTIFICATION_D1_TRIGGERS_OFF_HEAD='+m.head.sha+
   ' SOURCE='+t.product_code_sha;
 const matching=(comments||[]).filter(c=>c.user?.login==='andrawing1212'
  &&String(c.body||'').trim()===approval
  &&Date.parse(c.created_at)<Date.parse(m.merged_at)
  &&Date.parse(c.updated_at)<Date.parse(m.merged_at));
 demand(matching.length===1,'OWNER_APPROVAL_MISSING_OR_AMBIGUOUS');
 demand(runs?.total_count===1&&runs.workflow_runs?.length===1
  &&String(runs.workflow_runs[0].id)===String(meta.runId)
  &&runs.workflow_runs[0].head_sha===meta.sha
  &&runs.workflow_runs[0].event==='push','ONE_USE_VIOLATION');
 return t.product_code_sha;
}
const sha='a'.repeat(40),source='b'.repeat(40),phead='c'.repeat(40),merged='2026-11-09T12:00:00Z';
const fixture={
 meta:{event:'push',ref:'refs/heads/preview',repo:REPO,sha,attempt:'1',runId:10},
 trigger:'approval_pr=999\nproduct_code_sha='+source+'\ntriggers_only_off=true\nno_drop_rollback=true\n',
 prs:[{number:999,merged_at:merged,merge_commit_sha:sha,base:{ref:'preview'},head:{sha:phead}}],
 pr:{number:999,merged_at:merged,head:{sha:phead}},
 comments:[{user:{login:'andrawing1212'},body:'APPROVE_SORIDRAW_NOTIFICATION_D1_TRIGGERS_OFF_HEAD='+phead+' SOURCE='+source,
  created_at:'2026-11-09T11:00:00Z',updated_at:'2026-11-09T11:00:00Z'}],
 commit:{files:[{filename:PATH}]},files:[{filename:PATH}],branch:{commit:{sha}},
 runs:{total_count:1,workflow_runs:[{id:10,head_sha:sha,event:'push'}]},
};
if(process.argv.includes('--self-test')){
 assert.equal(verifyApproval009(fixture),source);
 for(const bad of [
  {...fixture,meta:{...fixture.meta,attempt:'2'}},
  {...fixture,comments:[]},
  {...fixture,comments:[{...fixture.comments[0],user:{login:'stranger'}}]},
  {...fixture,commit:{files:[{filename:PATH},{filename:'src/App.tsx'}]}},
  {...fixture,trigger:fixture.trigger.replace('triggers_only_off=true','triggers_only_off=false')},
  {...fixture,prs:[{...fixture.prs[0],merge_commit_sha:source}]},
  {...fixture,branch:{commit:{sha:source}}},
  {...fixture,runs:{total_count:2,workflow_runs:[]}},
 ])assert.throws(()=>verifyApproval009(bad),/NOTIFICATION_RELEASE_BLOCKED/);
 console.log('NOTIFICATION_009_OWNER_EXACT_HEAD_ONE_USE_GUARD=PASS');
 process.exit(0);
}
if(!process.argv.includes('--verify-approval'))throw Error('EXPLICIT_MODE_REQUIRED');
demand(process.env.GITHUB_TOKEN?.length>10,'GITHUB_TOKEN_MISSING');
const env=process.env;
const meta={event:env.GITHUB_EVENT_NAME,ref:env.GITHUB_REF,repo:env.GITHUB_REPOSITORY,
 sha:env.GITHUB_SHA,attempt:env.GITHUB_RUN_ATTEMPT,runId:env.GITHUB_RUN_ID};
const trigger=readFileSync(PATH,'utf8'),t=parse(trigger);
const api='https://api.github.com/repos/'+REPO;
async function get(path){
 const r=await fetch(api+path,{headers:{Authorization:'Bearer '+env.GITHUB_TOKEN,
  Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
  signal:AbortSignal.timeout(15000)});
 demand(r.ok,'GITHUB_API_'+r.status);return r.json();
}
const [prs,pr,comments,commit,files,branch,runs]=await Promise.all([
 get('/commits/'+meta.sha+'/pulls?per_page=100'),
 get('/pulls/'+t.approval_pr),
 get('/issues/'+t.approval_pr+'/comments?per_page=100'),
 get('/commits/'+meta.sha),
 get('/pulls/'+t.approval_pr+'/files?per_page=100'),
 get('/branches/preview'),
 get('/actions/workflows/notification-d1-triggers-off-release.yml/runs?event=push&head_sha='+meta.sha+'&per_page=100'),
]);
const s=verifyApproval009({meta,trigger,prs,pr,comments,commit,files,branch,runs});
demand(env.GITHUB_OUTPUT&&env.GITHUB_OUTPUT.startsWith('/'),'GITHUB_OUTPUT_MISSING');
appendFileSync(env.GITHUB_OUTPUT,'source_sha='+s+'\n');
console.log('NOTIFICATION_009_OWNER_ONE_USE_APPROVAL=PASS');
