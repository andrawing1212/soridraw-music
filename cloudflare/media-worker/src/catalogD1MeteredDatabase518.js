// app518 DORMANT: every candidate D1 mutation passes the same account-wide
// reservation before reaching D1, whether first-index, outbox, ACK, retry,
// compacted-index replay or direct SQL batch. No page-entry/GET writes.
// A release MUST prove that other databases, Workers and legacy writers are
// reserved in this very same account ledger. Local VERIFIED flags alone do
// not provide that proof; the release remains OFF pending external audit.
export class CatalogD1BudgetError518 extends Error {
 constructor(code){super(code);this.code=code;this.name='CatalogD1BudgetError518';}
}
const mutation=sql=>/^(?:\s*\/\*[^]*?\*\/\s*)*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
const quantity=(sql,args)=>{
 if(!mutation(sql))return 0;
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
  return Math.max(1,max);
 }
 return 1;
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
  first:(...p)=>statement.first(...p),
  all:(...p)=>statement.all(...p),
  async run(){
   await reserve(quantity(sql,args),
    sql.includes('APP518_DAILY_PAUSE_CONTROL_518')?'control':'normal');
   return statement.run();
  },
 });
 return {
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
