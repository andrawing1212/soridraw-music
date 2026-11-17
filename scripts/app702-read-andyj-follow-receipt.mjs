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
 console.log('APP702_READONLY_NO_BACKUP_WRITE_NO_MUTATION=PASS');
}finally{rmSync(folder,{recursive:true,force:true});}
