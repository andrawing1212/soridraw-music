// APP683 regression: A is viewing C, B follows C on another account.
// The public RTDB subscription must attach after C's public shell appears,
// even if A's authenticated follow-state GET is delayed or lacks exact counts.
// B's own cached profile shell should not wait for the independent count GET.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const transport=readFileSync('src/services/explorePublicFollowSync668.ts','utf8');
const slice=(start,end)=>{
 const a=page.indexOf(start),b=page.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'missing APP683 boundary '+start);
 return page.slice(a,b);
};
const subscriber=slice('  // APP668: one visible *visited* public profile','  // APP527: A\'s profile');
assert.match(subscriber,/subscribePublicProfileFollow668\(viewedUid,signal=>/);
assert.match(subscriber,/user\?\.uid!==principal\.uid\)return/);
assert.doesNotMatch(subscriber,/verifiedVisitedSignalUid669!==viewedUid/,
 'exact follow-state GET must not gate public listener registration');
assert.doesNotMatch(subscriber,/if\(!read\|\|read\.uid!==viewedUid\)return/,
 'a failed or late first-view GET must not block subscription');
// APP687: the first attempt may precede the authenticated GET, so its
// completion must re-run attachment. A later read also advances the fence.
assert.match(subscriber,/verifiedVisitedSignalUid669\]\);/,
 'the verified-first-view state must re-trigger visitor subscription');
assert.match(subscriber,/const latestRead=verifiedVisitedCounts668Ref\.current/);
assert.match(subscriber,/latestRead\?\.uid===viewedUid/);
assert.match(subscriber,/signal\.at<=latestRead\.readStartedAt/);
assert.doesNotMatch(subscriber,/signal\.at<=read\.readStartedAt/,
 'do not compare against a stale ref captured during earlier attachment');
assert.match(subscriber,/verifiedVisitedCounts668Ref\.current=\{uid:viewedUid,readStartedAt:signal\.at\}/);
assert.match(subscriber,/activeProfileUidRef\.current!==viewedUid/);
assert.match(subscriber,/readPendingExploreFollowIntents380\(principal\.uid\)/);
const mount=slice('  useEffect(() => {\n    if (!profileUid)', '  // app380: a real pending follow choice');
assert.match(mount,/verifiedVisitedCounts668Ref\.current=\{uid:profileUid,readStartedAt:ownCountsRequestedAt\}/);
assert.match(mount,/verifiedVisitedCounts668Ref\.current=\{uid:nextProfile\.uid,/);
assert.match(mount,/const newerPublicSignal683 =/);
assert.match(mount,/if\(!pending525&&!keepChoice685&&confirmedFollower689===null&&[\s\S]*?nextFollowState\.countVerified661===true&&!newerPublicSignal683\)/);
assert.match(mount,/const cachedFirstView684=readCachedExplorePublicProfileFirstView684\(profileUid\)/);
assert.match(mount,/setProfile\(cachedProfile684&&firstFollower690!==null/);
assert.match(mount,/setProfileLoading\(!cachedFirstView684\)/);
assert.match(mount,/getExploreOwnProfileFollowCounts\(user\)/);
assert.doesNotMatch(mount,/setExploreFollow\(/,
 'own-profile read-only entry must not commit a follow again');
assert.match(transport,/PUBLIC_FOLLOW_VISITOR_668_ENABLED=true/);
assert.match(transport,/window\.location\.hostname!=='preview\.soridraw\.com'/);
assert.match(transport,/onValue\(databaseRef\(realtimeDb,/);
console.log('APP683_A_VIEWING_C_SUBSCRIBES_WITHOUT_EXACT_FOLLOW_GET=PASS');
console.log('APP683_PUBLIC_SIGNAL_LATE_OLD_GET_CANNOT_OVERWRITE_NEW_COUNTER=PASS');
console.log('APP683_OWN_PROFILE_LOCAL_SHELL_NO_REPEAT_FOLLOW_WRITE=PASS');
console.log('APP683_PREVIEW_ONLY_VISITOR_PROTECTION=PASS');
