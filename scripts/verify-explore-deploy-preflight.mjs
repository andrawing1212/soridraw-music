import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import './verify-252-unified-profile-save.mjs';
import './verify-376-profile-connections-popup.mjs';
import './verify-377-follow-count-list-sync.mjs';
import { deployWithDerivedPreflight, requiredTables, requiredTriggers, requiredLike035Objects } from '../cloudflare/explore-worker/scripts/derived-deploy-preflight.mjs';

const previewEntry244 = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const social244Start = previewEntry244.indexOf('// SORIDRAW_PROFILE_SOCIAL_EXTRA_244_20260930');
const social244End = previewEntry244.indexOf('// SORIDRAW_EXPLORE_PUBLIC_LIKE_SERVER_ACCEPTED_AT_193_20260924');
assert.ok(social244Start >= 0 && social244End > social244Start, '244 profile social-extra block missing');
const social244 = previewEntry244.slice(social244Start, social244End);
assert.match(social244, /PROFILE_SOCIAL_EXTRA_PREFIX_244\s*=\s*'internal\/explore\/profile-social-extra-v1'/);
assert.match(social244, /env\.PROFILE_MEDIA\.put/);
assert.match(social244, /caches\.default\.match/);
assert.doesNotMatch(social244, /env\.DB|\.prepare\(/, '244 must not add canonical D1 work');
assert.match(previewEntry244, /Object\.prototype\.hasOwnProperty\.call\(requestBody, 'youtubeUrl'\)/);
assert.match(previewEntry244, /isPublicProfileRead244[\s\S]*?attachProfileSocialExtra244/);
assert.match(previewEntry244, /SORIDRAW_PROFILE_SOCIAL_EXTRA_NOOP_247_20260930/);
assert.match(previewEntry244, /currentExtra247\.youtubeUrl === nextYoutubeUrl247[\s\S]*?writeProfileSocialExtra244/);

const canonicalWorker245 = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const profile245Start = canonicalWorker245.indexOf('async function handleMyProfileUpdate(');
const profile245End = canonicalWorker245.indexOf('\n__name(handleMyProfileUpdate', profile245Start);
assert.ok(profile245Start >= 0 && profile245End > profile245Start, '245 profile handler missing');
const profile245 = canonicalWorker245.slice(profile245Start, profile245End);
assert.match(profile245, /const coreChanged =/);
assert.match(profile245, /patchPublicProfileBundle245\([\s\S]*?env,[\s\S]*?authContext\.uid,[\s\S]*?profilePatch,[\s\S]*?previousHandle/);
assert.doesNotMatch(profile245, /readPublicProfileByUid\(/, '245 profile save must not post-read full profile + track count');
assert.doesNotMatch(profile245, /refreshOrPrebuildPublicProfileFirstView\(/, '245 profile save must not rebuild first-view');
assert.doesNotMatch(profile245, /syncDerivedCache032\(/, '245 profile save must not run derived profile sync');
assert.doesNotMatch(profile245, /refreshProfileSearchIndex\(env/, '245 profile save must not re-read profile for FTS');
const counter245Start = canonicalWorker245.indexOf('async function patchExploreProfileR2Counters020(');
const counter245End = canonicalWorker245.indexOf('\n__name(patchExploreProfileR2Counters020', counter245Start);
assert.ok(counter245Start >= 0 && counter245End > counter245Start, '245 follow R2 counter patch missing');
const counter245 = canonicalWorker245.slice(counter245Start, counter245End);
assert.match(counter245, /patchPublicProfileBundle245\(env, uid, patch\)/);
assert.doesNotMatch(counter245, /syncDerivedCache032|env\.DB/, 'follow counter cache patch must be R2-only');

const publicProfile246Start = canonicalWorker245.indexOf('async function handlePublicProfile(');
const publicProfile246End = canonicalWorker245.indexOf('\n__name(handlePublicProfile', publicProfile246Start);
const publicProfile246 = canonicalWorker245.slice(publicProfile246Start, publicProfile246End);
assert.match(publicProfile246, /SORIDRAW_PROFILE_FOLLOW_MEDIA_COST_246_20260930/);
assert.match(publicProfile246, /readExploreSharedProfile060\(env, profileRef\)/);
assert.ok(publicProfile246.indexOf('readExploreSharedProfile060') < publicProfile246.indexOf('resolvePublicProfileRef'), '246 direct profile must try shared R2 before canonical D1');

const media246Start = canonicalWorker245.indexOf('async function handleProfileMediaUpload(');
const media246End = canonicalWorker245.indexOf('\n__name(handleProfileMediaUpload', media246Start);
const media246 = canonicalWorker245.slice(media246Start, media246End);
assert.match(media246, /SORIDRAW_PROFILE_MEDIA_TARGETED_R2_246_20260930/);
assert.match(media246, /patchPublicProfileBundle245\(env, authContext\.uid, profilePatch, "", baseline251\)/);
assert.doesNotMatch(media246, /refreshProfileSearchIndex|readPublicProfileByUid/, '246 profile media must not rescan the public profile');
assert.match(media246, /if \(patchedBundle\)[\s\S]*?else \{[\s\S]*?refreshOrPrebuildPublicProfileFirstView/, '246 heavy first-view rebuild must be cold-repair only');

const follow246Start = canonicalWorker245.indexOf('async function adjustExploreFollowCountersDelta(');
const follow246End = canonicalWorker245.indexOf('\n__name(adjustExploreFollowCountersDelta', follow246Start);
const follow246 = canonicalWorker245.slice(follow246Start, follow246End);
assert.match(follow246, /SORIDRAW_FOLLOW_RETURNING_NO_POSTREAD_246_20260930/);
assert.match(follow246, /RETURNING uid, follower_count, following_count/);
assert.ok(follow246.indexOf('fallbackRead') >= 0, '246 follow must retain idempotent cold fallback');
assert.match(canonicalWorker245, /SORIDRAW_FOLLOW_R2_TARGET_GUARD_246_20260930[\s\S]*?readExploreSharedProfileByUid247\(env, targetUid\)/);
assert.match(canonicalWorker245, /SORIDRAW_FOLLOW_STATE_R2_FIRST_246_20260930[\s\S]*?readExploreFollowingR2Bundle/);

const profileEdit246 = readFileSync('src/components/explore/ExploreProfileEditModal.tsx', 'utf8');
assert.doesNotMatch(profileEdit246, /getExplorePublicProfile\(user\.uid\)/, '246 profile save must not re-read the just-saved public profile');
assert.match(profileEdit246, /const saved = useUnifiedProfileSave252[\s\S]*?saveExplorePublicProfileUnified\([\s\S]*?: profileFieldsChanged247[\s\S]*?updateExplorePublicProfile\(user, normalizedDraft, \{ youtubeChanged: youtubeChanged252 \}\)[\s\S]*?: profile;/);
assert.match(profileEdit246, /const refreshed: ExplorePublicProfile = \{[\s\S]*?backgroundUrl[\s\S]*?avatarUrl/);

const profile247 = canonicalWorker245.slice(profile245Start, profile245End);
assert.match(profile247, /SORIDRAW_PROFILE_SAVE_R2_FIRST_247_20260930/);
assert.match(profile247, /readExploreSharedProfileByUid247\(env, authContext\.uid\)/);
assert.ok(
  profile247.indexOf('readExploreSharedProfileByUid247(env, authContext.uid)') < profile247.indexOf('readExistingD1247()'),
  '247 warm profile save must resolve shared R2 before canonical D1 fallback',
);
assert.match(profile247, /if \(coreChanged\) \{[\s\S]*?UPDATE public_profiles/);
assert.match(profile247, /existingBundle,[\s\S]*?\);/);
assert.doesNotMatch(profile247, /readExisting245/);

const patch247Start = canonicalWorker245.indexOf('async function patchPublicProfileBundle245(');
const patch247End = canonicalWorker245.indexOf('\n__name(patchPublicProfileBundle245', patch247Start);
const patch247 = canonicalWorker245.slice(patch247Start, patch247End);
assert.match(patch247, /baselineBundle = null/);
assert.match(patch247, /readExploreSharedProfileByUid247\(env, normalizedUid\)/);
assert.doesNotMatch(patch247, /readExploreSharedProfile060\(env, normalizedUid\)/);

assert.match(profileEdit246, /profileFieldsChanged247/);
assert.match(profileEdit246, /profileFieldsChanged247[\s\S]*?updateExplorePublicProfile\(user, normalizedDraft, \{ youtubeChanged: youtubeChanged252 \}\)[\s\S]*?: profile/);

// app248 profile cost guards.
assert.match(profile247, /SORIDRAW_PROFILE_BIO_NO_FTS_248_20260930/);
assert.match(profile247, /const searchChanged = nicknameChanged;/);
assert.match(profile247, /const coreChanged = bioChanged[\s\S]*?\|\| searchChanged/);
assert.doesNotMatch(profile247, /const searchChanged = nicknameChanged \|\| bioChanged/);

const media248Start = canonicalWorker245.indexOf('async function handleProfileMediaBatchUpload248(');
const media248End = canonicalWorker245.indexOf('\nasync function handleProfileMediaGet', media248Start);
assert.ok(media248Start >= 0 && media248End > media248Start, '248 profile media batch handler missing');
const media248 = canonicalWorker245.slice(media248Start, media248End);
assert.match(canonicalWorker245, /SORIDRAW_PROFILE_MEDIA_BATCH_248_20260930/);
assert.match(media248, /form\?\.get\("avatar"\)[\s\S]*?form\?\.get\("background"\)/);
assert.match(media248, /UPDATE public_profiles[\s\S]*?avatar_url = \?[\s\S]*?background_url = \?/);
assert.match(media248, /patchPublicProfileBundle245\(env, authContext\.uid, \{[\s\S]*?avatarUrl,[\s\S]*?backgroundUrl/);
assert.match(canonicalWorker245, /url\.pathname === "\/v1\/me\/profile-media"[\s\S]*?handleProfileMediaBatchUpload248/);

const socialService248 = readFileSync('src/services/exploreSocialService.ts', 'utf8');
assert.match(socialService248, /export const uploadExploreProfileMediaBatch/);
assert.match(socialService248, /form\.set\('avatar'[\s\S]*?form\.set\('background'/);
assert.match(socialService248, /\/v1\/me\/profile-media/);
assert.match(profileEdit246, /backgroundBlob && avatarBlob[\s\S]*?uploadExploreProfileMediaBatch/);

// app248 Worker-only physical write compaction, internal change 251.
assert.match(profile247, /SORIDRAW_PROFILE_INDEXED_WRITE_COMPACTION_251_20260930/);
assert.match(profile247, /if \(bioChanged\) \{ set251\.push\("bio = \?"\)/);
assert.match(profile247, /if \(handleChanged\) \{ set251\.push\("handle = \?"\)/);
assert.match(profile247, /writeProfileRecovery251/);
assert.doesNotMatch(
  profile247,
  /const writeProfile247 = async \(\) => await env\.DB\.prepare\(`[\s\S]*?SET nickname = \?, bio = \?, handle = \?/,
  '251 warm profile save must not rewrite unchanged indexed handle/is_public columns',
);
assert.match(media246, /const knownPublic251 = validExploreProfileR2Bundle020\(baseline251\)/);
assert.match(media246, /writeMediaWarm251[\s\S]*?profile_customized = 1, updated_at = \?[\s\S]*?WHERE uid = \?/);
assert.doesNotMatch(
  media246.slice(media246.indexOf('const writeMediaWarm251'), media246.indexOf('const writeMediaRecovery251')),
  /is_public/,
  '251 warm single-media save must not touch indexed is_public',
);
assert.match(media248, /const knownPublicBatch251 = validExploreProfileR2Bundle020\(baselineBatch251\)/);
assert.doesNotMatch(
  media248.slice(media248.indexOf('const writeProfile248'), media248.indexOf('const writeProfileRecovery251')),
  /is_public/,
  '251 warm dual-media save must not touch indexed is_public',
);
assert.match(media248, /baselineBatch251\);/);


if (process.argv.includes('--connections')) {
  const prepared=readFileSync('cloudflare/explore-worker/scripts/deploy-prepared.mjs','utf8');
  const productionGuardIndex=prepared.indexOf('if (isCloudflareNativeBuild && !allowProductionDeploy)');
  const guardedDeployIndex=prepared.indexOf('deployWithDerivedPreflight');
  assert.ok(productionGuardIndex >= 0 && guardedDeployIndex >= 0 && productionGuardIndex < guardedDeployIndex);
  assert.match(prepared,/SORIDRAW_ALLOW_PRODUCTION_WORKER_DEPLOY/);
  assert.doesNotMatch(prepared,/spawnSync/);
  const router=readFileSync('cloudflare/explore-worker/scripts/native-git-deploy-router.mjs','utf8');
  assert.match(router,/if \(isNative\)/);assert.match(router,/deploy-prepared\.mjs/);
  for(const name of readdirSync('.github/workflows').filter(n=>n.endsWith('.yml'))) {
    const source=readFileSync('.github/workflows/'+name,'utf8');
    assert.doesNotMatch(source,/npx wrangler deploy/,name+' must use the shared guard');
  }
  for(const path of ['.deploy/cloudflare-explore-namespaced-env-split.mjs','.deploy/temp-release-027-cloudflare.mjs']) {
    const source=readFileSync(path,'utf8');
    assert.match(source,/assertDerivedD1Ready\(configPath\);\s*(?:wrangler|run)\(/);
  }
  console.log('PASS shared workflow/helper guard connections; native/production approval blocks retained');
} else {
  const normal=[
    ...requiredTables.map(name=>({type:'table',name})),
    ...requiredTriggers.map(name=>({type:'trigger',name})),
    ...requiredLike035Objects.map(([type,name])=>({type,name})),
  ];
  assert.equal(requiredTriggers.length,18);
  assert.equal(requiredLike035Objects.length,3);
  function exercise({schema=normal,seeded=1,processorId=1,failAt=0}={},allow=false,environment='preview') {
    const calls=[];let reads=0;
    const config=resolve('fixture-'+environment+'.jsonc');
    const run=(args,capture)=>{
      calls.push(args);
      assert.equal(args[args.indexOf('--config')+1],config,'query and deploy must target the same config');
      if(args[0]==='deploy') { assert.equal(capture,undefined);return ''; }
      assert.deepEqual(args.slice(0,4),['d1','execute','DB','--remote']);assert.equal(capture,true);
      const sql=args[args.indexOf('--command')+1];
      assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/;|\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA)\b/i);
      if(++reads===failAt)throw new Error('fixture D1 query failure');
      let results;
      if(sql.includes('sqlite_schema')) results=schema;
      else if(sql.includes('FROM explore_derived_state')) results=[{seeded}];
      else if(sql.includes('FROM explore_like_processor_035')) results=[{id:processorId,lease_until:0,owner:''}];
      else throw new Error('unexpected fixture SELECT: '+sql);
      return JSON.stringify([{success:true,results}]);
    };
    if(allow)deployWithDerivedPreflight(config,run);
    else assert.throws(()=>deployWithDerivedPreflight(config,run),/D1 preflight|fixture D1 query failure/);
    assert.equal(calls.filter(args=>args[0]==='deploy').length,allow?1:0);
    if(allow)assert.deepEqual(calls.map(args=>args[0]),['d1','d1','d1','d1','deploy']);
  }
  for(const env of ['preview','test','production'])exercise({},true,env);
  console.log('PASS 1 complete 032 + 035 schema allows deploy only after four read-only SELECTs (all environments)');
  exercise({seeded:0});console.log('PASS 2 seeded=0 blocks deploy');
  for(const name of requiredTables)exercise({schema:normal.filter(row=>row.name!==name)});
  console.log('PASS 3 each required 032 table missing blocks deploy');
  for(const name of requiredTriggers)exercise({schema:normal.filter(row=>row.name!==name)});
  console.log('PASS 4 each of 18 required 032 triggers missing blocks deploy');
  for(const [,name] of requiredLike035Objects)exercise({schema:normal.filter(row=>row.name!==name)});
  console.log('PASS 5 each required 035 queue object missing blocks deploy');
  exercise({processorId:0});console.log('PASS 6 missing 035 processor seed blocks deploy');
  for(let failAt=1;failAt<=4;failAt+=1)exercise({failAt});
  console.log('PASS 7 any D1 preflight SELECT failure blocks deploy');
  console.log('PASS 8 profile social-extra 244 uses shared R2/cache only and never canonical D1');
  console.log('No real D1 query, SQL/seed write, Wrangler process or deployment executed');
}
