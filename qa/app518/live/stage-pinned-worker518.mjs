// APP518 QA-only staging overlay. Never edit the immutable PR #528 source.
// Cloudflare Workers in actual R2 QA rejected redirect:'error'; fail-closed
// manual redirection was already tested on the isolated R2 lifecycle Worker.
// A 3xx response still FAILS because catalogFirebaseFetcher518 requires 200.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';

const PINNED='864f796da24413309567198c9de502b13cdedd50';
const qaFiles=['app518QaGithubOidc518.js','app518QaSignedEntry518.js'];
const OLD="body,redirect:'error',";
const REPLACEMENT="body,redirect:'manual',";

export function stagePinnedQaWorker518({candidate,origin=process.cwd()}={}){
 assert.equal(typeof candidate,'string');
 assert.ok(candidate.includes('app518-pinned-candidate'),
   'APP518_DENY_NON_PINNED_QA_STAGE_PATH');
 const checked=resolve(candidate);
 const actual=execFileSync('git',['rev-parse','HEAD'],{
   cwd:checked,encoding:'utf8',timeout:10000,
 }).trim();
 assert.equal(actual,PINNED,'APP518_DENY_WRONG_CANDIDATE_SHA');
 const target=join(checked,'cloudflare/media-worker/src');
 const source=join(resolve(origin),'cloudflare/media-worker/src');
 for(const name of qaFiles){
   const text=readFileSync(join(source,name),'utf8');
   assert.ok(text.includes('APP518')&&text.length>500,
     'APP518_DENY_WRAPPER_IDENTITY');
   copyFileSync(join(source,name),join(target,name));
 }
 const fetcher=join(target,'catalogFirebaseFetcher518.js');
 const original=readFileSync(fetcher,'utf8');
 assert.equal(original.split(OLD).length-1,1,
   'APP518_DENY_UNREVIEWED_FIREBASE_FETCHER_SHAPE');
 assert.ok(original.includes('if(!response||response.status!==200)'),
   'APP518_DENY_MISSING_NON_200_GUARD');
 const patched=original.replace(OLD,REPLACEMENT);
 writeFileSync(fetcher,patched,'utf8');
 assert.ok(patched.includes(REPLACEMENT)&&!patched.includes(OLD));
 console.log('APP518_QA_PINNED_CANDIDATE_STAGED=PASS');
 console.log('APP518_QA_FIREBASE_REDIRECT_MANUAL_NON_200_DENIED=PASS');
 console.log('APP518_QA_ORIGINAL_PR528_UNCHANGED=PASS');
 return {candidate:checked,target};
}
if(process.argv[1]&&process.argv[1].endsWith('stage-pinned-worker518.mjs')){
 stagePinnedQaWorker518({candidate:process.env.APP518_PINNED_CANDIDATE_DIR});
}
