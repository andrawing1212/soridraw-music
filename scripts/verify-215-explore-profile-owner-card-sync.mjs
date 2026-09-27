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
