// One bounded read-only comparison of the exact active release, not a new
// per-feature development project. Never fetch user data or credential values.
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const cf='https://api.cloudflare.com/client/v4/accounts/e1a30fc9ef497fda1d34f4ab3dc1da45/';
const gcp='https://cloudfunctions.googleapis.com/v2/projects/soridraw-app-866a5/locations/asia-northeast3/functions/';
const hosting='https://firebasehosting.googleapis.com/v1beta1/';
const pins={
 'soridraw-explore-preview':'cfd40718-6ab5-4133-bdb2-fa69332d6810',
 'soridraw-explore-api':'5313d378-351b-412c-b1d9-a7e6e9eb23fa',
 'soridraw-media-preview':'eca146eb-d50a-44b9-bab3-12fead33fb59',
 'soridraw-media':'41b74bf4-812b-4088-878d-f1b24a207869',
 'soridraw-owner-follow-preview-candidate':'c71d7c12-ace4-4405-ab1a-d8c651c90559'
};
const sha=x=>createHash('sha256').update(x).digest('hex');
const safe=x=>String(x||'').slice(0,160);
const get=async(url,token,optional=false)=>{
 const res=await fetch(url,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
 if(optional&&res.status===404)return null;
 if(!res.ok)throw Error('READ_ONLY_GET_'+new URL(url).hostname+'_'+res.status);
 const j=await res.json();
 if(j.success===false)throw Error('PROVIDER_GET_FAILED');
 return j.result??j;
};
const ct=process.env.CLOUDFLARE_API_TOKEN,ft=process.env.FIREBASE_ACCESS_TOKEN;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='andrawing1212/soridraw-music'||!ct||!ft)throw Error('SCOPE');
const fetchWorker=async([name,id])=>{
 const d=await get(cf+'workers/scripts/'+name+'/deployments?per_page=1',ct);
 const v=d.deployments?.[0]?.versions?.filter(x=>Number(x.percentage)>0);
 if(v?.length!==1||v[0].version_id!==id||Number(v[0].percentage)!==100)throw Error('VERSION_DRIFT_'+name);
 const [meta,body]=await Promise.all([get(cf+'workers/scripts/'+name+'/versions/'+id,ct),get(cf+'workers/workers/'+name+'/versions/'+id+'?include=modules',ct)]);
 const rows=meta.resources?.bindings,mods=body.modules;
 if(!Array.isArray(rows)||!Array.isArray(mods)||!mods.length)throw Error('NO_PINNED_SOURCE_'+name);
 const source=mods.map(m=>({name:m.name,content:Buffer.from(m.content_base64,'base64').toString('utf8')}));
 return {name,id,rows,source,runtime:meta.resources?.script_runtime};
};


// Probe only the already deployed shared publication receiver; the signed
// malformed body has no UID, track, timestamp, or legal mutation.
import {createHmac} from 'node:crypto';
const secretPath='https://secretmanager.googleapis.com/v1/projects/soridraw-app-866a5/secrets/SORIDRAW_PRIVATE_BATCH416_HMAC_SECRET';
const perms=await fetch(secretPath+':testIamPermissions',{method:'POST',headers:{Authorization:'Bearer '+ft,'Content-Type':'application/json'},body:JSON.stringify({permissions:['secretmanager.versions.access']})});
if(!perms.ok)throw Error('EXISTING_SECRET_PERMISSION_CHECK_'+perms.status);
const available=(await perms.json()).permissions?.includes('secretmanager.versions.access')===true;
if(!available){console.log('FULL_RELEASE_EXISTING_SECRET_ACCESS=HOLD;USER_WRITES=0');process.exit(2)}
const item=await get(secretPath+'/versions/1:access',ft);
const key=Buffer.from(item?.payload?.data||'','base64');
if(key.length<32)throw Error('EXISTING_SECRET_INVALID');
const raw='{}',endpoint='https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publicationRelease431Candidate';
const sign=createHmac('sha256',key).update(raw).digest('hex');
const call=async signature=>{const response=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Soridraw-431-Publication-Signature':signature},body:raw,signal:AbortSignal.timeout(20000)});return {status:response.status,code:(await response.json().catch(()=>null))?.error?.code}};
const denied=await call('0'.repeat(64)),valid=await call(sign);
key.fill(0);
if(denied.status!==403||valid.status!==400||!String(valid.code).includes('BAD_CLAIM'))throw Error('EXISTING_PUBLICATION_RECEIVER_PROOF_'+denied.status+'_'+valid.status);
console.log('FULL_RELEASE_EXISTING_PUBLICATION_RECEIVER_AUTH=PASS; INVALID_SIGNATURE=403; SIGNED_INVALID_CLAIM=400; USER_WRITES=0; SECRET_ROTATION=0');
