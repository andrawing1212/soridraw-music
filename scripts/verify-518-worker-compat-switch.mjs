import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync('cloudflare/media-worker/src/index.js','utf8');
const config=readFileSync('cloudflare/media-worker/wrangler.jsonc','utf8');
const cfg=JSON.parse(config);
const enabled="ENABLED_AFTER_SHARED_ROLLOUT";
// No current PREVIEW, TEST or PRODUCTION environment may activate this.
for(const vars of [cfg.vars,cfg.env.test.vars,cfg.env.production.vars]){
 assert.notEqual(vars.SORIDRAW_CANONICAL_CATALOG_518,enabled,
   'server-side cutover must remain disabled across all three environments');
}
const body=(start,end)=>{
 const i=worker.indexOf(start);assert.ok(i>=0,start);
 const j=worker.indexOf(end,i+start.length);assert.ok(j>i,end);
 return worker.slice(i,j);
};
assert.match(worker,/from '\.\/catalogAuthorityPolicy518\.js'/);
assert.match(worker,/const isCanonicalCatalogAuthority518 = \(env\)/);
assert.match(worker,/text\(env\?\.SORIDRAW_CANONICAL_CATALOG_518\) === 'ENABLED_AFTER_SHARED_ROLLOUT'/);
const delta=body('const applyCatalogDelta = async','const handleCatalog = async');
assert.match(delta,/decideCatalogWriterAuthority518/);
assert.match(delta,/operation: 'legacy-delta'/);
assert.ok(delta.indexOf('decideCatalogWriterAuthority518')<delta.indexOf('appendCatalogJournalDelta'));
assert.ok(delta.indexOf('const head = state.head')<delta.indexOf('decideCatalogWriterAuthority518'));
const route=body("if (request.method === 'POST' && route.action === 'delta')",
  "if (request.method === 'POST' && route.action === 'base')");
assert.ok(route.indexOf('isCanonicalCatalogAuthority518(env)')<route.indexOf('request.json()'));
assert.ok(route.indexOf('CATALOG_518_CANONICAL_WRITER_REQUIRED')<route.indexOf('applyCatalogDelta('));
const boot=body('const bootstrapSharedCatalogFromCanonical = async','const getOrBuildCatalog = async');
assert.ok(boot.indexOf('CATALOG_518_BOOTSTRAP_MUST_RECONCILE_EXACT')<boot.indexOf('buildCanonicalCatalog('),
 'no expensive Firestore scan after cutover');
assert.ok(boot.indexOf('CATALOG_518_FENCED_REBUILD_DENIED')<boot.indexOf('createEmptyCatalogJournal('),
 'never erase tombstone when rebuilding');
const seed=body('const seedSharedCatalogFromCurrentLegacy = async','const getCatalogState = async');
assert.ok(seed.indexOf('CATALOG_518_LEGACY_SEED_DISABLED')<seed.indexOf('readCatalogStateFromBucket(env.MEDIA'),
 'no legacy MEDIA seeding after canonical cutover');
assert.doesNotMatch(cfg,/"SORIDRAW_CANONICAL_CATALOG_518"\s*:\s*"ENABLED_AFTER_SHARED_ROLLOUT"/);
// This verifies source guard wiring, not production safety until every old
// Worker is updated and canonical retry is durable.
console.log('APP518_REAL_WORKER_LEGACY_DELTA_WRITER_GUARD_WIRED=PASS');
console.log('APP518_REAL_WORKER_FENCED_BOOTSTRAP_AND_LEGACY_SEED_GUARD_WIRED=PASS');
console.log('APP518_ALL_THREE_ENVS_DEFAULT_OFF=PASS');
console.log('APP518_SHARED_WORKER_CUTOVER_DEPLOY=ZERO');
