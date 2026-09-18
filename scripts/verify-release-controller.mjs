import assert from 'node:assert/strict';
import fs from 'node:fs';
import { controllerIdentity, parseReleaseCommand } from './release-controller-policy.mjs';

const workflow = fs.readFileSync('.github/workflows/soridraw-release-promotion.yml', 'utf8');
const runtime = fs.readFileSync('.deploy/release-worker-runtime.mjs', 'utf8');

function step(source, name) {
  const marker = `      - name: ${name}\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = source.indexOf('\n      - name:', start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}
function before(text, first, second) {
  assert.ok(text.indexOf(first) >= 0 && text.indexOf(first) < text.indexOf(second), `${first} must execute before ${second}`);
}
function validate(source = workflow) {
  const checkout = source.slice(source.indexOf('      - name: Checkout fixed controller'), source.indexOf('      - name: Lock request and immutable baselines'));
  assert.match(checkout, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.doesNotMatch(checkout, /ref: preview/);
  const request = step(source, 'Lock request and immutable baselines');
  assert.match(request, /COMMENT_ISSUE.*RELEASE_CONTROL_ISSUE/s);
  assert.match(request, /COMMENT_IS_PR" = false/);
  assert.match(request, /GITHUB_ACTOR" = "\$GITHUB_REPOSITORY_OWNER".*allowed" = true/s);
  assert.match(request, /release-controller-policy\.mjs parse-command/);
  assert.doesNotMatch(request, /read -r .*COMMENT_BODY/);

  const capability = step(source, 'Safe Firebase write-permission and GitHub capability preflight');
  for (const permission of ['firebasehosting.versions.create', 'firebasehosting.versions.delete', 'firebasehosting.releases.create']) assert.ok(capability.includes(permission));
  assert.match(capability, /firebasehosting\.googleapis\.com\/v1beta1\/projects\/\$FIREBASE_PROJECT\/sites\/\$1\/channels\/live/);
  assert.doesNotMatch(source, /firebasehosting\.googleapis\.com\/v1beta1\/sites\//);
  assert.ok(capability.includes(':testIamPermissions'));
  assert.ok(capability.includes('git push --dry-run'));

  const snapshot = step(source, 'Snapshot external state');
  const immutable = step(source, 'Finish immutable preflight_only');
  for (const identity of ['preview-before', 'main-before', 'production-before', 'test-worker-before', 'production-worker-before', 'test-hosting-before', 'production-hosting-before', 'test-worker-schedules-before', 'production-worker-schedules-before']) {
    assert.ok(immutable.includes(identity), `preflight does not compare ${identity}`);
  }
  assert.match(snapshot, /sort_by\(\.cron\)/);
  assert.match(immutable, /sort_by\(\.cron\)/);

  const testDeploy = step(source, 'TEST_DEPLOY exact tree and uploaded Worker version');
  before(testDeploy, 'test upload', 'refs/heads/main');
  before(capability + testDeploy, 'testIamPermissions', 'refs/heads/main');
  const prodDeploy = step(source, 'PROD_DEPLOY verified identities only');
  before(prodDeploy, 'production upload', 'refs/heads/production');
  assert.match(prodDeploy, /hosting:clone "soridraw-test:@\$test_hosting_version_id"/);
  assert.doesNotMatch(prodDeploy, /soridraw-test:live/);

  const testVerify = step(source, 'TEST_VERIFY and freeze durable manifest');
  const prodPreflight = step(source, 'PROD_PREFLIGHT revalidate TEST manifest and live release');
  assert.match(testVerify, /identity "\$GITHUB_WORKSPACE"/);
  assert.match(prodPreflight, /controllerIdentity\(process\.argv\[3\]\)/);
  assert.match(prodPreflight, /"\$GITHUB_WORKSPACE"/);
  assert.doesNotMatch(prodPreflight, /controllerIdentity\(process\.cwd\(\)\)/);

  const rollback = step(source, 'Rollback branch and Worker traffic after deployment failure');
  for (const flag of ['test-worker-mutated', 'test-branch-mutated', 'test-hosting-mutated', 'production-worker-mutated', 'production-branch-mutated', 'production-hosting-mutated']) assert.ok(rollback.includes(flag));
  assert.match(rollback, /release-worker-runtime\.mjs "\$stage" restore/);
  assert.doesNotMatch(rollback, /release-worker-runtime\.mjs "\$stage" activate/);
  assert.match(runtime, /if \(action === 'restore'\) \{\s*await restore\(\);\s*process\.exit\(0\);\s*\}/);

  assert.doesNotMatch(source, /git\s+push[^\n]*(?:--force|-f\b)/i);
  assert.doesNotMatch(source, /d1\s+(?:migrations?\s+apply|execute)[^\n]*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i);
}

validate();
const sha = 'a'.repeat(40);
assert.equal(parseReleaseCommand(`/soridraw test ${sha}`).mode, 'test');
assert.throws(() => parseReleaseCommand(`/soridraw production soridraw-test-v116-abcdef123456 DEPLOY_PRODUCTION\nquoted`));
assert.equal(Object.values(controllerIdentity(process.cwd())).every(value => /^[0-9a-f]{64}$/.test(value)), true);

// Mutation tests prove the verifier rejects each audited defect rather than merely finding tokens.
for (const [index, mutate] of [
  s => s.replace('ref: ${{ github.workflow_sha }}', 'ref: preview'),
  s => s.replace('parsed="$(node scripts/release-controller-policy.mjs parse-command)"', 'read -r command argument value approval extra <<< "$COMMENT_BODY"'),
  s => s.replace('"$GITHUB_WORKSPACE" <<\'NODE\'', '"$RELEASE_ROOT" <<\'NODE\''),
  s => s.replaceAll('firebasehosting.versions.create', 'firebasehosting.versions.get'),
  s => s.replaceAll('/v1beta1/projects/$FIREBASE_PROJECT/sites/', '/v1beta1/sites/'),
  s => s.replace('test "$(cat "$RUNNER_TEMP/test-worker-schedules-before")" = "$(current_schedules "$TEST_WORKER")"', ':'),
  s => s.replace('release-worker-runtime.mjs "$stage" restore', 'release-worker-runtime.mjs "$stage" activate'),
].entries()) assert.throws(() => validate(mutate(workflow)), undefined, `mutation ${index} was not rejected`);

console.log('RELEASE_CONTROLLER_TWELVE_HARDENING_INVARIANTS=PASS');
console.log('RELEASE_CONTROLLER_EXECUTABLE_MUTATION_TESTS=PASS');
console.log('RELEASE_CONTROLLER_STATE_MACHINE_STATIC=PASS');
console.log('RELEASE_CONTROLLER_PREFLIGHT_IMMUTABLE_STATIC=PASS');
