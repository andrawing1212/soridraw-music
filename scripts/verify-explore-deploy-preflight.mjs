import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { deployWithDerivedPreflight, requiredTables, requiredTriggers } from '../cloudflare/explore-worker/scripts/derived-deploy-preflight.mjs';

if (process.argv.includes('--connections')) {
  const prepared=readFileSync('cloudflare/explore-worker/scripts/deploy-prepared.mjs','utf8');
  assert.ok(prepared.indexOf('if (isCloudflareNativeBuild && !allowProductionDeploy)') < prepared.indexOf('deployWithDerivedPreflight(`${REMOTE_DIR}'));
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
  const normal=[...requiredTables.map(name=>({type:'table',name})),...requiredTriggers.map(name=>({type:'trigger',name}))];
  assert.equal(requiredTriggers.length,18);
  function exercise({schema=normal,seeded=1,failAt=0}={},allow=false,environment='preview') {
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
      return JSON.stringify([{success:true,results:sql.includes('sqlite_schema')?schema:[{seeded}]}]);
    };
    if(allow)deployWithDerivedPreflight(config,run);
    else assert.throws(()=>deployWithDerivedPreflight(config,run),/D1 preflight|fixture D1 query failure/);
    assert.equal(calls.filter(args=>args[0]==='deploy').length,allow?1:0);
    if(allow)assert.deepEqual(calls.map(args=>args[0]),['d1','d1','deploy']);
  }
  for(const env of ['preview','test','production'])exercise({},true,env);
  console.log('PASS 1 normal schema + seeded=1 allows deploy only after two SELECTs (all environments)');
  exercise({seeded:0});console.log('PASS 2 seeded=0 blocks deploy');
  for(const name of requiredTables)exercise({schema:normal.filter(row=>row.name!==name)});
  console.log('PASS 3 each required table missing blocks deploy');
  for(const name of requiredTriggers)exercise({schema:normal.filter(row=>row.name!==name)});
  console.log('PASS 4 each of 18 required triggers missing blocks deploy');
  exercise({failAt:1});exercise({failAt:2});console.log('PASS 5 either D1 query failure blocks deploy');
  console.log('No real D1 query, SQL/seed write, Wrangler process or deployment executed');
}
