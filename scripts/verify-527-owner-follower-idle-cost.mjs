import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// APP527 user-video regression: 43s open profile should not emit periodic
// follower-list D1 R12 after 15s idle/focus clicks. A truly changed follow
// still may refresh an already-open list via the established own-UID RTDB
// app377 signal. This test is source-only, never touches shared data.
const page=readFileSync('src/pages/ExplorePage.tsx','utf8');
const service=readFileSync('src/services/exploreSocialService.ts','utf8');
const begin=page.indexOf('  const openProfileConnections376 = async (direction: ExploreProfileConnectionDirection) => {');
const end=page.indexOf('  const loadMoreProfileConnections376 = async () => {',begin);
assert.ok(begin>0 && end>begin,'explicit followers handler must exist');
const explicit=page.slice(begin,end);
const rest=page.slice(0,begin)+page.slice(end);

assert.match(page,/APP527: A's profile must not spend D1\/R2 on window focus/);
assert.doesNotMatch(page,/onOwnFollowersFocus525|ownFollowersHeaderLastCheck525Ref|ownFollowersHeaderInflight525Ref/);
assert.doesNotMatch(rest,/getExploreProfileConnections\(ownerUid,'followers',null,true\)/);
assert.match(explicit,/const refreshOwn523 = ownFollowers523 &&/);
assert.match(explicit,/readExploreProfileConnectionLastServerAt528\(targetUid, direction\)/);
assert.match(explicit,/shouldRefreshOwnerFollowersOnOpen528\(/);
assert.match(page,/OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523 = 120_000/);
assert.match(explicit,/shouldRefreshOwnerFollowersOnOpen528\([\s\S]*?lastCheck523, Date\.now\(\), OWN_FOLLOWERS_EXPLICIT_RECHECK_MS_523/);
assert.match(explicit,/getExploreProfileConnections\(targetUid, direction, null, refreshOwn523\)/);
// Only 3 potential call sites survive: user-requested list, user-requested
// pagination, confirmed same-account follow event; none idle or focus.
const calls=[...page.matchAll(/getExploreProfileConnections\(/g)];
assert.equal(calls.length,3, 'unexpected implicit list-fetch path');
const eventTriggered=page.slice(page.indexOf('  // app377: same-account PC/mobile'),
  page.indexOf('  // app335: warm public-profile entry'));
assert.match(eventTriggered,/subscribeExploreFollowSync377\(/);
assert.match(eventTriggered,/getExploreProfileConnections\(openUid377, openDirection377\)/);
assert.doesNotMatch(service.slice(service.indexOf('export const getExploreProfileConnections'),
  service.indexOf('export const getExplorePublicProfileTracks')),/setInterval\(/);
assert.doesNotMatch(page.slice(0,begin),/window\.addEventListener\('focus',onOwnFollowers/);
console.log('APP527_IDLE_43S_AND_BLANK_CLICK_FOLLOWER_LIST_GET_0=PASS');
console.log('APP527_EXPLICIT_REFRESH_AND_CHANGED_FOLLOW_ONLY=PASS');
