// app518 one-shot operator read-only evidence. No deployment, SQL, storage,
// or user-data mutation. Network calls restricted to GET and analytics POST.
import assert from 'node:assert/strict';
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const API='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const GRAPH='https://api.cloudflare.com/client/v4/graphql';
const TARGETS=[
 {env:'PREVIEW',script:'soridraw-media-preview',media:'soridraw-media-preview'},
 {env:'TEST',script:'soridraw-media-test',media:'soridraw-media-test'},
 {env:'PRODUCTION',script:'soridraw-media',media:'soridraw-media'},
];
const QUERY=`query SORIDRAWAccountD1($accountTag: string!, $start: Date, $end: Date) {
 viewer { accounts(filter: {accountTag: $accountTag}) {
  d1AnalyticsAdaptiveGroups(limit: 10000,filter: {date_geq: $start,date_leq: $end},orderBy: [date_DESC]) {
   dimensions {date databaseId}
   sum {rowsWritten}
  }
 } }
}`;
const day=d=>d.toISOString().slice(0,10);
const binding=(rows,name)=>rows.filter(x=>x?.name===name);
const value=r=>r?.text??r?.value??null;
const code=e=>String(e?.message||e).replace(/[^A-Z0-9_\-]/gi,'_').slice(0,90);
const metric=n=>{if(!Number.isSafeInteger(n)||n<0)throw Error('METRIC_INVALID');return n;};
const sum=(a,b)=>metric(a+b);
export const collect518=async({request,token,at=new Date()}={})=>{
 if(typeof request!=='function'||typeof token!=='string'||token.length<8)throw Error('MISSING_READONLY_TOKEN');
 const result={timestampUtc:at.toISOString(),liveWorkers:[],
  d1:{status:'NOT_CHECKED'},security:{mutation:'NEVER_REQUESTED',
  inflightDrain:'NOT_PROVEN',rollbackAttestation:'NOT_PROVEN'},errors:[]};
 const fetchSafe=async(url,method='GET',body=null)=>{
  const worker=TARGETS.some(t=>url===`https://${t.script}.andrawing1212.workers.dev/health?read_only_probe=518`);
  const api=url.startsWith(API+'/workers/scripts/')||url.startsWith(API+'/d1/database?');
  if(!((method==='GET'&&(worker||api))||(method==='POST'&&url===GRAPH&&body?.query===QUERY)))
   throw Error('DISALLOWED_READONLY_REQUEST');
  const headers=worker?{'Cache-Control':'no-cache'}:{Authorization:'Bearer '+token,Accept:'application/json'};
  if(method==='POST')headers['Content-Type']='application/json';
  const response=await request(url,{method,headers,body:body?JSON.stringify(body):undefined,
   signal:AbortSignal.timeout(20000)});
  if(!response?.ok)throw Error('HTTP_'+String(response?.status||'FAILED'));
  const data=await response.json();
  if(!worker&&method==='GET'&&data?.success!==true)throw Error('API_UNSUCCESSFUL');
  return data;
 };
 for(const t of TARGETS){
  const out={env:t.env,status:'HOLD_UNVERIFIED',active:[],
   sharedFlag:'UNKNOWN',canonical:'UNKNOWN',fence:'UNKNOWN',
   rollback:'NOT_ATTESTED'};
  try{
   const [dep,settings,health]=await Promise.all([
    fetchSafe(`${API}/workers/scripts/${t.script}/deployments`),
    fetchSafe(`${API}/workers/scripts/${t.script}/settings`),
    fetchSafe(`https://${t.script}.andrawing1212.workers.dev/health?read_only_probe=518`),
   ]);
   const versions=dep.result?.deployments?.[0]?.versions;
   if(!Array.isArray(versions)||versions.length===0)throw Error('NO_WORKER_DEPLOYMENT');
   out.active=versions.filter(x=>Number(x.percentage)>0).map(x=>({
    versionId:String(x.version_id||''),trafficPercent:Number(x.percentage),
   }));
   const b=settings.result?.bindings;
   if(!Array.isArray(b))throw Error('MISSING_WORKER_BINDINGS');
   const media=binding(b,'MEDIA'),catalog=binding(b,'CATALOG'),
    shared=binding(b,'SORIDRAW_SHARED_CATALOG_V1');
   if(media.length!==1||catalog.length!==1||shared.length!==1)
    throw Error('AMBIGUOUS_WORKER_BINDINGS');
   out.mediaBucketMatches=(media[0].bucket_name??media[0].bucket)===t.media;
   out.catalogBucketMatches=(catalog[0].bucket_name??catalog[0].bucket)==='soridraw-user-catalog';
   out.sharedFlag=String(value(shared[0]));
   // Check all binding types, including secret_text, not plain_text alone.
   out.canonical=binding(b,'SORIDRAW_CANONICAL_CATALOG_518').length?'PRESENT':'ABSENT';
   const fence=health?.catalogWriterFence518;
   out.fence=fence?.fenceContract==='app518-music-note-fence-v1'
     &&fence.sourceInstalled===true&&fence.canonicalEnabled===false
     ?'SOURCE_MARKER_ON':'SOURCE_MARKER_MISSING_OR_ENABLED';
   out.healthMode=String(health?.catalogAuthorityMode??'UNKNOWN');
   out.status='OBSERVED_NOT_RELEASE_APPROVED';
  }catch(e){out.status='HOLD_READ_ERROR';out.errorCode=code(e);result.errors.push(t.env+':'+out.errorCode);}
  result.liveWorkers.push(out);
 }
 const end=new Date(Date.UTC(at.getUTCFullYear(),at.getUTCMonth(),at.getUTCDate()));
 const start=new Date(end.getTime()-6*86400000);
 result.d1.windowUtc={start:day(start),end:day(end),
  note:'UTC dates, current day incomplete; analytics may be sampled or delayed'};
 let known=[];
 try{
  let page=1;
  while(page<=20){
   const data=await fetchSafe(`${API}/d1/database?per_page=100&page=${page}`);
   if(!Array.isArray(data.result))throw Error('D1_LIST_INVALID');
   for(const db of data.result){
    if(typeof db.uuid!=='string'||typeof db.name!=='string')
     throw Error('D1_DATABASE_ID_INVALID');
    known.push({id:db.uuid,name:db.name});
   }
   if(data.result_info?.total_count!=null&&known.length>=data.result_info.total_count)break;
   if(data.result.length<100)break;
   page++;
  }
  if(page>20)throw Error('D1_LIST_TRUNCATED');
  if(new Set(known.map(x=>x.id)).size!==known.length)throw Error('D1_LIST_DUPLICATE');
  result.d1.databaseCount=known.length;
  result.d1.listStatus='COMPLETE';
 }catch(e){result.d1.listStatus='UNVERIFIED';result.d1.listError=code(e);
  result.errors.push('D1_LIST:'+result.d1.listError);}
 try{
  const data=await fetchSafe(GRAPH,'POST',{query:QUERY,
   variables:{accountTag:ACCOUNT,start:day(start),end:day(end)}});
  if(data.errors?.length)throw Error('GRAPHQL_SCHEMA_OR_PERMISSION');
  const accounts=data.data?.viewer?.accounts;
  if(!Array.isArray(accounts)||accounts.length!==1)
   throw Error('GRAPHQL_ACCOUNT_RESULT_INVALID');
  const groups=accounts[0]?.d1AnalyticsAdaptiveGroups;
  if(!Array.isArray(groups)||groups.length>=10000)
   throw Error('GRAPHQL_D1_GROUPS_MISSING_OR_TRUNCATED');
  const days=new Map();let total=0;
  for(const g of groups){
   const date=g.dimensions?.date, db=g.dimensions?.databaseId;
   const rows=metric(g.sum?.rowsWritten);
   if(typeof db!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)
     ||date<day(start)||date>day(end))throw Error('GRAPHQL_D1_INVALID_GROUP');
   days.set(date,sum(days.get(date)||0,rows));total=sum(total,rows);
  }
  result.d1.days=Array.from({length:7},(_,i)=>{
   const date=day(new Date(start.getTime()+i*86400000));
   return {utcDate:date,rowsWrittenObserved:days.get(date)||0,
    completeDay:date!==day(end)};
  });
  result.d1.rowsWrittenObservedTotal=total;
  result.d1.analyticsGroups=groups.length;
  result.d1.analyticsStatus='OBSERVED_NOT_EXACT_BILLING';
  result.d1.status=result.d1.listStatus==='COMPLETE'
    ?'OBSERVED_ACCOUNT_WIDE':'PARTIAL_ACCOUNT_COVERAGE';
  if(known.length){
   const seen=new Set(groups.map(x=>x.dimensions?.databaseId));
   result.d1.byDatabase=known.map(db=>({name:db.name,hasAnalytics:seen.has(db.id)}));
   result.d1.unknownAnalyticsGroups=groups.filter(x=>
    !known.some(db=>db.id===x.dimensions?.databaseId)).length;
  }
 }catch(e){result.d1.status='HOLD_ANALYTICS_UNVERIFIED';
  result.d1.analyticsError=code(e);
  result.errors.push('D1_ANALYTICS:'+result.d1.analyticsError);}
 result.verdict='READONLY_EVIDENCE_ONLY_RELEASE_HOLD';
 result.overall=result.errors.length?'PARTIAL_OR_DENIED':'OBSERVED_NEEDS_INDEPENDENT_AUDIT';
 return result;
};
const selfTest=async()=>{
 const token='DUMMY_TEST_TOKEN',calls=[];
 const request=async(url,opts)=>{
  calls.push({url,method:opts.method});
  assert.equal(opts.headers?.Authorization||'',url.includes('workers.dev')?'':'Bearer '+token);
  if(url===GRAPH)return {ok:true,json:async()=>({data:{viewer:{accounts:[
   {d1AnalyticsAdaptiveGroups:[{dimensions:{date:'2026-10-28',databaseId:'db1'},
     sum:{rowsWritten:4}}]}]}}})};
  if(url.includes('/d1/database'))return {ok:true,json:async()=>({
   success:true,result:[{uuid:'db1',name:'soridraw-explore-db'}],result_info:{total_count:1}})};
  if(url.endsWith('/deployments'))return {ok:true,json:async()=>({
   success:true,result:{deployments:[{versions:[
    {version_id:'11111111-1111-4111-8111-111111111111',percentage:100}]}]}})};
  if(url.endsWith('/settings'))return {ok:true,json:async()=>({success:true,result:{
   bindings:[{name:'MEDIA',bucket_name:TARGETS.find(t=>url.includes(t.script))?.media},
    {name:'CATALOG',bucket_name:'soridraw-user-catalog'},
    {name:'SORIDRAW_SHARED_CATALOG_V1',text:'1'}]}})};
  return {ok:true,json:async()=>({catalogAuthorityMode:'shared-catalog',
   catalogWriterFence518:{fenceContract:'app518-music-note-fence-v1',
    sourceInstalled:true,canonicalEnabled:false}})};
 };
 const snap=await collect518({request,token,at:new Date('2026-10-30T01:00:00Z')});
 assert.equal(snap.liveWorkers.length,3);
 assert.equal(snap.d1.status,'OBSERVED_ACCOUNT_WIDE');
 assert.equal(snap.d1.days.find(x=>x.utcDate==='2026-10-28').rowsWrittenObserved,4);
 assert.ok(calls.every(x=>x.method==='GET'||x.method==='POST'&&x.url===GRAPH));
 assert.ok(!JSON.stringify(snap).includes(token));
 assert.equal(snap.security.inflightDrain,'NOT_PROVEN');
 const denied=await collect518({request:async()=>({ok:false,status:403}),token,
  at:new Date('2026-10-30T01:00:00Z')});
 assert.equal(denied.overall,'PARTIAL_OR_DENIED');
 console.log('APP518_CLOUDFLARE_READONLY_REQUEST_ALLOWLIST=PASS');
 console.log('APP518_CLOUDFLARE_READONLY_SECRET_REDACTION_AND_FAIL_CLOSED=PASS');
};
if(process.argv.includes('--self-test'))await selfTest();
else if(process.argv.includes('--live')){
 const data=await collect518({request:fetch,token:process.env.CLOUDFLARE_READONLY_API_TOKEN});
 console.log('APP518_CLOUDFLARE_READONLY_RESULT_JSON='+JSON.stringify(data));
 console.log('APP518_CLOUDFLARE_READONLY_STATUS='+data.overall);
 if(data.errors.length)process.exitCode=2;
}else{console.error('Use --self-test or --live');process.exitCode=2;}
