import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const action = String(process.argv[2] || '').trim();
const targetPath = String(process.argv[3] || '').trim();
if (!['snapshot', 'verify'].includes(action) || !targetPath) {
  throw new Error('usage: node scripts/release-production-environment-contract.mjs <snapshot|verify> <path>');
}

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};
const stableText = (value) => JSON.stringify(stable(value)) + '\n';
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const sortRows = (rows, key = 'binding') => [...(rows || [])]
  .map(stable)
  .sort((a, b) => String(a?.[key] || JSON.stringify(a)).localeCompare(String(b?.[key] || JSON.stringify(b)), 'en'));
const assertEqual = (a, b, label) => {
  if (JSON.stringify(stable(a)) !== JSON.stringify(stable(b))) throw new Error(label);
};
const one = (rows, binding) => (rows || []).find((row) => row.binding === binding) || null;

const normalizeExplore = (mode) => {
  const c = readJson(`cloudflare/explore-worker/.release-system/${mode}/wrangler.jsonc`);
  return stable({
    name: c.name,
    main: c.main,
    compatibility_date: c.compatibility_date,
    workers_dev: c.workers_dev,
    keep_vars: c.keep_vars,
    vars: c.vars || {},
    d1: sortRows((c.d1_databases || []).map((x) => ({
      binding: x.binding,
      database_name: x.database_name,
      database_id: x.database_id,
    }))),
    r2: sortRows((c.r2_buckets || []).map((x) => ({ binding: x.binding, bucket_name: x.bucket_name }))),
    services: sortRows((c.services || []).map((x) => ({
      binding: x.binding,
      service: x.service,
      ...(x.environment ? { environment: x.environment } : {}),
    }))),
    ratelimits: sortRows(c.ratelimits || [], 'name'),
    durable_objects: { bindings: sortRows(c?.durable_objects?.bindings || [], 'name') },
    migrations: sortRows(c.migrations || [], 'tag'),
    observability: c.observability || {},
    compatibility_flags: [...(c.compatibility_flags || [])].sort(),
  });
};

const normalizeMedia = (mode) => {
  const c = readJson(`cloudflare/media-worker/.release-system/${mode}/wrangler.jsonc`);
  return stable({
    name: c.name,
    main: c.main,
    compatibility_date: c.compatibility_date,
    keep_vars: c.keep_vars,
    vars: c.vars || {},
    r2: sortRows((c.r2_buckets || []).map((x) => ({ binding: x.binding, bucket_name: x.bucket_name }))),
  });
};

const hosting = (file) => stable(readJson(file).hosting || {});
const omitExploreAllowed = (c) => stable({
  ...c,
  name: undefined,
  vars: Object.fromEntries(Object.entries(c.vars || {}).filter(([key]) => key !== 'SORIDRAW_ENVIRONMENT')),
  d1: c.d1.filter((x) => x.binding !== 'RATE_DB'),
  r2: c.r2.filter((x) => x.binding !== 'EXPLORE_CACHE'),
  services: [],
});
const omitMediaAllowed = (c) => {
  const vars = { ...(c.vars || {}) };
  delete vars.ALLOWED_ORIGINS;
  return stable({ ...c, name: undefined, vars, r2: c.r2.filter((x) => x.binding !== 'MEDIA') });
};
const omitHostingSite = (h) => {
  const copy = JSON.parse(JSON.stringify(h));
  delete copy.site;
  return stable(copy);
};

const buildContract = () => {
  const testExplore = normalizeExplore('test');
  const prodExplore = normalizeExplore('production');
  const testMedia = normalizeMedia('test');
  const prodMedia = normalizeMedia('production');
  const testHosting = hosting('firebase.hosting-test.json');
  const prodHosting = hosting('firebase.hosting-production.json');

  if (testExplore.name !== 'soridraw-explore-test' || prodExplore.name !== 'soridraw-explore-api') {
    throw new Error('Explore target names drifted');
  }
  if (testExplore.vars.SORIDRAW_ENVIRONMENT !== 'test' || prodExplore.vars.SORIDRAW_ENVIRONMENT !== 'production') {
    throw new Error('Explore abuse environment identity mismatch');
  }
  assertEqual(omitExploreAllowed(testExplore), omitExploreAllowed(prodExplore), 'Unapproved TEST/PRODUCTION Explore contract difference');
  const testDb = one(testExplore.d1, 'DB');
  const prodDb = one(prodExplore.d1, 'DB');
  if (!testDb || !prodDb || testDb.database_name !== 'soridraw-explore-db' || prodDb.database_name !== 'soridraw-explore-db' || testDb.database_id !== prodDb.database_id) {
    throw new Error('Shared canonical D1 identity mismatch');
  }
  const testProfile = one(testExplore.r2, 'PROFILE_MEDIA');
  const prodProfile = one(prodExplore.r2, 'PROFILE_MEDIA');
  if (testProfile?.bucket_name !== 'soridraw-profile-media' || prodProfile?.bucket_name !== 'soridraw-profile-media') {
    throw new Error('Shared PROFILE_MEDIA identity mismatch');
  }
  if (one(testExplore.d1, 'RATE_DB')?.database_name !== 'soridraw-explore-test-db' || one(prodExplore.d1, 'RATE_DB')) {
    throw new Error('RATE_DB allowlist drift');
  }
  if (one(testExplore.r2, 'EXPLORE_CACHE')?.bucket_name !== 'soridraw-profile-media-test' || one(prodExplore.r2, 'EXPLORE_CACHE')) {
    throw new Error('EXPLORE_CACHE allowlist drift');
  }
  assertEqual(testExplore.services, [], 'TEST Explore services must remain empty');
  assertEqual(prodExplore.services.map(({ binding, service }) => ({ binding, service })), [
    { binding: 'EXPLORE_MIRROR_PREVIEW', service: 'soridraw-explore-preview' },
    { binding: 'EXPLORE_MIRROR_TEST', service: 'soridraw-explore-test' },
  ], 'PRODUCTION Explore mirror service allowlist drift');

  if (testMedia.name !== 'soridraw-media-test' || prodMedia.name !== 'soridraw-media') {
    throw new Error('Media target names drifted');
  }
  assertEqual(omitMediaAllowed(testMedia), omitMediaAllowed(prodMedia), 'Unapproved TEST/PRODUCTION Media contract difference');
  if (one(testMedia.r2, 'MEDIA')?.bucket_name !== 'soridraw-media-test' || one(prodMedia.r2, 'MEDIA')?.bucket_name !== 'soridraw-media') {
    throw new Error('MEDIA bucket allowlist drift');
  }
  if (one(testMedia.r2, 'CATALOG')?.bucket_name !== 'soridraw-user-catalog' || one(prodMedia.r2, 'CATALOG')?.bucket_name !== 'soridraw-user-catalog') {
    throw new Error('Shared CATALOG identity mismatch');
  }
  if (String(testMedia.vars?.SORIDRAW_SHARED_CATALOG_V1 || '') !== '1' || String(prodMedia.vars?.SORIDRAW_SHARED_CATALOG_V1 || '') !== '1') {
    throw new Error('Shared Catalog flag must be enabled in TEST and PRODUCTION');
  }
  if (!String(testMedia.vars?.ALLOWED_ORIGINS || '').includes('https://test.soridraw.com')) {
    throw new Error('TEST media ALLOWED_ORIGINS missing test host');
  }
  if (!String(prodMedia.vars?.ALLOWED_ORIGINS || '').includes('https://soridraw.com')) {
    throw new Error('PRODUCTION media ALLOWED_ORIGINS missing production host');
  }

  if (testHosting.site !== 'soridraw-test' || prodHosting.site !== 'soridraw') throw new Error('Firebase Hosting target site drift');
  assertEqual(omitHostingSite(testHosting), omitHostingSite(prodHosting), 'Unapproved TEST/PRODUCTION Hosting config difference');

  return stable({
    schema: 1,
    policy: 'soridraw-production-first-2026-10-06',
    allowedDifferences: {
      explore: [
        'worker-name',
        'TEST-only RATE_DB=soridraw-explore-test-db',
        'TEST-only EXPLORE_CACHE=soridraw-profile-media-test',
        'PRODUCTION-only mirror service bindings',
      ],
      media: ['worker-name', 'environment MEDIA bucket', 'ALLOWED_ORIGINS'],
      hosting: ['site'],
    },
    test: { explore: testExplore, media: testMedia, hosting: testHosting },
    production: { explore: prodExplore, media: prodMedia, hosting: prodHosting },
  });
};

const current = buildContract();
const currentText = stableText(current);
const currentHash = sha256(currentText);
if (action === 'snapshot') {
  fs.writeFileSync(targetPath, currentText);
} else {
  const expected = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const expectedText = stableText(expected);
  if (expectedText !== currentText) throw new Error('PRODUCTION environment contract drifted after TEST_VERIFIED');
}
console.log(`PRODUCTION_ENVIRONMENT_CONTRACT_SHA256=${currentHash}`);
console.log('TEST_PRODUCTION_ALLOWED_ENVIRONMENT_DIFFS=PASS');
console.log('PRODUCTION_ENVIRONMENT_CONTRACT=PASS');
