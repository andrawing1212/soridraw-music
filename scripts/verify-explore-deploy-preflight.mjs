import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { deployWithDerivedPreflight, requiredTables, requiredTriggers, requiredLike035Objects } from '../cloudflare/explore-worker/scripts/derived-deploy-preflight.mjs';

if (process.argv.includes('--connections')) {
  const prepared=readFileSync('cloudflare/explore-worker/scripts/deploy-prepared.mjs','utf8');
  assert.ok(prepared.indexOf('if (isCloudflareNativeBuild && !allowProductionDeploy)') < prepared.indexOf('deployWithDerivedPreflight(`${REMOTE_DIR}')));
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
  console.log('No real D1 query, SQL/seed write, Wrangler process or deployment executed');
}
