// app518 DORMANT, conservative D1 Free row-write reservation.
// Not an account billing meter: only safe when every app/env/legacy writer
// hitting the Cloudflare account has a shared, verified reservation contract.
// Legacy unmetered writers => fail closed, never assume zero other writes.
export const D1_FREE_DAILY_ROWS_518=100000;
export const D1_MAX_RESERVED_ROWS_518=80000;
// A small control-only reserve permits UTC-next-day deferrals when bulk
// indexing is already paused. Never use the extra capacity for index rows.
export const D1_CONTROL_RESERVED_ROWS_518=90000;
export const RESERVE_518=[
 'INSERT INTO music_note_catalog_daily_budget_518',
 '(day_utc,reserved_rows,updated_at_ms)',
 'SELECT ?,?,? WHERE ?<=?',
 'ON CONFLICT(day_utc) DO UPDATE SET',
 'reserved_rows=reserved_rows+excluded.reserved_rows,',
 'updated_at_ms=excluded.updated_at_ms',
 'WHERE reserved_rows+excluded.reserved_rows<=?',
].join(' ');
export const READ_BUDGET_518=[
 'SELECT reserved_rows FROM music_note_catalog_daily_budget_518',
 'WHERE day_utc=?',
].join(' ');
const day=ms=>new Date(ms).toISOString().slice(0,10);
export const reserveD1WriteRows518=async({
 db,nowMs,requestedRows,allAccountWritersVerified=false,
 sharedAccountLedgerVerified=false,dailyCap=D1_MAX_RESERVED_ROWS_518,
 purpose='normal',
}={})=>{
 if(allAccountWritersVerified!==true||sharedAccountLedgerVerified!==true)
  return {code:'HOLD_D1_GLOBAL_WRITERS_UNVERIFIED',reserved:false,d1Writes:0};
 if(!db?.prepare||!Number.isSafeInteger(nowMs)||nowMs<0
  ||!Number.isSafeInteger(requestedRows)||requestedRows<1||requestedRows>2048
  ||!['normal','control'].includes(purpose)
  ||!Number.isSafeInteger(dailyCap)||dailyCap<1
  ||dailyCap>D1_MAX_RESERVED_ROWS_518)
  return {code:'DENY_D1_BUDGET_ARGUMENTS',reserved:false,d1Writes:0};
 // Reserve *before* D1 writes. Count this reservation write, every
 // potential inserted membership row, cursor/meta and retry headroom.
 // A crash wastes a reservation but cannot silently overrun the quota.
 if(purpose==='control'&&requestedRows!==3)
  return {code:'DENY_D1_CONTROL_BUDGET_ARGUMENTS',reserved:false,d1Writes:0};
 const cap=purpose==='control'?D1_CONTROL_RESERVED_ROWS_518:dailyCap;
 const amount=requestedRows+1,utc=day(nowMs);
 if(amount>cap)return {code:'HOLD_D1_DAILY_QUOTA',reserved:false,d1Writes:0};
 try{
  const result=await db.prepare(RESERVE_518)
   .bind(utc,amount,nowMs,amount,cap,cap).run();
  if(Number(result?.meta?.changes)===1)
   return {code:'RESERVED',reserved:true,d1Writes:1,
    guaranteedRows:requestedRows,dayUtc:utc};
  if(result?.success===false)
   return {code:'RETRYABLE_D1_BUDGET_IO',reserved:false,d1Writes:0};
  return {code:'HOLD_D1_DAILY_QUOTA',reserved:false,d1Writes:0};
 }catch{
  return {code:'RETRYABLE_D1_BUDGET_IO',reserved:false,d1Writes:0};
 }
};
export const createD1BudgetGate518=({
 db,allAccountWritersVerified=false,sharedAccountLedgerVerified=false,
 dailyCap=D1_MAX_RESERVED_ROWS_518,
}={})=>({nowMs,requestedRows,purpose='normal'})=>reserveD1WriteRows518({
 db,nowMs,requestedRows,allAccountWritersVerified,
 sharedAccountLedgerVerified,dailyCap,purpose,
});
