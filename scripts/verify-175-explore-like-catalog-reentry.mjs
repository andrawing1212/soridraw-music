import fs from 'node:fs';

const source = fs.readFileSync('src/services/exploreLikeService.ts', 'utf8');

const need = (needle, label) => {
  if (!source.includes(needle)) throw new Error(label + ' missing');
};

need("EXPLORE_LIKE_LOCAL_CATALOG_READY_135", '135 local catalog marker');
need("const hasLocalLikeCatalog135 =", '135 local catalog readiness helper');
need("const needsRepair = gap || readRepairTarget127(uid) > 0;", 'gap repair flag');
need("requestRepair127(uid, signal.version);", 'gap repair request');
need("markLocalLikeCatalogReady135(uid);\n  markSeenLikeSignal127(uid, signal.version);", 'remote delta catalog persist');
need("const localCatalogReady127 = baselineReady127 || hasLocalLikeCatalog135(user.uid);", 'page-return local catalog authority');
need("markLocalLikeCatalogReady135(user.uid);", 'one-time bootstrap promotion');

const gapStart = source.indexOf('const needsRepair = gap || readRepairTarget127(uid) > 0;');
const pendingStart = source.indexOf('const pending = readLikeOutbox(uid);', gapStart);
if (gapStart < 0 || pendingStart < 0) throw new Error('gap signal flow missing');
const gapBlock = source.slice(gapStart, pendingStart);
if (/\breturn\s*;/.test(gapBlock)) {
  throw new Error('gap signal still returns before applying exact retained rows');
}

const repairStart = source.indexOf('const requestRepair127 = (uid: string, version: number) => {');
const repairEnd = source.indexOf('\n};', repairStart);
if (repairStart < 0 || repairEnd < 0) throw new Error('requestRepair127 missing');
const repairBlock = source.slice(repairStart, repairEnd);
if (repairBlock.includes('clearTargetedVerifiedLikeTracks127(uid)')) {
  throw new Error('repair still erases targeted catalog proof');
}

const invalidateStart = source.indexOf('export const invalidateExplorePersonalLikeBaseline127 = (uid: string) => {');
const invalidateEnd = source.indexOf('\n};', invalidateStart);
if (invalidateStart < 0 || invalidateEnd < 0) throw new Error('baseline invalidator missing');
const invalidateBlock = source.slice(invalidateStart, invalidateEnd);
if (invalidateBlock.includes('clearTargetedVerifiedLikeTracks127(uid)')) {
  throw new Error('revision invalidation still erases device catalog proof');
}

const missingStart = source.indexOf('const missing = localCatalogReady127 ? [] : normalized.filter');
if (missingStart < 0) throw new Error('normal-path D1 fallback guard missing');

console.log('APP135_CROSS_DEVICE_SIGNAL_APPLIES_BEFORE_REPAIR=PASS');
console.log('APP135_PAGE_RETURN_LOCAL_CATALOG_AUTHORITY=PASS');
console.log('APP135_NORMAL_CACHED_DEVICE_D1_MEMBERSHIP_FALLBACK_BLOCKED=PASS');
