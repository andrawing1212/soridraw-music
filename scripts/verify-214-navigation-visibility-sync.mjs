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
