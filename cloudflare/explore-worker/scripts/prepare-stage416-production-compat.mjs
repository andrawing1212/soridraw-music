import {mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';

const ROOT=resolve(process.cwd());
const OUT=join(ROOT,'.remote-worker');
const NAME='soridraw-explore-api';
const ACCOUNT=String(process.env.CLOUDFLARE_ACCOUNT_ID||'').trim();
const TOKEN=String(process.env.CLOUDFLARE_API_TOKEN||'').trim();
const EXPECTED=String(process.env.STAGE416_EXPECTED_PRODUCTION_VERSION||'').trim();
if(!ACCOUNT||!TOKEN) throw new Error('Cloudflare auth missing');
const H={Authorization:'Bearer '+TOKEN,Accept:'application/json'};
const API='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
async function get(url){
 const r=await fetch(url,{headers:H});const x=await r.json();
 if(!r.ok||x?.success===false) throw new Error('CF '+r.status+' '+JSON.stringify(x).slice(0,700));
 return x.result??x;
}
const canonical={
 rate:{name:'LIKE_RATE_LIMITER',namespace_id:'91054',simple:{limit:60,period:60}},
 durable:{name:'EXPLORE_LIKE_BATCH_SCHEDULER',class_name:'ExploreLikeBatchScheduler103'},
};
const requiredNames=new Set([
 'DB','PROFILE_MEDIA','LIKE_RATE_LIMITER','EXPLORE_LIKE_BATCH_SCHEDULER',
 'EXPLORE_MIRROR_PREVIEW','EXPLORE_MIRROR_TEST','EXPLORE_MIRROR_TOKEN',
 'SORIDRAW_ENVIRONMENT','SORIDRAW_FOLLOW_AUTHORITY_LIFECYCLE_378',
 'SORIDRAW_PUBLICATION_R2_ONLY_READ_V1','SORIDRAW_R2_CATALOG_V1','SORIDRAW_R2_HYBRID_READ_V1'
]);
const allowedTypes=new Set(['d1','r2_bucket','ratelimit','durable_object_namespace','service','secret_text','plain_text']);
const main=async()=>{
 const base=API+'/workers/scripts/'+NAME;
 const ds=await get(base+'/deployments');
 const d=(ds.deployments||ds||[])[0];
 const active=[...(d?.versions||[])].sort((a,b)=>Number(b.percentage||0)-Number(a.percentage||0))[0];
 if(!active?.version_id||Number(active.percentage||0)<99.99) throw new Error('single active production version missing');
 if(EXPECTED&&String(active.version_id)!==EXPECTED) throw new Error('production active drift expected='+EXPECTED+' actual='+active.version_id);
 const v=await get(API+'/workers/workers/'+NAME+'/versions/'+active.version_id+'?include=modules');
 const modules=Array.isArray(v.modules)?v.modules:[];
 if(modules.length!==1||!modules[0]?.content_base64) throw new Error('expected one production main module');
 const source=Buffer.from(modules[0].content_base64,'base64').toString('utf8');
 const settings=await get(base+'/settings');
 const bindings=Array.isArray(settings.bindings)?settings.bindings:[];
 const names=new Set(bindings.map(x=>String(x.name||'')));
 for(const n of requiredNames) if(!names.has(n)) throw new Error('production binding missing '+n);
 const extras=bindings.filter(x=>!requiredNames.has(String(x.name||''))||!allowedTypes.has(String(x.type||'')));
 if(extras.length) throw new Error('unexpected production binding '+JSON.stringify(extras.map(x=>[x.name,x.type])));
 const byName=new Map(bindings.map(x=>[String(x.name||''),x]));
 const db=byName.get('DB');
 if(String(db?.id||db?.database_id||db?.uuid||'')!=='217ef5b1-5d80-4f7c-afc7-9e07eb05c06b') throw new Error('production DB drift');
 const media=byName.get('PROFILE_MEDIA');
 if(String(media?.bucket_name||media?.bucket||'')!=='soridraw-profile-media') throw new Error('production PROFILE_MEDIA drift');
 const rate=byName.get('LIKE_RATE_LIMITER');
 if(String(rate?.namespace_id||'')!=='91054') throw new Error('production rate namespace drift');
 const durable=byName.get('EXPLORE_LIKE_BATCH_SCHEDULER');
 if(String(durable?.class_name||canonical.durable.class_name)!==canonical.durable.class_name) throw new Error('production durable class drift');
 const vars=Object.fromEntries(bindings.filter(x=>x.type==='plain_text').map(x=>[String(x.name),String(x.text??x.value??'')]));
 if(vars.SORIDRAW_ENVIRONMENT!=='production') throw new Error('production environment var drift');
 const services=bindings.filter(x=>x.type==='service').map(x=>({binding:String(x.name),service:String(x.service||x.service_name||''),...(x.environment?{environment:String(x.environment)}:{})}));
 if(services.some(x=>!x.service)) throw new Error('production service binding unresolved');
 const config={
  name:NAME,main:'./worker.js',
  compatibility_date:String(settings.compatibility_date||'2026-08-28').slice(0,10),
  workers_dev:true,keep_vars:true,vars,
  d1_databases:[{binding:'DB',database_name:'soridraw-explore-db',database_id:'217ef5b1-5d80-4f7c-afc7-9e07eb05c06b'}],
  r2_buckets:[{binding:'PROFILE_MEDIA',bucket_name:'soridraw-profile-media'}],
  ratelimits:[canonical.rate],
  durable_objects:{bindings:[canonical.durable]},
  migrations:[{tag:'v1',new_sqlite_classes:[canonical.durable.class_name]}],
  services,
  observability:settings.observability&&typeof settings.observability==='object'
   ?{enabled:settings.observability.enabled!==false,...(typeof settings.observability.head_sampling_rate==='number'?{head_sampling_rate:settings.observability.head_sampling_rate}:{})}
   :{enabled:true}
 };
 if(Array.isArray(settings.compatibility_flags)&&settings.compatibility_flags.length) config.compatibility_flags=settings.compatibility_flags;
 rmSync(OUT,{recursive:true,force:true});mkdirSync(OUT,{recursive:true});
 writeFileSync(join(OUT,'worker.js'),source);
 writeFileSync(join(OUT,'worker.before.js'),source);
 writeFileSync(join(OUT,'wrangler.jsonc'),JSON.stringify(config,null,2)+'\n');
 writeFileSync(join(OUT,'active-version.txt'),String(active.version_id));
 console.log('STAGE416_PRODUCTION_BASE_VERSION='+active.version_id);
 console.log('STAGE416_PRODUCTION_BINDINGS_EXACT=PASS');
 console.log('STAGE416_PRODUCTION_PREPARE_READONLY=PASS');
};
main().catch(e=>{console.error(e);process.exit(1)});
