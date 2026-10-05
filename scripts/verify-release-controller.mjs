import assert from 'node:assert/strict';
import fs from 'node:fs';
import { controllerIdentity, parseReleaseCommand } from './release-controller-policy.mjs';

const workflow = fs.readFileSync('.github/workflows/soridraw-release-promotion.yml', 'utf8');
const runtime = fs.readFileSync('.deploy/release-worker-runtime.mjs', 'utf8');
const mediaRuntime = fs.readFileSync('.deploy/release-media-worker-runtime.mjs', 'utf8');

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
  for (const permission of ['firebasehosting.sites.get', 'firebasehosting.sites.list', 'firebasehosting.sites.update']) assert.ok(capability.includes(permission));
  assert.ok(capability.includes(':testIamPermissions'));
  assert.ok(capability.includes('git push --dry-run'));

  const snapshot = step(source, 'Snapshot external state');
  const immutable = step(source, 'Finish immutable preflight_only');
  for (const identity of ['preview-before', 'main-before', 'production-before', 'test-worker-before', 'production-worker-before', 'test-media-worker-before', 'production-media-worker-before', 'test-hosting-before', 'production-hosting-before', 'test-worker-schedules-before', 'production-worker-schedules-before']) {
    assert.ok(immutable.includes(identity), `preflight does not compare ${identity}`);
  }
  assert.match(snapshot, /sort_by\(\.cron\)/);
  assert.match(immutable, /sort_by\(\.cron\)/);

  const testDeploy = step(source, 'TEST_DEPLOY exact tree and uploaded Worker version');
  assert.match(testDeploy, /release-media-worker-runtime\.mjs test upload/);
  assert.match(testDeploy, /release-media-worker-runtime\.mjs test activate/);
  assert.doesNotMatch(testDeploy, /refs\/heads\/main/);
  const prodDeploy = step(source, 'PROD_DEPLOY verified identities only');
  assert.match(prodDeploy, /release-media-worker-runtime\.mjs production upload/);
  assert.match(prodDeploy, /release-media-worker-runtime\.mjs production activate/);
  assert.match(prodDeploy, /hosting:clone "soridraw-test@\$test_hosting_version_id"/);
  assert.doesNotMatch(prodDeploy, /refs\/heads\/production/);
  assert.doesNotMatch(prodDeploy, /soridraw-test:live/);
  assert.doesNotMatch(prodDeploy, /soridraw-test:@/);

  const testVerify = step(source, 'TEST_VERIFY and freeze durable manifest');
  const prodPreflight = step(source, 'PROD_PREFLIGHT revalidate TEST manifest and live release');
  assert.match(testVerify, /identity "\$GITHUB_WORKSPACE"/);
  assert.match(testVerify, /gh release create/);
  assert.match(testVerify, /refs\/heads\/main/);
  before(testVerify, 'release-media-worker-runtime.mjs test verify', 'refs/heads/main');
  before(testVerify, 'gh release create', 'refs/heads/main');
  const prodVerify = step(source, 'PROD_VERIFY');
  assert.match(prodVerify, /refs\/heads\/production/);
  before(prodVerify, 'release-media-worker-runtime.mjs production verify', 'refs/heads/production');
  assert.match(prodPreflight, /controllerIdentity\(process\.argv\[3\]\)/);
  assert.match(prodPreflight, /"\$GITHUB_WORKSPACE"/);
  assert.doesNotMatch(prodPreflight, /controllerIdentity\(process\.cwd\(\)\)/);

  const rollback = step(source, 'Rollback branch and Worker traffic after deployment failure');
  for (const flag of ['test-worker-mutated', 'test-media-worker-mutated', 'test-branch-mutated', 'test-hosting-mutated', 'test-release-mutated', 'production-worker-mutated', 'production-media-worker-mutated', 'production-branch-mutated', 'production-hosting-mutated']) assert.ok(rollback.includes(flag));
  assert.match(rollback, /gh release delete/);
  assert.match(rollback, /release-worker-runtime\.mjs "\$stage" restore/);
  assert.match(rollback, /release-media-worker-runtime\.mjs "\$stage" restore/);
  assert.doesNotMatch(rollback, /release-worker-runtime\.mjs "\$stage" activate/);
  assert.doesNotMatch(rollback, /release-media-worker-runtime\.mjs "\$stage" activate/);
  assert.match(runtime, /if \(action === 'restore'\) \{\s*await restore\(\);\s*process\.exit\(0\);\s*\}/);
  assert.match(runtime, /hashReleaseIdentity/);
  assert.match(mediaRuntime, /SORIDRAW_SHARED_CATALOG_V1/);
  assert.match(mediaRuntime, /SHARED_CATALOG_BUCKET = 'soridraw-user-catalog'/);
  assert.match(mediaRuntime, /MEDIA_WORKER_UPLOAD_NO_TRAFFIC_CHANGE=PASS/);
  assert.match(mediaRuntime, /MEDIA_WORKER_VERIFY=PASS/);
  assert.match(mediaRuntime, /MEDIA_ACTIVE_VERSION_SETTLED=PASS/);
  assert.match(mediaRuntime, /MEDIA_HEALTH_SETTLED=PASS/);
  assert.match(mediaRuntime, /hashReleaseIdentity/);
  const mediaIdentityBlock = mediaRuntime.slice(mediaRuntime.indexOf('function hashReleaseIdentity()'), mediaRuntime.indexOf('async function activeVersion()', mediaRuntime.indexOf('function hashReleaseIdentity()')));
  assert.doesNotMatch(mediaIdentityBlock, /CONFIG_PATH/);
  assert.match(mediaIdentityBlock, /shared_catalog_flag/);
  assert.match(mediaRuntime, /action === 'restore'/);

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
  s => s.replaceAll('firebasehosting.sites.update', 'firebasehosting.sites.get'),
  s => s.replace('test "$(cat "$RUNNER_TEMP/test-worker-schedules-before")" = "$(current_schedules "$TEST_WORKER")"', ':'),
  s => s.replace('release-worker-runtime.mjs "$stage" restore', 'release-worker-runtime.mjs "$stage" activate'),
  s => s.replace('release-media-worker-runtime.mjs "$stage" restore', 'release-media-worker-runtime.mjs "$stage" activate'),
].entries()) assert.throws(() => validate(mutate(workflow)), undefined, `mutation ${index} was not rejected`);

console.log('RELEASE_CONTROLLER_TWELVE_HARDENING_INVARIANTS=PASS');
console.log('RELEASE_CONTROLLER_EXECUTABLE_MUTATION_TESTS=PASS');
console.log('RELEASE_CONTROLLER_STATE_MACHINE_STATIC=PASS');
console.log('RELEASE_CONTROLLER_PREFLIGHT_IMMUTABLE_STATIC=PASS');
