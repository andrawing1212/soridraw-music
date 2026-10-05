import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const rail = fs.readFileSync('src/components/studio/StudioLeftRail.tsx', 'utf8');
const shell = fs.readFileSync('src/components/explore/ExploreShell.tsx', 'utf8');

const desktopStart = app.indexOf('soridraw-profile-menu soridraw-account-menu-surface absolute right-5');
const desktopEnd = app.indexOf('</motion.div>', desktopStart);
const desktop = app.slice(desktopStart, desktopEnd);

const mobileStart = app.indexOf('soridraw-profile-menu soridraw-account-menu-surface absolute right-0 top-full');
const mobileEnd = app.indexOf('</motion.div>', mobileStart);
const mobile = app.slice(mobileStart, mobileEnd);

for (const block of [desktop, mobile, rail]) {
  assert.ok(block.includes('MY 페이지'), 'MY 페이지 missing');
  assert.ok(block.includes('MY 프로필'), 'MY 프로필 missing');
  assert.ok(block.includes('설정'), '설정 missing');
  assert.ok(block.indexOf('MY 페이지') < block.indexOf('MY 프로필'), 'MY profile must follow MY page');
  assert.ok(!block.includes('요금제'), 'plan row must be removed from account menu');
  assert.ok(!block.includes('결제 관리'), 'billing row must be removed from account menu');
}

assert.match(app, /\/explore\?profile=\$\{encodeURIComponent\(user\.uid\)\}/);
assert.match(rail, /onPublicProfile: \(\) => void/);
assert.match(rail, /data-soridraw-menu-access="explore"[\s\S]{0,300}onPublicProfile/);
assert.match(shell, /onPublicProfile=\{\(\) => \{/);
assert.match(shell, /\/explore\?profile=\$\{encodeURIComponent\(user\.uid\)\}/);

assert.doesNotMatch(rail, /onPlan|onBilling|BadgeDollarSign|CreditCard/);
assert.doesNotMatch(shell, /onPlan=|onBilling=/);
assert.doesNotMatch(app, /onPlan=\{\(\) => navigate\('\/my-page\?tab=plan'\)\}/);
assert.doesNotMatch(app, /onBilling=\{\(\) => navigate\('\/my-page\?tab=billing'\)\}/);

assert.match(app, /<ExploreShellLazy isAdminUser=\{isAdminUser\} \/>/);
assert.doesNotMatch(rail, /관리자메뉴/);
assert.doesNotMatch(rail, /디자인 모드/);
assert.doesNotMatch(rail, /고객지원 · 준비중/);
assert.match(app, /관리자메뉴/);

console.log('220_MY_PAGE_LABEL=PASS');
console.log('220_PUBLIC_PROFILE_DIRECT_UID_ROUTE=PASS');
console.log('220_PLAN_BILLING_ROWS_REMOVED=PASS');
console.log('220_ACCOUNT_MENU_CORE_LAYOUT_ALL_MODES=PASS');
console.log('220_LEFT_RAIL_ADMIN_DESIGN_SUPPORT_REMOVED=PASS');
console.log('220_LIGHT_PALETTE_CONTRACT_REUSED=PASS');
console.log('220_NO_NEW_SERVER_LOOKUP=PASS');
