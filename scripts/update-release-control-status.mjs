import { readFileSync, writeFileSync } from 'node:fs';

const [action, state] = process.argv.slice(2);
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const issue = process.env.RELEASE_CONTROL_ISSUE || '76';
const stateFile = process.env.RELEASE_STATUS_FILE;

if (!['create', 'update'].includes(action) || !state) throw new Error('usage: update-release-control-status.mjs <create|update> <state>');
if (!repository || !token || !stateFile) throw new Error('release status environment is incomplete');

const validStates = new Set([
  'REQUESTED', 'SOURCE_LOCKED', 'STATIC_CHECKS', 'PREFLIGHT', 'TEST_DEPLOY',
  'TEST_VERIFY', 'TEST_VERIFIED', 'PROD_PREFLIGHT', 'PROD_DEPLOY', 'PROD_VERIFY',
  'RELEASED', 'BLOCKED', 'FAILED', 'ROLLED_BACK',
]);
if (!validStates.has(state)) throw new Error(`unsupported release state: ${state}`);

const api = async (path, method, body) => {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'soridraw-release-controller',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GitHub issue status write failed: ${response.status} ${await response.text()}`);
  return response.json();
};

const runUrl = `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
let record = action === 'create'
  ? { commentId: null, history: [], mode: process.env.RELEASE_MODE || 'unknown', target: process.env.RELEASE_TARGET_INPUT || '(none)' }
  : JSON.parse(readFileSync(stateFile, 'utf8'));
if (record.history.at(-1) !== state) record.history.push(state);

const body = [
  '<!-- soridraw-release-controller-status -->',
  '## SORIDRAW Release Controller',
  '',
  `**Current state:** \`${state}\``,
  `**Mode:** \`${record.mode}\``,
  `**Requested by:** @${process.env.GITHUB_ACTOR}`,
  `**Target:** \`${record.target}\``,
  `**Run:** [${process.env.GITHUB_RUN_ID}](${runUrl})`,
  '',
  '### State history',
  ...record.history.map((item, index) => `${index + 1}. \`${item}\``),
  '',
  '_This comment is updated in place by the fixed Release Controller._',
].join('\n');

if (action === 'create') {
  const response = await api(`/repos/${repository}/issues/${issue}/comments`, 'POST', { body });
  record.commentId = response.id;
} else {
  if (!record.commentId) throw new Error('release status comment id is missing');
  await api(`/repos/${repository}/issues/comments/${record.commentId}`, 'PATCH', { body });
}
writeFileSync(stateFile, `${JSON.stringify(record)}\n`);
console.log(`RELEASE_CONTROL_STATE=${state}`);
