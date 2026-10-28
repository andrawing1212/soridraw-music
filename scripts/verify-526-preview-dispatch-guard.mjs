// app526 P1/P2: execute the ACTUAL workflow step shell against an isolated fake
// trigger file. Never reach Firebase/Cloudflare; mock the Hosting command.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const source = readFileSync('.github/workflows/firebase-hosting-custom-preview.yml', 'utf8');
const sha = 'a'.repeat(40);

function step(name) {
  const startToken = '      - name: ' + name + '\n';
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, 'missing exact step: ' + name);
  const next = source.indexOf('\n      - name:', start + startToken.length);
  const block = source.slice(start, next < 0 ? source.length : next);
  const anchor = '        run: |\n';
  const pos = block.indexOf(anchor);
  assert.ok(pos >= 0, 'step has no inline shell run: ' + name);
  const raw = block.slice(pos + anchor.length);
  return raw.split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
}

const guard = step('APP526_PINNED_PREVIEW_RELEASE_GUARD');
const rules = step('Deploy shared RTDB rules when release requests public like live sync');
const hosting = step('Deploy PREVIEW Hosting only');
const v2pos = source.indexOf('      - name: APP515_MAIN_PREVIEW_V2_GUARD');
const lockPos = source.indexOf('      - name: Lock source and protected refs');
const authPos = source.indexOf('      - name: Authenticate Firebase');
const deployPos = source.indexOf('      - name: Deploy shared RTDB rules');
assert.ok(lockPos >= 0 && v2pos > lockPos && v2pos < authPos && v2pos < deployPos,
  'app515 main V2 guard must precede authenticated mutation');
assert.ok(source.includes('git show origin/main:scripts/verify-515-main-release-floor.mjs'),
  'V2 check must load policy from LIVE main not from arbitrary candidate');
assert.ok(source.includes('APP526_MANUAL_SHA_RACE_BLOCKED'), 'missing last-moment SHA guard');
assert.ok(!source.includes('trigger_url='), 'no remote GITHUB_SHA trigger reads allowed');

const root = mkdtempSync(path.join(tmpdir(), 'soridraw-526-'));
const fakeBin = path.join(root, 'bin');
mkdirSync(fakeBin);
const npxMarker = path.join(root, 'npx.called');
const fakeNpx = path.join(fakeBin, 'npx');
writeFileSync(fakeNpx, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$NPX_MARKER"\n', {mode: 0o755});

const approved = [
  'deploy_shared_rtdb_rules=false',
  'functions_deploy=false',
  'release_shared_user_data_change=false',
  'deploy_hosting=true',
].join('\n') + '\n';

function testStep(shell, {event = 'workflow_dispatch', eventSha = sha, approvedSha = sha, targetSha = sha, trigger = approved} = {}) {
  const dir = mkdtempSync(path.join(root, 'case-'));
  const triggerDir = path.join(dir, '.deploy');
  mkdirSync(triggerDir);
  writeFileSync(path.join(triggerDir, 'preview-app-release.trigger'), trigger);
  const output = spawnSync('bash', ['-e', '-c', shell], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env,
      GITHUB_EVENT_NAME: event, GITHUB_SHA: eventSha,
      APPROVED_SHA: approvedSha, TARGET_SHA: targetSha,
      NPX_MARKER: npxMarker, PATH: fakeBin + path.delimiter + process.env.PATH,
      GITHUB_OUTPUT: path.join(dir, 'gh-output'),
    },
  });
  rmSync(dir, {recursive: true, force: true});
  return {ok: output.status === 0, text: output.stdout + output.stderr};
}

try {
  assert.ok(testStep(guard).ok, 'exact SHA and no-shared Rules approval should pass');
  assert.ok(!testStep(guard, {eventSha: 'b'.repeat(40)}).ok, 'moving preview event SHA must block');
  assert.ok(!testStep(guard, {approvedSha: 'preview'}).ok, 'branch ref cannot replace SHA');
  assert.ok(!testStep(guard, {trigger: approved.replace('rules=false', 'rules=true')}).ok,
    'shared Rules=true must block manual release');
  assert.ok(!testStep(guard, {trigger: approved.replace('functions_deploy=false', 'functions_deploy=true')}).ok,
    'Functions=true must block manual release');
  assert.ok(!testStep(guard, {trigger: approved.replace('deploy_hosting=true', 'deploy_hosting=false')}).ok,
    'hosting-disabled request must block');
  assert.match(testStep(rules).text, /MANUAL_SHARED_RTDB_RULES_DEPLOY=SKIPPED/,
    'manual Rules path should be disabled by construction');
  assert.ok(testStep(rules).ok, 'manual Rules step must pass without accessing shared backend');
  assert.ok(!testStep(rules, {eventSha: 'b'.repeat(40)}).ok, 'late changed SHA must abort Rules step');
  assert.ok(!existsSync(npxMarker), 'Rules checks must never call deploy command');
  assert.ok(!testStep(hosting, {eventSha: 'b'.repeat(40)}).ok,
    'late SHA race must abort before Hosting deployment');
  assert.ok(!testStep(hosting, {trigger: approved.replace('rules=false', 'rules=true')}).ok,
    'changed Rules flag must abort before Hosting deployment');
  assert.ok(!existsSync(npxMarker), 'unsafe Hosting attempt invoked deploy');
  assert.ok(testStep(hosting).ok, 'approved exact pinned Hosting step should proceed');
  assert.ok(existsSync(npxMarker), 'mock Hosting deploy path not reached for safe request');
  assert.match(readFileSync(npxMarker, 'utf8'), /firebase-tools@latest deploy/,
    'only Firebase Hosting command should be reached');
  console.log('APP526_PINNED_PREVIEW_P1_SHA_AND_RULES_RACE=PASS');
  console.log('APP526_PREVIEW_MAIN_V2_PROTECTION_P2=PASS');
  console.log('APP526_WORKFLOW_SHELL_MOCK_NO_REAL_DEPLOY=PASS');
} finally {
  rmSync(root, {recursive: true,force: true});
}
