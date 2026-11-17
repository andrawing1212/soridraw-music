// APP702: ONE named actor's PREVIEW follow-rate receipt, READ-ONLY.
// No raw UID, R2 body, object key or tokens may be logged or uploaded.
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const account='e1a30fc9ef497fda1d34f4ab3dc1da45';
const db='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b';
const token=process.env.CLOUDFLARE_API_TOKEN||'';
const fail=why=>{throw Error('APP702_HOLD_'+why)};
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/preview'||
 process.env.CLOUDFLARE_ACCOUNT_ID!==account||token.length<20)fail('CONTEXT');
const query=async(sql,params=[])=>{
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+db+'/query',{
 method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(25000)});
 const j=await r.json();
 if(!r.ok||j.success!==true||!Array.isArray(j.result))fail('D1_READ');
 return j.result[0]?.results||[];
};
const profiles=await query("SELECT uid,nickname,handle FROM public_profiles WHERE nickname IN ('Andy.j','Andy.J','andy.j','소울포스뮤직') OR handle IN ('andy.j','andyj','soulforcemusic','soulforcemusi') LIMIT 12");
const actor=profiles.filter(p=>String(p.nickname||'').toLowerCase()==='andy.j'||['andy.j','andyj'].includes(String(p.handle||'').toLowerCase()));
const target=profiles.filter(p=>p.nickname==='소울포스뮤직'||['soulforcemusic','soulforcemusi'].includes(String(p.handle||'').toLowerCase()));
console.log('APP702_ACTOR_UNIQUE='+(actor.length===1));
console.log('APP702_TARGET_UNIQUE='+(target.length===1));
if(actor.length!==1||target.length!==1)fail('AMBIGUOUS_PROFILE_IDENTITIES');
const edge=await query('SELECT following FROM explore_follow_overrides_348 WHERE follower_uid=? AND following_uid=? LIMIT 1',[actor[0].uid,target[0].uid]);
console.log('APP702_CANONICAL_PAIR_FOLLOWING='+(edge.length===1?String(edge[0].following):'NO_OVERRIDE'));
const folder=mkdtempSync(join(tmpdir(),'app702-'));
try{
 const output=join(folder,'private-follow-receipt.json');
 const key='internal/explore/abuse/preview/follow/'+encodeURIComponent(actor[0].uid)+'.json';
 const executable=resolve('cloudflare/explore-worker/node_modules/wrangler/bin/wrangler.js');
 if(!existsSync(executable))fail('WRANGLER_NOT_INSTALLED');
 try{
   execFileSync(process.execPath,[executable,'r2','object','get','soridraw-profile-media/'+key,'--remote','--file',output],
   {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 }catch {console.log('APP702_R2_RECEIPT=UNAVAILABLE_OR_MISSING');fail('R2_READ');}
 if(!existsSync(output))fail('NO_OUTPUT');
 let record;try{record=JSON.parse(readFileSync(output,'utf8'));}catch{fail('RECEIPT_JSON_INVALID')}
 const now=Date.now();
 const ints=(n)=>Number.isSafeInteger(n)&&n>=0&&n<=now;
 const old=[30000,120000,600000,3600000],current=[0,0,0,30000];
 const problems=[];
 if(record?.schemaVersion!==380)problems.push('SCHEMA');
 for(const field of ['events','pairs','operations'])if(!Array.isArray(record?.[field]))problems.push('MISSING_'+field.toUpperCase());
 const events=Array.isArray(record.events)?record.events:[];
 const pairs=Array.isArray(record.pairs)?record.pairs:[];
 const ops=Array.isArray(record.operations)?record.operations:[];
 if(events.length>120||events.some(n=>!ints(n)))problems.push('EVENTS');
 if(ops.length>120||ops.some(o=>!o||!ints(o.at)||typeof o.target!=='string'||typeof o.desired!=='boolean'||typeof o.operationId!=='string'))problems.push('OPERATIONS');
 if(pairs.length>120||pairs.some(p=>!p||!ints(p.at)||p.level<0||p.level>3||!Number.isSafeInteger(p.level)||!Number.isSafeInteger(p.nextAllowedAt)||p.nextAllowedAt<0))problems.push('PAIRS');
 const badReceipt=pairs.filter(p=>Number.isSafeInteger(p?.level)&&Number.isSafeInteger(p?.at)&&
 p.nextAllowedAt!==p.at+old[p.level]&&p.nextAllowedAt!==p.at+current[p.level]);
 const legacy=pairs.filter(p=>Number.isSafeInteger(p?.level)&&Number.isSafeInteger(p?.at)&&p.nextAllowedAt===p.at+old[p.level]);
 const newer=pairs.filter(p=>Number.isSafeInteger(p?.level)&&Number.isSafeInteger(p?.at)&&p.nextAllowedAt===p.at+current[p.level]);
 const specific=pairs.filter(p=>p?.target===target[0].uid);
 console.log('APP702_RECEIPT_EXISTS=TRUE');
 console.log('APP702_SCHEMA_VER='+String(record?.schemaVersion));
 console.log('APP702_EVENTS_COUNT='+events.length);
 console.log('APP702_PAIRS_COUNT='+pairs.length);
 console.log('APP702_OPERATIONS_COUNT='+ops.length);
 console.log('APP702_LEGACY_PAIR_COUNT='+legacy.length);
 console.log('APP702_NEW_POLICY_PAIR_COUNT='+newer.length);
 console.log('APP702_INVALID_COOLDOWN_PAIR_COUNT='+badReceipt.length);
 console.log('APP702_TARGET_PAIR_ENTRIES='+specific.length);
 console.log('APP702_TARGET_PAIR_LEVEL='+(specific.length===1?specific[0].level:'OTHER'));
 console.log('APP702_TARGET_PAIR_OVERDUE='+(specific.length===1?Number(specific[0].nextAllowedAt)<=now:'UNKNOWN'));
 console.log('APP702_STRUCTURAL_ISSUES='+(problems.length?problems.join(','):'NONE'));
 // The older independent APP355 per-actor limiter can also reject DELETE with
 // 503, even when APP380's separate receipt is entirely valid. GET only.
 const second=join(folder,'private-edge-rate.json');
 const rateKey='internal/explore/follow-rate-v355/'+encodeURIComponent(actor[0].uid)+'.json';
 try {
   execFileSync(process.execPath,[executable,'r2','object','get','soridraw-profile-media/'+rateKey,'--remote','--file',second],
   {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 } catch {
   console.log('APP702_SECONDARY_RATE_RECORD=NOT_READABLE_OR_ABSENT');
 }
 if(existsSync(second)){
   let rate;try{rate=JSON.parse(readFileSync(second,'utf8'));}catch{rate=null}
   console.log('APP702_SECONDARY_RATE_RECORD=EXISTS');
   console.log('APP702_SECONDARY_RATE_JSON_VALID='+Boolean(rate&&typeof rate==='object'&&!Array.isArray(rate)));
   console.log('APP702_SECONDARY_RATE_WINDOW_INTEGER='+Number.isSafeInteger(rate?.windowStart));
   console.log('APP702_SECONDARY_RATE_WINDOW_IN_FUTURE='+(Number.isSafeInteger(rate?.windowStart)?rate.windowStart>now:'UNKNOWN'));
   console.log('APP702_SECONDARY_RATE_WINDOW_AGE_SECONDS='+(Number.isSafeInteger(rate?.windowStart)?Math.floor((now-rate.windowStart)/1000):'UNKNOWN'));
   console.log('APP702_SECONDARY_RATE_COUNT_INTEGER='+Number.isSafeInteger(rate?.count));
   console.log('APP702_SECONDARY_RATE_COUNT_RANGE='+(
     Number.isSafeInteger(rate?.count)&&rate.count>=0&&rate.count<=1000?'OK':'INVALID_OR_UNKNOWN'));
   console.log('APP702_SECONDARY_RATE_KEYS='+Object.keys(rate||{}).sort().join(','));
 }
 // Full structural predicates used by the active APP380 handler.
 const idOk=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{16,128}$/.test(v);
 const targetOk=v=>typeof v==='string'&&v.length>0&&v.length<=512;
 const eventOk=v=>Number.isSafeInteger(v)&&v>=0&&v<=now;
 const opOk=o=>o&&targetOk(o.target)&&typeof o.desired==='boolean'&&
   idOk(o.operationId)&&eventOk(o.at);
 const pairOk=p=>opOk(p)&&Number.isSafeInteger(p.level)&&p.level>=0&&p.level<=3&&
   Number.isSafeInteger(p.nextAllowedAt)&&p.nextAllowedAt>=0&&
   (p.nextAllowedAt===p.at+old[p.level]||p.nextAllowedAt===p.at+current[p.level]);
 const report={
  schema:record.schemaVersion===380,
  eventLength:events.length<=120,
  eventShape:events.every(eventOk),
  operationLength:ops.length<=120,
  operationShape:ops.every(opOk),
  pairLength:pairs.length<=120,
  pairShape:pairs.every(pairOk),
  uniquePairs:new Set(pairs.map(p=>p.target)).size===pairs.length,
 };
 console.log('APP702_EXACT_380_CHECKS='+Object.entries(report).map(([k,v])=>k+':'+(v?'PASS':'FAIL')).join(','));
 // APP703: an exact pair's durable follow-intent may remain unresolved
 // even when rate receipts and canonical edge are healthy. No raw data/logging.
 const controls=await query('SELECT cutover_token,phase FROM explore_follow_cutover_control_348 WHERE id=1 LIMIT 1');
 if(controls.length!==1||controls[0].phase!=='overlay'||typeof controls[0].cutover_token!=='string'||!controls[0].cutover_token)fail('CUTOVER_TOKEN_NOT_AVAILABLE');
 const intent=join(folder,'exact-follow-intent.json');
 const intentKey='internal/explore/follow-intents-v354/'+encodeURIComponent(controls[0].cutover_token)+'/'+encodeURIComponent(actor[0].uid)+'/'+encodeURIComponent(target[0].uid)+'.json';
 let intentResult='NOT_FOUND_OR_READ_ERROR';
 try{
   execFileSync(process.execPath,[executable,'r2','object','get','soridraw-profile-media/'+intentKey,'--remote','--file',intent],
   {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
   intentResult='DOWNLOADED';
 }catch{}
 console.log('APP703_EXACT_PAIR_R2_DOWNLOAD='+intentResult);
 if(intentResult==='DOWNLOADED'&&existsSync(intent)){
   let detail;try{detail=JSON.parse(readFileSync(intent,'utf8'));}catch{detail=null}
   console.log('APP703_EXACT_PAIR_JSON_VALID='+Boolean(detail&&typeof detail==='object'&&!Array.isArray(detail)));
   if(detail&&typeof detail==='object'){
     console.log('APP703_EXACT_PAIR_SETTLED='+String(detail.settled===true?'TRUE':detail.settled===false?'FALSE':'UNKNOWN'));
     console.log('APP703_EXACT_PAIR_FOLLOWING='+String(detail.following===true?'TRUE':detail.following===false?'FALSE':'UNKNOWN'));
     console.log('APP703_EXACT_PAIR_REVISION_VALID='+(Number.isSafeInteger(detail.revision)&&detail.revision>0));
     console.log('APP703_EXACT_PAIR_EXPECTED_REVISION_VALID='+(Number.isSafeInteger(detail.expectedRevision)&&detail.expectedRevision>=0));
     console.log('APP703_EXACT_PAIR_ACTOR_MATCH='+(detail.actor===actor[0].uid));
     console.log('APP703_EXACT_PAIR_TARGET_MATCH='+(detail.target===target[0].uid));
     console.log('APP703_EXACT_PAIR_HAS_OPERATION_ID='+(typeof detail.id==='string'&&detail.id.length>=16));
     console.log('APP703_EXACT_PAIR_FIELDS='+Object.keys(detail).sort().join(','));
   }
 }
 console.log('APP702_READONLY_NO_BACKUP_WRITE_NO_MUTATION=PASS');
}finally{rmSync(folder,{recursive:true,force:true});}
