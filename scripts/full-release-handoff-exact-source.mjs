// Read only pinned deployed source modules. No metadata secrets or user data.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.argv[2],token=process.env.CLOUDFLARE_API_TOKEN;
assert(root&&token&&process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='andrawing1212/soridraw-music');
const base='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/workers/workers/soridraw-explore-api/versions/';
mkdirSync(root,{recursive:true,mode:0o700});
for(const [id,name,hash] of [
 ['5313d378-351b-412c-b1d9-a7e6e9eb23fa','legacy.mjs','8b932f13cbc87652d3e4a28b757e8bc219a3d8dc484fa217857e9b150487406f'],
 ['c8c528df-008c-4eba-95f9-26952dabe0bc','shared.mjs','fb6cf9218097e731fa6a4a26216c0fc68ce8e803c1478dd32c909bb3e70665e3']
]){
 const r=await fetch(base+id+'?include=modules',{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
 const j=await r.json().catch(()=>null);assert(r.ok&&j?.success===true,'PINNED_SOURCE_HTTP_'+r.status);
 const m=j.result.modules.find(x=>x.name==='production-main.mjs');assert(m,'PINNED_MODULE_MISSING');
 const bytes=Buffer.from(m.content_base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'PINNED_SOURCE_DRIFT');
 writeFileSync(join(root,name),bytes,{mode:0o600});
}
console.log('EXACT_PINNED_PRODUCTION_AND_SHARED_CORE=PASS');
