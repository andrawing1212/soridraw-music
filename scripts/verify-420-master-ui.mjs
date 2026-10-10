import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ui = readFileSync('src/components/ExploreLikeAbuseMasterPanel420.tsx', 'utf8');
const page = readFileSync('src/pages/AdminAppSettingsPage.tsx', 'utf8');
const functions = readFileSync('functions/src/index.ts', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json','utf8'));
assert.match(ui, /normalizeStaffRole\(readUserProfileCache\(uid\)\) === 'master'/,
  'panel is hidden from regular Admin');
assert.match(ui, /if \(!isMaster\) return null/,
  'non-Master must not view private management controls');
for(const endpoint of [
  'masterGetExploreLikePolicy420',
  'masterSetExploreLikePolicy420',
  'masterGetExploreLikeLimit420',
  'masterUnlockExploreLike420',
]) {
  assert(ui.includes(endpoint), 'Master panel must invoke '+endpoint);
  const i=functions.indexOf('export const '+endpoint+' = onCall(');
  assert(i>=0, 'server endpoint missing '+endpoint);
  const next=functions.indexOf('\nexport const ',i+10);
  const segment=functions.slice(i,next<0?undefined:next);
  assert.match(segment,/await requireMasterCaller\(request\)/,
    'backend Master auth missing: '+endpoint);
}
assert.match(ui, /window\.confirm\(/,'early unlock must require explicit confirmation');
assert.match(ui, /loadedPolicy/,'admin setting must indicate dirty state');
assert.doesNotMatch(ui, /setDoc\(|updateDoc\(|\.ref\(/,
  'Master policy client must never bypass server');
assert.match(page, /<ExploreLikeAbuseMasterPanel420\s*\/>/,
  'existing app settings route must contain only the protected panel');
assert.match(page,/const STAGE420_MASTER_PANEL_ACTIVE = false;/,
  'unreleased Master panel must remain disabled while backend callables are absent');
assert.match(page,/\{STAGE420_MASTER_PANEL_ACTIVE && <ExploreLikeAbuseMasterPanel420\s*\/>\}/,
  'Master panel must be gated from PREVIEW app startup while Stage420 cutover is off');
assert.equal(rules.rules.privateLikeSync420, undefined,
  'shared live rules must remain unchanged until final gate');
console.log('STAGE420_MASTER_UI_ONLY_AND_SERVER_MASTER_GUARDS=PASS');
console.log('STAGE420_AUDITED_MANUAL_UNLOCK_WITH_CONFIRMATION=PASS');
console.log('STAGE420_NO_CLIENT_SIDE_ADMIN_WRITES=PASS');
console.log('STAGE420_ADMIN_UI_DEPLOY_AND_LIVE_PERMISSION=NOT_TESTED');
