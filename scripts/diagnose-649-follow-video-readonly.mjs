// One-shot user-video follow failure inspection. No user content or mutations.
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const db='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
if(process.env.GITHUB_ACTIONS!=='true'||token.length<20)throw Error('READONLY_CONTEXT_REQUIRED');
const start='2026-11-14T06:14:00Z',end='2026-11-14T06:24:00Z';
const q={
 queryId:'soridraw-follow-video-20261114-0618',
 dry:true,timeframe:{from:Date.parse(start),to:Date.parse(end)},
 view:'events',limit:100,
 parameters:{datasets:['cloudflare-workers'],
  filters:[{key:'$metadata.service',operation:'eq',type:'string',
    value:'soridraw-explore-preview'}],
  needle:{value:'/follow',isRegex:false,matchCase:false}}
};
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
 '/workers/observability/telemetry/query',{
 method:'POST',headers:{Authorization:'Bearer '+token,
  'Content-Type':'application/json'},body:JSON.stringify(q),
 signal:AbortSignal.timeout(25000)});
const payload=await response.json().catch(()=>null);
if(!response.ok||payload?.success!==true)throw Error('WORKER_LOG_READ_HTTP_'+response.status);
const events=payload.result?.events?.events||[];
const allowed=/D1_ERROR|SQLITE_ERROR|SQLITE_BUSY|UNIQUE constraint|NOT NULL constraint|CHECK constraint|FOREIGN KEY constraint|no such table|no such column|quota exceeded|rate.limit|FOLLOW_RECOVERY_BUSY|FOLLOW_ORDER_REQUIRED|FOLLOW_REVISION_CONFLICT|invalid_delta|missing_shared_profile|[45][0-9][0-9]/i;
const safe=(s)=>String(s||'').replace(/[A-Za-z0-9_-]{21,}/g,'[redacted]').replaceAll('https://','[url]').slice(0,150);
const rows=[];
for(const e of events){
 const req=e?.$workers?.event?.request||{};
 const method=String(req.method||'');
 const status=Number(e?.$workers?.event?.response?.status||0);
 const raw=String(e?.source?.message||e?.$metadata?.message||
  (typeof e?.source==='string'?e.source:'')||'');
 const time=typeof e.timestamp==='number'?new Date(e.timestamp).toISOString():'';
 const sourceMatch=raw.match(/(?:D1_ERROR|SQLITE_ERROR|SQLITE_BUSY|UNIQUE constraint failed|NOT NULL constraint failed|CHECK constraint failed|FOREIGN KEY constraint failed|no such table|no such column|FOLLOW_RECOVERY_BUSY|rate limited|quota exceeded)[^\\n]{0,100}/i);
 const errorType=sourceMatch?safe(sourceMatch[0]):'';
 rows.push({time,method,status,
  version:String(e?.$workers?.scriptVersion?.id||'').slice(0,48),
  errorType,
  outcome:String(e?.$workers?.outcome||'').slice(0,24)});
}
console.log('FOLLOW_NOV14_VIDEO_LOG_SUMMARY='+JSON.stringify({
 status:payload.result?.run?.status,total:rows.length,
 rows:rows.filter(r=>r.method==='PUT'||r.method==='DELETE'||r.status>=400)
}));
const gql=`query($accountTag:string!,$databaseId:string!){
 viewer{accounts(filter:{accountTag:$accountTag}){
  d1QueriesAdaptiveGroups(limit:1000,
   filter:{date_geq:"2026-11-14",date_leq:"2026-11-14",databaseId:$databaseId})
   {count dimensions{date datetime error query} sum{rowsWritten}}
 }}
 }`;
const gr=await fetch('https://api.cloudflare.com/client/v4/graphql',{
 method:'POST',headers:{Authorization:'Bearer '+token,
  'Content-Type':'application/json'},
 body:JSON.stringify({query:gql,variables:{accountTag:account,databaseId:db}}),
 signal:AbortSignal.timeout(25000)});
const gj=await gr.json().catch(()=>null);
if(!gr.ok||gj?.errors?.length)throw Error('D1_ANALYTICS_READ_HTTP_'+gr.status);
const groups=gj?.data?.viewer?.accounts?.[0]?.d1QueriesAdaptiveGroups||[];
const errs=groups.filter(x=>String(x.dimensions?.error||'')&&
 /follow|notification|explore_follow_overrides_348/i.test(String(x.dimensions?.query||'')));
console.log('FOLLOW_NOV14_D1_QUERY_ERRORS='+JSON.stringify(errs.map(x=>({
 at:x.dimensions?.datetime,
 error:safe(x.dimensions?.error),
 count:x.count,
 sqlKind:/INSERT INTO explore_follow_overrides_348/i.test(x.dimensions.query)?'follow_overlay_upsert':'other_follow_notification',
 rowsWritten:x.sum?.rowsWritten
})).slice(0,30)));
console.log('FOLLOW_NOV14_NO_CUSTOMER_ROWS_OR_WRITE=PASS');
