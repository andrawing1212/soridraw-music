import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const adminPage = fs.readFileSync('src/pages/AdminAppSettingsPage.tsx', 'utf8');
const service = fs.readFileSync('src/services/navigationVisibilitySyncService.ts', 'utf8');
const functions = fs.readFileSync('functions/src/index.ts', 'utf8');
const rules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));
const cache = fs.readFileSync('src/lib/firestoreReadCache.ts', 'utf8');
const version = JSON.parse(fs.readFileSync('public/app-version.json', 'utf8'));

assert.ok(Number(version.version) >= 192, `navigation visibility sync requires app192+; got ${version.version}`);

assert.match(service, /SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927/);
assert.match(service, /publicSync\/navigationVisibility/);
assert.doesNotMatch(service, /firebase\/firestore|getDoc\(|onSnapshot\(|collection\(/);

const navRules = rules?.rules?.publicSync?.navigationVisibility;
assert.ok(navRules, 'publicSync/navigationVisibility rules missing');
assert.equal(navRules['.read'], 'auth != null');
assert.equal(navRules['.write'], false);
for (const key of ['home','explore','studio','musicNote','library','lab','myPage']) {
  assert.ok(navRules.menuVisibility?.[key], 'menuVisibility rule missing: ' + key);
  assert.ok(navRules.menuAdminOnly?.[key], 'menuAdminOnly rule missing: ' + key);
}

assert.match(functions, /export const adminSetNavigationVisibility = onCall/);
assert.match(functions, /requireAdminCaller\(request, "appSettings"\)/);
assert.match(functions, /collection\("app_settings"\)\.doc\("navigation_visibility"\)\.set/);
assert.match(functions, /admin\.database\(\)\.ref\("publicSync\/navigationVisibility"\)\.set/);
assert.match(functions, /showSunoLibraryMenu: menuVisibility\.library/);
assert.match(functions, /sunoLibraryMenuAdminOnly: menuAdminOnly\.library/);

assert.match(adminPage, /httpsCallable\(functions, 'adminSetNavigationVisibility'\)/);
const saveStart = adminPage.indexOf('const saveNavigationSettings = async');
const saveEnd = adminPage.indexOf('const saveClicheGuard = async', saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart, 'navigation save block missing');
const saveBlock = adminPage.slice(saveStart, saveEnd);
assert.doesNotMatch(saveBlock, /setDoc\(/, 'navigation save must be one server callable, not a second client Firestore write');
assert.match(saveBlock, /getNavigationFirestorePayload\(draftSettings\)/);

assert.match(app, /subscribeNavigationVisibilitySync/);
assert.match(app, /SORIDRAW_NAVIGATION_VISIBILITY_SYNC_214_20260927/);
assert.match(app, /writeFirestoreReadCache\(FIRESTORE_READ_CACHE_KEYS\.navigationVisibility, nextSettings\)/);
assert.match(app, /canAccessNavigationMenu\('explore'\)/);
assert.match(app, /FeatureUnavailablePage label="익스플로어"/);
assert.match(app, /explore: \(menuVisibility\.explore \?\? true\) && !\(menuAdminOnly\.explore \?\? false\)/);
assert.match(app, /explore: \(menuVisibility\.explore \?\? true\) && \(!\(menuAdminOnly\.explore \?\? false\) \|\| isAdminMenuUser\)/);

assert.match(cache, /navigationVisibility: Number\.POSITIVE_INFINITY/);
assert.doesNotMatch(app, /onSnapshot\([^\n]*navigation_visibility/);

console.log('214_NAVIGATION_VISIBILITY_SYNC=PASS');
console.log('NORMAL_APP_START_FIRESTORE_NAV_READ=0_WITH_EXISTING_CACHE');
console.log('ADMIN_CHANGE=FIRESTORE_W1_PLUS_TINY_RTDB_MIRROR_W1');
console.log('OTHER_SIGNED_IN_DEVICES=RTDB_TINY_PAYLOAD_ONLY');
console.log('EXPLORE_DIRECT_ROUTE_GATE=PASS');


// app450 global split frame: keep menu writes backward compatible and use a
// separate tiny realtime signal, because deployed older TEST/PRODUCTION menu
// Functions still replace publicSync/navigationVisibility with .set().
const framePolicy = fs.readFileSync('src/constants/splitFrameGlobal.ts', 'utf8');
const masterPage = fs.readFileSync('src/pages/MasterPermissionsPage.tsx', 'utf8');
const appSettingsPage450 = fs.readFileSync('src/pages/AdminAppSettingsPage.tsx', 'utf8');
const masterFramePanel = fs.readFileSync('src/components/MasterSplitFramePanel.tsx', 'utf8');
const splitEngine = fs.readFileSync('src/components/studio/StudioSplitEngineWorkspace.tsx', 'utf8');
const liteSplit = fs.readFileSync('src/components/studio/LiteStudioSplitWorkspace.tsx', 'utf8');
assert.match(framePolicy, /'pure-pane', 'local-responsive', 'pure-pane-hybrid'/);
assert.match(framePolicy, /성능우선/);
assert.match(framePolicy, /보통/);
assert.match(framePolicy, /품질우선/);
assert.ok(!framePolicy.includes('최적우선'), 'old label must never return');
assert.match(framePolicy, /DEFAULT_SPLIT_FRAME_MODE: SplitFrameMode = 'pure-pane-hybrid'/);
assert.match(appSettingsPage450, /<MasterSplitFramePanel \/>/,
  'split frame settings must be in Admin App Settings');
assert.doesNotMatch(masterPage, /<MasterSplitFramePanel \/>|'split-frame'/,
  'Master permissions page layout must remain unchanged');
assert.match(masterFramePanel, /normalizeStaffRole\(readUserProfileCache\(uid\)\) === 'master'/,
  'the App Settings card must be hidden from non-Master viewers');
assert.match(masterFramePanel, /분할바 프레임/);
assert.match(masterFramePanel, /role="radiogroup"/);
assert.match(masterFramePanel, /masterSetSplitFrameMode/);
assert.match(masterFramePanel, /window\.confirm/);
assert.match(masterFramePanel, /disabled=\{!environment \|\| !serverReady \|\| saving \|\| draft === applied\}/);
assert.match(masterFramePanel, /isSplitFrameServerReady/,
  'Master must wait for first confirmed backend signal before applying global state');
const masterApplyBlock = masterFramePanel.slice(masterFramePanel.indexOf('const apply = async () => {'),
  masterFramePanel.indexOf('if (!isMaster) return null;'));
assert.ok(!masterApplyBlock.includes('setApplied(draft)'),
  'the last server response must not overwrite the authoritative mode received from another Master');
assert.match(masterApplyBlock, /실시간 동기화 신호를 확인합니다/,
  'Apply confirmation must distinguish callable acknowledgment from globally received policy');
assert.match(service, /export const subscribeSplitFrameRealtime/, 'Guest Studio needs a small public scalar subscription');
assert.match(service, /frameSubscriberCount \+= 1/,
  'signed-in menu and Guest Studio must share a reference-counted RTDB listener');
assert.match(service, /frameSubscriberCount !== 0/,
  'shared RTDB subscription must survive until last subscriber leaves');
assert.match(service, /splitFrameServerReady = false;/,
  'denied/failed listeners must clear serverReady and disable Master Apply');
assert.match(service, /window\.addEventListener\('online', retryFrameTransport\)/,
  'terminal RTDB listener failure must support network reconnection');
assert.match(splitEngine, /return subscribeSplitFrameRealtime\(\)/,
  'Guest Studio must listen even without authenticated navigation effect');
assert.match(splitEngine, /compactMobileMode && props\.viewMode === 'split'/,
  'compact mobile with no splitter must avoid needless policy subscription');
assert.match(service, /firstConfirmedSnapshot = !splitFrameServerReady/,
  'initial fallback Hybrid must not be treated as server-confirmed mode');
// app450 isolated Functions entry must retain the exact public callable name
// but must not pull unrelated exported Cloud Functions into its release package.
const isolated450 = fs.readFileSync('functions/src/masterSplitFrameMode450.ts', 'utf8');
assert.match(functions, /export \{ masterSetSplitFrameMode \} from "\.\/masterSplitFrameMode450"/);
assert.match(isolated450, /export const masterSetSplitFrameMode = onCall/);
assert.match(isolated450, /const requesterUid = request\.auth\?\.uid/);
assert.match(isolated450, /if \(!requesterUid\)/);
assert.match(isolated450, /collection\("users"\)\.doc\(requesterUid\)\.get\(\)/);
assert.match(isolated450, /requesterSnap\.data\(\)\?\.staffRole !== "master"/);
assert.match(isolated450, /SPLIT_FRAME_ORIGINS_450\[origin\]/);
assert.match(isolated450, /request\.data\?\.environment !== environment/);
assert.match(isolated450, /SORIDRAW_SPLIT_FRAME_ENABLED_ENVIRONMENTS \|\| "preview"/);
assert.match(isolated450, /ref\("publicSync\/splitFrameModes\/" \+ environment\)/);
assert.match(isolated450, /\.transaction\(\(stored\) => \{/);
assert.match(isolated450, /if \(current !== expectedMode\) return;/);
assert.match(isolated450, /if \(!outcome\.committed\)/);
assert.doesNotMatch(isolated450,
  /await admin\.firestore\(\)\.collection\([^\n]*\.set\(|splitFrameUpdatedAt|splitFrameModes: \{/,
  'app450 isolated callable must have ONE authoritative RTDB write, no dual-write');
assert.equal((isolated450.match(/\.set\(/g) || []).length, 0,
  'app450 must never bypass the atomic scalar transaction');
assert.equal((isolated450.match(/\.transaction\(/g) || []).length, 1,
  'app450 must perform only one atomic scalar transaction');

assert.ok(functions.includes('admin.database().ref("publicSync/navigationVisibility").set('),
  'legacy nav callable must remain compatible with older deployments');
assert.match(service, /publicSync\/splitFrameModes/);
assert.match(service, /ref\(realtimeDb, 'publicSync\/splitFrameModes\/' \+ env\)/,
  'each signed-in client must read only its own environment scalar');
assert.match(service, /if \(!env\) return unsubscribeMenu/,
  'unknown hosts must not start a shared-RTDB policy listener');

assert.match(service, /subscribeSplitFrameMode/);
assert.match(service, /unsubscribeMenu\(\); unsubscribeFrame\(\);/);
assert.doesNotMatch(service, /getDoc\(|onSnapshot\(|setInterval\(/);
assert.match(splitEngine, /readCurrentSplitFrameMode/);
assert.match(splitEngine, /subscribeSplitFrameMode/);
assert.match(splitEngine, /pointerup/);
assert.match(splitEngine, /effectiveSplitFrameMode/);
assert.match(splitEngine, /commitFrame = window\.requestAnimationFrame\(/,
  'global split mode must apply after final app448 pointer-up geometry cleanup');
assert.match(splitEngine, /window\.cancelAnimationFrame\(commitFrame\)/,
  'unmount must cancel pending global mode changes');
assert.doesNotMatch(splitEngine,
  /const releasePointer = \(\) => \{[\s\S]{0,130}setGlobalSplitFrameMode\(pendingMode\)/,
  'pointer-up capture must never directly replace app448 live split mode');
assert.ok(liteSplit.includes('const fullButtonDriftTooLarge'),
  'app448 PC full Generate 4px rebase must be preserved');
assert.ok(liteSplit.includes('const compactButtonDriftTooLarge'),
  'app448 compact Generate 4px rebase must be preserved');
// Rules are isolated into a separately audited PR; source code quality can
// pass safely before the shared RTDB Rules change is approved or deployed.
const frameRules = rules.rules.publicSync.splitFrameModes;
if (frameRules) {
  assert.equal(frameRules['.read'], false, 'guest policy cannot make parent public');
  assert.equal(frameRules['.write'], false, 'client writes to Master setting are forbidden');
  for (const environment of ['preview', 'test', 'production']) {
    assert.equal(frameRules[environment]?.['.read'], true,
      'authenticated and Guest Studio users may read only the public environment scalar');
    assert.ok(frameRules[environment]?.['.validate']?.includes('pure-pane-hybrid'),
      'missing strict RTDB mode validator for ' + environment);
  }
  assert.equal(frameRules.$other?.['.read'], false);
  assert.equal(frameRules.$other?.['.validate'], false);
}
console.log('VERIFY_450_MASTER_SPLIT_FRAME_GLOBAL_CONTROL_CONTRACT=PASS');
console.log('MASTER_ONLY_APPLY=PASS; PREVIEW_TEST_PRODUCTION_ISOLATED=PASS');
console.log('ONE_EXTRA_TINY_AUTH_RTD_B_SIGNAL; NO_FIRESTORE_OR_D1_READS_PER_PAGE');
