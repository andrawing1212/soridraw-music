// SORIDRAW cost-first D1 analytics. READ-ONLY GraphQL; NO SQL, no D1 queries,
// no Worker/Hosting deploy, no user IDs, no user data and no billing mutations.
// Based on https://developers.cloudflare.com/d1/observability/metrics-analytics/
// The reported costs are ESTIMATES of the D1 overage only, never a real invoice.
const account = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const token = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
const targetDb = String(process.env.SORIDRAW_SHARED_D1_DATABASE_ID ||
  '217ef5b1-5d80-4f7c-afc7-9e07eb05c06b').trim();
if (!/^[a-f0-9]{32}$/.test(account) || !token ||
    !/^[a-f0-9-]{36}$/.test(targetDb)) {
  throw new Error('D1_COST_READONLY_CREDENTIALS_OR_SHARED_DATABASE_ID_MISSING');
}
const days = Number(process.env.SORIDRAW_D1_COST_DAYS || 7);
if (!Number.isSafeInteger(days) || days < 1 || days > 30) {
  throw new Error('D1_COST_DAYS_MUST_BE_1_TO_30');
}
const utcDate = date => date.toISOString().slice(0, 10);
const end = new Date();
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - days + 1);
const query = `query D1CostReadOnly($accountTag: string!, $start: Date, $end: Date) {
 viewer {
  accounts(filter: { accountTag: $accountTag }) {
   d1AnalyticsAdaptiveGroups(
    limit: 10000, filter: { date_geq: $start, date_leq: $end },
    orderBy: [date_DESC]) {
    dimensions { date databaseId }
    sum { rowsRead rowsWritten readQueries writeQueries }
   }
  }
 }
}`;
const response = await fetch('https://api.cloudflare.com/client/v4/graphql',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({query,variables:{accountTag:account,
    start:utcDate(start),end:utcDate(end)}}),
});
if(!response.ok) throw new Error('D1_COST_READONLY_GRAPHQL_HTTP_'+response.status);
const payload=await response.json();
if(payload?.errors?.length || !Array.isArray(payload?.data?.viewer?.accounts) ||
  payload.data.viewer.accounts.length!==1) {
  throw new Error('D1_COST_READONLY_GRAPHQL_UNAVAILABLE_OR_NO_ANALYTICS_PERMISSION');
}
const rows=payload.data.viewer.accounts[0].d1AnalyticsAdaptiveGroups;
if(!Array.isArray(rows))throw new Error('D1_COST_METRICS_DATASET_UNAVAILABLE');
const safeCount=value=>{
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<0)throw new Error('D1_COST_INVALID_NONNEGATIVE_COUNTER');
  return n;
};
const accum=()=>({rowsRead:0,rowsWritten:0,readQueries:0,writeQueries:0});
const plus=(o,v)=>{for(const k of Object.keys(o)){
  const x=safeCount(v?.[k]??0);
  if(!Number.isSafeInteger(o[k]+x))throw new Error('D1_COST_COUNTER_OVERFLOW');
  o[k]+=x;
}};
const all=accum(),shared=accum();
for(const item of rows){
  plus(all,item?.sum);
  if(item?.dimensions?.databaseId===targetDb)plus(shared,item.sum);
}
// D1 paid-plan monthly allowance applies ACCOUNT-WIDE to all D1 databases,
// not once per database. A 7-day run-rate is not an invoice or a peak bound.
const forecast30=counter=>Math.round(counter / days * 30);
const estimateOverage30=counts=>{
  const read=forecast30(counts.rowsRead),written=forecast30(counts.rowsWritten);
  return {rowsRead:read,rowsWritten:written,
    d1RowsReadOverageUSD:Math.max(0,read-25_000_000_000)/1_000_000*0.001,
    d1RowsWrittenOverageUSD:Math.max(0,written-50_000_000)/1_000_000};
};
const result={kind:'SORIDRAW_D1_USAGE_READONLY',source:'Cloudflare GraphQL Analytics',
  coverage:{start:utcDate(start),end:utcDate(end),days,
    note:'Daily UTC buckets, partial current day possible; last 31 days only'},
  sharedDatabase:shared,allAccountDatabases:all,
  estimated30DayAccountOverage:estimateOverage30(all),
  estimated30DaySharedUsage:estimateOverage30(shared),
  disclaimer:'Forecast, NOT actual Cloudflare billing. D1 only; excludes Workers, R2, Durable Objects, Firebase and subscription. Free plan uses DAILY limits.'};
console.log(JSON.stringify(result,null,2));
console.log('D1_COST_GRAPHQL_READONLY=PASS; SHARED_D1_SQL_QUERIES=0; DATA_WRITES=0; DEPLOY=0');
