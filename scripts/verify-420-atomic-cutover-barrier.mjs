// Stage420 release barrier: existing app396 / TEST / PRODUCTION data is
// shared. A green code build MUST NOT accidentally enable only one backend
// surface or revoke the old installed-client RTDB publisher.
// This source-only guard is retired ONLY as part of a user-approved,
// independently audited coherent release (Rules + Worker + Functions +
// Master + new-client PWA compatibility). No live resources are touched.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file = path => readFileSync(path,'utf8');
const client=file('src/services/exploreLikeService.ts');
const server=file('functions/src/index.ts');
const ui=file('src/pages/AdminAppSettingsPage.tsx');
const worker=file('cloudflare/explore-worker/canonical/preview-entry.js');
const ledger=file('functions/src/exploreLikeAtomicLedgerCandidate420.ts');
const shared=JSON.parse(file('database.rules.json'));
const exactlyOff=(s,label) => {
  assert.match(s,/= false;/,label);
};
assert.match(client,/export const EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE = false;/,
  'old mobile/PC accounts must not be routed to inactive Stage420');
assert.match(server,/const STAGE420_ATOMIC_APPROVAL_CUTOVER_ACTIVE = false;/,
  'Firestore approved receipts need all other release components before activation');
// The chosen signed-existing-Writer route uses the RTDB /display producer.
// /displayV2 is owned solely by the different, still-dormant atomic onCreate.
assert.match(client,/const STAGE420_PRIVATE_SIGNAL_SOURCE: 'legacy' \| 'atomic-v2' = 'legacy';/,
  'signed-existing-Writer client must listen to the producer at /display');
assert.match(client,/unsubscribeGuardedLike420 = subscribeGuardedLikeIntent420\(uid,[\s\S]*?STAGE420_PRIVATE_SIGNAL_SOURCE\);/,
  'single UID receiver must use the guarded server signal source selector');
assert.match(server,/const STAGE420_ATOMIC_MASTER_CUTOVER_ENABLED = false;/,
  'Master must not clear a different rate authority');
assert.match(ui,/const STAGE420_MASTER_PANEL_ACTIVE = false;/,
  'unreleased Master panel must not replace the existing role UI');
assert.match(worker,/const STAGE426_COMPILED_OPEN = false;/,
  'unsigned old Worker path must not be bypassed through a partial release');
assert.match(worker,/const STAGE420_SIGNED_LEGACY_INTAKE_OPEN = false;/,
  'alternate signed guard needs the SAME old-client/Rules release approval');
assert.equal(shared.rules.privateLikeSync420,undefined,
  'shared RTDB Rules cannot be silently flipped on a preview-only code push');
assert.match(shared.rules.userSync.$uid['.write'],
  /auth != null && auth.uid === \$uid/,
  'unreviewed legacy ancestor permission change would break old clients');
assert.match(ledger,/createLikeReceiptDeliveryTriggerCandidate420/,
  'receipt onCreate must remain an explicit candidate until the operator alert is real');
assert.doesNotMatch(server,/export const (?:likeReceiptDelivery|createLikeReceiptDeliveryTriggerCandidate420)/,
  'onCreate must NOT be deployed alone before old-client Rules/Worker cutover');
assert.match(server,/recoverExactAtomicLikeApprovalCandidate420/,
  'future ACK recovery needs the Firestore authority proof, never fresh approval');
assert.match(server,/issueRenewedLikePermitV2420/,
  'future signed replay cannot extend the original permit lifetime');
assert.match(client,/if \(!EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\) \{[\s\S]*?settleExploreLikeIntent416\(uid, noOps\.map/,
  'atomic cancellation must not write revoked direct416 signal');
assert.match(client,/if \(!EXPLORE_LIKE_STAGE420_CUTOVER_ACTIVE\) \{[\s\S]*?settleExploreLikeIntent416\(uid, batchEntries\.map/,
  'atomic canonical ACK must not write revoked direct416 signal');

console.log('STAGE420_ATOMIC_CUTOVER_GUARD_ALL_FIVE_SURFACES_HARD_OFF=PASS');
console.log('STAGE420_SHARED_RULES_AND_LEGACY_416_CLIENT_INTACT=PASS');
console.log('STAGE420_ATOMIC_RECEIPT_EVENTARC_UNDEPLOYED_BY_DESIGN=PASS');
