import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const hosts = ['preview.soridraw.com','test.soridraw.com','soridraw.com'];
for (const p of ['src/lib/adaptiveListIndexV2.ts','src/lib/firestoreMeasured.ts','src/lib/userDataEngine.ts','src/services/versionSignalService.ts']) {
  const s = read(p);
  for (const host of hosts) if (!s.includes(host)) throw new Error(`${p} missing ${host}`);
}
const engine = read('src/lib/userDataEngine.ts');
const archive = read('src/services/sunoR2Archive.ts');
for (const endpoint of ['soridraw-media-preview.andrawing1212.workers.dev','soridraw-media-test.andrawing1212.workers.dev','soridraw-media.andrawing1212.workers.dev']) {
  if (!engine.includes(endpoint)) throw new Error(`catalog endpoint missing ${endpoint}`);
  if (!archive.includes(endpoint)) throw new Error(`archive endpoint missing ${endpoint}`);
}
const cfg = JSON.parse(read('cloudflare/media-worker/wrangler.jsonc'));
if (cfg?.env?.test?.name !== 'soridraw-media-test') throw new Error('test media worker config missing');
if (cfg?.env?.production?.name !== 'soridraw-media') throw new Error('production media worker config missing');
if (cfg?.env?.test?.r2_buckets?.[0]?.bucket_name !== 'soridraw-media-test') throw new Error('test media bucket config missing');
if (cfg?.env?.production?.r2_buckets?.[0]?.bucket_name !== 'soridraw-media') throw new Error('production media bucket config missing');
console.log('RUNTIME_ENVIRONMENT_PARITY_028=PASS');
