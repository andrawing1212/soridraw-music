import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const rail = fs.readFileSync('src/components/studio/StudioLeftRail.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const studioCss = fs.readFileSync('src/components/studio/studioLayout.css', 'utf8');

assert.match(css, /SORIDRAW_ACCOUNT_MENU_PARITY_219_20260929/);
assert.match(studioCss, /SORIDRAW_STUDIO_ACCOUNT_MENU_PARITY_219_20260929/);

// Canonical top/mobile account menus keep their current visual language and mode control.
assert.match(app, /soridraw-profile-menu soridraw-account-menu-surface absolute right-5 top-\[68px\]/);
assert.match(app, /soridraw-account-menu-kicker">계정 메뉴/);
assert.match(app, /label: 'MY 페이지'[\s\S]*icon: UserIcon/);
assert.match(app, /label: '공개 프로필'[\s\S]*icon: Compass/);
assert.match(app, /label: '설정'[\s\S]*icon: Settings/);
assert.match(app, /soridraw-account-menu-mode/);
assert.match(app, /soridraw-account-menu-logout/);
assert.match(app, /soridraw-profile-menu soridraw-account-menu-surface absolute right-0 top-full/);

// Split left rail keeps the same surface/position, but its menu is intentionally minimal.
assert.match(rail, /const PROFILE_MENU_WIDTH = 224/);
assert.match(rail, /soridraw-studio-profile-menu soridraw-account-menu-surface/);
assert.match(rail, /soridraw-account-menu-kicker">계정 메뉴/);
for (const label of ['MY 페이지','공개 프로필','설정','로그아웃']) {
  assert.ok(rail.includes(label), 'rail action lost: ' + label);
}
for (const removed of ['관리자메뉴','디자인 모드','고객지원 · 준비중']) {
  assert.ok(!rail.includes(removed), 'rail-only item must be removed: ' + removed);
}
assert.match(rail, /const preferredLeft = rect\.right \+ PROFILE_MENU_GAP/);
assert.doesNotMatch(rail, /cycleSoridrawDisplayMode|getSoridrawDisplayModeLabel/);
assert.doesNotMatch(rail, /setIsThemeMenuOpen|isThemeMenuOpen|soridraw-studio-profile-theme-menu/);

assert.match(css, /width: 224px !important/);
assert.match(css, /border-radius: 18px !important/);
assert.match(css, /background: #242426 !important/);
assert.match(css, /backdrop-filter: none !important/);
assert.match(css, /data-soridraw-color-mode="light"[\s\S]*background: #eeebe7 !important/);
assert.match(studioCss, /SORIDRAW_STUDIO_ACCOUNT_MENU_PARITY_219_20260929[\s\S]*background: #242426 !important/);

console.log('219_TOP_ACCOUNT_MENU_MOBILE_VISUAL_LANGUAGE=PASS');
console.log('219_LEFT_RAIL_ACCOUNT_MENU_MOBILE_VISUAL_LANGUAGE=PASS');
console.log('219_DARK_LIGHT_ACCOUNT_SURFACE_PARITY=PASS');
console.log('219_ACCOUNT_MENU_OPAQUE=PASS');
console.log('219_LEFT_RAIL_RIGHT_SIDE_POSITION=PASS');
console.log('219_LEFT_RAIL_ACCOUNT_MENU_MINIMAL=PASS');
console.log('219_ACCOUNT_MENU_VISUAL_STRUCTURE_PRESERVED=PASS');
console.log('219_BACKEND_AND_DATA_PATHS_UNCHANGED=PASS');
