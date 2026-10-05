import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const favorites = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const navigation = readFileSync('src/constants/navigationVisibility.ts', 'utf8');
const cacheDiagnostics = readFileSync('src/lib/cacheDiagnostics.ts', 'utf8');
const adminSettings = readFileSync('src/pages/AdminAppSettingsPage.tsx', 'utf8');
const updateNotice = readFileSync('src/services/appUpdateNotice.ts', 'utf8');

// Library "hidden" is the only gate. Admin-only still has menuVisibility.library === true.
assert.match(
  app,
  /\{menuVisibility\.library && \(\s*<div className="soridraw-result-music-api-card/,
  'Recent/Result Music API card must be gated by raw Library visibility',
);
const historyPropMatches = app.match(/showMusicApiGeneration=\{menuVisibility\.library\}/g) || [];
assert.equal(historyPropMatches.length, 3, 'all Music Note mounts must receive raw Library visibility');

assert.match(
  favorites,
  /showMusicApiGeneration = true/,
  'Music Note must accept the Library-based Music API visibility prop',
);
assert.match(
  favorites,
  /\{showMusicApiGeneration && \(\s*<section className="rounded-\[28px\].*?Music API 생성/s,
  'Music Note detail Music API section must be gated',
);
assert.match(
  favorites,
  /showMusicApiGeneration && showFavoriteMusicApiModal && selectedSong/,
  'hidden Library must also prevent the Music API modal from rendering',
);

// Administrator choices survive app-version/storage-schema updates through
// stable, unversioned mirrors. Versioned keys remain for backward compatibility.
assert.match(
  navigation,
  /ADMIN_NAVIGATION_VISIBILITY_PERSISTENT_STORAGE_KEY = 'soridraw_admin_navigation_visibility_persistent'/,
  'navigation admin state needs a stable persistent key',
);
assert.match(
  navigation,
  /localStorage\.getItem\(ADMIN_NAVIGATION_VISIBILITY_PERSISTENT_STORAGE_KEY\)/,
  'navigation reader must fall back to the stable persistent key',
);
assert.match(
  navigation,
  /localStorage\.setItem\(ADMIN_NAVIGATION_VISIBILITY_PERSISTENT_STORAGE_KEY, JSON\.stringify\(settings\)\)/,
  'navigation writer must update the stable persistent key',
);

assert.match(
  cacheDiagnostics,
  /CACHE_DIAGNOSTICS_PERSISTENT_ENABLED_STORAGE_KEY = 'soridraw_admin_cache_diagnostics_enabled_persistent'/,
  'cache diagnostics needs a stable enabled preference key',
);
assert.match(
  cacheDiagnostics,
  /CACHE_DIAGNOSTICS_PERSISTENT_OWNER_UID_STORAGE_KEY = 'soridraw_admin_cache_diagnostics_owner_uid_persistent'/,
  'cache diagnostics needs a stable owner key',
);
assert.match(
  cacheDiagnostics,
  /localStorage\.setItem\(CACHE_DIAGNOSTICS_PERSISTENT_ENABLED_STORAGE_KEY, enabledText\)/,
  'cache diagnostics writer must preserve ON/OFF across updates',
);

assert.ok(
  !/setSavedSettings\(DEFAULT_NAVIGATION_VISIBILITY_SETTINGS\)/.test(adminSettings)
  && !/setDraftSettings\(DEFAULT_NAVIGATION_VISIBILITY_SETTINGS\)/.test(adminSettings),
  'admin settings load failure must never reset the last state to defaults',
);
assert.match(
  adminSettings,
  /const preservedSettings = readStoredNavigationVisibilitySettings\(\)/,
  'admin settings load failure must keep the last locally persisted state',
);

// The update-notice/reload mechanism must never wipe persistent admin choices.
assert.ok(!updateNotice.includes('localStorage.clear('), 'app update flow must never clear localStorage');
for (const protectedKey of [
  'soridraw_admin_navigation_visibility_persistent',
  'soridraw_admin_cache_diagnostics_enabled_persistent',
  'soridraw_admin_cache_diagnostics_owner_uid_persistent',
]) {
  assert.ok(!updateNotice.includes(`removeItem('${protectedKey}')`) && !updateNotice.includes(`removeItem("${protectedKey}")`),
    `app update flow must not remove protected admin preference: ${protectedKey}`);
}

console.log('APP207_LIBRARY_HIDDEN_GATES_RECENT_MUSIC_API=PASS');
console.log('APP207_LIBRARY_HIDDEN_GATES_MUSIC_NOTE_DETAIL_API=PASS');
console.log('APP207_ADMIN_SETTINGS_PERSIST_ACROSS_APP_UPDATE=PASS');
console.log('APP207_UPDATE_FLOW_DOES_NOT_RESET_ADMIN_PREFERENCES=PASS');
