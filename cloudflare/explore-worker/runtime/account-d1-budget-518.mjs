// app518 DORMANT account-wide D1 budget wrapper for existing Explore Writers.
// IMPORTANT: No client behavior or D1 I/O changes until a separately audited
// all-Worker migration, shared ledger schema, signed rollback and explicit deploy.
// Unlike a per-DB quota, reservations MUST go to the same canonical D1 ledger
// for PRODUCTION, PREVIEW, TEST, migration tools and Media app518.
import {createD1BudgetGate518} from '../../media-worker/src/catalogD1DailyWriteBudget518.js';

export class ExploreD1BudgetHold518 extends Error {
 constructor(code){super(code);this.code=code;this.name='ExploreD1BudgetHold518';}
}
const deny=code=>{throw new ExploreD1BudgetHold518(code)};
const TAG='SORIDRAW_D1_ACCOUNT_BUDGET_ENFORCEMENT_518';
const mode=env=>String(env?.[TAG]??'');
const tidy=s=>typeof s==='string'?s.trim():'';
const mutation=/^(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z][\w]*)\b/i;
const simpleRead=s=>/^SELECT\b/i.test(s)&&!/[;]|--|\/\*/.test(s);
const sqlTable=s=>mutation.exec(s)?.[1]?.toLowerCase()||'';
// Table index contracts MUST be checked against the live sqlite_schema before
// enabling. Conservative values include table row and index churn; no unknown
// schema or unbounded UPDATE/DELETE is guessed to be W1.
const TABLE_MAX_ROWS_518=Object.freeze({
 explore_curators:4,
 curated_picks:5,
 explore_like_overrides_171:5,
 explore_like_count_deltas_171:5,
 explore_like_private_pending_416:5,
 explore_like_private_operations_416:5,
 explore_like_batches_069:5,
});
const plan=(sql,args=[])=>{
 const text=tidy(sql);
 if(!text||/[;]|--|\/\*/.test(text))deny('HOLD_518_SQL_UNSAFE');
 if(simpleRead(text))return 0;
 const table=sqlTable(text);
 const factor=TABLE_MAX_ROWS_518[table];
 if(!factor)deny('HOLD_518_UNAUDITED_LEGACY_D1_TABLE');
 // A multirow INSERT SELECT, mass update or DELETE is not bounded simply
 // because the SQL contains one WHERE clause. Reject unless reviewed.
 const verb=text.split(/\s+/)[0].toUpperCase();
 const isInsert=['INSERT','REPLACE'].includes(verb);
 if(isInsert){
  const singleValues=/\bVALUES\s*\([^)]*\)/i.test(text)
    &&!/\bVALUES\s*\([^)]*\)\s*,/i.test(text)
    && !/\bSELECT\b/i.test(text);
  if(!singleValues)deny('HOLD_518_UNBOUNDED_INSERT_SELECT');
 }else{
  const where=text.match(/\bWHERE\b([\s\S]*)/i)?.[1]||'';
  if(!/\b(?:uid|user_uid|track_id|batch_id|id)\s*=\s*\?/i.test(where))
   deny('HOLD_518_UNBOUNDED_UPDATE_OR_DELETE');
 }
 if(!Array.isArray(args)||args.length>128)
  deny('HOLD_518_D1_BINDINGS_UNBOUNDED');
 return factor;
};
export const exploreBudgetPlan518=plan;

// OFF is a byte-identical passthrough of the original binding and causes no
// additional D1 reads, writes, DO requests, or page entry work.
export const protectExploreEnv518=(env,{clock=()=>Date.now()}={})=>{
 if(mode(env)==='')return env;
 if(mode(env)!=='ENFORCE_AFTER_SIGNED_ALL_WRITERS_518')
  deny('HOLD_518_UNKNOWN_BUDGET_MODE');
 if(env?.SORIDRAW_D1_ALL_ACCOUNT_WRITERS_518!=='VERIFIED'
   ||env?.SORIDRAW_D1_SHARED_ACCOUNT_LEDGER_518!=='VERIFIED'
   ||env?.SORIDRAW_APP518_RELEASE_FENCES_VERIFIED!=='APPROVED_ALL_3_AND_NO_OLD_WRITERS')
  deny('HOLD_518_ACCOUNT_WRITER_COHORT_UNATTESTED');
 // Explore's DB is the shared canonical D1 in all three environments. The
 // separately approved release controller must also verify its LIVE DB UUID,
 // the ledger table + index schema and every external/API/DO writer version.
 const raw=env.DB;
 if(!raw?.prepare||!raw?.batch)
  deny('HOLD_518_ACCOUNT_LEDGER_BINDING_MISSING');
 const reserve=createD1BudgetGate518({db:raw,
  allAccountWritersVerified:true,sharedAccountLedgerVerified:true});
 const charge=async n=>{
  if(!Number.isSafeInteger(n)||n<1||n>2048)deny('HOLD_518_ROW_RESERVATION_LIMIT');
  const now=clock();
  // Never reserve just before UTC midnight and risk completing the write
  // against tomorrow's free quota using yesterday's receipt.
  if(now%86400000>=86400000-120000)deny('HOLD_518_UTC_ROLLOVER_WINDOW');
  const receipt=await reserve({nowMs:now,requestedRows:n,purpose:'normal'});
  if(receipt?.reserved!==true)
   deny(receipt?.code||'HOLD_518_D1_RESERVATION_FAILED');
  if(Math.floor(clock()/86400000)!==Math.floor(now/86400000))
   deny('HOLD_518_UTC_DAY_CHANGED_AFTER_RESERVATION');
 };
 const wrap=(statement,sql,args=[])=>({
  __guard518:true,sql,args,raw:statement,
  bind(...values){return wrap(statement.bind(...values),sql,values)},
  async first(...rest){if(plan(sql,args)!==0)deny('HOLD_518_WRITE_VIA_FIRST');return statement.first(...rest)},
  async all(...rest){if(plan(sql,args)!==0)deny('HOLD_518_WRITE_VIA_ALL');return statement.all(...rest)},
  async run(){const n=plan(sql,args);if(n)await charge(n);return statement.run()},
 });
 const budgeted={
  prepare(sql){return wrap(raw.prepare(sql),sql)},
  async batch(statements){
   if(!Array.isArray(statements)||!statements.length
     ||statements.some(s=>s?.__guard518!==true))
    deny('HOLD_518_RAW_OR_EMPTY_BATCH');
   const n=statements.reduce((sum,s)=>sum+plan(s.sql,s.args),0);
   if(n>0)await charge(n);
   return raw.batch(statements.map(s=>s.raw));
  },
  exec(){deny('HOLD_518_UNMETERED_EXEC')},
  withSession(){deny('HOLD_518_UNMETERED_SESSION')},
 };
 return {...env,DB:budgeted};
};
