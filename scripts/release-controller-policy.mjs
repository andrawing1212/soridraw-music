import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SHA = '[0-9a-f]{40}';
const TAG = 'soridraw-test-v[0-9]+-[0-9a-f]{12}';
const commandPattern = new RegExp(`^/soridraw (preflight|test) (${SHA})$|^/soridraw production (${TAG}) DEPLOY_PRODUCTION$`);

export function parseReleaseCommand(body) {
  if (typeof body !== 'string' || body.includes('\n') || body.includes('\r')) throw new Error('INVALID_RELEASE_COMMAND');
  const match = commandPattern.exec(body);
  if (!match) throw new Error('INVALID_RELEASE_COMMAND');
  if (match[1]) return { mode: match[1] === 'preflight' ? 'preflight_only' : 'test', target: match[2], manifestTag: '', approval: '' };
  return { mode: 'production', target: '', manifestTag: match[3], approval: 'DEPLOY_PRODUCTION' };
}

export function controllerIdentity(root) {
  const hash = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
  return {
    workflowSha256: hash('.github/workflows/soridraw-release-promotion.yml'),
    workerRuntimeSha256: hash('.deploy/release-worker-runtime.mjs'),
    controllerVerifierSha256: hash('scripts/verify-release-controller.mjs'),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const action = process.argv[2];
  if (action === 'parse-command') process.stdout.write(`${JSON.stringify(parseReleaseCommand(process.env.COMMENT_BODY))}\n`);
  else if (action === 'identity') process.stdout.write(`${JSON.stringify(controllerIdentity(process.argv[3] || process.cwd()))}\n`);
  else throw new Error('usage: release-controller-policy.mjs <parse-command|identity> [controller-root]');
}
