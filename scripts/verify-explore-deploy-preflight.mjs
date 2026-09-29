import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
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

const canonicalWorker245 = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const profile245Start = canonicalWorker245.indexOf('async function handleMyProfileUpdate(');
const profile245End = canonicalWorker245.indexOf('\n__name(handleMyProfileUpdate', profile245Start);
assert.ok(profile245Start >= 0 && profile245End > profile245Start, '245 profile handler missing');
const profile245 = canonicalWorker245.slice(profile245Start, profile245End);
assert.match(profile245, /const coreChanged =/);
assert.match(profile245, /patchPublicProfileBundle245\(env, authContext\.uid, profilePatch, previousHandle\)/);
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
