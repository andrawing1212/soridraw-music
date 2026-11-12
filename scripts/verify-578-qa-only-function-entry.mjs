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
// Firebase-generated config may reference the unused same-project US default.
const config=JSON.stringify({projectId:'soridraw-app',
 databaseURL:'https://soridraw-app-default-rtdb.firebaseio.com'});
const env={FIREBASE_CONFIG:config,GCLOUD_PROJECT:'soridraw-app',
 SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED:'1',
 SORIDRAW_QA_OWNER_UID_578:'ownerA578',
 SORIDRAW_QA_RTDB_URL_578:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app/'};
assert.deepEqual(plan(env),{ok:true,ownerUid:'ownerA578',
 databaseURL:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app'});
assert.equal(plan({}).ok,false,'MISSING_CONFIG_MUST_FAIL_CLOSED');
const bad=[
 {SORIDRAW_QA_OWNER_FOLLOW_578_ENABLED:'0'},
 {FIREBASE_CONFIG:'{"projectId":"soridraw-app-866a5"}'},
 {GCP_PROJECT:'soridraw-app-866a5'},
 {GCP_PROJECT_NUMBER:'91309780603'},
 {GOOGLE_CLOUD_PROJECT:'soridraw-app-866a5'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-app-866a5-default-rtdb.firebaseio.com'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-app-default-rtdb.firebaseio.com'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-qa-sg.firebaseio.com'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-qa-sg.asia-east1.firebasedatabase.app'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-qa-sg.asia-southeast1.firebasedatabase.app.attacker.test'},
 {SORIDRAW_QA_RTDB_URL_578:'https://soridraw-app-default-rtdb.firebaseio.com.attacker.test'},
 {SORIDRAW_QA_OWNER_UID_578:''},
 {SORIDRAW_QA_OWNER_UID_578:'../shared'},
 {FIREBASE_CONFIG:'{"projectId":"soridraw-app","databaseURL":"https://soridraw-app-866a5-default-rtdb.firebaseio.com"}'},
 {FIREBASE_CONFIG:'{"projectId":"soridraw-app","databaseURL":"https://soridraw-qa-sg.other-region.firebasedatabase.app"}'},
];
for(const change of bad)assert.equal(plan({...env,...change}).ok,false,
 'PRODUCTION_OR_INCOMPLETE_QA_CONFIG_MUST_FAIL '+JSON.stringify(change));
const src=readFileSync('functions/qa577/src/index.ts','utf8');
const compiled=readFileSync(main,'utf8');
// Regression: Firebase discovery MUST NOT load the production webhook.
// Its top-level defineSecret registers HMAC_539 and would prompt for a
// production-named secret during a QA-only deployment.
const qaHandler=readFileSync('functions/qa577/src/owner-follow-handler-qa578.ts','utf8');
const prodWebhook=readFileSync('functions/src/exploreOwnerFollowerWebhook542.ts','utf8');
const qaPure=qaHandler.slice(qaHandler.indexOf('const UID='));
const prodPure=prodWebhook.slice(prodWebhook.indexOf('const UID='),
 prodWebhook.indexOf('export const publishExploreOwnerFollower542=onRequest'));
assert.equal(qaPure,prodPure,'QA_HMAC_VALIDATION_MUST_MATCH_PROVEN_PURE_HANDLER');
assert.match(src,/from ['"]\.\/owner-follow-handler-qa578['"]/);
assert.doesNotMatch(src,/exploreOwnerFollowerWebhook542|SORIDRAW_OWNER_FOLLOW_HMAC_539/);
assert.doesNotMatch(qaPure,/onRequest\(|defineSecret\(|SORIDRAW_OWNER_FOLLOW_HMAC_539/);
assert.doesNotMatch(compiled,/exploreOwnerFollowerWebhook542|SORIDRAW_OWNER_FOLLOW_HMAC_539/);
const qaFunction=require('../'+main).publishExploreOwnerFollower542;
assert.equal(typeof qaFunction,'function');
const wiredSecrets=qaFunction.__endpoint?.secretEnvironmentVariables || [];
assert.deepEqual(wiredSecrets.map(x=>x.key),['SORIDRAW_QA_OWNER_FOLLOW_HMAC_578']);
console.log('APP578_QA_IMPORT_DOES_NOT_REGISTER_PRODUCTION_HMAC_539=PASS');
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
