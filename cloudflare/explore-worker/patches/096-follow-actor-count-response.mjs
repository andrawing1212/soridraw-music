import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_FOLLOW_ACTOR_COUNT_RESPONSE_096_20261007';
if (source.includes(marker)) {
  console.log('[SORIDRAW Worker] follow actor count response already applied.');
  process.exit(0);
}

const start = source.indexOf('async function handleFollowR2Core(');
if (start < 0) throw new Error('096 handleFollowR2Core missing');
const end = source.indexOf('\n__name(handleFollowR2Core', start);
if (end < 0) throw new Error('096 handleFollowR2Core end missing');
const body = source.slice(start, end);
const oldTail = `  return json({ ok: true, data: {
    uid: targetUid,
    following: shouldFollow,
    followerCount: clampExploreSocialCount(stats?.following?.follower_count),
    followingCount: clampExploreSocialCount(stats?.following?.following_count)
  } }, 200, cors);`;
const newTail = `  // ${marker}
  return json({ ok: true, data: {
    uid: targetUid,
    following: shouldFollow,
    followerCount: clampExploreSocialCount(stats?.following?.follower_count),
    followingCount: clampExploreSocialCount(stats?.following?.following_count),
    actorFollowingCount: clampExploreSocialCount(stats?.follower?.following_count)
  } }, 200, cors);`;
if (!body.includes(oldTail)) throw new Error('096 follow response anchor missing');
const nextBody = body.replace(oldTail, newTail);
source = source.slice(0, start) + nextBody + source.slice(end);

if (!source.includes(marker) || !source.includes('actorFollowingCount: clampExploreSocialCount(stats?.follower?.following_count)')) {
  throw new Error('096 verification failed');
}
writeFileSync(workerPath, source);
console.log('[SORIDRAW Worker] follow actor exact count response applied.');
