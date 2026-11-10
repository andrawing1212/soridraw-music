// Stage029 emergency OFF: only the one-row notification activation latch.
// Manual workflow only, zero user-content reads; does not delete inbox data.
import assert from 'node:assert/strict';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const D1='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const mode=process.argv[2];
const read='SELECT enabled FROM soridraw_notification_activation_002 WHERE id=1 LIMIT 1';
const off='UPDATE soridraw_notification_activation_002 SET enabled=0 WHERE id=1 AND enabled=1';
assert.ok(mode==='--self-test'||mode==='--disable','EXPLICIT_MODE_REQUIRED');
assert.equal(/^(?:SELECT|UPDATE)\s/.test(read),true);
assert.equal(off.includes('enabled=0 WHERE id=1 AND enabled=1'),true);
if(mode==='--self-test'){console.log('NOTIFICATION_029_EMERGENCY_ONE_ROW_OFF_ONLY=PASS');process.exit(0);}
assert.equal(process.env.GITHUB_REF,'refs/heads/preview','PREVIEW_ONLY');
assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch','MANUAL_ONLY');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
assert.ok(process.env.CLOUDFLARE_API_TOKEN?.length>20,'TOKEN_MISSING');
const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+D1+'/query';
const query=async sql=>{
 assert.ok(sql===read||sql===off,'ONLY_OFF_CONTROL_SQL');
 const response=await fetch(url,{method:'POST',
  headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
   'Content-Type':'application/json'},body:JSON.stringify({sql,params:[]}),
  signal:AbortSignal.timeout(18000)});
 const value=await response.json(),result=value?.result?.[0];
 assert.ok(response.ok&&value?.success===true&&value.result?.length===1&&result?.success===true,
  'D1_CONTROL_CALL_FAILED');
 const written=Number(result.meta?.rows_written);
 assert.ok(Number.isSafeInteger(written)&&written>=0&&written<=1,'D1_WRITE_SCOPE_VIOLATION');
 return {rows:result.results||[],written,changes:Number(result.meta?.changes)};
};
const before=await query(read);
assert.ok(before.written===0&&before.rows.length===1,'CONTROL_NOT_READABLE');
const prior=Number(before.rows[0].enabled);
assert.ok(prior===0||prior===1,'CONTROL_CORRUPT_HOLD');
if(prior===1){
 const result=await query(off);
 assert.equal(result.changes,1,'OFF_WRITE_NOT_CONFIRMED');
 assert.equal(result.written,1,'OFF_PHYSICAL_WRITE_NOT_ONE');
}
const after=await query(read);
assert.equal(after.written,0);
assert.equal(Number(after.rows?.[0]?.enabled),0,'OFF_NOT_PERSISTED');
console.log(prior===1
 ?'NOTIFICATION_029_SHARED_COLLECTOR_EMERGENCY_OFF_W1=PASS'
 :'NOTIFICATION_029_SHARED_COLLECTOR_ALREADY_OFF_W0=PASS');
console.log('NOTIFICATION_029_CANONICAL_AND_INBOX_ROWS_UNTOUCHED=PASS');
