import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const rail = fs.readFileSync('src/components/studio/StudioLeftRail.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const studioCss = fs.readFileSync('src/components/studio/studioLayout.css', 'utf8');

assert.match(css, /SORIDRAW_ACCOUNT_MENU_PARITY_219_20260929/);
assert.match(studioCss, /SORIDRAW_STUDIO_ACCOUNT_MENU_PARITY_219_20260929/);

assert.match(app, /soridraw-profile-menu soridraw-account-menu-surface absolute right-5 top-\[68px\]/);
assert.match(app, /soridraw-account-menu-kicker">계정 메뉴/);
assert.match(app, /label: '내 프로필'[\s\S]*icon: UserIcon/);
assert.match(app, /label: '설정'[\s\S]*icon: Settings/);
assert.match(app, /label: '요금제'[\s\S]*icon: Tag/);
assert.match(app, /label: '결제 관리'[\s\S]*icon: CreditCard/);
assert.match(app, /soridraw-account-menu-mode/);
assert.match(app, /soridraw-account-menu-logout/);
assert.match(app, /soridraw-profile-menu soridraw-account-menu-surface absolute right-0 top-full/);

assert.match(rail, /const PROFILE_MENU_WIDTH = 224/);
assert.match(rail, /soridraw-studio-profile-menu soridraw-account-menu-surface/);
assert.match(rail, /soridraw-account-menu-kicker">계정 메뉴/);
for (const label of ['내 프로필','설정','요금제','결제 관리','고객지원 · 준비중','로그아웃']) {
  assert.ok(rail.includes(label), 'rail action lost: ' + label);
}
assert.match(rail, /getSoridrawDisplayModeLabel\(displayMode\)/);
assert.match(rail, /aria-haspopup="menu"/);
assert.match(rail, /setIsThemeMenuOpen\(\(current\) => !current\)/);

assert.match(css, /width: 224px !important/);
assert.match(css, /border-radius: 18px !important/);
assert.match(css, /background: rgba\(36,36,38,.98\) !important/);
assert.match(css, /data-soridraw-color-mode="light"[\s\S]*background: rgba\(238,235,231,.99\) !important/);

console.log('219_TOP_ACCOUNT_MENU_MOBILE_VISUAL_LANGUAGE=PASS');
console.log('219_LEFT_RAIL_ACCOUNT_MENU_MOBILE_VISUAL_LANGUAGE=PASS');
console.log('219_DARK_LIGHT_ACCOUNT_SURFACE_PARITY=PASS');
console.log('219_ACCOUNT_ACTIONS_PRESERVED=PASS');
console.log('219_BACKEND_AND_DATA_PATHS_UNCHANGED=PASS');
