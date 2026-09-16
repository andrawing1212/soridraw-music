import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const explorePage = readFileSync(resolve(root, 'src/pages/ExplorePage.tsx'), 'utf8');
const likedService = readFileSync(resolve(root, 'src/services/exploreLikedTracksService.ts'), 'utf8');
const workerPath = process.env.SORIDRAW_GENERATED_WORKER
  ? resolve(process.env.SORIDRAW_GENERATED_WORKER)
  : resolve(root, 'cloudflare/explore-worker/canonical/preview-worker.js');
const worker = readFileSync(workerPath, 'utf8');

const must = (text, needle, label) => {
  if (!text.includes(needle)) throw new Error(`085 verifier: missing ${label}: ${needle}`);
};

for (const [needle, label] of [
  ["getExploreLikedTracks", 'liked tracks loader'],
  ["rememberExploreLikedTrack", 'liked track local patch'],
  ["'public' | 'liked'", 'profile collection state'],
  ["공개곡", 'public tab label'],
  ["좋아요 곡", 'liked tab label'],
  ["user?.uid === profile.uid", 'own-profile visibility guard'],
]) must(explorePage, needle, label);

for (const [needle, label] of [
  ["canonicalLikedTrackIds", 'canonical personal liked-ID cache'],
  ["explore-liked-track-collection-085", 'persistent local cache'],
  ["LOCAL HIT · 좋아요 곡 전체 캐시", 'warm local zero-read path'],
  ["/v1/me/liked-tracks", 'bounded missing-details route'],
  ["LIKED_TRACK_BATCH_MAX = 200", 'bounded request size'],
]) must(likedService, needle, label);

if (/from ['\"]firebase\/firestore/.test(likedService) || likedService.includes("doc(db, 'users'")) {
  throw new Error('085 verifier: liked track collection must not add Firestore writes/reads');
}

for (const [needle, label] of [
  ['SORIDRAW_LIKED_TRACK_COLLECTION_052_20260914', 'Worker 052 marker'],
  ['handleMyLikedTracks052', 'Worker liked-track handler'],
  ['"/v1/me/liked-tracks"', 'Worker liked-track route'],
  ['readExploreLikeR2Bundle(env, authContext.uid)', 'viewer liked-ID R2 authorization'],
  ['JOIN tracks t ON t.id = r.id', 'PK-bounded track detail lookup'],
  ['SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056_20260915', 'Worker 056 liked-track profile join marker'],
  ['LEFT JOIN public_profiles p ON p.uid = t.owner_uid', 'canonical public profile join'],
  ["t.is_public = 1", 'public-only guard'],
  ["t.status = 'published'", 'published-only guard'],
]) must(worker, needle, label);

if (worker.includes('LEFT JOIN profiles p ON p.uid = t.owner_uid')) {
  throw new Error('085 verifier: liked-track detail lookup must use public_profiles, not missing profiles table');
}

if (worker.includes('WHERE t.owner_uid = ? AND t.id IN')) {
  throw new Error('085 verifier: owner-wide liked track scan reintroduced');
}

console.log('PASS 085: own-profile liked-song collection keeps canonical personal liked IDs locally, warm cache is read-free, and only missing liked public tracks use bounded PK lookup.');
