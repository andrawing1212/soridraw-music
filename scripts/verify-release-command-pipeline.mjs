import assert from 'node:assert/strict';
import { parseReleaseCommand } from './release-controller-policy.mjs';

const sha = 'a'.repeat(40);
assert.deepEqual(parseReleaseCommand(`/soridraw preflight ${sha}`), { mode: 'preflight_only', target: sha, manifestTag: '', approval: '' });
assert.deepEqual(parseReleaseCommand(`/soridraw test ${sha}`), { mode: 'test', target: sha, manifestTag: '', approval: '' });
assert.equal(parseReleaseCommand('/soridraw production soridraw-test-v116-abcdef123456 DEPLOY_PRODUCTION').mode, 'production');
for (const invalid of [
  `/soridraw production soridraw-test-v116-abcdef123456 DEPLOY_PRODUCTION\nquoted documentation`,
  `> /soridraw production soridraw-test-v116-abcdef123456 DEPLOY_PRODUCTION`,
  `/soridraw test ${sha} extra`, `/soridraw preflight ${sha.toUpperCase()}`, '',
]) assert.throws(() => parseReleaseCommand(invalid), /INVALID_RELEASE_COMMAND/);
console.log('RELEASE_COMMAND_ENTIRE_BODY_GRAMMAR=PASS');
