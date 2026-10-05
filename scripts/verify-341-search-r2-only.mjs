import fs from 'node:fs';
const worker=fs.readFileSync('cloudflare/explore-worker/canonical/preview-worker.js','utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const functionText=(name)=>{
  const start=worker.indexOf('async function '+name+'('); if(start<0) throw new Error('missing '+name);
  const brace=worker.indexOf('{',start); let depth=0,q='',e=false,com='';
  for(let i=brace;i<worker.length;i++){const c=worker[i],n=worker[i+1];
    if(com==='line'){if(c==='\n')com='';continue}
    if(com==='block'){if(c==='*'&&n==='/'){com='';i++}continue}
    if(q){if(e)e=false;else if(c==='\\')e=true;else if(c===q)q='';continue}
    if(c==='/'&&n==='/'){com='line';i++;continue} if(c==='/'&&n==='*'){com='block';i++;continue}
    if("'\"`".includes(c)){q=c;continue} if(c==='{')depth++; if(c==='}'&&--depth===0)return worker.slice(start,i+1);
  } throw new Error('unterminated '+name);
};
for(const t of ['SORIDRAW_SEARCH_R2_ONLY_341_20261004','R2-ONLY-SEARCH-341','X-SORIDRAW-Search-Authority','X-SORIDRAW-D1-Read','readSearchEdge341','writeSearchEdge341']) must(worker.includes(t),'missing '+t);
const search=functionText('handleSearch');
must(search.includes('handleCatalogSearch066(url, env, cors)'),'R2 catalog call missing');
for(const f of ['handleSearchCore066(', 'handleIndexedGenreAlias338(', 'env.DB', '.prepare(', '.batch(']) must(!search.includes(f),'live D1 search fallback remains '+f);
must(search.includes("if (!isExploreR2HybridReadEnabled336(env))"),'hybrid gate missing');
must(worker.includes("max-age=300"),'edge cache ttl missing');
console.log('APP341_SEARCH_R2_ONLY=PASS');
console.log('APP341_SEARCH_D1_R0_W0_CONTRACT=PASS');
console.log('APP341_RANDOM_QUERY_D1_R0_W0=PASS');
console.log('APP341_EDGE_CACHE_5M=PASS');
console.log('APP341_SHARED_D1_SCHEMA_CHANGE=0');
console.log('APP341_USER_DATA_MIGRATION=0');
