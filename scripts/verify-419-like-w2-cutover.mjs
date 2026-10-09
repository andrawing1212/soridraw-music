// Stage419 isolated executable audit of the ACTUAL source-only 171 adapter.
// Uses Node 22 built-in SQLite in memory. NEVER connects to shared or remote D1.
// D1 meta.rows_written here is a logical-rows fixture, NOT Cloudflare billing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createLikeD1OnlyCanonical171 } from '../cloudflare/explore-worker/runtime/like-d1only-171.mjs';

const schemaPath = 'cloudflare/explore-worker/migrations/20260921_03_explore_like_d1only_v171_additive.sql';
const schema = readFileSync(schemaPath, 'utf8');
assert.match(schema, /explore_like_overrides_171/);
assert.match(schema, /explore_like_count_deltas_171/);
assert.match(schema, /WITHOUT ROWID/);

function isolatedFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec("PRAGMA foreign_keys=ON");
  sqlite.exec([
    'CREATE TABLE tracks(id TEXT PRIMARY KEY, owner_uid TEXT NOT NULL,',
    "is_public INTEGER NOT NULL, status TEXT NOT NULL);",
    'CREATE TABLE public_profiles(uid TEXT PRIMARY KEY,is_public INTEGER NOT NULL);',
    'CREATE TABLE likes(track_id TEXT NOT NULL,user_uid TEXT NOT NULL,',
    'PRIMARY KEY(track_id,user_uid));',
    'CREATE TABLE track_stats(track_id TEXT PRIMARY KEY,like_count INTEGER NOT NULL);',
  ].join(' '));
  sqlite.exec(schema);
  sqlite.prepare('INSERT INTO public_profiles(uid,is_public) VALUES(?,?)').run('owner',1);
  for (const track of ['song','legacy','hidden']) {
    sqlite.prepare('INSERT INTO tracks(id,owner_uid,is_public,status) VALUES(?,?,?,?)')
      .run(track,'owner',track==='hidden'?0:1,'published');
    sqlite.prepare('INSERT INTO track_stats(track_id,like_count) VALUES(?,?)').run(track,0);
  }
  // One historical true membership is preserved without copying it.
  sqlite.prepare('INSERT INTO likes(track_id,user_uid) VALUES(?,?)').run('legacy','old-user');
  sqlite.prepare('UPDATE track_stats SET like_count=1 WHERE track_id=?').run('legacy');

  const bind = (sql, values) => ({
    sql, values,
    bind(...v) { return bind(sql,v); },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    async run() {
      const result=sqlite.prepare(sql).run(...values);
      return { success:true, meta:{ changes:Number(result.changes),rows_written:Number(result.changes) } };
    },
  });
  const db = {
    prepare(sql) { return bind(sql,[]); },
    async batch(statements) {
      // Faithfully exercise the candidate SQL ordering and D1.batch rollback.
      // This substitutes logical SQLite changes for D1 physical rows_written.
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const outputs=[];
        for (const command of statements) {
          const stmt=sqlite.prepare(command.sql);
          if (command.sql.trimStart().startsWith('SELECT ')) {
            outputs.push({success:true,results:stmt.all(...command.values),
              meta:{changes:0,rows_written:0}});
          } else {
            const result=stmt.run(...command.values);
            const changes=Number(result.changes);
            outputs.push({success:true,results:[],meta:{changes,rows_written:changes}});
          }
        }
        sqlite.exec('COMMIT');
        return outputs;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return {sqlite,db};
}

function rows(sqlite,table) {
  return sqlite.prepare('SELECT COUNT(*) AS n FROM '+table).get().n;
}
async function main() {
  const {sqlite,db}=isolatedFixture();
  assert.throws(() => createLikeD1OnlyCanonical171(db),/writer blocked/);
  const adapter=createLikeD1OnlyCanonical171(db,{cutoverVerified:true});

  // Real source-only adapter SQL, not a rewritten in-test mutation model.
  let r=await adapter.applyAtomically('user-a','song',true,
    {expectedRevision:0,operationId:'a-like-1',now:100});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount,r.revision],['applied',2,1,1]);
  r=await adapter.applyAtomically('user-a','song',true,
    {expectedRevision:0,operationId:'a-like-1',now:101});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['duplicate',0,1]);

  // Distinct accounts mutating one track must converge to exact public count.
  r=await adapter.applyAtomically('user-b','song',true,
    {expectedRevision:0,operationId:'b-like-1',now:102});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['applied',2,2]);
  r=await adapter.applyAtomically('user-a','song',false,
    {expectedRevision:0,operationId:'a-unlike-stale',now:103});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['revision-conflict',0,2]);

  r=await adapter.applyAtomically('user-a','song',false,
    {expectedRevision:1,operationId:'a-unlike-2',now:104});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['applied',2,1]);
  r=await adapter.applyAtomically('user-a','song',true,
    {expectedRevision:0,operationId:'a-like-1',now:105});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['revision-conflict',0,1]);
  r=await adapter.applyAtomically('user-b','song',false,
    {expectedRevision:1,operationId:'b-unlike-2',now:106});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['applied',2,0]);
  assert.equal((await adapter.readSnapshot('user-a','song')).liked,false);
  assert.equal((await adapter.readSnapshot('user-b','song')).likeCount,0);
  console.log('419_ACTUAL_171_SOURCE_LIKE_UNLIKE_DUPLICATE_STALE_MULTIUSER=PASS');

  // Historical personal likes need to survive as immutable legacy baseline.
  r=await adapter.applyAtomically('old-user','legacy',false,
    {expectedRevision:0,operationId:'old-unlike-1',now:107});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['applied',2,0]);
  assert.equal(rows(sqlite,'likes'),1);
  assert.equal((await adapter.readSnapshot('old-user','legacy')).liked,false);
  r=await adapter.applyAtomically('old-user','legacy',true,
    {expectedRevision:1,operationId:'old-relike-2',now:108});
  assert.deepEqual([r.status,r.rowsWritten,r.likeCount],['applied',2,1]);
  r=await adapter.applyAtomically('user-a','hidden',true,
    {expectedRevision:0,operationId:'hidden-1',now:109});
  assert.deepEqual([r.status,r.rowsWritten],['ineligible',0]);
  console.log('419_ACTUAL_171_SOURCE_LEGACY_BASELINE_AND_HIDDEN=PASS');

  // A release blocker independent of operation-id logic:
  // A stale TEST/PRODUCTION writer can still write the legacy baseline.
  const other=isolatedFixture();
  const newWriter=createLikeD1OnlyCanonical171(other.db,{cutoverVerified:true});
  r=await newWriter.applyAtomically('user-x','song',true,
    {expectedRevision:0,operationId:'x-like-1',now:201});
  assert.equal(r.likeCount,1);
  // Simulate an old shared writer reaching the SAME D1 after new overlay commit.
  other.sqlite.prepare('INSERT INTO likes(track_id,user_uid) VALUES(?,?)').run('song','user-x');
  other.sqlite.prepare('UPDATE track_stats SET like_count=like_count+1 WHERE track_id=?').run('song');
  const stale=(await newWriter.readSnapshot('user-x','song'));
  assert.equal(stale.liked,true);
  assert.equal(stale.likeCount,2);
  assert.equal(other.sqlite.prepare(
    'SELECT COUNT(*) AS n FROM likes WHERE track_id=? AND user_uid=?').get('song','user-x').n,1);
  console.log('419_OLD_NEW_WRITER_DOUBLE_COUNT_COUNTEREXAMPLE=REPRODUCED');
  console.log('419_CUTOVER_BEFORE_OLD_WRITERS_FROZEN=BLOCKED');
  console.log('419_PHYSICAL_CLOUDFLARE_D1_COST=NOT_MEASURED');
  console.log('419_LIVE_SHARED_DATA_AND_DEPLOYMENT=UNTOUCHED');
  sqlite.close(); other.sqlite.close();
}
await main();
