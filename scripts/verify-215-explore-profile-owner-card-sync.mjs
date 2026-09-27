import fs from 'node:fs';

const page = fs.readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const migration = fs.readFileSync('cloudflare/explore-worker/migrations/20260910_01_explore_derived_state.sql', 'utf8');

const requireText = (text, token, label) => {
  if (!text.includes(token)) throw new Error(`Missing ${label}: ${token}`);
};

requireText(page, 'SORIDRAW_EXPLORE_PROFILE_OWNER_CARD_SYNC_215_20260928', '215 marker');
requireText(page, 'patchExploreTrackOwnerProfile215', 'owner card helper');
requireText(page, 'setTracks((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)))', 'feed React repaint');
requireText(page, 'setProfileTracks((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)))', 'profile React repaint');
requireText(page, 'setProfileLikedTracks((current) => current.map((track) => patchExploreTrackOwnerProfile215(track, nextProfile)))', 'liked React repaint');
requireText(page, 'patchExploreFeedSessionCachesRow(trackId, ownerCardPatch)', 'loaded feed local cache patch');
requireText(page, 'patchExplorePublicProfileFirstViewTrack(nextProfile.uid, trackId, ownerCardPatch)', 'profile first-view local cache patch');
requireText(page, 'ownerAvatarUrl: nextProfile.avatarUrl', 'raw feed avatar patch');
requireText(page, 'ownerNickname: nextProfile.nickname', 'raw feed nickname patch');
requireText(page, 'ownerHandle: nextProfile.handle', 'raw feed handle patch');
requireText(page, 'SORIDRAW_EXPLORE_PROFILE_CARD_AVATAR_AUTHORITY_217_20260928', '217 profile-card authority marker');
requireText(page, 'const authorityTrack217 = ownerProfileAuthority', 'profile card authority track');
requireText(page, 'patchExploreTrackOwnerProfile215(track, ownerProfileAuthority)', 'profile card local authority patch');
requireText(page, 'renderTrackGrid(profileTracks, `${profile.nickname} 공개곡`, profile)', 'public profile grid uses profile authority');
requireText(page, 'renderTrackGrid(profileLikedTracks, `${profile.nickname} 좋아요 곡`, profile)', 'liked grid preserves profile authority for own tracks');
requireText(page, 'SORIDRAW_EXPLORE_CARD_AVATAR_UNIFIED_218_20260928', '218 unified card avatar marker');
requireText(page, 'applyExploreCardAvatarAuthority218', 'shared feed/profile avatar resolver');
requireText(page, 'track.ownerUid === currentUser.uid && currentUser.photoURL', 'signed-in owner feed avatar authority');
requireText(page, 'track.ownerUid === ownerProfileAuthority.uid', 'public-profile card avatar authority');

const markerStart = page.indexOf('SORIDRAW_EXPLORE_PROFILE_OWNER_CARD_SYNC_215_20260928');
const helperEnd = page.indexOf('const isOpenableUrl', markerStart);
if (markerStart < 0 || helperEnd < 0) throw new Error('Could not isolate 215 helper');
const helperBlock = page.slice(markerStart, helperEnd);
if (/\b(fetch|requestAuthed|requestPublic|getExplorePublicProfile|getExplorePublicProfileTracks)\s*\(/.test(helperBlock)) {
  throw new Error('215 helper must remain local-only and add no server call');
}

const onSavedStart = page.indexOf('onSaved={(nextProfile) => {');
const onSavedEnd = page.indexOf('              />', onSavedStart);
if (onSavedStart < 0 || onSavedEnd < 0) throw new Error('Could not isolate profile onSaved block');
const onSavedBlock = page.slice(onSavedStart, onSavedEnd);
if (/\b(fetch|requestAuthed|requestPublic)\s*\(/.test(onSavedBlock)) {
  throw new Error('Profile save repaint must not add a network request');
}

const marker218Start = page.indexOf('SORIDRAW_EXPLORE_CARD_AVATAR_UNIFIED_218_20260928');
const marker218End = page.indexOf('const isOpenableUrl', marker218Start);
if (marker218Start < 0 || marker218End < 0) throw new Error('Could not isolate 218 unified avatar resolver');
const avatarResolver218 = page.slice(marker218Start, marker218End);
if (/\b(fetch|requestAuthed|requestPublic|getExplorePublicProfile|getExplorePublicProfileTracks)\s*\(/.test(avatarResolver218)) {
  throw new Error('218 unified card avatar resolver must remain local-only');
}

const marker217Start = page.indexOf('SORIDRAW_EXPLORE_PROFILE_CARD_AVATAR_AUTHORITY_217_20260928');
const marker217End = page.indexOf('if (profileUid)', marker217Start);
if (marker217Start < 0 || marker217End < 0) throw new Error('Could not isolate 217 render authority block');
const renderAuthority217 = page.slice(marker217Start, marker217End);
if (/\b(fetch|requestAuthed|requestPublic|getExplorePublicProfile|getExplorePublicProfileTracks)\s*\(/.test(renderAuthority217)) {
  throw new Error('217 public-card repaint must remain local-only and add no server call');
}

const triggerMatch = migration.match(/CREATE TRIGGER IF NOT EXISTS explore032_derived_profile_feed[\s\S]*?END;/);
if (!triggerMatch) throw new Error('Missing shared derived profile->feed trigger');
const trigger = triggerMatch[0];
if (!trigger.includes('OLD.row_json IS NOT NEW.row_json') && !trigger.includes('avatar_url')) {
  throw new Error('Shared profile->feed trigger no longer invalidates owner card metadata changes');
}
requireText(trigger, "'feed'", 'feed scope');
requireText(trigger, "'profile'", 'profile kind');

console.log('215_PROFILE_OWNER_CARD_SYNC=PASS');
console.log('LOCAL_REPAINT=true');
console.log('LOCAL_CACHE_PATCH=true');
console.log('SERVER_IO_ADDED=0');
console.log('SHARED_FEED_AVATAR_SIGNAL_GUARD=PASS');
console.log('217_PUBLIC_PROFILE_CARD_AVATAR_AUTHORITY=PASS');
console.log('217_SERVER_IO_ADDED=0');
console.log('218_FEED_PROFILE_CARD_AVATAR_UNIFIED=PASS');
console.log('218_SERVER_IO_ADDED=0');
