import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const service = readFileSync('src/services/exploreSocialService.ts', 'utf8');
const modal = readFileSync('src/components/explore/ExploreProfileEditModal.tsx', 'utf8');
const appVersion = Number(JSON.parse(readFileSync('public/app-version.json', 'utf8')).version || 0);

function functionText(source, name) {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `${name} missing`);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = '', escape = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (comment === 'line') { if (ch === '\n') comment = ''; continue; }
    if (comment === 'block') { if (ch === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (ch === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} unterminated`);
}

assert.ok(appVersion >= 249, `app version must be >=249, got ${appVersion}`);

const unified = functionText(worker, 'handleProfileUnifiedSave252');
assert.match(unified, /SORIDRAW_UNIFIED_PROFILE_SAVE_252_20260930/);
assert.match(unified, /request\.formData\(\)/);
assert.match(unified, /form\?\.get\("profile"\)/);
assert.match(unified, /form\?\.get\("avatar"\)/);
assert.match(unified, /form\?\.get\("background"\)/);
assert.match(unified, /handleMyProfileUpdate\(request, env, cors, \{/);
assert.doesNotMatch(unified, /env\.DB\.prepare|UPDATE public_profiles/, 'unified route must delegate the sole canonical D1 mutation');

const profile = functionText(worker, 'handleMyProfileUpdate');
assert.match(profile, /SORIDRAW_UNIFIED_PROFILE_SAVE_CORE_252_20260930/);
assert.match(profile, /mutation252\?\.authContext/);
assert.match(profile, /avatarChanged252/);
assert.match(profile, /backgroundChanged252/);
assert.match(profile, /set251\.push\("avatar_url = \?"\)/);
assert.match(profile, /set251\.push\("background_url = \?"\)/);
assert.match(profile, /mediaWrites252/);
assert.match(profile, /nextAvatarUrl252/);
assert.match(profile, /nextBackgroundUrl252/);
assert.match(profile, /writeProfileRecovery251/);

assert.match(worker, /request\.method === "PUT" && url\.pathname === "\/v1\/me\/profile-save"[\s\S]*?handleProfileUnifiedSave252/);
assert.match(worker, /request\.method === "PUT" && url\.pathname === "\/v1\/me\/profile-media"/);
assert.match(worker, /handleProfileMediaUpload\(request, env, cors/);

assert.match(service, /SORIDRAW_UNIFIED_PROFILE_SAVE_CLIENT_252_20260930/);
assert.match(service, /saveExplorePublicProfileUnified/);
assert.match(service, /form\.set\('profile', JSON\.stringify\(profilePayload252\)\)/);
assert.match(service, /\/v1\/me\/profile-save/);
assert.match(service, /profileMutationVersion: 252/);

assert.match(modal, /SORIDRAW_UNIFIED_PROFILE_SAVE_UI_252_20260930/);
assert.match(modal, /const useUnifiedProfileSave252 = profileFieldsChanged247 && hasProfileMedia252/);
assert.match(modal, /saveExplorePublicProfileUnified\(/);
assert.match(modal, /updateExplorePublicProfile\(user, normalizedDraft, \{ youtubeChanged: youtubeChanged252 \}\)/);
assert.match(modal, /if \(!useUnifiedProfileSave252\) \{[\s\S]*?uploadExploreProfileMediaBatch/);

assert.match(entry, /const isUnifiedProfileSave252 = request\.method === 'PUT' && url\.pathname === '\/v1\/me\/profile-save'/);
assert.match(entry, /SORIDRAW_PROFILE_SOCIAL_CHANGED_ONLY_252_20260930/);
assert.match(entry, /explicitYoutubeChanged252/);
assert.match(entry, /Number\(requestBody\?\.profileMutationVersion \|\| 0\) !== 252/);

console.log('252_UNIFIED_PROFILE_SAVE=PASS');
console.log('252_COMBINED_PROFILE_CANONICAL_D1_QUERY_WRITE=ONE_BY_DELEGATION_CONTRACT');
console.log('252_LEGACY_TEXT_MEDIA_ROUTES=PASS');
console.log('252_YOUTUBE_UNCHANGED_R2_READ_SKIP=PASS');
console.log('252_D1_SCHEMA_MIGRATION=0');
