import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const page = readFileSync('src/pages/ExplorePage.tsx', 'utf8');

assert.match(service, /export const subscribeExploreLikeUiSync139 = \(/,
  'replayable changed-track UI subscription missing');
assert.match(service, /latestRemoteLikeUiRows139\.get\(normalizedUid\)\?\.forEach\(\(detail\) => listener\(detail\)\)/,
  'late-mounted Explore UI must replay already-received changed-track rows');
assert.match(service, /notifyExploreLikeUiSync139\(detail\);[\s\S]*window\.dispatchEvent/,
  'replayable delivery must happen before the legacy one-shot window event');
assert.match(service, /if \(detail\.source !== 'remote'\) return;/,
  'only cross-device remote rows should enter the replay buffer');

const subscriptionStart = service.indexOf('export const subscribeExploreLikeUiSync139');
const subscriptionEnd = service.indexOf('const likedStateByUid', subscriptionStart);
const subscriptionBlock = service.slice(subscriptionStart, subscriptionEnd);
assert.doesNotMatch(subscriptionBlock, /fetch\(|requestExploreLike\(|realtimeDb|databaseRef|runTransaction/,
  'UI replay subscription must not add server reads or writes');

assert.match(page, /subscribeExploreLikeUiSync139\(user\.uid, onRemote\)/,
  'ExplorePage must subscribe directly to replayable changed-track UI sync');
assert.doesNotMatch(page, /addEventListener\(EXPLORE_LIKE_SYNC_EVENT/,
  'ExplorePage must not depend on catching a one-shot window like event');
assert.match(page, /unsubscribeLikeUi139\(\)/,
  'ExplorePage must clean up changed-track UI subscription');

assert.match(service, /const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000/,
  '30-second write batching changed unexpectedly');

console.log('APP139_CHANGED_TRACK_UI_REPLAY=PASS');
console.log('APP139_CHANGED_TRACK_UI_REPLAY_SERVER_IO=0');
console.log('APP139_W1_WRITE_ARCHITECTURE_UNCHANGED=PASS');
