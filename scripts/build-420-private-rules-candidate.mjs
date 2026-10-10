// Stage420 security-only candidate builder. NEVER writes database.rules.json.
// The current deployed app392 still publishes directly to the old path;
// deployable cutover needs a new client + Function + RTDB emulator first.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

export const buildStage420PrivateRulesCandidate = (source) => {
  const next = JSON.parse(JSON.stringify(source));
  const uid = next.rules.userSync.$uid;
  const originalRead = uid['.read'];
  const originalWrite = uid['.write'];
  assert.equal(originalWrite, 'auth != null && auth.uid === $uid',
    'unexpected live ACL: do not rewrite permissions');
  const legacyChildren = [
    'musicNote', 'recentSongs', 'libraryPlaylist',
    'exploreLike', 'exploreFollow', 'explorePublication',
  ];
  for (const child of legacyChildren) {
    assert(uid[child] && typeof uid[child] === 'object', 'missing existing signal ' + child);
    assert.equal(uid[child]['.write'], undefined, 'unexpected already-narrow child ' + child);
  }
  assert(uid.exploreLikeIntent416, 'stage416 channel missing');
  // Crucial: a parent .write permits direct writes to EVERY child, even when
  // a child says .write:false. Remove parent grant before protecting old path.
  delete uid['.write'];
  for (const child of legacyChildren) {
    uid[child]['.write'] = originalWrite;
  }
  uid.exploreLikeIntent416['.write'] = false;
  assert.equal(uid['.read'], originalRead, 'legacy account-private read must remain intact');
  assert.equal(next.rules.privateLikeSync420, undefined,
    'guarded root already present; refuse double application');
  next.rules.privateLikeSync420 = {
    '$uid': {
      // A parent .read would also expose adminUnlockAudit actorUid/reasons.
      // Only the personal display subtree is readable by its owner.
      '.write': false,
      'display': { '.read': 'auth != null && auth.uid === $uid' },
      'adminUnlockAudit': { '.read': false },
      '$other': { '.validate': false },
    },
  };
  return next;
};
if (process.argv[1] && process.argv[1].endsWith('build-420-private-rules-candidate.mjs')) {
  const source = JSON.parse(readFileSync('database.rules.json', 'utf8'));
  const next = buildStage420PrivateRulesCandidate(source);
  if (process.argv.includes('--output')) {
    const i = process.argv.indexOf('--output');
    const target = process.argv[i + 1];
    if (!target || target === 'database.rules.json' ||
        !target.startsWith('/tmp/')) throw new Error('Only /tmp/ candidate output allowed');
    writeFileSync(target, JSON.stringify(next, null, 2) + '\n');
    console.log('STAGE420_RULES_CANDIDATE_WRITTEN=' + target);
  } else {
    console.log('STAGE420_RULES_CANDIDATE_IN_MEMORY_ONLY=PASS');
  }
}
