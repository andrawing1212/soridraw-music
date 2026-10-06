import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');

const getterStart = like.indexOf('export const getExploreLikedTrackIds = async');
const getterEnd = like.indexOf('\n// App129 single-authority rule:', getterStart);
assert.ok(getterStart >= 0 && getterEnd > getterStart, 'getExploreLikedTrackIds range missing');
const getter = like.slice(getterStart, getterEnd);
assert.doesNotMatch(
  getter,
  /checkExplorePersonalLikeRevision127\(user\)/,
  'visible heart hydration must not spend timed private revision Worker reads',
);
assert.match(getter, /await ensurePersonalLikeBaseline127\(user\)/);

const likedEffectStart = page.indexOf("if (!profileUid || !profile || !user || user.uid !== profile.uid || profileCollection !== 'liked') return;");
const likedEffectEnd = page.indexOf('\n  const visibleTracks = profileUid', likedEffectStart);
assert.ok(likedEffectStart >= 0 && likedEffectEnd > likedEffectStart, 'My Likes effect range missing');
const likedEffect = page.slice(likedEffectStart, likedEffectEnd);
assert.doesNotMatch(
  likedEffect,
  /checkExplorePersonalLikeRevision127\(user\)/,
  'My Likes tab navigation must not trigger the 5-minute revision fallback',
);
assert.match(likedEffect, /ensureExplorePersonalLikeCrossOriginParity357\(user\)/);
assert.match(likedEffect, /ensureExplorePersonalLikeBaseline127\(user\)/);

const resumeStart = page.indexOf('const onResume = () => {');
const resumeEnd = page.indexOf('const unsubscribeLikeUi139', resumeStart);
assert.ok(resumeStart >= 0 && resumeEnd > resumeStart, 'resume fallback range missing');
const resume = page.slice(resumeStart, resumeEnd);
assert.match(
  resume,
  /checkExplorePersonalLikeRevision127\(user\)/,
  'legacy revision fallback must remain on a real hidden->visible resume',
);
assert.match(page, /subscribeExploreLikeUiSync139\(user\.uid, onRemote\)/);
assert.match(like, /const EXPLORE_LIKE_LEGACY_CHECK_MS_127 = 5 \* 60_000;/);

console.log('APP360_MY_LIKES_TAB_WORKER_ZERO_AFTER_CACHE=PASS');
console.log('APP360_HEART_HYDRATION_NO_TIMED_REVISION_READ=PASS');
console.log('APP360_RESUME_ONLY_REVISION_FALLBACK_PRESERVED=PASS');
console.log('APP360_RTDB_LIVE_CHANGE_PATH_PRESERVED=PASS');
