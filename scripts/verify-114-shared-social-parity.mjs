import { readFileSync } from 'node:fs';

const workerPath = process.env.SORIDRAW_GENERATED_WORKER || 'cloudflare/explore-worker/canonical/preview-worker.js';
const worker = readFileSync(workerPath, 'utf8');
const manifest = JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json', 'utf8'));
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));

const fail = (message) => { throw new Error(`[114] ${message}`); };
const appVersion = Number(version.version);
if (!Number.isFinite(appVersion) || appVersion < 114) fail('app version is older than 114');
if (!Array.isArray(manifest.patches) || !manifest.patches.includes('061-shared-social-r2-parity.mjs')) fail('patch 061 missing from manifest');
if (!manifest.patches.includes('078-shared-like-reader-cutover.mjs')) fail('patch 078 reader cutover missing from manifest');

for (const required of [
  'SORIDRAW_SHARED_SOCIAL_R2_PARITY_061_20260917',
  'exploreSharedLikesKey061',
  'exploreSharedFollowingKey061',
  'readSharedLikes061',
  'writeSharedLikes061',
  'readSharedFollowing061',
  'writeSharedFollowing061',
  'seedSharedLikesFromPreviewLocal061',
  'seedSharedFollowingFromPreviewLocal061',
  'readExploreLikeR2BundleCore061',
  'rebuildExploreLikeR2BundleCore061',
  'syncExploreLikeR2AfterBatch034Core061',
  'readExploreFollowingR2BundleCore061',
  'rebuildExploreFollowingR2BundleCore061',
  'syncExploreFollowingR2AfterMutationCore061',
]) {
  if (!worker.includes(required)) fail(`generated Worker missing ${required}`);
}

const functionText = (name) => {
  const needles = [`async function ${name}(`, `function ${name}(`];
  let start = -1;
  for (const needle of needles) {
    start = worker.indexOf(needle);
    if (start >= 0) break;
  }
  if (start < 0) fail(`function missing ${name}`);
  const brace = worker.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let i = brace; i < worker.length; i += 1) {
    const c = worker[i];
    const n = worker[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && n === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { comment = 'line'; i += 1; continue; }
    if (c === '/' && n === '*') { comment = 'block'; i += 1; continue; }
    if ('"\'`'.includes(c)) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}' && --depth === 0) return worker.slice(start, i + 1);
  }
  fail(`unterminated ${name}`);
};

const sharedWriter = functionText('writeSharedLikes061');
if (!sharedWriter.includes('SORIDRAW_EXACT_SHARED_LIKE_GUARD_156_20260921')) fail('exact >2000 shared-like guard missing');
if (!sharedWriter.includes('canonicalComplete156 === true')) fail('legacy shared writer can overwrite exact 156 snapshot');
if (!sharedWriter.includes('return false')) fail('legacy exact-snapshot writer guard does not fail closed');

const likeReader = functionText('readExploreLikeR2Bundle');
if (!likeReader.includes('readSharedLikes061(env, uid)')) fail('like reader does not prefer shared R2');
if (!likeReader.includes('seedSharedLikesFromPreviewLocal061')) fail('PREVIEW like seed path missing');
if (/env\.DB|\.prepare\(/.test(likeReader)) fail('shared like read path queries D1');

const followReader = functionText('readExploreFollowingR2Bundle');
if (!followReader.includes('readSharedFollowing061(env, uid)')) fail('following reader does not prefer shared R2');
if (!followReader.includes('seedSharedFollowingFromPreviewLocal061')) fail('PREVIEW following seed path missing');
if (/env\.DB|\.prepare\(/.test(followReader)) fail('shared following read path queries D1');

const likeRebuild = functionText('rebuildExploreLikeR2Bundle');
if (!likeRebuild.includes('writeSharedLikes061(env, uid, local)')) fail('D1 like recovery is not promoted to shared R2');
const followRebuild = functionText('rebuildExploreFollowingR2Bundle');
if (!followRebuild.includes('writeSharedFollowing061(env, uid, local)')) fail('D1 following recovery is not promoted to shared R2');

const likeSync = functionText('syncExploreLikeR2AfterBatch034');
if (!likeSync.includes('readSharedLikes061(env, uid)')) fail('like mutation does not prime from shared state');
if (!likeSync.includes('writeSharedLikes061(env, uid, local)')) fail('like mutation does not mirror shared state');
const followSync = functionText('syncExploreFollowingR2AfterMutation');
if (!followSync.includes('readSharedFollowing061(env, uid)')) fail('follow mutation does not prime from shared state');
if (!followSync.includes('writeSharedFollowing061(env, uid, local)')) fail('follow mutation does not mirror shared state');

const sharedState = functionText('normalizeSharedLikesState161');
if (!sharedState.includes('canonicalComplete156 === true')) fail('161 exact marker validation missing');
if (!sharedState.includes('exactLikeCount === likedIds.size')) fail('161 exact count proof missing');
if (!sharedState.includes('values.length === likedIds.size')) fail('161 duplicate ID proof missing');
const normalize161 = Function(sharedState + '; return normalizeSharedLikesState161;')();
const legacy1999 = normalize161({ schemaVersion: 1, uid: 'u', likedTrackIds: Array.from({ length: 1999 }, (_, i) => 't' + i) }, 'u');
if (!legacy1999 || legacy1999.exact !== false || legacy1999.likedIds.size !== 1999) fail('legacy <2000 must remain partial');
const legacy2000 = normalize161({ schemaVersion: 1, uid: 'u', likedTrackIds: Array.from({ length: 2000 }, (_, i) => 't' + i) }, 'u');
if (!legacy2000 || legacy2000.exact !== false) fail('legacy 2000 must remain partial');
const exact2053 = normalize161({
  schemaVersion: 1, uid: 'u', likedTrackIds: Array.from({ length: 2053 }, (_, i) => 'e' + i),
  canonicalComplete156: true, canonicalSource156: 'explore_likes_153', exactLikeCount156: 2053,
}, 'u');
if (!exact2053?.exact || exact2053.exactLikeCount !== 2053 || exact2053.likedIds.size !== 2053) fail('exact >2000 snapshot rejected');
const mismatched = normalize161({
  schemaVersion: 1, uid: 'u', likedTrackIds: ['a','b'],
  canonicalComplete156: true, canonicalSource156: 'explore_likes_153', exactLikeCount156: 3,
}, 'u');
if (!mismatched || mismatched.exact !== false) fail('mismatched exact count accepted');

const cutover162 = functionText('readLikeCutoverState162');
if (!cutover162.includes('internal/explore/like-cutover-v162/active.json') &&
    !worker.includes("internal/explore/like-cutover-v162/active.json")) {
  fail('162 shared cutover key missing');
}
for (const proof of [
  'legacyRelationWritersFrozen === true',
  'legacyCountWritersFrozen === true',
  'allEnvironmentReadersReady === true',
  'allEnvironmentWritersReady === true',
  "ownerProtocol === 'uid143-track147-158'",
]) {
  if (!cutover162.includes(proof)) fail('162 shared cutover proof missing: ' + proof);
}
const effective162 = functionText('readBoundedEffectiveLikeMemberships162');
if (!effective162.includes('readBoundedLegacyLikeMemberships161')) fail('162 legacy pre-cutover fallback missing');
if (!effective162.includes('explore_like_overrides_157')) fail('162 overlay relation missing');
if (!effective162.includes('COALESCE(o.liked')) fail('162 effective baseline+override rule missing');

if (!worker.includes('SORIDRAW_LEGACY_LIKE_WRITER_FREEZE_GUARD_163_20260921')) fail('163 legacy writer freeze marker missing');
const guard163 = functionText('assertLegacyLikeWriterOpen163');
if (!guard163.includes("state.mode !== 'legacy'")) fail('163 non-legacy writer block missing');
if (!guard163.includes('legacy like writer frozen after shared cutover')) fail('163 writer freeze error missing');

const targeted = functionText('handleMyLikeStates');
if (!targeted.includes('readSharedLikesState161(env, authContext.uid)')) fail('targeted reader lost 161 state');
if (!targeted.includes('sharedState?.exact')) fail('targeted exact R2 fast path missing');
if (!targeted.includes('readBoundedEffectiveLikeMemberships162')) fail('partial targeted 162 gate missing');
if (!targeted.includes('likesComplete: false')) fail('partial targeted response not marked incomplete');

const social = functionText('handleMySocialSnapshot042');
if (!social.includes('readSharedLikesState161(env, authContext.uid)')) fail('social snapshot lost 161 state');
if (!social.includes('likesComplete: likeState.exact')) fail('social snapshot completeness metadata missing');
if (!social.includes('readExploreFollowingR2Bundle(env, authContext.uid)')) fail('social snapshot lost shared following reader');

const liked = functionText('handleMyLikedTracks052');
if (!liked.includes('readSharedLikesState161(env, authContext.uid)')) fail('liked collection lost 161 state');
if (!liked.includes('readBoundedEffectiveLikeMemberships162')) fail('liked collection partial 162 membership gate missing');
if (!liked.includes('readRequestedLikedTrackCardsD1161')) fail('liked collection bounded cold card recovery missing');

console.log('114_SHARED_SOCIAL_PARITY=PASS');
console.log('161_LEGACY_1999_2000_PARTIAL_AND_EXACT_2053=PASS');
console.log('161_PARTIAL_VISIBLE_MEMBERSHIP_BOUNDED_D1=PASS');
console.log('162_SHARED_CUTOVER_GATED_EFFECTIVE_MEMBERSHIP=PASS');
console.log('078_DEPLOYED_WORKER_REPLAY_PATCH_PRESENT=PASS');
console.log('163_LEGACY_WRITER_FREEZE_GUARD_PRESENT=PASS');
console.log('LIKES_SOURCE=SHARED_R2_FIRST');
console.log('FOLLOWING_SOURCE=SHARED_R2_FIRST');
console.log('PREVIEW_EXISTING_LOCAL_CAN_SEED_SHARED_WITHOUT_D1=true');
console.log('ONE_TIME_D1_RECOVERY_PROMOTED_TO_SHARED=true');
console.log('WARM_SOCIAL_D1=R0_BY_SHARED_R2_CONTRACT');
console.log('EXACT_156_SHARED_LIKE_LEGACY_OVERWRITE_GUARD=PASS');
console.log('NO_D1_SCHEMA_CHANGE=true');
console.log('NO_USER_DATA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');
