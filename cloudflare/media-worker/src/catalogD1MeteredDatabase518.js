// app518 DORMANT: every candidate D1 mutation passes the same account-wide
// reservation before reaching D1, whether first-index, outbox, ACK, retry,
// compacted-index replay or direct SQL batch. No page-entry/GET writes.
// A release MUST prove that other databases, Workers and legacy writers are
// reserved in this very same account ledger. Local VERIFIED flags alone do
// not provide that proof; the release remains OFF pending external audit.
export class CatalogD1BudgetError518 extends Error {
 constructor(code){super(code);this.code=code;this.name='CatalogD1BudgetError518';}
}
// D1 .first()/.all() execute prepared statements as well. They must NEVER
// run INSERT/UPDATE/DELETE ... RETURNING without the daily reservation.
const clean=sql=>typeof sql==='string'
 ?sql.replace(/^(?:\s*\/\*[\s\S]*?\*\/\s*)*/,'').trim():'';
const readOnly=sql=>/^SELECT\b/i.test(clean(sql))&&!/[;]|--|\/\*/.test(clean(sql));
const mutate=sql=>{
 const value=clean(sql);
 // Only known per-owner app518 tables and direct bounded SQL are allowed.
 // Reject WITH/PRAGMA/DDL/unknown target/multi-statements closed, not W0.
 if(/[;]|--|\/\*/.test(value))return false;
 const match=value.match(/^(INSERT(?:\s+OR\s+(?:IGNORE|REPLACE|ABORT|FAIL|ROLLBACK))?\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+(music_note_catalog_(?:member|index_meta|outbox|paged_stage)_518)\b/i);
 if(!match)return false;
 const verb=match[1].toUpperCase(),table=match[2].toLowerCase();
 const isInsert=/^(INSERT|REPLACE)/.test(verb);
 if(isInsert){
  // Without JSON1 bounds, INSERT ... SELECT could copy an entire DB table
  // while reserving just one row. Only the existing single-owner index-meta
  // projection is bounded without json_each.
  if(/\bSELECT\b/i.test(value)&&!/json_each\s*\(/i.test(value)
    &&!(table==='music_note_catalog_member_518'
      &&/\bFROM\s+music_note_catalog_index_meta_518\b/i.test(value)
      &&/\bWHERE\s+owner_uid\s*=\s*\?/i.test(value)))return false;
  if(!/\bSELECT\b/i.test(value)&&!/\bVALUES\s*\(/i.test(value))return false;
  if(/\bVALUES\s*\([^)]*\)\s*,\s*\(/i.test(value))return false;
  return true;
 }
 // UPDATE/DELETE may affect thousands of rows; the following audited
 // per-owner/row keys must be present before charging a fixed upper bound.
 const where=value.match(/\bWHERE\b([\s\S]*)/i)?.[1]||'';
 if(!/\bowner_uid\s*=\s*\?/i.test(where))return false;
 if(table==='music_note_catalog_outbox_518')
  return /\bfavorite_id\s*=\s*\?/i.test(where);
 if(table==='music_note_catalog_index_meta_518')return true;
 if(table==='music_note_catalog_paged_stage_518')
  return /\bgeneration\s*=\s*\?/i.test(where)&&/\bmode\s*=\s*\?/i.test(where);
 if(table==='music_note_catalog_member_518')
  return /^DELETE/.test(verb)&&/\bgeneration\s*=\s*\?/i.test(where)
   &&(/favorite_id\s*=\s*\?/i.test(where)
     ||/favorite_id\s+IN\s*\(\s*SELECT\s+value\s+FROM\s+json_each\s*\(/i.test(where));
 return false;
};
const safeSql=sql=>{
 if(readOnly(sql))return 'read';
 if(mutate(sql))return 'write';
 throw new CatalogD1BudgetError518('HOLD_D1_UNMETERED_SQL');
};
// D1 rows_written counts secondary index changes too. Member has one
// generation index (base row + index = 2); outbox has a partial due index,
// whose UPDATE can remove and insert entries (base + 2 = 3).
// Unknown app518 mutation targets use 3 rows per logical change.
const billedPerRow=sql=>
 /\\bmusic_note_catalog_member_518\\b/i.test(sql)?2:3;
const quantity=(sql,args)=>{
 if(safeSql(sql)==='read')return 0;
 // In-app JSON1 bulk member INSERT/DELETE is charged by affected rows,
 // not one SQL statement. Reserve the full upper bound, including repeats.
 if(/json_each\s*\(/i.test(sql)){
  const lists=args.filter(x=>typeof x==='string'&&x.startsWith('['));
  if(!lists.length)throw new CatalogD1BudgetError518('HOLD_D1_BULK_UNMEASURED');
  let max=0;
  for(const s of lists){
   let arr;
   try{arr=JSON.parse(s)}catch{}
   if(!Array.isArray(arr))throw new CatalogD1BudgetError518('HOLD_D1_BULK_UNMEASURED');
   max+=arr.length;
  }
  return Math.max(1,max)*billedPerRow(sql);
 }
 return billedPerRow(sql);
};
export const createMeteredD1Database518=({rawDb,reserveWriteBudget,clock=()=>Date.now()}={})=>{
 if(!rawDb?.prepare||!rawDb?.batch||typeof reserveWriteBudget!=='function')
  return null;
 const reserve=async(n,purpose='normal')=>{
  if(!n)return;
  if(!Number.isSafeInteger(n)||n<0||n>2048)
   throw new CatalogD1BudgetError518('HOLD_D1_INVOCATION_WRITE_LIMIT');
  const receipt=await reserveWriteBudget({nowMs:clock(),requestedRows:n,purpose});
  if(receipt?.reserved!==true)
   throw new CatalogD1BudgetError518(receipt?.code||'HOLD_D1_GLOBAL_WRITERS_UNVERIFIED');
 };
 const wrap=(statement,sql,args=[])=>({
  __budgeted518:true,raw:statement,sql,args,
  bind(...values){return wrap(statement.bind(...values),sql,values);},
  async first(...p){
   if(safeSql(sql)!=='read')throw new CatalogD1BudgetError518('HOLD_D1_WRITE_THROUGH_READ');
   return statement.first(...p);
  },
  async all(...p){
   if(safeSql(sql)!=='read')throw new CatalogD1BudgetError518('HOLD_D1_WRITE_THROUGH_READ');
   return statement.all(...p);
  },
  async run(){
   await reserve(quantity(sql,args),
    sql.includes('APP518_DAILY_PAUSE_CONTROL_518')
     &&/^UPDATE\s+music_note_catalog_outbox_518\s+SET\s+next_attempt_ms=/i.test(clean(sql))
     ?'control':'normal');
   return statement.run();
  },
 });
 return {
  __budgeted518:true,
  prepare(sql){return wrap(rawDb.prepare(sql),sql);},
  async batch(statements){
   if(!Array.isArray(statements)||statements.some(s=>s?.__budgeted518!==true))
    throw new CatalogD1BudgetError518('HOLD_D1_UNMETERED_BATCH');
   const cost=statements.reduce((n,s)=>n+quantity(s.sql,s.args),0);
   await reserve(cost);
   return rawDb.batch(statements.map(s=>s.raw));
  },
 };
};
