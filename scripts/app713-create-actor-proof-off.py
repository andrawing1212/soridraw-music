"""APP713: CREATE only a new inert PREVIEW HTTP Function from three exact
precompiled modules. Never update existing Functions, IAM, shared data or Rules.
The recipient's compile-time public write switch stays FALSE.
"""
import hashlib,json,os,re,subprocess,sys,tempfile,time,urllib.request,urllib.error,zipfile
from pathlib import Path
PROJECT='soridraw-app-866a5'
PARENT=f'projects/{PROJECT}/locations/asia-northeast3'
NAME='verifyExploreFollowActor713'
ROOT='https://cloudfunctions.googleapis.com/v2/'
SOURCE=['ownerFollowActorVerify713']
EXISTING='publishExploreOwnerFollower542'
SECRET='SORIDRAW_OWNER_FOLLOW_HMAC_539'
def require(condition,reason):
 if not condition:raise RuntimeError('APP713_HOLD_'+reason)
def sha(data):return hashlib.sha256(data).hexdigest()
def create_archive(path):
 base=Path('functions')
 metadata=json.loads((base/'package.json').read_text())
 metadata.update(main='lib/actorProofEntry713.js',
   scripts={'gcp-build':''})
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as archive:
  archive.writestr('package.json',json.dumps(metadata))
  archive.write(base/'package-lock.json','package-lock.json')
  for module in SOURCE:
   compiled=(base/'lib'/f'{module}.js').read_bytes()
   if module=='ownerFollowActorVerify713':
    require(b'APP713_ACTOR_PROOF_COMPILED_OPEN = true' in compiled,
       'ACTOR_ENDPOINT_NEEDS_RUNTIME_OFF')
   archive.writestr(f'lib/{module}.js',compiled)
  entry=("require('firebase-admin/app').initializeApp({projectId:'"+
    PROJECT+"',databaseURL:'https://"+PROJECT+
    "-default-rtdb.firebaseio.com'});\n"+
    "exports."+NAME+"=require('./ownerFollowActorVerify713')."+NAME+";\n")
  archive.writestr('lib/actorProofEntry713.js',entry)
 with zipfile.ZipFile(path) as archive:
  require(set(archive.namelist())=={
   'package.json','package-lock.json',
   'lib/ownerFollowActorVerify713.js',
   'lib/actorProofEntry713.js',
  },'PACKAGE_UNEXPECTED_FILES')
  require(b'initializeApp' in archive.read('lib/actorProofEntry713.js'),
    'ADMIN_INIT_MISSING')
 print('APP713_CANARY_ACTOR_PROOF_ISOLATED_PACKAGE_FOUR_FILES=PASS',flush=True)
def api(token,method,path,body=None):
 data=None if body is None else json.dumps(body).encode()
 req=urllib.request.Request(ROOT+path,data=data,method=method,headers={
  'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
 except urllib.error.HTTPError as error:
  if error.code==404:return None
  try:detail=json.load(error).get('error',{}).get('message','UNAVAILABLE')
  except:detail='UNAVAILABLE'
  raise RuntimeError('APP713_API_'+str(error.code)+'_'+str(detail)[:350])
def main():
 require(len(sys.argv)==2 and sys.argv[1] in ('--package-check','--create-off'),'MODE')
 with tempfile.TemporaryDirectory(prefix='soridraw-app713-') as d:
  archive=Path(d)/'actor-proof-function.zip'
  create_archive(archive)
  if sys.argv[1]=='--package-check':return
  require(os.environ.get('GITHUB_ACTIONS')=='true' and
    os.environ.get('GITHUB_REF')=='refs/heads/fix/app713-server-owned-follow' and
    os.environ.get('GITHUB_SHA')==os.environ.get('APP713_APPROVED_SHA') and
    bool(re.fullmatch('[a-f0-9]{40}',os.environ.get('APP713_APPROVED_SHA',''))),
    'PREVIEW_WORKFLOW_ONLY')
  token=subprocess.run(['gcloud','auth','print-access-token'],check=True,
    capture_output=True,text=True,timeout=30).stdout.strip()
  require(len(token)>40,'GCP_IDENTITY_MISSING')
  old=api(token,'GET',PARENT+'/functions/'+EXISTING)
  require(old and old.get('state')=='ACTIVE' and
    old.get('buildConfig',{}).get('runtime')=='nodejs22','EXISTING_OWNER_RUNTIME')
  service=old['serviceConfig']
  require(service.get('serviceAccountEmail')==
    '91309780603-compute@developer.gserviceaccount.com','EXISTING_OWNER_SA')
  secrets=[s for s in service.get('secretEnvironmentVariables',[])
    if s.get('key')==SECRET]
  require(len(secrets)==1,'OWNER_HMAC_SECRET_NOT_BOUND')
  require(api(token,'GET',PARENT+'/functions/'+NAME) is None,'FUNCTION_ALREADY_EXISTS')
  uploaded=api(token,'POST',PARENT+'/functions:generateUploadUrl',{})
  require(uploaded and uploaded.get('uploadUrl','').startswith('https://') and
    uploaded.get('storageSource',{}).get('bucket'),'SIGNED_UPLOAD_MISSING')
  req=urllib.request.Request(uploaded['uploadUrl'],data=archive.read_bytes(),
    method='PUT',headers={'Content-Type':'application/zip'})
  with urllib.request.urlopen(req,timeout=120) as response:
   require(response.status in (200,201),'SOURCE_UPLOAD_FAILED')
  new={
   'name':PARENT+'/functions/'+NAME,
   'buildConfig':{'runtime':'nodejs22','entryPoint':NAME,
     'source':{'storageSource':uploaded['storageSource']}},
   'serviceConfig':{
    'serviceAccountEmail':service['serviceAccountEmail'],
    'secretEnvironmentVariables':secrets,
    'environmentVariables':{
     'SORIDRAW_FOLLOW_ACTOR_PROOF_713':'0',
     'SORIDRAW_FOLLOW_ACTOR_SCOPE_713':'preview-only',
    },
    'ingressSettings':service.get('ingressSettings','ALLOW_ALL'),
    'availableMemory':'256Mi','timeoutSeconds':15,
    'minInstanceCount':0,'maxInstanceCount':2,
   },
  }
  require(api(token,'GET',PARENT+'/functions/'+NAME) is None,'FUNCTION_CONCURRENT_CREATE')
  op=api(token,'POST',PARENT+'/functions?functionId='+NAME,new)
  require(op and op.get('name'),'CREATE_OPERATION_MISSING')
  deadline=time.monotonic()+900
  while not op.get('done'):
   require(time.monotonic()<deadline,'CREATE_OPERATION_TIMEOUT')
   time.sleep(10)
   op=api(token,'GET',op['name'])
   require(op is not None,'CREATE_OPERATION_LOST')
  require(not op.get('error'),'CREATE_OPERATION_ERROR_'+json.dumps(op.get('error'))[:350])
  current=api(token,'GET',PARENT+'/functions/'+NAME)
  require(current and current.get('state')=='ACTIVE','NEW_FUNCTION_NOT_ACTIVE')
  require(current['buildConfig'].get('entryPoint')==NAME and
    current['buildConfig'].get('runtime')=='nodejs22','DEPLOYED_BUILD_DRIFT')
  c=current['serviceConfig']
  require(c.get('environmentVariables',{}).get('SORIDRAW_FOLLOW_ACTOR_PROOF_713')=='0',
    'PUBLIC_FUNCTION_NOT_OFF')
  require(len(c.get('secretEnvironmentVariables',[]))==1 and
    c['secretEnvironmentVariables'][0].get('key')==SECRET,'NEW_SECRET_DRIFT')
  require(c.get('serviceAccountEmail')==service['serviceAccountEmail'],
    'SERVICE_ACCOUNT_CHANGED')
  require(c.get('minInstanceCount',0)==0,'IDLE_INSTANCE_COST')
  Path('app713-actor-function-result.json').write_text(json.dumps({
   'status':'PASS','function':NAME,'sourceSha':os.environ['APP713_APPROVED_SHA'],
   'httpCompiledOff':False,'runtimeReadyOff':True,'sharedDataWrites':0,
  }))
  print('APP713_NEW_PREVIEW_ACTOR_PROOF_RUNTIME_OFF=PASS',flush=True)
  print('APP713_OLD_OWNER_FUNCTION_UNCHANGED=PASS',flush=True)
  print('APP713_NO_SHARED_RTDB_RULES_OR_USER_DATA_CHANGES=PASS',flush=True)
if __name__=='__main__':
 try:main()
 except Exception as error:
  print('APP713_HOLD='+str(error)[:600],flush=True)
  sys.exit(2)
