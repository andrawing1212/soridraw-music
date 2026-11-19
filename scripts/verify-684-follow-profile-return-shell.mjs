// APP684: a revisited public profile shell (not just own profile) must
// render immediately from a validated existing first-view cache. Follow
// network verification and pending outbox must not gate profile visibility.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const service=readFileSync('src/services/exploreProfileFirstViewService.ts','utf8');
const section=(a,b)=>{const s=page.indexOf(a),e=page.indexOf(b,s+a.length);
 assert.ok(s>=0&&e>s,'APP684 source boundary '+a);return page.slice(s,e);};
const profile=section('  useEffect(() => {\n    if (!profileUid)','  // app380: a real pending follow choice');
assert.match(profile,/readCachedExplorePublicProfileFirstView684\(profileUid\)/);
assert.match(profile,/setProfile\(cachedProfile684&&firstFollower690!==null/);
assert.match(profile,/setProfileLoading\(!cachedFirstView684\)/);
assert.match(profile,/setProfileTracks\(overlayActorLikeCounts120\(cachedTracks684\)\)/);
assert.match(profile,/setProfileLoading\(!cachedFirstView684\)/);
assert.doesNotMatch(profile,/setProfileLoading\(true\)/,'revisited profile must not always blank the screen');
assert.match(profile,/getExplorePublicProfileFirstView\(profileUid/);
assert.match(profile,/\(\)=>getExploreFollowState\(user, nextProfile.uid, true\)/,
 'APP725 exact canonical GET stays inside one in-flight request loader');
assert.match(profile,/cachedPending684\?\.desiredFollowing/);
assert.match(profile,/readExploreFollowMembership379\(user.uid,cachedProfile684.uid\)/);
assert.doesNotMatch(profile,/setExploreFollow\(/,'profile return cannot trigger a new follow write');
assert.match(service,/export const readCachedExplorePublicProfileFirstView684/);
const helper=service.slice(service.indexOf('export const readCachedExplorePublicProfileFirstView684'),
 service.indexOf('const writeCache',service.indexOf('export const readCachedExplorePublicProfileFirstView684')));
assert.match(helper,/const cached = readCache\(ref\)/);
assert.match(helper,/aliases.some\(alias => alias.toLowerCase\(\) === ref.toLowerCase\(\)\)/);
assert.doesNotMatch(helper,/fetch\(|requestMaterializedFirstView\(/);
console.log('APP684_VISITED_C_PROFILE_CACHED_SHELL_AND_TRACKS_PAINT_BEFORE_NETWORK=PASS');
console.log('APP684_FOLLOW_AND_UNFOLLOW_PENDING_PRIORITY_NO_PROFILE_REWRITE=PASS');
console.log('APP684_REVISIT_NO_NEW_FETCH_OR_CANONICAL_FOLLOW_WRITE=PASS');
