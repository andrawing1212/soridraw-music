import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const like = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
assert.ok(Number(version.version) >= 90, `expected app version 090+, got ${version.version}`);
assert.match(like, /SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915/);
assert.match(page, /SORIDRAW_EXPLORE_LIKE_LIVE_DISPLAY_090_20260915/);
assert.match(like, /const pendingOutbox = readLikeOutbox\(uid\)/);
assert.match(like, /pending \? \{ \.\.\.result, liked: pending\.desiredLiked \} : result/);
assert.match(like, /beginExploreLikeDisplayTransition091/);
assert.doesNotMatch(like, /clampLikeCount\(currentLikeCount\) \+ \(liked \? 1 : -1\)/);
assert.match(page, /const canonicalTrack = \{/);
assert.match(page, /getExploreLikeDisplayCount091/);
assert.match(page, /rememberExploreLikedTrack\(user\.uid, canonicalTrack/);
assert.doesNotMatch(page, /effectiveLikedSet\.has\(track\.id\) && track\.likeCount === 0/);
assert.doesNotMatch(page, /patchLikedZeroFloor/);
assert.match(page, /likeInteractionVersionRef090/);
assert.match(page, /interactionVersion !== likeInteractionVersionRef090\.current/);
const setLikeStart = like.indexOf('export const setExploreTrackLike = async');
const setLikeBody = like.slice(setLikeStart, like.indexOf('\n};', setLikeStart) + 3);
assert.doesNotMatch(setLikeBody, /requestExploreLike\(/, '090 click path must remain local/batched');

// Explore public-like browser guard: exactly the Studio 7/20/50 thresholds,
// but with an entirely separate keyspace and zero additional backend I/O.
const { transform } = await import('esbuild');
const exploreGuardSource = readFileSync('src/lib/exploreLikeClickGuard.ts','utf8');
const output = await transform(exploreGuardSource,{loader:'ts',format:'esm'});
const { admitExploreLikeClick, recordExploreLikeAcceptedClick } =
  await import('data:text/javascript;base64,'+Buffer.from(output.code).toString('base64'));
assert.doesNotMatch(exploreGuardSource,/fetch\(|getDoc\(|setDoc\(|updateDoc\(|localStorage|sessionStorage|indexedDB|realtimeDb|LIKE_RATE_LIMITER/);
const uid='explore-abuse-test';
for(let n=0;n<6;n++){
  const at=10000+n*200;
  assert.equal(admitExploreLikeClick(uid,'burst',at,false).allowed,true);
  recordExploreLikeAcceptedClick(uid,'burst',at);
}
const firstBlock=admitExploreLikeClick(uid,'burst',11200,false);
assert.equal(firstBlock.allowed,false);
assert.equal(firstBlock.notify,true);
assert.equal(firstBlock.retryAfterMs,10000);
assert.equal(admitExploreLikeClick(uid,'burst',11201,false).notify,false);
assert.equal(admitExploreLikeClick(uid,'other-track',11201,false).allowed,true);
assert.equal(admitExploreLikeClick('different-uid','burst',11201,false).allowed,true);
assert.equal(admitExploreLikeClick(uid,'burst',25000,false).allowed,true);
for(let n=0;n<19;n++){
  const at=100000+n*1000;
  assert.equal(admitExploreLikeClick(uid,'medium',at,false).allowed,true);
  recordExploreLikeAcceptedClick(uid,'medium',at);
}
assert.equal(admitExploreLikeClick(uid,'medium',119000,false).retryAfterMs,60000);
for(let n=0;n<49;n++){
  const at=200000+n*5500;
  assert.equal(admitExploreLikeClick(uid,'long',at,false).allowed,true);
  recordExploreLikeAcceptedClick(uid,'long',at);
}
assert.equal(admitExploreLikeClick(uid,'long',200000+49*5500,false).retryAfterMs,600000);
for(let n=0;n<30;n++) assert.equal(admitExploreLikeClick(uid,'failed',500000+n*100,false).allowed,true,
  'ignored or failed clicks must never count');
const toggleStart=page.indexOf('  const toggleLike = async (track: ExploreTrack) => {');
const toggleEnd=page.indexOf('  const selectLatestPublicScope312',toggleStart);
assert.ok(toggleStart>=0 && toggleEnd>toggleStart);
const toggleSource=page.slice(toggleStart,toggleEnd);
assert.ok(toggleSource.includes('admitExploreLikeClick(user.uid, track.id, acceptedAt, false)'));
assert.ok(toggleSource.includes('recordExploreLikeAcceptedClick(user.uid, track.id, acceptedAt)'));
assert.ok(toggleSource.includes(String.raw`window.alert('좋아요에 문제가 있다면\n관리자에게 문의하세요.')`));
assert.ok(toggleSource.includes('const isStateChangingClick = desiredLiked420 !== currentLiked'));
assert.ok(toggleSource.indexOf('admitExploreLikeClick(')<toggleSource.indexOf('setLikeBusyTrackId(track.id)'),
  'block before UI and outbox');
assert.ok(toggleSource.indexOf('admitExploreLikeClick(')<toggleSource.indexOf('setExploreTrackLike('));
assert.ok(toggleSource.indexOf('recordExploreLikeAcceptedClick(')>toggleSource.indexOf('await setExploreTrackLike('));
assert.ok(!toggleSource.includes('RATE_LIMITER') && !toggleSource.includes('fetch('));
console.log('EXPLORE_LIKE_ACCEPTED_7_20_50_BROWSER_GUARD=PASS');
console.log('EXPLORE_LIKE_GUARD_NEW_SERVER_IO=0');

console.log('PASS 090/091: live heart/count remain local-first, stale hydration/account signals cannot roll back a newer local pending heart, canonical caches are no longer overwritten by optimistic counts, and click path adds no server request.');
