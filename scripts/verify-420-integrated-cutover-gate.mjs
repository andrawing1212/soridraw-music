// Stage420 source contracts: cutover MUST remain disabled until shared RTDB
// old-client compatibility + canonical Worker locks and cost are proven.
// No live Firebase, Cloudflare, user data or deployment operations.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const service = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const guarded = readFileSync('src/services/exploreLikeGuardedTransport420.ts', 'utf8');
const reducer = readFileSync('src/services/exploreLikeGuardedOutbox420.ts', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8')).rules;
assert.match(service, /export const EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false;/,
  'shared old-client cutover must be hard disabled until coordinated proof');
assert.match(service, /guardStatus420\?: 'awaiting' \| 'approved'/,
  'new persisted outbox state required without schema reset');
assert.match(service, /row\.guardStatus420 === 'awaiting' \|\| row\.guardStatus420 === 'approved'/,
  'reload must preserve exact private authorization state');
assert.match(service, /guardCanonicalLiked420\?: boolean/,
  'rollback proof must be captured before optimistic click');
assert.match(service, /const authoritativeBeforeClick420 = !EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE[\s\S]*?existing\?\.guardCanonicalLiked420/,
  'normal mode avoids extra cache reads; guarded proof comes from persisted pre-click membership');
assert.match(service, /const existing = outbox\[normalizedTrackId\]/);
assert.match(service, /const authoritativeBeforeClick420 =[\s\S]*?cache\.has\(normalizedTrackId\)/,
  'canonical evidence only if cached membership verified before clicking');
assert.match(service, /const eligibleGuardedMutation420 =[\s\S]*?entry\.guardStatus420 === 'approved'/,
  'unapproved old and new outbox cannot flush to canonical Worker');
assert.match(service, /eligibleGuardedMutation420\(pending\)/g);
assert.match(service, /flushPendingLikes = async[\s\S]*?\.filter\(\(pending\) => \(pending\.retryCount \|\| 0\) === 0 && eligibleGuardedMutation420\(pending\)\)/);
assert.match(service, /const flushOnExit413 = \(\) => \{[\s\S]*?eligibleGuardedMutation420\(pending\)/);
assert.match(service, /if \(operationId416 && !EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\)[\s\S]*?publishExploreLikeIntent416/,
  'legacy direct 416 used only under old active mode');
assert.match(service, /else if \(operationId416 && EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\)[\s\S]*?submitGuardedOutboxCandidate420/,
  'candidate must use authenticated server without direct RTDB fallback');
assert.match(service, /startLikeSignal127\(uid\);[\s\S]*?if \(EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\) \{\s*startLikeIntent416\(''\);\s*startGuardedLike420\(uid\);/,
  'legacy and guarded listeners must not both write provisional state');
assert.match(service, /clearExploreLikeIntent416\(uid, item\.trackId, item\.liked\);[\s\S]*?guardedLikeHintsByUid420/,
  'accepted canonical 127 signal must retire matching guarded hints');
assert.match(service, /persistLikeOutbox\(uid, latest\);[\s\S]*?const currentCache = getLikedStateCache\(uid\);/,
  'outbox guard must be retired before optimistic cache rollback');
assert.match(guarded, /return settleGuardedOutbox420\(/);
assert.match(reducer, /const decision = resolveGuardedOutbox420\(/);
assert.match(reducer, /commit\(decision\);\s*notifyAfterCommit\(decision\);/,
  'durable update must precede remote/UI repaint');
assert.equal(rules.userSync.$uid['.write'], 'auth != null && auth.uid === $uid',
  'live old-client rules must NOT change in this source candidate');
assert.equal(rules.privateLikeSync420, undefined,
  'new private root is still an undeployed candidate: no live rules changes');
console.log('STAGE420_OUTBOX_RELOAD_AND_CANONICAL_FLUSH_GATING=PASS');
console.log('STAGE420_PRECLICK_PROOF_NO_OPTIMISTIC_CACHE_ROLLBACK=PASS');
console.log('STAGE420_LEGACY_RECEIVER_AND_NEW_PRIVATE_RECEIVER_SEPARATE=PASS');
console.log('STAGE420_CANONICAL_127_ACK_AND_OUTBOX_PAINT_ORDER=PASS');
console.log('STAGE420_FEATURE_ENABLE_AND_OLD_CLIENT_CUTOVER=HOLD');
