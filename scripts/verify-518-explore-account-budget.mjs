import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {protectExploreEnv518,exploreBudgetPlan518,ExploreD1BudgetHold518}
 from '../cloudflare/explore-worker/runtime/account-d1-budget-518.mjs';
const sql='INSERT INTO curated_picks(collection_key,track_id) VALUES (?,?)';
const upd='UPDATE explore_curators SET is_active=0 WHERE uid=?';
const SELECT='SELECT id FROM curated_picks WHERE track_id=? LIMIT 1';
const holds=fn=>assert.throws(fn,e=>e instanceof ExploreD1BudgetHold518);
const rejects=async promise=>assert.rejects(promise,e=>e instanceof ExploreD1BudgetHold518);
let direct=0,book=0,reads=0,reserved=0,ledgerReady=true;
const raw={
 prepare(statement){
  return {bind(...args){
   return {
    async first(){reads++;return {id:'x'}},
    async all(){reads++;return {results:[]}},
    async run(){
     if(statement.includes('music_note_catalog_daily_budget_518')){
      if(!ledgerReady)return {success:false,meta:{changes:0}};
      reserved+=Number(args[1]);book++;return {success:true,meta:{changes:1}};
     }
     direct++;return {success:true,meta:{changes:1}};
    },
   };
  }};
 },
 async batch(){direct++;return [{success:true,meta:{changes:1}}]},
};
const base={DB:raw,other:'preserved'};
assert.equal(protectExploreEnv518(base),base,'OFF is exact original env');
assert.equal(book,0);assert.equal(direct,0);
holds(()=>protectExploreEnv518({...base,SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518:'WRONG'}));
const enabled={...base,SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518:'ENFORCE_AFTER_SIGNED_ALL_WRITERS_518',
 SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'VERIFIED',
 SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518:'VERIFIED',
 SORIDRAW_APP518_RELEASE_FENCES_VERIFIED:'APPROVED_ALL_3_AND_NO_OLD_WRITERS'};
holds(()=>protectExploreEnv518({...enabled,SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518:'OFF'}));
holds(()=>protectExploreEnv518({...enabled,DB:null}));
let now=Date.UTC(2026,9,30,12);
const env=protectExploreEnv518(enabled,{clock:()=>now});
assert.equal(env.other,'preserved');
assert.equal(env.DB===raw,false);
assert.equal((await env.DB.prepare(SELECT).bind('a').first()).id,'x');
assert.equal((await env.DB.prepare(SELECT).bind('a').all()).results.length,0);
assert.equal(book,0);
await env.DB.prepare(sql).bind('soridraw','a').run();
assert.equal(book,1);
assert.equal(reserved,6,'5 conservative index rows + budget ledger W1');
assert.equal(direct,1);
const a=env.DB.prepare(upd).bind('a'),b=env.DB.prepare(sql).bind('soridraw','b');
await env.DB.batch([a,b]);
assert.equal(book,2);
assert.equal(reserved,16,'5+4+ledger write');
assert.equal(direct,2);
await rejects(env.DB.prepare('DELETE FROM curated_picks').bind().run());
await rejects(env.DB.prepare('UPDATE explore_curators SET is_active=0 WHERE is_active=1').bind().run());
await rejects(env.DB.prepare('DELETE FROM curated_picks WHERE track_id=?').bind('song').run());
await rejects(env.DB.prepare('UPDATE explore_like_overrides_171 SET liked=0 WHERE user_uid=?').bind('owner').run());
await rejects(env.DB.prepare('INSERT INTO curated_picks SELECT * FROM other').bind().run());
await rejects(env.DB.prepare('INSERT INTO unknown_table(id) VALUES (?)').bind('x').run());
await rejects(env.DB.prepare('WITH e AS (SELECT 1) INSERT INTO curated_picks VALUES (?)').run());
await rejects(env.DB.prepare('CREATE TABLE unexpected(x INT)').run());
await rejects(env.DB.prepare('PRAGMA writable_schema=ON').run());
await rejects(env.DB.prepare('UPDATE curated_picks SET track_id=? WHERE track_id=?').bind('a','b').first());
holds(()=>env.DB.exec('DELETE FROM curated_picks'));
holds(()=>env.DB.withSession('first-primary'));
await rejects(env.DB.batch([{run:async()=>{direct++}}]));
assert.equal(book,2,'denied unknown SQL must reserve nothing');
assert.equal(direct,2,'denied unknown SQL must mutate nothing');
assert.equal(exploreBudgetPlan518(SELECT),0);
assert.equal(exploreBudgetPlan518(sql),5);
ledgerReady=false;
await assert.rejects(env.DB.prepare(sql).bind('soridraw','c').run(),
 e=>e.code==='RETRYABLE_D1_BUDGET_IO');
assert.equal(direct,2,'denied budget must never execute user SQL');
ledgerReady=true;
now=Date.UTC(2026,9,30,23,59,30);
await assert.rejects(env.DB.prepare(sql).bind('soridraw','c').run(),
 e=>e.code==='HOLD_518_UTC_ROLLOVER_WINDOW');
assert.equal(direct,2);
// Ensure the source actually wraps every outer entrypoint plus its DO.
const source=readFileSync('cloudflare/explore-worker/canonical/preview-entry.js','utf8');
assert.match(source,/import \{protectExploreEnv518\}/);
assert.match(source,/constructor\(ctx,env\)\{super\(ctx,protectExploreEnv518\(env\)\);\}/);
assert.match(source,/async scheduled\(controller, env, ctx\) \{\s*env=protectExploreEnv518\(env\);/);
assert.match(source,/async fetch\(request, env, ctx\) \{\s*env=protectExploreEnv518\(env\);/);
console.log('APP518_EXPLORE_LEGACY_WRITERS_SHARED_LEDGER_DORMANT=PASS');
console.log('APP518_EXPLORE_WRITE_ONLY_COST_AND_SQL_FAIL_CLOSED=PASS');
console.log('APP518_EXPLORE_FETCH_CRON_DO_ALL_ENTRYPOINTS=PASS');
