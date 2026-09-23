import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const client = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const marker = '// SORIDRAW_PERSONAL_LIKE_EXACT_CANONICAL_CHECK_182_20260924';
const helperStart = worker.indexOf('async function repairPartialPersonalLikeMetadata182(');
const helperEnd = worker.indexOf('\n}\n', helperStart);
assert.ok(worker.includes(marker) && helperStart > 0 && helperEnd > helperStart);
const helper = worker.slice(helperStart, helperEnd + 2);
const endpointStart = worker.indexOf('async function handleMySocialSnapshot042(');
const endpointEnd = worker.indexOf('\n}\n', endpointStart);
const endpoint = worker.slice(endpointStart, endpointEnd);
assert.match(endpoint, /searchParams\.get\('__soridraw_personal_repair'\) === '182'/);
assert.match(endpoint, /!likeState\.exact/);
assert.match(endpoint, /likesRepairStatus182 = await repairPartialPersonalLikeMetadata182/);
assert.match(endpoint, /likeState = await readSharedLikesState161/);
assert.match(client, /const EXPLORE_LIKE_REPAIR_ATTEMPTED_182/);
assert.match(client, /partial182 && attempted182/);
assert.match(client, /requestPersonalLikeBaseline127\(user, repairPartial182\)/);
assert.match(client, /recoveryQuery182 = repairPartial182 \? '\?__soridraw_personal_repair=182' : ''/);
assert.doesNotMatch(helper, /DELETE FROM|UPDATE likes|INSERT INTO likes|UPDATE track_stats/i);

const context = {
  Date, Number, String, Set, Array, JSON, Object, console,
  exploreSharedLikesKey061: uid => 'private/' + uid,
  normalizeSharedLikesState161: (bundle, uid) => ({
    exact: bundle.canonicalComplete156 === true &&
      Boolean(bundle.canonicalSource156) &&
      Number.isSafeInteger(Number(bundle.exactLikeCount156)) &&
      Number(bundle.exactLikeCount156) === bundle.likedTrackIds.length,
    uid,
  }),
};
vm.runInNewContext(helper + '\nthis.repair182 = repairPartialPersonalLikeMetadata182;', context, {timeout: 1000});
function makeScenario({ catalog = ['1','2','3','4','5','6','7','8','9','10'], canonical = catalog,
                        count = 5, q069 = 0, q075 = 0, casFail = false } = {}) {
  let data = { schemaVersion:1,uid:'A',canonicalComplete156:true,
    canonicalSource156:'old-exact',exactLikeCount156:count,likedTrackIds:catalog };
  let writes = 0, canonicalReads = 0, queueReads = 0;
  const bucket = {
    get: async () => ({ etag:'original', text:async()=>JSON.stringify(data),
      customMetadata:{test:'safe'} }),
    put: async (_key, serialized, options) => {
      assert.equal(options.onlyIf.etagMatches, 'original');
      if (casFail) return null;
      data = JSON.parse(serialized); writes++; return {etag:'next'};
    },
  };
  const db = { prepare: sql => ({
    bind: (...args) => ({
      first: async () => {queueReads++; assert.equal(args.length,2);return {q069,q075};},
      all: async () => {canonicalReads++; assert.equal(args[0],'A');
        assert.match(sql,/LIMIT 2001/);
        return {results:canonical.map(track_id=>({track_id}))}; },
    }),
  }) };
  return { env:{PROFILE_MEDIA:bucket,DB:db}, get:()=>data,
    writes:()=>writes, canonicalReads:()=>canonicalReads,queueReads:()=>queueReads };
}
const agreed=makeScenario();
assert.equal(await context.repair182(agreed.env,'A'), 'metadata-repaired');
assert.equal(agreed.get().exactLikeCount156, 10);
assert.deepEqual(agreed.get().likedTrackIds,['1','2','3','4','5','6','7','8','9','10']);
assert.equal(agreed.writes(),1);
assert.equal(agreed.canonicalReads(),1);
const mismatch=makeScenario({canonical:['1','2','3','4','5']});
assert.equal(await context.repair182(mismatch.env,'A'), 'canonical-mismatch');
assert.equal(mismatch.writes(),0);
assert.equal(mismatch.get().exactLikeCount156,5);
const pending=makeScenario({q069:1});
assert.equal(await context.repair182(pending.env,'A'), 'pending');
assert.equal(pending.canonicalReads(),0);
assert.equal(pending.writes(),0);
const processed=makeScenario({q075:1});
assert.equal(await context.repair182(processed.env,'A'), 'pending');
assert.equal(processed.writes(),0);
const healthy=makeScenario({catalog:['1','2','3','4','5'],canonical:['1','2','3','4','5'],count:5});
assert.equal(await context.repair182(healthy.env,'A'), 'already-exact');
assert.equal(healthy.queueReads(),0);
assert.equal(healthy.canonicalReads(),0);
const contested=makeScenario({casFail:true});
assert.equal(await context.repair182(contested.env,'A'), 'concurrent-change');
assert.equal(contested.writes(),0);
console.log('APP182_VERIFIED_MATCH_REPAIRS_METADATA_ONLY=PASS');
console.log('APP182_CANONICAL_MISMATCH_NO_OVERWRITE=PASS');
console.log('APP182_PENDING_AND_CAS_GUARDS=PASS');
console.log('APP182_HEALTHY_D1_R0=PASS');
console.log('APP182_CLIENT_ONE_TIME_PARTIAL_GATE=PASS');
