import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import { runtime390, schema390 } from './lib/like-receipt-390-fixture.mjs';
import { clientFixture379 } from './lib/like-client-fixture-379.mjs';

const old = readFileSync('scripts/fixtures/app379-exploreLikeService.txt','utf8');
assert.equal(createHash('sha256').update(old).digest('hex'),
  'e074a085365555b57a6910f0f3aad6b5169d2e0a8bfe019c405adcbc6acbe1ec',
  'exact aa1bac7636651fdf94598f0d5ef502955a60bc0f source');
const current = readFileSync('src/services/exploreLikeService.ts','utf8');
const { original, now } = clientFixture379(old);
const db = new DatabaseSync(':memory:');
const temp = mkdtempSync(join(tmpdir(),'compat379-'));
try {
  db.exec(readFileSync('cloudflare/explore-worker/migrations/20260912_01_explore_like_w1_queue.sql','utf8'));
  db.exec(`CREATE TABLE explore_like_cutover_control_174(id INTEGER PRIMARY KEY,phase TEXT);
    INSERT INTO explore_like_cutover_control_174 VALUES(1,'open');
    CREATE TABLE tracks(id TEXT PRIMARY KEY,is_public INTEGER,status TEXT) WITHOUT ROWID;
    CREATE TABLE likes(track_id TEXT,user_uid TEXT,PRIMARY KEY(track_id,user_uid)) WITHOUT ROWID;
    CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER) WITHOUT ROWID;
    INSERT INTO tracks VALUES('t',1,'published'); INSERT INTO track_stats VALUES('t',8);`);
  for (const sql of schema390()) db.exec(sql);
  let queryPlans=[];
  const query = async (sql,params=[]) => {
    if (sql.includes('pending AS MATERIALIZED')) queryPlans=db.prepare('EXPLAIN QUERY PLAN '+sql).all(...params);
    return {success:true,results:db.prepare(sql).all(...params)};
  };
  const {context:c,env} = runtime390(query);
  copyFileSync('cloudflare/explore-worker/canonical/preview-worker.js',join(temp,'worker.js'));
  for (const patch of ['097-follow-abuse-guard','098-like-abuse-guard']) execFileSync(process.execPath,
    ['cloudflare/explore-worker/patches/'+patch+'.mjs'],{env:{...process.env,SORIDRAW_REMOTE_WORKER_DIR:temp}});
  const worker=readFileSync(join(temp,'worker.js'),'utf8');
  const ast=ts.createSourceFile('worker.js',worker,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const selected=ast.statements.filter(ts.isFunctionDeclaration)
    .filter(n=>['handleLikeBatch034','readLegacyLikeReplay379'].includes(n.name?.text));
  assert.equal(selected.length,2);
  Object.assign(c,{ Date:{now:()=>now+31_000},requireExploreAuth:async()=>({uid:'viewer'}),
    EXPLORE_LIKE_BATCH_MAX_034:50,clampExploreSocialCount:n=>Math.max(0,Number(n)||0),
    enforceExploreLikeBatchEdgeRateLimit054:async()=>{},consumeSocialAbuse380:async()=>{},
    assertLegacyLikeIntakeOpen165:async()=>{},syncExploreLikeR2AfterBatch074:async()=>({ok:true}),
    json:(body,status)=>({body,status}) });
  vm.runInContext(selected.map(n=>n.getText(ast)).join('\n'),c);
  const mutation={trackId:'t',liked:true,baseLiked:false,mutationAt:now,
    expectedRevision:0,operationId:original.operationId};
  const handle=async(mutations=[mutation],aware=false)=>
    (await c.handleLikeBatch034({json:async()=>({mutations,...(aware?{acceptanceProtocol390:1}:{})})},env,{})).body;
  const written=()=>db.prepare('SELECT total_changes() n').get().n;
  const baseline=written(); const normal=await handle(); assert.equal(written()-baseline,2);
  for(const source of [old,current]) {
    const f=clientFixture379(source).fixture();f.setResponse(()=>normal);await f.flush();
    assert.deepEqual(f.state.outbox,{});assert.equal(f.state.signals.length,1);
    assert.equal(f.state.publics.length,1);assert.equal(f.state.errors.length,0);
  }
  async function verifyReplay(label,liked,count) {
    const before=written();const reply=await handle();assert.equal(written(),before,label+': replay W0');
    assert.equal(reply.data.results[0].liked,liked);assert.equal(reply.data.results[0].likeCount,count);
    assert.equal(reply.data.results[0].status,'revision-conflict');
    const legacy=clientFixture379(old).fixture();legacy.setResponse(()=>reply);await legacy.flush();
    assert.deepEqual(legacy.state.outbox,{});assert.equal(legacy.state.errors.length,0);
    assert.equal(legacy.state.cache.get('t'),liked);
    assert.equal(legacy.state.signals.length+legacy.state.publics.length,0,label+': legacy no republish');
    const modern=clientFixture379(current).fixture();modern.setResponse(()=>reply);await modern.flush();
    assert.deepEqual(modern.state.outbox,{});assert.equal(modern.state.errors.length,0);
    assert.equal(modern.state.signals.length+modern.state.publics.length,0);
    console.log('392_'+label+'_LEGACY_OUTBOX_CLEARED_W0_NO_REPUBLISH=PASS');
    return reply;
  }
  await verifyReplay('QUEUE_PENDING',true,9);
  // Another device's newer accepted queue wins even before materialization.
  const newerDevice=clientFixture379(current).fixture();
  newerDevice.setState({outbox:{t:{...original,baseLiked:true,baseLikeCount:9,
    desiredLiked:false,optimisticLikeCount:8,updatedAt:now+1,operationId:'newer_operation_123456789'}},
    cache:new Map([['t',false]])});
  newerDevice.setResponse(payload=>{
    assert.equal(payload.acceptanceProtocol390,1);
    return handle(payload.mutations,true);
  });
  await newerDevice.flush();
  assert.deepEqual(newerDevice.state.outbox,{});assert.equal(newerDevice.state.errors.length,0);
  assert.equal(newerDevice.state.signals.length,1);assert.equal(newerDevice.state.publics.length,1);
  assert.equal(newerDevice.state.cache.get('t'),false);
  const pendingNew=await verifyReplay('NEWER_DEVICE_QUEUE',false,8);
  // Processor atomically applies newer false then removes both queue rows.
  db.exec('DELETE FROM explore_like_batches_069');
  await verifyReplay('CANONICAL_NEWER_FALSE',false,8);
  db.exec("INSERT INTO likes VALUES('t','viewer'); UPDATE track_stats SET like_count=9 WHERE track_id='t';");
  const applied=await verifyReplay('CANONICAL_APPLIED',true,9);
  for(const source of [old,current]) {
    const f=clientFixture379(source).fixture();
    const newer={...original,desiredLiked:false,updatedAt:now+1,
      operationId:'explicit_undo_123456789',optimisticLikeCount:8};
    f.setResponse(()=>{f.setState({outbox:{t:newer},cache:new Map([['t',false]])});return applied;});
    await f.flush();assert.equal(f.state.outbox.t.desiredLiked,false);
    assert.equal(f.state.outbox.t.operationId,newer.operationId);assert.equal(f.state.outbox.t.updatedAt,newer.updatedAt);
    assert.equal(f.state.cache.get('t'),false);assert.equal(f.state.signals.length+f.state.publics.length,0);
    const revised=clientFixture379(source).fixture();
    const fresh={...newer,baseLiked:true,expectedRevision:9};
    revised.setResponse(()=>{revised.setState({outbox:{t:fresh},revisions:{t:9},cache:new Map([['t',false]])});return pendingNew;});
    await revised.flush();assert.equal(revised.state.revisions.t,9);
    assert.equal(revised.state.outbox.t.expectedRevision,9);
    assert.equal(revised.state.cache.get('t'),false);
  }
  // Receipt-aware clients opt out of compatibility reads; no old protocol changes.
  const aware=await handle([mutation],true);assert.equal(aware.data.results,undefined);
  const details=queryPlans.map(row=>row.detail).join('\n');
  assert.match(details,/SEARCH proof USING PRIMARY KEY/);assert.match(details,/SEARCH q USING PRIMARY KEY/);
  assert.match(details,/SEARCH t USING PRIMARY KEY/);assert.match(details,/SEARCH l USING PRIMARY KEY/);
  assert.doesNotMatch(details,/SCAN (?:proof|q|t|l|s)\b/);
  console.log('392_EXACT_APP379_FIRST_ACK_AND_APP381_MIXED_NEWER_UNDO_REVISION=PASS');
  console.log('392_REPLAY_READ_ONE_SNAPSHOT_UID_PK_QUEUE_PK_TRACK_PK_NO_FULL_SCAN=PASS');
  console.log('392_LEGACY_READ_BOUNDS=receipt_row1_queue_rows<=1200_queue_intents<=1200_requested_tracks<=50');
} finally {db.close();rmSync(temp,{recursive:true,force:true});}
