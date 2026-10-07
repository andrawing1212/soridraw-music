import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,copyFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import {receiptMigration390,receiptObjects390,receiptSchemaQuery390,verifyReceiptMigration390,
  verifyReceiptSchema390,verifySocialConfig380,assertReceiptReady390,applyReceiptSchema390}
  from '../cloudflare/explore-worker/scripts/receipt390-release.mjs';

const migration=readFileSync('cloudflare/explore-worker/migrations/'+receiptMigration390,'utf8');
verifyReceiptMigration390(migration);
for(const suffix of ['\nCREATE TABLE extra(x);','\nDELETE FROM likes;','\nINSERT INTO likes VALUES(1);']) {
  assert.throws(()=>verifyReceiptMigration390(migration+suffix));
}
assert.throws(()=>verifyReceiptMigration390(migration.replace("phase = 'open'","phase = 'closed'")));
function database() {
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync('cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql','utf8'));
  db.exec("CREATE TABLE explore_like_cutover_control_174(id INTEGER PRIMARY KEY,phase TEXT); INSERT INTO explore_like_cutover_control_174 VALUES(1,'open');");
  return db;
}
for(const failureAt of [0,1,2]) for(const afterAck of [false,true]) {
  const db=database();let attempt=0,failed=false,dormantChecks=0;
  const query=async sql=>{
    if(sql.startsWith('CREATE')) {
      const fail=!failed&&attempt++===failureAt;
      if(fail&&!afterAck) {failed=true;throw Error('injected migration failure');}
      const rows=db.prepare(sql).all();
      if(fail&&afterAck) {failed=true;throw Error('lost DDL ACK');}
      return rows;
    }
    return db.prepare(sql).all();
  };
  await assert.rejects(()=>applyReceiptSchema390(query,async()=>{dormantChecks++;}),/migration failure|lost DDL ACK/);
  assert.equal(db.prepare(receiptSchemaQuery390).all().length,0);
  assert.equal(dormantChecks,2);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM explore_like_batches_069').get().n,0);
  db.close();
}
const complete=database();
const query=async sql=>complete.prepare(sql).all();
await applyReceiptSchema390(query,async()=>{});
verifyReceiptSchema390(await query(receiptSchemaQuery390));
let creates=0;
await applyReceiptSchema390(async sql=>{if(sql.startsWith('CREATE'))creates++;return query(sql);},async()=>{});
assert.equal(creates,0,'existing complete schema is read-only/idempotent');
const rows=await query(receiptSchemaQuery390);
assert.throws(()=>verifyReceiptSchema390(rows.slice(0,2)),/missing\/partial/);
assert.throws(()=>verifyReceiptSchema390(rows.map((row,i)=>i?row:{...row,sql:'CREATE TABLE bad(x)'})),/drift/);
for(const phase of ["'OPEN'","'o pen'"]) {
  assert.throws(()=>verifyReceiptSchema390(rows.map(row=>({...row,sql:row.sql.replace("'open'",phase)}))),/drift/);
}
complete.close();
const partial=database();partial.exec(receiptObjects390[0].statement);
await assert.rejects(()=>applyReceiptSchema390(async sql=>partial.prepare(sql).all(),async()=>{}),/partial/);
assert.equal(partial.prepare(receiptSchemaQuery390).all().length,1,'unknown preexisting partial schema is preserved');
partial.close();
// Worker activation during a failed apply blocks compensation; never erase proofs.
const active=database();let created=0;
await assert.rejects(()=>applyReceiptSchema390(async sql=>{
  const result=active.prepare(sql).all();if(sql.startsWith('CREATE')&&++created===3)throw Error('lost ACK');return result;
},async()=>{if(created)throw Error('Worker active: preserve');}),/Worker active/);
assert.equal(active.prepare(receiptSchemaQuery390).all().length,3);active.close();
const populated=database();let ddlCount=0;
await assert.rejects(()=>applyReceiptSchema390(async sql=>{
  const result=populated.prepare(sql).all();
  if(sql.startsWith('CREATE')&&++ddlCount===3) {
    populated.exec(`INSERT INTO explore_like_intake_receipts_390 VALUES('proof',1,'[]','proof-queue',1,1,'[]')`);
    throw Error('lost ACK with proof');
  }
  return result;
},async()=>{}),/populated: preserve acceptance proofs/);
assert.equal(populated.prepare(receiptSchemaQuery390).all().length,3);
assert.equal(populated.prepare('SELECT user_uid FROM explore_like_intake_receipts_390').get().user_uid,'proof');
assert.equal(populated.prepare('SELECT batch_id FROM explore_like_batches_069').get().batch_id,'proof-queue');
populated.close();
console.log('393_EXACT_THREE_OBJECT_SCHEMA_PARTIAL_FAILURE_AND_LOST_ACK_CLEANUP=PASS');
console.log('393_PREEXISTING_PARTIAL_POPULATED_OR_ACTIVE_SCHEMA_PRESERVED_NO_USER_REWRITE=PASS');

const config=JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc','utf8'));
for(const environment of ['preview','test','production']) {
  const cfg={...config,vars:{...config.vars,SORIDRAW_ENVIRONMENT:environment}};
  verifySocialConfig380(cfg,environment);
  assert.throws(()=>verifySocialConfig380({...cfg,vars:{...cfg.vars,SORIDRAW_ENVIRONMENT:'wrong'}},environment));
  assert.throws(()=>verifySocialConfig380({...cfg,r2_buckets:[]},environment));
  assert.throws(()=>verifySocialConfig380({...cfg,ratelimits:[]},environment));
  let calls=0;
  assertReceiptReady390('fixture',args=>{
    calls++;assert.equal(args[args.indexOf('--command')+1],receiptSchemaQuery390);
    assert.equal(args.includes('--file'),false);
    return JSON.stringify([{success:true,results:rows}]);
  });
  assert.equal(calls,1);
  assert.throws(()=>assertReceiptReady390('fixture',()=>JSON.stringify([{success:false,results:rows}])));
  assert.throws(()=>assertReceiptReady390('fixture',()=>JSON.stringify([{success:true,results:[]}])));
}
verifySocialConfig380(config,'preview');
const runtime=readFileSync('.deploy/release-worker-runtime.mjs','utf8');
assert.match(runtime,/canonicalVars\.SORIDRAW_ENVIRONMENT = mode/);
assert.match(runtime,/liveRateLimits\.some\(item => item\?\.name === 'LIKE_RATE_LIMITER'\)/);
assert.match(runtime,/if \(action !== 'restore'\) \{\n  verifySocialConfig380\([\s\S]*?mode\);\n  assertReceiptReady390\(CONFIG_PATH\);/);
const preview=readFileSync('.github/workflows/cloudflare-explore-preview-release.yml','utf8');
assert.match(preview,/receipt390-release\.mjs preflight canonical\/wrangler\.preview\.jsonc preview/);
assert.ok(preview.indexOf('receipt390-release.mjs preflight')<preview.indexOf(' deploy --config wrangler.preview.jsonc\n'));
const contract=readFileSync('scripts/release-production-environment-contract.mjs','utf8');
assert.match(contract,/testExplore\.vars\.SORIDRAW_ENVIRONMENT !== 'test'/);
assert.match(contract,/prodExplore\.vars\.SORIDRAW_ENVIRONMENT !== 'production'/);
console.log('393_THREE_ENV_IDENTITY_BINDINGS_SCHEMA_SELECT_ONLY_FAIL_CLOSED=PASS');

const workflow=readFileSync('.github/workflows/cloudflare-explore-shared-d1-release.yml','utf8');
assert.match(workflow,/receipt390\)[\s\S]*?user_explicit_receipt390_schema_apply/);
assert.match(workflow,/Install receipt390 verifier tooling[\s\S]*?mode == 'receipt390'[\s\S]*?npm ci --no-audit --no-fund/);
assert.match(workflow,/TRIGGER\|VIEW/,'generic additive gate is still strict');
assert.match(workflow,/applyReceiptSchema390\(query,dormant\)/);
assert.match(workflow,/body\.result\.length!==1/);
assert.match(workflow,/workers\/scripts\/\$\{name\}\/content/);
assert.match(workflow,/git hash-object "\$migration_path"/);
assert.match(workflow,/git hash-object scripts\/verify-393-receipt390-activation.mjs/);
for(const step of workflow.split('      - name: ').slice(1)) {
  const run=step.split('\n        run: |\n')[1];if(!run)continue;
  const body=run.split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
  const result=spawnSync('bash',['-n'],{input:body,encoding:'utf8'});
  assert.equal(result.status,0,step.split('\n')[0]+': '+result.stderr);
}
console.log('393_RECEIPT390_EXACT_WORKFLOW_MODE_GENERIC_GATE_UNCHANGED=PASS');

const worker=readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const base='37a7f3e299ebb3d4232a1276817f2490698c96d0';
const fromBase=path=>execFileSync('git',['show',base+':'+path],{encoding:'utf8',maxBuffer:8*1024*1024});
const oldWorker=fromBase('cloudflare/explore-worker/canonical/preview-worker.js');
assert.equal(createHash('sha256').update(oldWorker).digest('hex'),'43b71e2892cbade0ce33911b7157286bd4c84eb7b516575769130412df34e673');
assert.doesNotMatch(oldWorker,/explore_like_intake_receipts_390|explore_like_receipt_(insert|update)_390/);
const functions=source=>{
  const ast=ts.createSourceFile('worker.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  return new Map(ast.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name?.text,n.getText(ast)]));
};
const before=functions(oldWorker),after=functions(worker);
const permitted=new Set(['enforceFollowEdgeRateLimit355','handleFollowOverlay354',
  'handleLikeBatch034','handleLikeD1Core','enforceExploreLikeBatchEdgeRateLimit054']);
for(const [name,text] of before) if(!permitted.has(name)) assert.equal(after.get(name),text,'frozen function '+name);
for(const path of ['cloudflare/explore-worker/candidates/390-like-acceptance-receipt.sql',
  'cloudflare/explore-worker/candidates/like-acceptance-390.js','cloudflare/explore-worker/patches/097-follow-abuse-guard.mjs']) {
  assert.equal(readFileSync(path,'utf8'),fromBase(path),'measured receipt/follow core unchanged');
}
const dormantDb=database();dormantDb.exec(migration);const oldQueries=[];
const prepare=(sql,params=[])=>({sql,params,bind:(...params)=>prepare(sql,params)});
const oldContext=vm.createContext({exploreLikeW1Batch040:async()=>({batchId:'old379',batchAt:1,payload:[{trackId:'t',liked:true}]}),
  throwLikeCutoverFenceClosed174:()=>{throw Error('closed');},isMissingExploreLikeCutover174:()=>false});
vm.runInContext(before.get('enqueueExploreLikeBatch035'),oldContext);
const oldEnv={DB:{prepare,batch:async statements=>statements.map(({sql,params})=>{
  oldQueries.push(sql);
  if(/SELECT phase/.test(sql))return {success:true,results:dormantDb.prepare(sql).all(...params)};
  return {success:true,meta:{changes:dormantDb.prepare(sql).run(...params).changes}};
})}};
const oldWrites=dormantDb.prepare('SELECT total_changes() n').get().n;
await oldContext.enqueueExploreLikeBatch035(oldEnv,'old-user',[{trackId:'t',liked:true}],1);
assert.equal(dormantDb.prepare('SELECT total_changes() n').get().n-oldWrites,1);
assert.equal(dormantDb.prepare('SELECT COUNT(*) n FROM explore_like_intake_receipts_390').get().n,0);
assert.ok(oldQueries.every(sql=>!sql.includes('receipt')));
dormantDb.close();
console.log('393_EXACT_OLD_WORKER_DORMANT_SCHEMA_W1_NO_RECEIPT_ACCESS_FROZEN_CORE=PASS');
assert.equal(createHash('sha256').update(worker).digest('hex'),readFileSync('cloudflare/explore-worker/canonical/source-sha256.txt','utf8').trim());
assert.match(worker,/SORIDRAW_LIKE_REPLAY_COMPAT_379_20261008/);
assert.match(worker,/SORIDRAW_FOLLOW_ABUSE_GUARD_380_20261007/);
assert.match(worker,/SORIDRAW_LIKE_ABUSE_GUARD_390_20261008/);
const manifest=JSON.parse(readFileSync('cloudflare/explore-worker/release-patches.json','utf8')).patches;
assert.ok(manifest.indexOf('097-follow-abuse-guard.mjs')>=0);
assert.ok(manifest.indexOf('098-like-abuse-guard.mjs')===manifest.indexOf('097-follow-abuse-guard.mjs')+1);
const temp=mkdtempSync(join(tmpdir(),'canonical390-'));
try {
  copyFileSync('cloudflare/explore-worker/canonical/preview-worker.js',join(temp,'worker.js'));
  for(const patch of ['097-follow-abuse-guard','098-like-abuse-guard']) execFileSync(process.execPath,
    ['cloudflare/explore-worker/patches/'+patch+'.mjs'],{env:{...process.env,SORIDRAW_REMOTE_WORKER_DIR:temp}});
  assert.equal(readFileSync(join(temp,'worker.js'),'utf8'),worker);
  execFileSync(process.execPath,['--check',join(temp,'worker.js')]);
} finally {rmSync(temp,{recursive:true,force:true});}
console.log('393_CANONICAL_097_THEN_098_HASH_SYNTAX_IDEMPOTENCE=PASS');
