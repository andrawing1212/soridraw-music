import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const workerPath = 'cloudflare/explore-worker/canonical/preview-worker.js';
const hashPath = 'cloudflare/explore-worker/canonical/source-sha256.txt';
const verifier085Path = 'scripts/verify-085-liked-profile.mjs';
const verifier086Path = 'scripts/verify-086-liked-sync-repair.mjs';
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

let verifier085 = readFileSync(verifier085Path, 'utf8');
const verifier085Anchor = "  ['JOIN tracks t ON t.id = r.id', 'PK-bounded track detail lookup'],\n";
const verifier085Insert = verifier085Anchor
  + "  ['SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056_20260915', 'Worker 056 liked-track profile join marker'],\n"
  + "  ['LEFT JOIN public_profiles p ON p.uid = t.owner_uid', 'canonical public profile join'],\n";
if (!verifier085.includes('Worker 056 liked-track profile join marker')) {
  if (!verifier085.includes(verifier085Anchor)) throw new Error('085 verifier anchor missing');
  verifier085 = verifier085.replace(verifier085Anchor, verifier085Insert);
}
const verifier085ForbiddenAnchor = "if (worker.includes('WHERE t.owner_uid = ? AND t.id IN')) {\n";
const verifier085ForbiddenInsert = "if (worker.includes('LEFT JOIN profiles p ON p.uid = t.owner_uid')) {\n  throw new Error('085 verifier: liked-track detail lookup must use public_profiles, not missing profiles table');\n}\n\n" + verifier085ForbiddenAnchor;
if (!verifier085.includes('must use public_profiles, not missing profiles table')) {
  if (!verifier085.includes(verifier085ForbiddenAnchor)) throw new Error('085 forbidden anchor missing');
  verifier085 = verifier085.replace(verifier085ForbiddenAnchor, verifier085ForbiddenInsert);
}
writeFileSync(verifier085Path, verifier085);

let verifier086 = readFileSync(verifier086Path, 'utf8');
const old086 = "assert.match(handler, /LEFT JOIN profiles p ON p\\.uid = t\\.owner_uid/);";
const new086 = "assert.match(handler, /LEFT JOIN public_profiles p ON p\\.uid = t\\.owner_uid/);\nassert.doesNotMatch(handler, /LEFT JOIN profiles p ON p\\.uid = t\\.owner_uid/);";
if (!verifier086.includes('LEFT JOIN public_profiles p ON p\\.uid = t\\.owner_uid')) {
  if (!verifier086.includes(old086)) throw new Error('086 profile join assertion anchor missing');
  verifier086 = verifier086.replace(old086, new086);
}
writeFileSync(verifier086Path, verifier086);

const digest = createHash('sha256').update(worker).digest('hex');
writeFileSync(hashPath, `${digest}\n`);
console.log(`LIKED_TRACK_PUBLIC_PROFILE_JOIN_056=PASS sha256=${digest}`);
