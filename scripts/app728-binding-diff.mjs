import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readWorker } from './app728-direct-preflight.mjs';

const WORKERS = ['soridraw-explore-preview', 'soridraw-explore-api'];
const requiredShared = ['DB:d1', 'PROFILE_MEDIA:r2_bucket'];
const normalized = (worker) => (worker.bindings || [])
  .map((b) => ({ name: b.name, type: b.type, id: b.id, bucket: b.bucket,
    class_name: b.class_name, namespace_id: b.namespace_id, service: b.service,
    serviceEnvironment: b.serviceEnvironment, plainHash: b.plainHash }))
  .sort((a, b) => a.name.localeCompare(b.name));
const publicName = (row) => String(row.name || '');
const label = (row) => `${row.name}:${row.type}`;

export function compareApp728Bindings(preview, production) {
  const a = normalized(preview), b = normalized(production);
  const p = new Map(a.map(x => [x.name, x])), d = new Map(b.map(x => [x.name, x]));
  const names = [...new Set([...p.keys(), ...d.keys()])].sort();
  const onlyPreview = names.filter(n => p.has(n) && !d.has(n)).map(n => label(p.get(n)));
  const onlyProduction = names.filter(n => d.has(n) && !p.has(n)).map(n => label(d.get(n)));
  const changedTypes = names.filter(n => p.has(n) && d.has(n) && p.get(n).type !== d.get(n).type)
    .map(n => ({ name: n, previewType: p.get(n).type, productionType: d.get(n).type }));
  const changedTargets = names.filter(n => p.has(n) && d.has(n) && p.get(n).type === d.get(n).type)
    .flatMap(n => {
      const x = p.get(n), y = d.get(n);
      if (x.type === 'secret_text') return [];
      const keys = ['id', 'bucket', 'class_name', 'namespace_id', 'service', 'serviceEnvironment', 'plainHash'];
      const drift = keys.filter(k => x[k] !== y[k]);
      return drift.length ? [{ name: n, type: x.type, changedFields: drift }] : [];
    });
  const shared = requiredShared.map(term => {
    const [name, type] = term.split(':');
    const x = p.get(name), y = d.get(name);
    return { name, presentInBoth: x?.type === type && y?.type === type,
      sameTarget: type === 'd1' ? Boolean(x?.id && x.id === y?.id)
        : Boolean(x?.bucket && x.bucket === y?.bucket) };
  });
  const anomalies = [
    ...(a.length !== new Set(a.map(publicName)).size ? ['DUPLICATE_PREVIEW_BINDING_NAME'] : []),
    ...(b.length !== new Set(b.map(publicName)).size ? ['DUPLICATE_PRODUCTION_BINDING_NAME'] : []),
    ...(!preview.pinnedBindingsVerified || !production.pinnedBindingsVerified ? ['PINNED_BINDINGS_UNVERIFIED'] : []),
    ...(!preview.schedulesVerified || !production.schedulesVerified ? ['ACTIVE_SCHEDULES_UNVERIFIED'] : []),
    ...(shared.some(x => !x.presentInBoth || !x.sameTarget) ? ['SHARED_CANONICAL_TARGET_MISMATCH'] : []),
  ];
  return {
    status: 'HOLD', scope: 'ACTIVE_WORKER_GET_ONLY_BINDING_INVENTORY',
    preview: { activeVersion: preview.activeVersion, count: a.length, namesAndTypes: a.map(label) },
    production: { activeVersion: production.activeVersion, count: b.length, namesAndTypes: b.map(label) },
    onlyPreview, onlyProduction, changedTypes, changedTargets, shared,
    anomalies, summary: { sharedBindingNames: names.filter(n => p.has(n) && d.has(n)).length,
      previewOnlyCount: onlyPreview.length, productionOnlyCount: onlyProduction.length,
      changedTypeCount: changedTypes.length, changedTargetCount: changedTargets.length },
    caution: 'A difference may be environment-specific or a missing required capability. No binding is safe to add, delete or inherit based on this inventory alone. Never print secret values.',
    codeAndRollbackStillUnverified: true, deploymentPermitted: false,
  };
}
async function main() {
  const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required');
  const [preview, production] = await Promise.all(WORKERS.map(name => readWorker(name, token)));
  const report = compareApp728Bindings(preview, production);
  console.log(JSON.stringify(report, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## APP728 binding inventory: HOLD (no deploy)\n\n` +
      `PREVIEW ${report.preview.count}, PRODUCTION ${report.production.count}.\n\n` +
      `PREVIEW only: ${report.onlyPreview.length}, PROD only: ${report.onlyProduction.length}, differing targets: ${report.changedTargets.length}.\n\n` +
      `No TEST or user data access. Deployment still blocked.\n`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('APP728_BINDING_INVENTORY_ERROR:', String(err?.message || err)); process.exitCode = 2; });
}
