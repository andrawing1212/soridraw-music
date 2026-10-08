import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// App379-compatible, pre-app380 handoff Worker. Test a strict byte-for-byte
// function freeze, not an allowlist of broad subsystems.
const frozen = execFileSync('git', ['show',
  '365e41f06c8ff169a3b762dd527498f6813d335f:cloudflare/explore-worker/canonical/preview-worker.js'],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const candidate = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const parsed = (name, source) => ts.createSourceFile(name, source,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const b = parsed('frozen.js', frozen), c = parsed('follow-only.js', candidate);
const allow = new Set(['enforceFollowEdgeRateLimit355', 'handleFollowOverlay354']);
const appended = ['socialAbusePolicy380', 'socialAbuseUnavailable380',
  'socialAbuseLimited380', 'consumeSocialAbuse380'];

assert.equal(c.statements.length, b.statements.length + appended.length,
  'only four follow-only runtime functions may be appended');
const changed = [];
for (let i = 0; i < b.statements.length; i += 1) {
  const oldNode = b.statements[i], node = c.statements[i];
  assert.equal(node.kind, oldNode.kind, 'Worker statement kind/order changed: ' + i);
  if (ts.isFunctionDeclaration(oldNode) && ts.isFunctionDeclaration(node)) {
    assert.equal(node.name?.text, oldNode.name?.text,
      'Worker function order/name changed: ' + i);
    if (allow.has(node.name.text)) {
      assert.notEqual(node.getText(c), oldNode.getText(b),
        'follow guard did not change expected function: ' + node.name.text);
      changed.push(node.name.text);
      continue;
    }
  }
  assert.equal(node.getText(c), oldNode.getText(b),
    'unrelated app379 Worker statement changed: ' +
    (ts.isFunctionDeclaration(oldNode) ? oldNode.name?.text : i));
}
assert.deepEqual(changed.sort(), [...allow].sort());
assert.deepEqual(c.statements.slice(b.statements.length).map(node => {
  assert.ok(ts.isFunctionDeclaration(node), 'new non-function Worker statement');
  return node.name?.text;
}), appended);
assert.doesNotMatch(candidate,
  /SORIDRAW_LIKE_ABUSE_GUARD_390_20261008|acceptLikeReceipt390|readLegacyLikeReplay379/,
  'app380 new like intake/replay must not be present');
const likeFrozen = execFileSync('git', ['show',
  'aa1bac7636651fdf94598f0d5ef502955a60bc0f:src/services/exploreLikeService.ts'],
  { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
assert.equal(readFileSync('src/services/exploreLikeService.ts', 'utf8'), likeFrozen,
  'app379 likes client changed in follow-only candidate');
console.log('APP379_LIKE_CLIENT_EXACT_FROZEN=PASS');
console.log('APP379_WORKER_ALL_NON_FOLLOW_STATEMENTS_EXACT_FROZEN=PASS');
console.log('FOLLOW_ONLY_097_TWO_FUNCTION_BOUNDARY=PASS');
