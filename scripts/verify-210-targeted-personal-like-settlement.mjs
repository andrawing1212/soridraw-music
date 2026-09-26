import fs from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER
  || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = fs.readFileSync(workerPath, 'utf8');
const like = fs.readFileSync('src/services/exploreLikeService.ts', 'utf8');
const manifest = JSON.parse(fs.readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionText(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  let depth = 0;
  let opened = false;
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; opened = true; }
    else if (source[i] === '}') {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated function ${name}`);
}

assert(
  manifest.patches.includes('090-targeted-personal-like-settlement.mjs'),
  '090 Worker patch is not registered in release-patches.json',
);
assert(
  worker.includes('SORIDRAW_TARGETED_PERSONAL_LIKE_SETTLEMENT_190_20260926'),
  'Targeted settlement Worker marker missing',
);

const settlement = functionText(worker, 'verifyFreshPersonalLikeSettlement189');
assert(
  settlement.includes('requested190') &&
  settlement.includes('readBoundedEffectiveLikeMemberships162(env, uid, requested190)'),
  'Targeted settlement must use the existing bounded canonical membership reader',
);
assert(
  settlement.includes('if (requested190.length)') &&
  settlement.includes('if (!queueEmpty(await readPending())) return null;'),
  'Targeted settlement must retain fail-closed queue checks',
);
assert(
  settlement.includes('current?.etag') && settlement.includes('current.etag === object.etag'),
  'Targeted settlement must retain unchanged-R2 ETag proof',
);
const targetedBranchStart = settlement.indexOf('if (requested190.length)');
const fallbackStart = settlement.indexOf('} else {', targetedBranchStart);
assert(targetedBranchStart >= 0 && fallbackStart > targetedBranchStart, 'Targeted/fallback branch missing');
const targetedBranch = settlement.slice(targetedBranchStart, fallbackStart);
assert(!targetedBranch.includes('ORDER BY l.created_at DESC LIMIT 2001'), 'Targeted branch still scans whole liked catalog');
assert(!/\b(?:INSERT|UPDATE|DELETE)\b/i.test(targetedBranch), 'Targeted settlement must stay read-only');
assert(
  settlement.includes('ORDER BY l.created_at DESC LIMIT 2001'),
  'Backward-compatible old-client full settlement fallback was removed',
);

const social = functionText(worker, 'handleMySocialSnapshot042');
for (const token of [
  "searchParams.get('trackIds')",
  'rawParts190.length > 200',
  "throwApi('INVALID_SETTLEMENT_SCOPE'",
  'verifyFreshPersonalLikeSettlement189(',
  'targetedTrackIds190',
]) {
  assert(social.includes(token), `Worker social snapshot targeted guard missing: ${token}`);
}

for (const token of [
  'settlementTrackIds190: string[] = []',
  "recoveryParams.set('trackIds', targetedSettlementIds190.join(','))",
  'unresolvedGuardIds190.length <= 200',
  'settlementTrackIds190',
  'const releaseIds190 = settlementTrackIds190.length',
  'for (const id of releaseIds190)',
  'PERSONAL SETTLEMENT 189 TARGETED',
]) {
  assert(like.includes(token), `Client targeted settlement token missing: ${token}`);
}

assert(
  like.includes('if (!verifySettlement189 && (baselineCompleted127.has(uid) || baseline127 ||'),
  'Healthy cached re-entry short-circuit changed',
);
assert(
  like.includes('const EXPLORE_LIKE_LEGACY_CHECK_MS_127 = 5 * 60_000;'),
  'Existing five-minute revision check window changed',
);
assert(
  like.includes('const EXPLORE_LIKE_IDLE_FLUSH_MS_120 = 30_000;'),
  'Frozen 30-second like batching changed',
);

console.log('APP210_SETTLEMENT_TARGETED_D1=PASS');
console.log('APP210_SETTLEMENT_WHOLE_SCAN_REMOVED_FROM_NEW_PATH=PASS');
console.log('APP210_SETTLEMENT_QUEUE_ETAG_GUARD=PASS');
console.log('APP210_OLD_CLIENT_BACKWARD_COMPAT=PASS');
console.log('APP210_NORMAL_REENTRY_R0_CONTRACT=PASS');
console.log('APP210_LIKE_BATCHING_UNCHANGED=PASS');
