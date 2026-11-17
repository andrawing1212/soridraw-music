"""APP713 single newly-created Firebase function flag only; no other Functions.
Director-approved PREVIEW canary, rollback OFF on any failed live check.
"""
import os,sys,json,time,subprocess,urllib.request,urllib.error
P='soridraw-app-866a5';R='asia-northeast3';N='verifyExploreFollowActor713'
F='projects/'+P+'/locations/'+R+'/functions/'+N
BASE='https://cloudfunctions.googleapis.com/v2/'
URL='https://'+R+'-'+P+'.cloudfunctions.net/'+N
def check(v,why):
 if not v:raise RuntimeError('APP713_FUNCTION_HOLD_'+why)
def token():
 s=subprocess.run(['gcloud','auth','print-access-token'],capture_output=True,text=True,timeout=30,check=True).stdout.strip()
 check(len(s)>40,'AUTH');return s
def api(method,path,body=None):
 headers={'Authorization':'Bearer '+token(),'Content-Type':'application/json'}
 payload=json.dumps(body).encode() if body is not None else None
 req=urllib.request.Request(BASE+path,data=payload,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=60) as r:return json.loads(r.read())
 except urllib.error.HTTPError as e:
  raise RuntimeError('APP713_FUNCTION_API_'+str(e.code)+'_'+e.read(300).decode(errors='ignore'))
def current():return api('GET',F)
def probe(method):
 try:
  req=urllib.request.Request(URL,method=method,data=b'{}' if method=='POST' else None,
   headers={'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=30) as r:return r.status
 except urllib.error.HTTPError as e:return e.code
def assert_envelope(fn,flag):
 c=fn.get('serviceConfig',{})
 check(fn.get('name')==F and fn.get('state')=='ACTIVE' and
   fn.get('buildConfig',{}).get('runtime')=='nodejs22','EXACT_FUNCTION')
 check(c.get('service')=='projects/'+P+'/locations/'+R+'/services/verifyexplorefollowactor713',
  'SERVICE')
 check(c.get('environmentVariables',{}).get('SORIDRAW_FOLLOW_ACTOR_PROOF_713')==flag and
   c.get('environmentVariables',{}).get('SORIDRAW_FOLLOW_ACTOR_SCOPE_713')=='preview-only',
  'RUNTIME_FLAG_OR_SCOPE')
 check(c.get('serviceAccountEmail')=='91309780603-compute@developer.gserviceaccount.com' and
   int(c.get('maxInstanceCount',0))==2 and int(c.get('minInstanceCount',0))==0,
  'ACCOUNT_OR_COST_LIMIT')
 check(len([x for x in c.get('secretEnvironmentVariables',[])
  if x.get('key')=='SORIDRAW_OWNER_FOLLOW_HMAC_539'])==1,'HMAC_SECRET')
 return c
def patch(old,to):
 original=old['serviceConfig'].get('environmentVariables',{})
 updated=dict(original);updated['SORIDRAW_FOLLOW_ACTOR_PROOF_713']=to
 op=api('PATCH',F+'?updateMask=serviceConfig.environmentVariables',
  {'name':F,'serviceConfig':{'environmentVariables':updated}})
 check(bool(op.get('name')),'PATCH_OPERATION_MISSING')
 for _ in range(70):
  if op.get('done'):break
  time.sleep(3)
  op=api('GET',op['name'])
 check(op.get('done') is True and not op.get('error'),
  'PATCH_INCOMPLETE_OR_FAILED_'+str(op.get('error',''))[:150])
 latest=current();assert_envelope(latest,to)
 check(latest.get('serviceConfig',{}).get('environmentVariables',{})==updated,
  'OTHER_ENVIRONMENT_VAR_CHANGED')
 return latest
def main(mode):
 check(os.environ.get('GITHUB_ACTIONS')=='true' and
  os.environ.get('GITHUB_REF')=='refs/heads/fix/app713-server-owned-follow' and
  os.environ.get('GITHUB_SHA')==os.environ.get('APP713_APPROVED_SHA'),
  'PINNED_WORKFLOW_ONLY')
 check(mode in ('--enable','--disable'),'MODE')
 first=current()
 prev=first.get('serviceConfig',{}).get('environmentVariables',{}).get('SORIDRAW_FOLLOW_ACTOR_PROOF_713')
 check(prev in ('0','1'),'FLAG_UNKNOWN')
 assert_envelope(first,prev)
 target='1' if mode=='--enable' else '0'
 if mode=='--enable':
  check(prev=='0','ALREADY_ENABLED_UNEXPECTED')
  check(probe('GET')==503,'EXPECTED_OFF_HANDLER')
 else:
  if prev=='0':
   check(probe('GET')==503,'DISABLED_HANDLER_UNAVAILABLE')
   print('APP713_FUNCTION_ALREADY_OFF=PASS',flush=True);return
 changed=False
 try:
  latest=patch(first,target)
  changed=True
  # The status difference proves the IAM route is available and runtime
  # is now executing our own narrow HMAC handler (no client credentials).
  actual=probe('POST' if target=='1' else 'GET')
  expected=403 if target=='1' else 503
  check(actual==expected,'UNSIGNED_HTTP_NOT_'+str(expected)+'_GOT_'+str(actual))
  if target=='1':
   check(probe('GET')==405,'ACTIVE_METHOD_GUARD')
   with open('app713-function-activated.json','w') as file:
    json.dump({'status':'PASS','function':N,'flag':'1','unsignedPOST':403,
     'noDataWrites':True,'sourceSha':os.environ['GITHUB_SHA']},file)
  print('APP713_EXACT_NEW_FUNCTION_'+('ON' if target=='1' else 'OFF')+
   '_HMAC_UNSIGNED_REJECTION=PASS',flush=True)
 except:
  if mode=='--enable':
   try:
    currentFlag=current().get('serviceConfig',{}).get('environmentVariables',{}).get('SORIDRAW_FOLLOW_ACTOR_PROOF_713')
    if currentFlag=='1':
     patch(current(),'0')
     check(probe('GET')==503,'FAILURE_ROLLBACK_STATUS')
     print('APP713_FUNCTION_ACTIVATION_FAILED_ROLLED_BACK_OFF=PASS',flush=True)
   except Exception as rollback:
    print('APP713_FUNCTION_ROLLBACK_HOLD='+str(rollback)[:250],flush=True)
  raise
if __name__=='__main__':
 try:main(sys.argv[1] if len(sys.argv)==2 else '')
 except Exception as e:
  print(str(e)[:400],flush=True);sys.exit(2)
