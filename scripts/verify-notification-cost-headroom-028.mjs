// Stage028. Offline query-plan test; live action queries aggregate analytics only.
// No D1 SQL, user rows, mutations or deployment in --live mode.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const dbId='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const src=readFileSync('cloudflare/explore-worker/candidates/20261108_03_notification_inert_schema_release.sql','utf8');
const db=new DatabaseSync(':memory:');
db.exec(src);
const readPlan=(sql,...bind)=>db.prepare('EXPLAIN QUERY PLAN '+sql).all(...bind).map(x=>x.detail).join(' | ');
const retention='SELECT receiver_uid,bucket_ms,category,actor_uid,subject_id FROM soridraw_notification_inbox_001 WHERE created_at<? ORDER BY created_at ASC LIMIT ?';
const inbox='SELECT category,actor_uid,subject_id FROM soridraw_notification_inbox_001 WHERE receiver_uid=? AND bucket_ms>=? ORDER BY bucket_ms DESC LIMIT ?';
const old=readPlan(retention,1234,200),recipient=readPlan(inbox,'owner',0,30);
assert.match(old,/USING COVERING INDEX idx_soridraw_notification_expiry_002/);
assert.match(recipient,/USING PRIMARY KEY/);
db.exec('DROP INDEX idx_soridraw_notification_expiry_002');
const after=readPlan(retention,1234,200);
assert.match(after,/SCAN soridraw_notification_inbox_001/);
assert.match(after,/USE TEMP B-TREE FOR ORDER BY/);
db.close();
console.log('NOTIFICATION_028_RECIPIENT_PK_AND_EXPIRY_INDEX_PLANS=PASS');
console.log('NOTIFICATION_028_DROPPING_EXPIRY_INDEX_REQUIRES_GLOBAL_SCAN=PASS');
const mode=process.argv[2]||'--self-test';
if(mode==='--self-test')process.exit(0);
if(mode!=='--live')throw Error('ONLY_SELF_TEST_OR_READONLY_ANALYTICS');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
assert.ok(token.length>20,'CLOUDFLARE_TOKEN_UNAVAILABLE');
const now=new Date(),midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
const day=ms=>new Date(ms).toISOString().slice(0,10);
const from=day(midnight-7*86400000),through=day(midnight-86400000);
const query=[
 'query D1Headroom($accountTag: string!, $start: Date, $end: Date) {',
 ' viewer { accounts(filter: {accountTag: $accountTag}) {',
 '  d1AnalyticsAdaptiveGroups(limit: 10000,',
 '   filter: {date_geq: $start, date_leq: $end}, orderBy: [date_DESC]) {',
 '   dimensions {date databaseId}',
 '   sum {readQueries writeQueries rowsRead rowsWritten}',
 '  }',
 ' } }',
 '}'
].join('\n');
const response=await fetch('https://api.cloudflare.com/client/v4/graphql',{
 method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({query,variables:{accountTag:account,start:from,end:through}}),
 signal:AbortSignal.timeout(20000)
});
assert.ok(response.ok,'CLOUDFLARE_ANALYTICS_UNAVAILABLE_HTTP_'+response.status);
const payload=await response.json();
assert.ok(!payload?.errors?.length,'CLOUDFLARE_GRAPHQL_ANALYTICS_PERMISSION_OR_SCHEMA');
const accounts=payload?.data?.viewer?.accounts;
assert.ok(Array.isArray(accounts)&&accounts.length===1,'CLOUDFLARE_ACCOUNT_MISSING');
const groups=accounts[0]?.d1AnalyticsAdaptiveGroups;
assert.ok(Array.isArray(groups)&&groups.length>0&&groups.length<10000,'CLOUDFLARE_ANALYTICS_INCOMPLETE');
const database=new Map(),byDay=new Map();
let accountWrite=0,accountRead=0,sharedWrite=0,sharedRead=0;
for(const row of groups){
 const d=String(row?.dimensions?.date||''),id=String(row?.dimensions?.databaseId||'');
 assert.ok(d>=from&&d<=through&&/^[a-f0-9-]{36}$/i.test(id),'ANALYTICS_DIMENSION_DRIFT');
 const read=Number(row?.sum?.rowsRead),write=Number(row?.sum?.rowsWritten);
 assert.ok(Number.isSafeInteger(read)&&read>=0&&Number.isSafeInteger(write)&&write>=0,'ANALYTICS_ROWS_INVALID');
 accountRead+=read;accountWrite+=write;
 if(id===dbId){sharedRead+=read;sharedWrite+=write;}
 database.set(id,(database.get(id)||0)+write);
 const prior=byDay.get(d)||{rowsRead:0,rowsWritten:0};
 byDay.set(d,{rowsRead:prior.rowsRead+read,rowsWritten:prior.rowsWritten+write});
}
assert.ok(database.has(dbId),'SHARED_D1_ACCOUNT_METRICS_MISSING');
const baselineMonthly=Math.round(accountWrite*30/7);
const scenarios=[0.1,1,5].map(uniqueAlertsPerUserDay=>{
 const alerts30d=Math.round(100000*uniqueAlertsPerUserDay*30);
 const addedD1PhysicalWrites=alerts30d*2;
 return {assumedUniqueAlertsPerUserDay:uniqueAlertsPerUserDay,alerts30d,
  addedD1PhysicalWrites,
  additionalD1OverageUSDIfAllAboveAllowance:Math.round(addedD1PhysicalWrites/1e6*100)/100,
  projectedAccountWrites:baselineMonthly+addedD1PhysicalWrites,
  projectedOverageUSDWithPaidAllowance:
    Math.round(Math.max(0,baselineMonthly+addedD1PhysicalWrites-50000000)/1e6*100)/100};
});
console.log('NOTIFICATION_028_D1_RECENT_AGGREGATE='+JSON.stringify({
 from,through,databases:database.size,accountRowsRead:accountRead,
 accountRowsWritten:accountWrite,sharedRowsRead:sharedRead,sharedRowsWritten:sharedWrite,
 byDay:[...byDay].sort(([a],[b])=>a.localeCompare(b)),baselineMonthly,
 scenarios,assumption:'Workers Paid 50M rows written/month included, $1 per excess million',
 caveat:'Hypothetical unique events; historical D1 aggregates are not invoice or Worker/R2/Firebase costs.'
}));
console.log('NOTIFICATION_028_ACCOUNT_USAGE_AGGREGATES_ONLY_NO_USER_ROWS=PASS');
console.log('NOTIFICATION_028_NO_SHARED_D1_WRITES_OR_DEPLOYMENT=PASS');
