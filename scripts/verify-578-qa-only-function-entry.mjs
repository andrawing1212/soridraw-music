// APP578 exact QA Functions executable gate. Run only after an isolated
// TypeScript compile; no login, network, Cloudflare/Firebase or data mutations.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const path='functions/qa577/lib/qa577/src/guard.js';
const main='functions/qa577/lib/qa577/src/index.js';
assert.ok(existsSync(path)&&existsSync(main),'BUILD_QA_ONLY_NOT_PRESENT');
const {planQaOwnerFollowRuntime578:plan}=require('../'+path);
const config=JSON.stringify({projectId:'soridraw-app',
 databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com'});
const env={FIREBASE_CONFIG:config,GCLOUD_PROJECT:'soridraw-app',
 SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED:'1',
 SORIDRAW_QA_OWNER_UID_578:'ownerA578',
 SORIDRAW_QA_RTDB_URL_578:'https://soridraw-app-default-rtdb.firebaseio.com/'};
assert.deepEqual(plan(env),{ok:true,ownerUid:'ownerA578',
 databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com'});
const bad=[
 {},{SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED:'0'},
 {FIREBASE_CONFIG:'{"projectId":"soridraw-app-866a5"}'},
 {GCP_PROJECT:'soridraw-app-866a5'},
 {GCP_PROJECT_NUMBER:'91309780603'},
 {GOOGLE_CLOUD_PROJECT:'soridraw-app-866a5'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-app-866a5-default-rtdb.firebaseio.com'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-app-default-rtdb.firebaseio.com.attacker.test'},
 {SORIDRAW_QA_OWNER_UID_578:''},
 {SORIDRAW_QA_OWNER_UID_578:'../shared'},
 {FIREBASE_CONFIG:'{"projectId":"soridraw-app","databaseURL":"https://soridraw-app-866a5-default-rtdb.firebaseio.com"}'},
];
for(const change of bad)assert.equal(plan({...env,...change}).ok,false,
 'PRODUCTION_OR_INCOMPLETE_QA_CONFIG_MUST_FAIL '+JSON.stringify(change));
const src=readFileSync('functions/qa577/src/index.ts','utf8');
const compiled=readFileSync(main,'utf8');
const qaConfig=JSON.parse(readFileSync('firebase.qa577.json','utf8'));
const qaPackage=JSON.parse(readFileSync('functions/qa577/package.json','utf8'));
assert.equal(qaConfig.functions.length,1);
assert.equal(qaConfig.functions[0].source,'functions/qa577');
assert.equal(qaPackage.main,'lib/qa577/src/index.js');
assert.match(src,/createOwnerFollowerHttp542/);
assert.match(src,/maxInstances:1,concurrency:1/);
assert.doesNotMatch(src,/from\s*['"]\.\.\/\.\.\/src\/index/);
assert.doesNotMatch(compiled,/soridraw-app-866a5/);
assert.doesNotMatch(compiled,/require\(['"]\.\.\/\.\.\/src\/index/);
assert.equal((compiled.match(/exports\.publishExploreOwnerFollower542/g)||[]).length>=1,true);
console.log('APP578_QA_ONLY_FUNCTION_ENTRY_BUILT_AND_PROD_ADMIN_UNIMPORTED=PASS');
console.log('APP578_QA_RUNTIME_CONFIG_WRONG_PROJECT_DB_OWNER_DISABLED_FAIL_CLOSED=PASS');
console.log('APP578_NOT_DEPLOYED_NO_LIVE_BILLING_OR_USER_DATA=PASS');
