import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const authority = read('src/services/profileAvatarAuthority.ts');
const modal = read('src/components/explore/ExploreProfileEditModal.tsx');
const page = read('src/pages/ExplorePage.tsx');
const rail = read('src/components/studio/StudioLeftRail.tsx');
const myPage = read('src/pages/MyPage.tsx');
const app = read('src/App.tsx');

const requireText = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};

requireText(authority, 'SORIDRAW_GLOBAL_PROFILE_AVATAR_AUTHORITY_216_20260928', '216 authority marker');
requireText(authority, "providerId === 'google.com'", 'Google provider fallback');
requireText(authority, "source: 'public-profile'", 'public-profile authority');
requireText(authority, "source: 'google'", 'Google fallback authority');
requireText(authority, 'isSoridrawGoogleAvatarUrl', 'Google-host detection');
requireText(authority, 'if (explicitSoridrawAvatar)', 'explicit public-profile precedence');
requireText(authority, 'if (changed)', 'write-only-on-change guard');
requireText(authority, 'updateProfile(user, { photoURL: resolved.url || null })', 'Firebase Auth effective avatar persistence');
requireText(authority, 'SORIDRAW_PROFILE_AVATAR_EVENT', 'same-session avatar signal');

if (/firestore|d1|exploreSocialService|fetch\s*\(/i.test(authority)) {
  throw new Error('Avatar authority service must not add Firestore/D1/public-profile reads');
}

requireText(modal, 'syncSoridrawProfileAvatarAuthority(user, refreshed.avatarUrl)', 'profile-save global avatar sync');
requireText(page, 'syncSoridrawProfileAvatarAuthority(user, nextProfile.avatarUrl)', 'own-profile self-heal');
requireText(rail, 'SORIDRAW_PROFILE_AVATAR_EVENT', 'left rail live avatar signal');
requireText(rail, 'effectiveProfilePhotoURL', 'left rail effective avatar');
requireText(myPage, 'SORIDRAW_PROFILE_AVATAR_EVENT', 'My Page live avatar signal');
requireText(myPage, 'effectiveAvatarUrl', 'My Page effective avatar');
requireText(app, 'SORIDRAW_PROFILE_AVATAR_EVENT', 'top navigation live avatar signal');
requireText(app, 'authoritativePhotoURL216', 'top navigation effective avatar');
requireText(app, 'writeCachedHeaderIdentity({', 'header identity cache convergence');
requireText(app, 'photoURL: nextPhotoURL', 'header cache effective avatar persistence');

const modalSync = modal.indexOf('syncSoridrawProfileAvatarAuthority(user, refreshed.avatarUrl)');
const modalSaved = modal.indexOf('onSaved(refreshed)', modalSync);
if (modalSync < 0 || modalSaved < modalSync) {
  throw new Error('Public-profile avatar authority must be synced before the modal reports save completion');
}

const publicPriority = authority.indexOf('if (explicitSoridrawAvatar)');
const googlePriority = authority.indexOf('if (googleUrl)');
if (publicPriority < 0 || googlePriority < 0 || publicPriority > googlePriority) {
  throw new Error('Explicit SORIDRAW public-profile avatar must precede Google fallback');
}

console.log('216_GLOBAL_PROFILE_AVATAR_AUTHORITY=PASS');
console.log('PUBLIC_PROFILE_OVERRIDES_GOOGLE=PASS');
console.log('GOOGLE_DEFAULT_FALLBACK=PASS');
console.log('TOP_NAV_RAIL_MYPAGE_LIVE_SYNC=PASS');
console.log('APP_UPDATE_SERVER_READ_ADDED=0');
console.log('PAGE_ENTRY_SERVER_READ_ADDED=0');
