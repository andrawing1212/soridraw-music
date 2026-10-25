#!/usr/bin/env node
// app497 read-only release-controller source audit. This does NOT constitute
// independent Work approval or authorize TEST/PRODUCTION. No external writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TARGET_SHA = 'f521b9c8808397d47b596f840ff816cac374dd91';
function part(source, begin, end) {
  const s = source.indexOf(begin);
  const e = source.indexOf(end, s + begin.length);
  assert.ok(s >= 0 && e > s, 'APP497_SOURCE_CONTROLLER_LAYOUT_CHANGED');
  return source.slice(s, e);
}
function examine(source) {
  const verify = part(source, '- name: TEST_VERIFY and freeze durable manifest',
    '- name: PROD_PREFLIGHT revalidate TEST manifest and live release');
  const prod = part(source, '- name: PROD_PREFLIGHT revalidate TEST manifest and live release',
    '- name: PROD_DEPLOY verified identities only');
  const prelude = part(source, '- name: Materialize exact release source',
    '- name: PREFLIGHT build and static verification');
  const hardcodedPass = /parity:\s*\{\s*reference:\s*'PREVIEW'\s*,\s*status:\s*'PASS'\s*\}/.test(verify);
  const automaticTestVerified = /state:\s*'TEST_VERIFIED'/.test(verify)
    && /gh release create/.test(verify)
    && /update TEST_VERIFIED/.test(verify);
  // Verify the manifest requires an independently signed owner-device
  // acceptance record, not just an approval typed at production time.
  const hasOwnerDeviceEvidence = /(?:ownerDeviceAcceptance|signedPhysicalTest|verifiedDeviceReceipt|userApprovedTestArtifact)/.test(verify)
    && /(?:ownerDeviceAcceptance|signedPhysicalTest|verifiedDeviceReceipt|userApprovedTestArtifact)/.test(prod);
  const productionOnlyChecksSelfCertifiedTest = /m\.state\s*!==\s*'TEST_VERIFIED'/.test(prelude)
    && !hasOwnerDeviceEvidence;
  return { hardcodedPass, automaticTestVerified, hasOwnerDeviceEvidence,
    productionOnlyChecksSelfCertifiedTest };
}
function selfTest() {
  const source = [
    '- name: Materialize exact release source',
    "if(m.state!=='TEST_VERIFIED') throw Error('no');",
    '- name: PREFLIGHT build and static verification',
    '- name: TEST_VERIFY and freeze durable manifest',
    "const m={state:'TEST_VERIFIED',parity:{reference:'PREVIEW',status:'PASS'}};",
    'gh release create "$tag"',
    'update TEST_VERIFIED',
    '- name: PROD_PREFLIGHT revalidate TEST manifest and live release',
    'test "$MANIFEST_MAIN" = "$EXPECTED"',
    '- name: PROD_DEPLOY verified identities only',
  ].join('\n');
  const f = examine(source);
  assert.deepEqual(f, { hardcodedPass: true, automaticTestVerified: true,
    hasOwnerDeviceEvidence: false, productionOnlyChecksSelfCertifiedTest: true });
  assert.equal(examine(source.replace("status:'PASS'","status:observedParityStatus")).hardcodedPass, false);
  assert.equal(examine(source.replace("state:'TEST_VERIFIED'","state:'TEST_PENDING_OWNER_ACCEPTANCE'")).automaticTestVerified, false);
  console.log('APP497_RELEASE_ATTESTATION_NEGATIVE_SOURCE_FIXTURES=PASS');
  console.log('APP497_BACKEND_DEPLOY_AND_USER_DATA_WRITES=0');
}
function main() {
  const args=process.argv.slice(2);
  if(args.length===1 && args[0]==='--self-test') return selfTest();
  if(args.length!==2 || args[0]!=='--workflow')
    throw Error('APP497_REQUIRE_EXPLICIT_FROZEN_WORKFLOW_FILE');
  const source=readFileSync(args[1],'utf8');
  const f=examine(source);
  // This verifier is a documented regression detector. Its *own* success
  // confirms the P1 gates are absent, NOT that the controller is ready.
  if(!f.hardcodedPass || !f.automaticTestVerified || !f.productionOnlyChecksSelfCertifiedTest)
    throw Error('APP497_FROZEN_SHA_FINDINGS_CHANGED_REVIEW_REQUIRED');
  console.log('APP497_FROZEN_AUDIT_TARGET_SHA='+TARGET_SHA);
  console.log('APP497_P1_MANIFEST_PARITY_STATIC_PASS=CONFIRMED');
  console.log('APP497_P1_TEST_VERIFIED_BEFORE_OWNER_DEVICE_ACCEPTANCE=CONFIRMED');
  console.log('APP497_P1_PRODUCTION_MANIFEST_LACKS_SIGNED_DEVICE_ACCEPTANCE=CONFIRMED');
  console.log('APP497_DEPLOYMENT_READINESS=HOLD');
  console.log('APP497_SOURCE_AUDIT_IS_NOT_INDEPENDENT_WORK_PASS');
  console.log('APP497_REMOTE_DEPLOY_USER_DATA_READ_WRITE=0');
}
try { main(); }
catch(err) {
  console.error('APP497_SOURCE_AUDIT_UNVERIFIED_HOLD '+String(err?.message || err).slice(0,140));
  process.exit(1);
}
