// Exact inactive candidate, never modify production data or traffic.
// All requests are invalid before any D1/R2/DO/RTDB operation.
import assert from 'node:assert/strict';
const token=process.env.CLOUDFLARE_API_TOKEN;
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music'&&token);
const name='soridraw-explore-api';
const staged='c8c528df-008c-4eba-95f9-26952dabe0bc',live='5313d378-351b-412c-b1d9-a7e6e9eb23fa';
const base='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const get=async p=>{const r=await fetch(base+p,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)});const j=await r.json();assert(r.ok&&j.success,'CF_GET_'+r.status);return j.result};
const unchanged=async()=>{const d=await get('workers/scripts/'+name+'/deployments?per_page=1');const v=d.deployments?.[0]?.versions;assert(v?.length===1&&v[0].version_id===live&&Number(v[0].percentage)===100,'LIVE_TRAFFIC_DRIFT')};
await unchanged();
const m=await get('workers/scripts/'+name+'/versions/'+staged);
assert(m.resources?.bindings?.find(x=>x.name==='RELEASE_SHARED_LIKE_SCHEDULER')?.namespace_id==='186f808d1e4c4dffb2320ff2ad737388');
const host='https://'+staged.slice(0,8)+'-'+name+'.andrawing1212.workers.dev';
const cases=[
 {name:'unauthenticated_owner_inbox',path:'/v1/me/notifications/inbox',method:'GET',origin:'https://soridraw.com',expected:[401,403]},
 {name:'wrong_origin_owner_inbox',path:'/v1/me/notifications/inbox',method:'GET',origin:'https://test.soridraw.com',expected:[403],code:'ORIGIN_FORBIDDEN'},
 {name:'invalid_manifest',path:'/v1/public-like-release-manifest-416',method:'POST',origin:'https://soridraw.com',expected:[400],code:'416_PUBLIC_MANIFEST_REQUEST_INVALID'},
 {name:'invalid_private_signature',path:'/v1/internal/private-like-handoff-416',method:'POST',origin:'https://soridraw.com',expected:[403],code:'416_PRIVATE_HANDOFF_SIGNATURE_DENIED'},
];
const results=[];
for(const c of cases){
 const r=await fetch(host+c.path,{method:c.method,redirect:'manual',headers:{Origin:c.origin,...(c.method==='POST'?{'Content-Type':'application/json'}:{})},...(c.method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(20000)});
 const body=await r.json().catch(()=>null);
 const code=body?.error?.code;
 results.push({name:c.name,status:r.status,code:typeof code==='string'&&/^[A-Za-z0-9_]+$/.test(code)?code:null,usage:{d1Read:r.headers.get('X-SORIDRAW-D1-Read'),d1Write:r.headers.get('X-SORIDRAW-D1-Write')}});
}
await unchanged();
console.log('FULL_RELEASE_INACTIVE_HTTP '+JSON.stringify(results));
const invalid=results.filter((x,i)=>!cases[i].expected.includes(x.status)||(cases[i].code&&cases[i].code!==x.code));
assert.equal(invalid.length,0,'INACTIVE_HTTP_ROUTE_OR_ACCESS_NOT_PROVEN');
console.log('FULL_RELEASE_INACTIVE_HTTP_AUTH_AND_ROUTE=PASS; NO_VALID_USER_MUTATION; LIVE_TRAFFIC_UNCHANGED');
