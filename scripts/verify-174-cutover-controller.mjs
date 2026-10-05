import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const controller = readFileSync(
  'cloudflare/explore-worker/scripts/like-d1-cutover-controller-174.mjs', 'utf8'
);
for (const required of [
  'SORIDRAW_LIKE_D1_CUTOVER_CONTROLLER_174_20260922',
  "confirm !== 'MANUAL_174_WRITE_APPROVED'",
  "confirm !== 'MANUAL_174_REOPEN_APPROVED'",
  'verifyExactWorkers(options.approvedWorkerSha256)',
  "actualSha !== approvedSha",
  'SORIDRAW_LIKE_D1_ATOMIC_CUTOVER_FENCE_174_20260922',
  "SET phase='draining'",
  "SET phase='frozen'",
  "SET phase='open'",
  'SORIDRAW_LIKE_DRAIN_TOKEN_174',
]) assert.ok(controller.includes(required), 'controller contract missing: ' + required);

assert.doesNotMatch(controller, /wrangler[^\n]+deploy/i);
assert.doesNotMatch(controller, /r2[^\n]+object[^\n]+put/i);
assert.doesNotMatch(controller, /20260922_01_explore_like_cutover_control_v174_additive\.sql/);
assert.ok(controller.indexOf('verifyExactWorkers(options.approvedWorkerSha256)') <
  controller.indexOf("options.action === 'begin-draining'"));

const workflows = [
  '.github/workflows/soridraw-release-system-audit.yml',
  '.github/workflows/cloudflare-explore-preview-release.yml',
  '.github/workflows/soridraw-release-promotion.yml',
].map((path) => readFileSync(path, 'utf8')).join('\n');
for (const action of ['begin-draining', 'freeze', 'reopen']) {
  assert.equal(
    workflows.includes('like-d1-cutover-controller-174.mjs --action ' + action),
    false,
    'mutation controller must not be auto-wired: ' + action,
  );
}

console.log('174_CONTROLLER_MUTATIONS_REQUIRE_EXPLICIT_CONFIRMATION=PASS');
console.log('174_CONTROLLER_REVERIFIES_ALL_ENV_EXACT_SOURCE_BEFORE_WRITE=PASS');
console.log('174_CONTROLLER_DOES_NOT_APPLY_MIGRATION_OR_FINAL_R2_MARKER=PASS');
console.log('174_CONTROLLER_NOT_AUTO_WIRED=PASS');
