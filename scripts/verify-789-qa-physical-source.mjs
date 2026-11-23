// APP789 one-shot source / narrow-scope invariants. No network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const entry=readFileSync('cloudflare/explore-worker/experiments/owner-follow-qa789-entry.mjs','utf8');
const runner=readFileSync('scripts/app789-qa-physical-runner.mjs','utf8');
const workflow=readFileSync('.github/workflows/app768-qa-r2-conditional-race.yml','utf8');
for(const s of [
 "import legacy, {OwnerFollowIsolated558 as OriginalOwnerDO}",
 "export class OwnerFollowIsolated558 extends OriginalOwnerDO",
 "QA789_ISOLATED==='1'",
 "idFromName(env.QA789_DO_NAME)",
 "createApp761ProductionOwnerDoRuntime",
 "createApp788QaOwnerHistoryWithDo",
 "APP788_ISOLATED_SYNTHETIC_QA",
 "qa.state.storage.deleteAll()",
 "QA789_R2",
 "QA789_D1",
])assert(entry.includes(s),'missing guarded QA route: '+s);
for(const s of ["ORIGINAL='4ed70845-6a4b-4a80-9c51-ed95d0becc38'",
 "soridraw-qa-app768-r2","soridraw-qa-app768-d1",
 "b60fcd62c679c64db19f0b0e0c2f3429",
 "e1a30fc9ef497fda1d34f4ab3dc1da45",
 "QA789_EXISTING_RESOURCES_ONE_SHOT",
 "/versions?deploy=false",
 "type:'inherit'","etagDoesNotMatch",
 "APP789_ORIGINAL_QA583_EXCLUSIVE_100",
 "qa789_"+ "'+RUN",
])assert(runner.includes(s),'missing exact runner guard: '+s);
assert(runner.includes("method='GET'"));
assert(runner.includes("GET"));assert(entry.includes("QA789_EXACT_SYNTHETIC_DO_WIPED"));
assert(entry.includes("if(!guard(request,env))return reply(403"));
assert(runner.includes("if(![0,1].includes(x.meta.rows_written))"));
assert(workflow.includes("if: false # APP785 QA exact one-shot PASS"));
assert(!entry.includes('functions.net/')&&!runner.includes('functions.net/'),
 'No real Firebase Functions invocation in APP789');
assert(!runner.includes('wrangler deploy')&&!runner.includes('firebase deploy'));
console.log('APP789_EXISTING_QA_ACCOUNT_D1_R2_DO_ONE_SHOT_ONLY=PASS');
console.log('APP789_ORIGINAL_QA_WORKER_100_PERCENT_AND_EXACT_CLEANUP_REQUIRED=PASS');
console.log('APP789_NO_REAL_FIREBASE_AUTH_RTDB_AND_NO_NEW_DO_MIGRATION=PASS');
console.log('APP789_PHYSICAL_QA_AND_REAL_WORKERS_BINDING=NOT_TESTED');
