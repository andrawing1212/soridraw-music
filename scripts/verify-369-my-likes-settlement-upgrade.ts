import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldAttemptPersonalLikeOriginSettlement359 } from '../src/services/exploreEnvironmentParityPolicy';

const likes = readFileSync('src/services/exploreLikeService.ts', 'utf8');

assert.equal(shouldAttemptPersonalLikeOriginSettlement359({
  hasLocalState: true,
  latestSignalVersion: 300,
  settledSignalVersion: 0,
  attemptedSignalVersion: 0,
}), true, 'app358-certified origins still need one app359 settlement upgrade');
assert.equal(shouldAttemptPersonalLikeOriginSettlement359({
  hasLocalState: true,
  latestSignalVersion: 300,
  settledSignalVersion: 0,
  attemptedSignalVersion: 300,
}), false, 'same retained signal must not repeat settlement on tab navigation');
assert.equal(shouldAttemptPersonalLikeOriginSettlement359({
  hasLocalState: true,
  latestSignalVersion: 300,
  settledSignalVersion: 300,
  attemptedSignalVersion: 0,
}), false, 'settled origin stays local');
assert.equal(shouldAttemptPersonalLikeOriginSettlement359({
  hasLocalState: true,
  latestSignalVersion: 301,
  settledSignalVersion: 300,
  attemptedSignalVersion: 300,
}), true, 'a genuinely newer retained signal may spend one new settlement');
assert.equal(shouldAttemptPersonalLikeOriginSettlement359({
  hasLocalState: false,
  latestSignalVersion: 300,
  settledSignalVersion: 0,
  attemptedSignalVersion: 0,
}), false, 'no local catalog is not an app359 upgrade target');

assert.match(likes, /EXPLORE_LIKE_CROSS_ORIGIN_SETTLEMENT_ATTEMPTED_359/);
assert.match(likes, /EXPLORE_LIKE_CROSS_ORIGIN_SETTLED_359/);
assert.match(likes, /shouldAttemptPersonalLikeOriginSettlement359/);
assert.match(likes, /Object\.keys\(readSnapshotPending127\(uid\)\)\.length > 0/);
assert.match(likes, /const repairedRevision359 = await requestPersonalLikeRevision127\(user\)/);
assert.match(
  likes,
  /writeLikeLocal127\(scopedLikeKey127\(EXPLORE_LIKE_SETTLEMENT_ATTEMPTED_189, uid\), ''\)/,
);
assert.match(likes, /invalidateExplorePersonalLikeBaseline127\(uid\)/);
assert.match(likes, /await ensurePersonalLikeBaseline127\(user, repairedRevision359\)/);
assert.match(likes, /markCrossOriginLikeSettled359\(uid, latestSignalVersion\)/);

const attempt = likes.indexOf('markCrossOriginLikeSettlementAttempted359(uid, latestSignalVersion)');
const repair = likes.indexOf('requestRepair127(uid, latestSignalVersion)', attempt);
const firstBaseline = likes.indexOf('await ensurePersonalLikeBaseline127(user)', repair);
const revision = likes.indexOf('const repairedRevision359 = await requestPersonalLikeRevision127(user)', firstBaseline);
const resetSettlement = likes.indexOf('EXPLORE_LIKE_SETTLEMENT_ATTEMPTED_189, uid), \'\'\)', revision);
const invalidate = likes.indexOf('invalidateExplorePersonalLikeBaseline127(uid)', revision);
const settledBaseline = likes.indexOf('await ensurePersonalLikeBaseline127(user, repairedRevision359)', invalidate);
const settledMark = likes.indexOf('markCrossOriginLikeSettled359(uid, latestSignalVersion)', settledBaseline);
assert.ok(attempt >= 0 && repair > attempt, 'one-shot app359 fence must be persisted before repair');
assert.ok(firstBaseline > repair, 'shared R2 repair must finish before settlement proof');
assert.ok(revision > firstBaseline, 'settlement must bind to the repaired R2 revision');
assert.ok(resetSettlement > revision, 'old app189 attempt marker must not block the app359 proof');
assert.ok(invalidate > revision && settledBaseline > invalidate, 'settlement must force a fresh exact baseline');
assert.ok(settledMark > settledBaseline, 'origin may be certified settled only after the fresh proof');

console.log('APP359_CANONICAL_R2_THEN_FRESH_SETTLEMENT=PASS');
console.log('APP359_SAME_SIGNAL_REPEAT_WORKER_BLOCKED=PASS');
console.log('APP359_CURRENT_OUTBOX_PROTECTED_BY_EXISTING_189_LOGIC=PASS');
