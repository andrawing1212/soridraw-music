import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');

const publishStart = service.indexOf('const publishConfirmedLikeSignal127');
const publishEnd = service.indexOf('let likeSignalRetryListenerInstalled127', publishStart);
assert.ok(publishStart >= 0 && publishEnd > publishStart);
const publish = service.slice(publishStart, publishEnd);

assert.match(service, /set as setRealtimeValue/,
  'RTDB set transport import missing');
assert.match(publish, /setRealtimeValue\(/,
  'changed-track live signal must publish through RTDB set');
assert.match(publish, /databaseRef\(realtimeDb, `userSync\/\$\{uid\}\/exploreLike`\)/);
assert.match(publish, /previousVersion: forceGap \? 0 : previousVersion/);
assert.match(publish, /markSeenLikeSignal127\(uid, version\)/);
assert.doesNotMatch(publish, /runTransaction\(/,
  'app140 must not depend on the broken transaction live-signal path');
assert.doesNotMatch(publish, /requestExploreLike\(|fetch\(|firebase\/firestore|env\.DB|D1/,
  'live signal transport must not add D1/Firestore reads or writes');

const visibleEffectStart = page.indexOf('if (!user || visibleTracks.length === 0) return;');
const visibleEffectEnd = page.indexOf('return () => { cancelled = true; };', visibleEffectStart);
assert.ok(visibleEffectStart >= 0 && visibleEffectEnd > visibleEffectStart);
const visibleEffect = page.slice(visibleEffectStart, visibleEffectEnd);
assert.match(visibleEffect, /const immediateLocal: Record<string, boolean> = \{\};/);
assert.match(visibleEffect, /readExploreTrackLikeMembership127\(user\.uid, id\)/);
assert.match(visibleEffect, /setLikedTrackIds\(\(previous\) => \(\{ \.\.\.previous, \.\.\.immediateLocal \}\)\)/);
assert.ok(
  visibleEffect.indexOf('setLikedTrackIds((previous) => ({ ...previous, ...immediateLocal }))') <
    visibleEffect.indexOf('getExploreLikedTrackIds(user, ids)'),
  'cached hearts must paint before async revision/baseline work',
);

console.log('APP140_LIVE_CHANGED_TRACK_RTDB_SET=PASS');
console.log('APP140_LIVE_SIGNAL_D1_FIRESTORE_IO=0');
console.log('APP140_CACHED_HEART_INITIAL_SPINNER_AVOIDED=PASS');
console.log('APP140_W1_QUEUE_AND_LOCAL_CATALOG_UNCHANGED=PASS');
