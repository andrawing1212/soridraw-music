import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const workerPath = 'cloudflare/explore-worker/canonical/preview-worker.js';
const hashPath = 'cloudflare/explore-worker/canonical/source-sha256.txt';
const verifierPath = 'scripts/verify-085-liked-profile.mjs';
const marker = '// SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056_20260915';
const badJoin = 'LEFT JOIN profiles p ON p.uid = t.owner_uid';
const goodJoin = 'LEFT JOIN public_profiles p ON p.uid = t.owner_uid';
const nextFunction = 'async function handleMySocialSnapshot042';

let worker = readFileSync(workerPath, 'utf8');
const start = worker.indexOf('async function handleMyLikedTracks052');
const end = worker.indexOf(nextFunction, start);
if (start < 0 || end < 0) throw new Error('handleMyLikedTracks052 range not found');
let block = worker.slice(start, end);

if (block.includes(badJoin)) {
  if (block.split(badJoin).length !== 2) throw new Error('unexpected duplicate bad liked-track profile join');
  block = block.replace(badJoin, goodJoin);
} else if (!block.includes(goodJoin)) {
  throw new Error('liked-track profile join shape changed unexpectedly');
}

if (!worker.includes(marker)) {
  worker = worker.slice(0, start) + marker + '\n' + block + worker.slice(end);
} else {
  worker = worker.slice(0, start) + block + worker.slice(end);
}

const fixedStart = worker.indexOf('async function handleMyLikedTracks052');
const fixedEnd = worker.indexOf(nextFunction, fixedStart);
const fixedBlock = worker.slice(fixedStart, fixedEnd);
if (!worker.includes(marker)) throw new Error('056 marker missing');
if (!fixedBlock.includes(goodJoin)) throw new Error('public_profiles join missing after patch');
if (fixedBlock.includes(badJoin)) throw new Error('profiles join remains after patch');
writeFileSync(workerPath, worker);

let verifier = readFileSync(verifierPath, 'utf8');
const verifierAnchor = "  ['JOIN tracks t ON t.id = r.id', 'PK-bounded track detail lookup'],\n";
const verifierInsert = verifierAnchor
  + "  ['SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056_20260915', 'Worker 056 liked-track profile join marker'],\n"
  + "  ['LEFT JOIN public_profiles p ON p.uid = t.owner_uid', 'canonical public profile join'],\n";
if (!verifier.includes('Worker 056 liked-track profile join marker')) {
  if (!verifier.includes(verifierAnchor)) throw new Error('085 verifier anchor missing');
  verifier = verifier.replace(verifierAnchor, verifierInsert);
}
const forbiddenAnchor = "if (worker.includes('WHERE t.owner_uid = ? AND t.id IN')) {\n";
const forbiddenInsert = "if (worker.includes('LEFT JOIN profiles p ON p.uid = t.owner_uid')) {\n  throw new Error('085 verifier: liked-track detail lookup must use public_profiles, not missing profiles table');\n}\n\n" + forbiddenAnchor;
if (!verifier.includes('must use public_profiles, not missing profiles table')) {
  if (!verifier.includes(forbiddenAnchor)) throw new Error('085 forbidden anchor missing');
  verifier = verifier.replace(forbiddenAnchor, forbiddenInsert);
}
writeFileSync(verifierPath, verifier);

const digest = createHash('sha256').update(worker).digest('hex');
writeFileSync(hashPath, `${digest}\n`);
console.log(`LIKED_TRACK_PUBLIC_PROFILE_JOIN_056=PASS sha256=${digest}`);
