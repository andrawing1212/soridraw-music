// SORIDRAW PREVIEW QA engine v1.
// Fast: focused checks requiring only Node 22 (no npm install).
// Stage416: private-intent two-browser regression remains in the existing like group; verified against final source candidate (no deployment).
// Full: the same frozen regressions + TypeScript and Vite build (npm ci needed).
// Focus: rerun only named check groups after a small correction.
// This is NOT a deployment or a substitute for live RTDB/D1/PC/mobile release gates.
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const groups = [
  { name: 'syntax', commands: [
    ['node', '--check', 'cloudflare/explore-worker/canonical/preview-entry.js'],
    ['node', '--check', 'cloudflare/explore-worker/canonical/preview-worker.js'],
    ['node', '--check', 'cloudflare/explore-worker/patches/060-shared-profile-r2-parity.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/patches/062-shared-track-card-r2.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-d1only-batch-adapter-420.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-batch-composition-422.mjs'],
    ['node', '--check', 'scripts/verify-419-like-w2-cutover.mjs'],
  ] },
  { name: 'like', commands: [
    ['node', 'scripts/verify-419-like-w2-cutover.mjs'],
    ['node', 'scripts/verify-416-private-like-intent.mjs'],
  ] },
  { name: 'like-deep', commands: [
    ['node', 'scripts/verify-127-atomic-personal-like.mjs'],
  ] },
  { name: 'catalog', commands: [
    ['node', 'scripts/verify-175-explore-like-catalog-reentry.mjs'],
  ] },
  { name: 'recent-edit-cost', commands: [
    ['node', 'scripts/verify-290-recent-edit-batch.mjs'],
    ['node', 'scripts/verify-291-recent-lyrics-live-preview.mjs'],
    ['node', 'scripts/verify-recent-noop-edit-cost.mjs'],
  ] },
  { name: 'catalog-deep', commands: [
    ['node', 'scripts/verify-197-new-public-track-like.mjs'],
  ] },
  { name: 'public', commands: [
    ['node', 'scripts/verify-178-final-like-architecture.mjs'],
    ['node', 'scripts/verify-191-bounded-public-like-convergence.mjs'],
    ['node', 'scripts/verify-192-cross-account-public-like-live.mjs'],
  ] },
  { name: 'receipt', commands: [
    ['node', 'scripts/verify-390-like-acceptance-receipt.mjs'],
  ] },
  { name: 'projection', commands: [
    ['node', '--check', 'scripts/verify-412-shared-projection-cas.mjs'],
    ['node', 'scripts/verify-412-shared-projection-cas.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-public-r2-publisher-421.mjs'],
    ['node', 'scripts/verify-421-like-r2-publisher.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-personal-r2-publisher-423.mjs'],
    ['node', 'scripts/verify-423-personal-like-r2.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-rtdb-user-signal-424.mjs'],
    ['node', 'scripts/verify-424-like-rtdb-signal.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-cold-personal-bootstrap-430.mjs'],
    ['node', 'scripts/verify-430-cold-personal-bootstrap.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-batch-capacity-431.mjs'],
    ['node', 'scripts/verify-431-like-batch-capacity.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-cold-public-card-432.mjs'],
    ['node', 'scripts/verify-432-cold-public-card.mjs'],
    ['node', '--check', 'cloudflare/explore-worker/runtime/like-legacy-intent-reconcile-433.mjs'],
    ['node', 'scripts/verify-433-legacy-intent-reconcile.mjs'],
  ] },
  { name: 'lifecycle', commands: [
    ['node', '--check', 'scripts/verify-413-like-exit-flush.mjs'],
    ['node', '--check', 'scripts/verify-414-pending-only-lifecycle.mjs'],
    ['node', 'scripts/verify-414-pending-only-lifecycle.mjs'],
  ] },
  { name: 'lifecycle-deep', commands: [
    ['node', 'scripts/verify-413-like-exit-flush.mjs'],
  ] },
  { name: 'typecheck', commands: [['npm', 'run', 'lint']] },
  { name: 'build', commands: [['npm', 'run', 'build']] },
];

const byName = new Map(groups.map(group => [group.name, group]));
const offlineNames = ['syntax','like','catalog','recent-edit-cost','public','receipt','projection','lifecycle'];
const mode = process.argv[2] || 'fast';
let names = [];
if (mode === 'fast') names = offlineNames;
else if (mode === 'full') names = [...offlineNames,'like-deep','catalog-deep','lifecycle-deep','typecheck','build'];
else if (mode === 'focus') names = process.argv.slice(3).flatMap(x => x.split(',')).filter(Boolean);
else {
  console.error('Usage: node scripts/soridraw-qa-engine.mjs fast|full|focus <group[,group]...>');
  process.exit(2);
}
if (!names.length || names.some(x => !byName.has(x))) {
  console.error('Available check groups: ' + groups.map(x => x.name).join(', '));
  process.exit(2);
}
if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('QA_ENGINE=FAIL: Node 22 or newer required (built-in SQLite)');
  process.exit(2);
}
const start=performance.now();
let completed=0;
console.log('SORIDRAW_QA_PROFILE=' + mode.toUpperCase() + ' CHECKS=' + [...new Set(names)].join(','));
for (const name of [...new Set(names)]) {
  const group=byName.get(name);
  const started=performance.now();
  console.log('QA_START=' + name);
  for (const command of group.commands) {
    const args=command.slice(1);
    const child=spawnSync(command[0], args, {
      shell:false, stdio:'inherit', timeout:mode==='fast' ? 120000 : 300000,
      env:process.env,
    });
    if (child.error || child.status !== 0) {
      console.error('QA_FAIL=' + name +
        ' command=' + command.join(' ') +
        ' exit=' + (child.status ?? 'error') +
        ' elapsed_ms=' + Math.round(performance.now()-started));
      console.error('QA_RELEASE_GATE=NOT_VERIFIED');
      process.exit(1);
    }
  }
  completed++;
  console.log('QA_PASS=' + name + ' elapsed_ms=' + Math.round(performance.now()-started));
}
console.log('QA_ENGINE=PASS groups=' + completed +
  ' total_ms=' + Math.round(performance.now()-start));
console.log('QA_LIVE_RTDB_RULES_AND_REMOTE_D1=NOT_CHECKED_BY_THIS_ENGINE');
console.log('QA_PREVIEW_DEPLOYMENT=NOT_PERFORMED');
console.log('QA_RELEASE_GATE=NOT_VERIFIED_UNTIL_EXISTING_REMOTE_AND_DEVICE_AUDITS');
