// Stage420 mandatory upgrade policy - source-level fail-closed contract.
// The feature remains OFF until one coherent all-environment release.
// No live Firebase, Cloudflare, RTDB or user data is accessed here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const worker = read('cloudflare/explore-worker/canonical/preview-entry.js');
const like = read('src/services/exploreLikeService.ts');
const notice = read('src/services/appUpdateNotice.ts');
const rules = JSON.parse(read('database.rules.json')).rules;
const preflight = worker.slice(worker.indexOf('async function verifySignedLegacyLikeIntake420('),
  worker.indexOf('// SORIDRAW_426_DORMANT_LIKE_BATCH_V171_ROUTE'));
assert.match(worker,/const STAGE420_SIGNED_LEGACY_INTAKE_OPEN = false;/,
  'cannot partially activate Worker before shared Rules and all clients');
const auth = preflight.indexOf('await validateExploreAuth307(');
const unsigned = preflight.indexOf("code:'420_APP_UPGRADE_REQUIRED'");
const signature = preflight.indexOf('await verifyGuardedLikeBatch420(');
const delegate = worker.indexOf('const rejected = await verifySignedLegacyLikeIntake420(');
const base = worker.indexOf('await baseWorker.fetch(request, env, ctx)', delegate);
assert.ok(auth >= 0 && unsigned > auth && signature > unsigned,
  'unauthenticated users cannot bypass UID verification; unsigned intake fails before HMAC/canonical');
assert.ok(delegate >= 0 && base > delegate,
  'signed intake only delegates to existing canonical Writer after verification');
assert.match(preflight,/body\.mutations\.length <= 50/,
  'oversized legacy batches cannot trigger downgrade exception');
assert.match(preflight,/status:409,headers/,
  'legacy client gets actionable mandatory update response');
assert.match(like,/response\.status === 409 &&[\s\S]*?420_APP_UPGRADE_REQUIRED/,
  'only explicit canonical 409 triggers update reminder');
assert.match(like,/new CustomEvent\('soridraw:like-upgrade-required-420'\)/);
assert.match(notice,/window\.addEventListener\(LIKE_UPGRADE_REQUIRED_EVENT_420/);
assert.match(notice,/window\.location\.reload\(\)/,
  'update button keeps the existing reload mechanism');
assert.doesNotMatch(notice,/localStorage\.clear\(|sessionStorage\.clear\(|indexedDB\.deleteDatabase\(/,
  'mandatory update must not destroy local pending data');
assert.match(like,/persistLikeOutbox\(uid, latest\);[\s\S]*?dispatchLikeSyncError\(/,
  'batch refusal retains durable outbox before showing error');
assert.equal(rules.userSync.$uid['.write'], 'auth != null && auth.uid === $uid',
  'shared RTDB Permissions may change ONLY in coordinated cutover');
// Execute the exact Worker preflight in an isolated Node runtime. Its early
// responses must never reach the existing canonical delegate (D1 R0/W0).
const {runInNewContext} = await import('node:vm');
const {Request,Response,Headers} = globalThis;
let allowAuth = true;
let signatureChecks = 0;
let canonicalEntrances = 0;
const mock = {
  Response, Headers, JSON, Date, console,
  like426Headers: () => new Headers({'Content-Type':'application/json','Access-Control-Allow-Origin':'https://preview.soridraw.com'}),
  validateExploreAuth307: async () => allowAuth
    ? {ok:true,uid:'user420'}
    : {ok:false,response:new Response('unauthorized',{status:401})},
  verifyGuardedLikeBatch420: async ({body,authenticatedUid}) => {
    signatureChecks++;
    assert.equal(authenticatedUid,'user420');
    if (!Array.isArray(body?.mutations) ||
        body.mutations.some(row=>row.guardPermit420!=='valid')) {
      throw new Error('invalid signature');
    }
    canonicalEntrances++; // In production this admission permits baseWorker call.
  },
};
const runtime = {exports:{}};
const extract=worker.slice(worker.indexOf('async function verifySignedLegacyLikeIntake420('),
  worker.indexOf('// SORIDRAW_426_DORMANT_LIKE_BATCH_V171_ROUTE'));
assert.match(extract,/async function verifySignedLegacyLikeIntake420/);
const handler=runInNewContext(extract+'; verifySignedLegacyLikeIntake420;',mock,{timeout:1000});
const submit=(mutations,secret='fixture-key')=>handler(new Request('https://example.invalid/v1/me/likes/batch',{
  method:'POST',body:JSON.stringify({mutations}),
}),{SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET:secret},{});
const old=await submit([{trackId:'song-a',liked:true,operationId:'op-a'}]);
assert.equal(old.status,409);
assert.equal((await old.json()).error.code,'420_APP_UPGRADE_REQUIRED');
assert.equal(signatureChecks,0);
assert.equal(canonicalEntrances,0);
const mixed=await submit([{trackId:'song-a',guardPermit420:'valid'},
  {trackId:'song-b'}]);
assert.equal(mixed.status,409,'one unsigned mutation rejects entire 50-row batch');
assert.equal(canonicalEntrances,0);
const valid=await submit([{trackId:'song-a',guardPermit420:'valid'}]);
assert.equal(valid,null,'fully verified batch falls through to the existing Worker');
assert.equal(signatureChecks,1);
assert.equal(canonicalEntrances,1);
const forged=await submit([{trackId:'song-a',guardPermit420:'forged'}]);
assert.equal(forged.status,403);
assert.equal(canonicalEntrances,1,'forged batch never reaches canonical mutation');
const keyMissing=await submit([{trackId:'song-a',guardPermit420:'valid'}],'');
assert.equal(keyMissing.status,503);
assert.equal(canonicalEntrances,1);
allowAuth=false;
const unauthorized=await submit([{trackId:'song-a'}]);
assert.equal(unauthorized.status,401);
assert.equal(canonicalEntrances,1);
console.log('STAGE420_EXECUTABLE_OLD_CLIENT_409_BEFORE_CANONICAL=PASS');
console.log('STAGE420_EXECUTABLE_MIXED_UNSIGNED_BATCH_NO_PARTIAL_D1=PASS');
console.log('STAGE420_EXECUTABLE_HMAC_TAMPER_AUTH_KEY_FAIL_CLOSED=PASS');

// Run the real app-update controller in a minimal browser sandbox. A 409
// before hosting publishes the NEXT version must not trigger an infinite
// same-version reload; a published newer version must allow exactly one.
{
  const vm = await import('node:vm');
  const ts = await import('typescript');
  const updateSource = read('src/services/appUpdateNotice.ts');
  const events = new Map();
  const nodes = new Map();
  const storage = new Map();
  let remoteVersion420 = 398;
  let failManifest420 = false;
  let reloads420 = 0;
  const requested420 = [];
  const window420 = {
    location:{hostname:'preview.soridraw.com',reload:()=>{reloads420++;}},
    localStorage:{
      getItem:k=>storage.get(k)??null,
      setItem:(k,v)=>storage.set(k,String(v)),
      get length(){return storage.size;},
      key:i=>Array.from(storage.keys())[i]??null,
    },
    sessionStorage:{length:0,key:()=>null,removeItem:()=>{}},
    addEventListener:(event,cb)=>events.set(event,cb),
    setInterval:()=>1, clearInterval:()=>{},
    setTimeout:()=>1,clearTimeout:()=>{},
    requestAnimationFrame:()=>1,innerWidth:1200,
  };
  const doc420 = {
    body:{appendChild:element=>{nodes.set(element.id,element);}},
    createElement:()=>({
      id:'',style:{},listeners:{},
      setAttribute(key,value){this[key]=value;},
      addEventListener(event,handler){this.listeners[event]=handler;},
      remove(){nodes.delete(this.id);},
    }),
    getElementById:id=>nodes.get(id)||null,
    querySelector:()=>null,
    querySelectorAll:()=>[],
    addEventListener:(event,cb)=>events.set('document:'+event,cb),
    visibilityState:'visible',
  };
  const exports420={};
  const code420=ts.transpileModule(updateSource,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText+
    '\nexports.__check420=checkForUpdate;';
  vm.runInNewContext(code420,{
    exports:exports420,document:doc420,window:window420,
    __SORIDRAW_APP_VERSION__:'398',
    fetch:async (url,opts)=>{
      requested420.push({url,opts});
      if(failManifest420) throw Error('manifest offline');
      return {ok:true,json:async()=>({version:remoteVersion420})};
    },
    Date,Number,Math,Set,Map,Object,Array,String,console,
  },{timeout:2000});
  exports420.startAppUpdateNotice();
  await exports420.__check420(true);
  assert.equal(nodes.has('soridraw-app-update-notice'),false,
    'healthy app398 cannot show a forced update without server 409');
  events.get('soridraw:like-upgrade-required-420')();
  await exports420.__check420(true);
  const notice420=nodes.get('soridraw-app-update-notice');
  assert.ok(notice420,'409 must preserve a useful upgrade notice');
  assert.match(notice420.textContent,/준비 중/);
  notice420.listeners.click();
  await exports420.__check420(true);
  assert.equal(reloads420,0,
    'newer Hosting manifest missing: never reload the same old bundle');
  failManifest420=true;
  await exports420.__check420(true);
  assert.ok(nodes.has('soridraw-app-update-notice'),
    'network outage cannot hide a verified Worker rejection');
  notice420.listeners.click();
  assert.equal(reloads420,0,'manifest outage cannot cause reload loops');
  failManifest420=false;
  remoteVersion420=399;
  await exports420.__check420(true);
  assert.match(notice420.textContent,/필수 · 적용/);
  notice420.listeners.click();
  assert.equal(reloads420,1,'published newer build allows one real reload');
  assert.ok(requested420.every(r=>r.url.startsWith('/app-version.json?t=')),
    'mandatory upgrade may fetch only the public version manifest');
  assert.ok(requested420.every(r=>r.opts?.cache==='no-store'));
  
// Old v4 outbox entries are opaque: a new signed click may replace ONE row
// only when the user confirms in the existing like action. On cancel, no
// mutation or new operation ID is created. app398 OFF stays exactly unchanged.
assert.match(like,/export const readLegacyPendingLikeForUpgrade420/);
assert.match(like,/if \(!EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE \|\| !uid \|\| !trackId\) return null;/);
const pageLike = read('src/pages/ExplorePage.tsx');
const toggleStart420 = pageLike.indexOf('  const toggleLike = async (track: ExploreTrack) => {');
const toggleEnd420 = pageLike.indexOf('  const selectLatestPublicScope312',toggleStart420);
assert.ok(toggleStart420>=0 && toggleEnd420>toggleStart420);
const toggle420=pageLike.slice(toggleStart420,toggleEnd420);
assert.match(toggle420,/const legacyPending420 = readLegacyPendingLikeForUpgrade420\(user\.uid, track\.id\);/);
assert.match(toggle420,/if \(!window\.confirm\(confirmMessage420\)\) \{/);
assert.match(toggle420,/setSocialNotice\('이전 미전송 좋아요는 기기에 그대로 보관됩니다\.'\);\s*return;/);
assert.ok(toggle420.indexOf('window.confirm(') < toggle420.indexOf('setExploreTrackLike('),
  'no new signed click before consent');
assert.match(toggle420,/legacyPending420\?\.desiredLiked \?\? !currentLiked/,
  'old intent confirmation must keep the original desired state');
assert.match(like,/operationId: EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\s*\? createExploreLikeOperationId420\(\)\s*: createExploreLikeOperationId144\(\)/,
  'new explicit confirmation alone creates a v7 operation');
assert.match(like,/const eligibleGuardedMutation420 =[\s\S]*?entry\.guardStatus420 === 'approved'/,
  'unapproved old outbox cannot drain in the background');
console.log('STAGE420_OLD_OUTBOX_REQUIRES_USER_CONFIRMATION_NO_AUTOREKEY=PASS');
console.log('STAGE420_CONFIRM_SAME_DESIRED_STATE_AND_NO_CANCEL_LOSS=PASS');
console.log('STAGE420_MANDATORY_UPGRADE_VERSION_READY_NO_RELOAD_LOOP=PASS');
  console.log('STAGE420_SERVER_409_MANIFEST_OFFLINE_RETAINS_NOTICE=PASS');
  console.log('STAGE420_UPGRADE_VERSION_CHECK_ONLY_USER_DB_R0=PASS');
}
console.log('STAGE420_MANDATORY_UPGRADE_AUTH_FIRST_409_BEFORE_CANONICAL=PASS');
console.log('STAGE420_USER_OUTBOX_AND_CACHE_PRESERVED_ON_409=PASS');
console.log('STAGE420_OLD_APP_UPDATE_NOTICE_NO_USER_DB_READ=PASS');
console.log('STAGE420_WORKER_AND_SHARED_RULES_NOT_PARTIALLY_ACTIVATED=PASS');
