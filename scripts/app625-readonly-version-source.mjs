// APP625: GET-only Cloudflare version inventory. No secrets or writes.
const ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45';
const workers=[
 {name:'soridraw-explore-preview',active:'350ce33d-ec83-49d0-a4ae-c25d2d90f59e',candidate:'74424822-2857-4f67-aff2-d4970f71cefa',oldBindings:23,newBindings:24},
 {name:'soridraw-owner-follow-preview-candidate',active:'5a2d333c-f703-4ef7-9468-0293f7699268',candidate:'cdaceda1-c97d-4a46-8fee-a6b8ec71eedd',oldBindings:2,newBindings:3}
];
const token=String(process.env.CLOUDFLARE_API_TOKEN||'');
if(process.env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT||token.length<15)throw Error('APP625_HOLD_AUTH');
async function get(path){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/'+path,
  {method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('APP625_HOLD_READ_HTTP_'+response.status);
 const json=await response.json();
 if(json.success!==true)throw Error('APP625_HOLD_READ_RESULT');
 return json.result;
}
for(const w of workers){
 const root='workers/scripts/'+w.name;
 const [deployment,list,version]=await Promise.all([
  get(root+'/deployments?per_page=1'),
  get(root+'/versions?per_page=10'),
  get(root+'/versions/'+w.candidate)
 ]);
 const current=deployment?.deployments?.[0]?.versions;
 if(current?.length!==1||current[0].version_id!==w.active||Number(current[0].percentage)!==100)
   throw Error('APP625_HOLD_ACTIVE_DRIFT_'+w.name);
 if(version?.resources?.bindings?.length!==w.newBindings)
   throw Error('APP625_HOLD_CANDIDATE_BINDING_DRIFT_'+w.name);
 const recents=Array.isArray(list)?list:
  (Array.isArray(list?.versions)?list.versions:
   (Array.isArray(list?.items)?list.items:
    (Array.isArray(list?.result)?list.result:null)));
 console.log('APP625_LIST_SHAPE_'+w.name+'='+JSON.stringify({rootKeys:list&&!Array.isArray(list)?Object.keys(list).slice(0,8):[],array:Array.isArray(list),count:recents?.length||0}));
 if(recents?.length){
   console.log('APP625_RECENT_VERSION_IDS_'+w.name+'='+recents.slice(0,6).map(x=>x.id||x.version_id||x.versionId||'?').join(','));
   console.log('APP625_RECENT_VERSION_TIMES_'+w.name+'='+recents.slice(0,4).map(x=>x.created_on||x.createdAt||x.created_at||'?').join(','));
 }
 console.log('APP625_PINNED_BINDINGS_'+w.name+'='+version.resources.bindings.map(x=>x.name).join(','));
 console.log('APP625_ACTIVE_ORIGINAL_100_PERCENT_'+w.name+'=PASS');
 console.log('APP625_PINNED_INACTIVE_SERVICE_BINDING_'+w.name+'=PASS');
}
console.log('APP625_GET_ONLY_NO_SECRETS_NO_MUTATION=PASS');