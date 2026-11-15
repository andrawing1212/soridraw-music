"""Complete ONLY C public-profile follower-number delivery on PREVIEW.
No edits to owner Functions, Auth data, D1/R2, TEST or PRODUCTION. The exact
shared RTDB Rules child is installed later, only after this receiver is ready.
"""
import json,os,re,subprocess,tempfile,time,zipfile,urllib.request,urllib.error
from pathlib import Path
PROJECT='soridraw-app-866a5'
LOCATION='asia-northeast3'
PARENT=f'projects/{PROJECT}/locations/{LOCATION}'
FUNCTION='publishExplorePublicFollow669'
DELETE='revokePublicFollowOnAuthDelete669'
PUBLIC_SECRET='SORIDRAW_OWNER_FOLLOW_HMAC_539'
ROOT='https://cloudfunctions.googleapis.com/v2/'
def check(value,message):
 if not value:raise RuntimeError('C_PROFILE_HOLD_'+message)
def request(token,method,url,payload=None):
 data=None if payload is None else json.dumps(payload).encode()
 try:
  req=urllib.request.Request(url,data=data,method=method,headers={
   'Authorization':'Bearer '+token,'Content-Type':'application/json'})
  with urllib.request.urlopen(req,timeout=90) as res:return json.load(res)
 except urllib.error.HTTPError as error:
  if error.code==404:return None
  raise RuntimeError('C_PROFILE_GCP_HTTP_'+str(error.code)) from None
def compiled(name,needle):
 s=(Path('functions/lib')/(name+'.js')).read_text()
 check(s.count(needle)==1,'COMPILED_ANCHOR_'+name)
 return s.replace(needle,needle.replace('false','true'))
def make_entry(base,main,files,export,code):
 target=base/'functions'
 (target/'lib').mkdir(parents=True)
 metadata=json.loads(Path('functions/package.json').read_text())
 metadata['main']='lib/'+main+'.js'
 metadata['scripts']={'gcp-build':''}
 (target/'package.json').write_text(json.dumps(metadata))
 (target/'package-lock.json').write_bytes(Path('functions/package-lock.json').read_bytes())
 for name,data in files.items():(target/'lib'/(name+'.js')).write_text(data)
 (target/'lib'/(main+'.js')).write_text(code)
 (base/'firebase.json').write_text(json.dumps({'functions':{
  'source':'functions','runtime':'nodejs22',
  'ignore':['node_modules','.git','firebase-debug.log']}}))
 return target
def write_http_zip(path):
 endpoint=compiled('explorePublicFollowEndpoint669',
   'APP669_PUBLIC_FOLLOW_ENDPOINT_COMPILED_OPEN = false')
 names=['explorePublicFollowAuthGeneration669','explorePublicFollowSignal667']
 meta=json.loads(Path('functions/package.json').read_text())
 meta.update(main='lib/publicFollowEntry674.js',scripts={'gcp-build':''})
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('package.json',json.dumps(meta))
  z.write('functions/package-lock.json','package-lock.json')
  for name in names:z.write('functions/lib/'+name+'.js','lib/'+name+'.js')
  z.writestr('lib/explorePublicFollowEndpoint669.js',endpoint)
  z.writestr('lib/publicFollowEntry674.js',
   "require('firebase-admin/app').initializeApp({projectId:'"+PROJECT+
   "',databaseURL:'https://"+PROJECT+"-default-rtdb.firebaseio.com'});\n"+
   "exports."+FUNCTION+"=require('./explorePublicFollowEndpoint669')."+FUNCTION+";\n")
  check(len(z.namelist())==6,'HTTP_ZIP_SCOPE')
 print('C_PROFILE_HTTP_COMPILED_ON_SINGLE_EXPORT=PASS')
def package_delete(base):
 files={
  'explorePublicFollowAuthGeneration669':Path('functions/lib/explorePublicFollowAuthGeneration669.js').read_text(),
  'explorePublicFollowDeletion669':compiled('explorePublicFollowDeletion669',
    'APP669_PUBLIC_FOLLOW_DELETION_HOOK_COMPILED_OPEN = false'),
 }
 check('getDatabase' in files['explorePublicFollowDeletion669'],'AUTH_DELETE_WRITER')
 entry=("require('firebase-admin/app').initializeApp({projectId:'"+PROJECT+
 "',databaseURL:'https://"+PROJECT+"-default-rtdb.firebaseio.com'});\n"+
 "exports."+DELETE+"=require('./explorePublicFollowDeletion669')."+DELETE+";\n")
 return make_entry(base,'deleteEntry',files,DELETE,entry)
def main():
 check(len(__import__('sys').argv)==2 and __import__('sys').argv[1] in
  ('--package-check','--apply'),'MODE')
 with tempfile.TemporaryDirectory(prefix='soridraw-c-profile-') as folder:
  base=Path(folder)
  delete=package_delete(base)
  archive=base/'receiver.zip'
  write_http_zip(archive)
  if __import__('sys').argv[1]=='--package-check':return
  check(os.environ.get('GITHUB_ACTIONS')=='true' and
   os.environ.get('GITHUB_REF')=='refs/heads/preview' and
   os.environ.get('APP_C_PROFILE_APPROVED_SHA')==os.environ.get('GITHUB_SHA') and
   bool(re.fullmatch('[a-f0-9]{40}',os.environ.get('GITHUB_SHA',''))),
   'PROTECTED_PREVIEW_ONLY')
  token=subprocess.run(['gcloud','auth','print-access-token'],check=True,
   capture_output=True,text=True,timeout=30).stdout.strip()
  check(len(token)>40,'NO_GCP_IDENTITY')
  current=request(token,'GET',ROOT+PARENT+'/functions/'+FUNCTION)
  check(current and current.get('state')=='ACTIVE','RECEIVER_NOT_STAGED')
  check(current.get('buildConfig',{}).get('entryPoint')==FUNCTION and
   current['buildConfig'].get('runtime')=='nodejs22','RECEIVER_CODE_DRIFT')
  config=current['serviceConfig']
  check(config.get('environmentVariables',{}).get('SORIDRAW_PUBLIC_FOLLOW_READY_669')=='0',
   'PREVIEW_RECEIVER_ALREADY_ENABLED')
  check(len(config.get('secretEnvironmentVariables',[]))==1 and
   config['secretEnvironmentVariables'][0].get('key')==PUBLIC_SECRET,
   'RECEIVER_SECRET_DRIFT')
  check(config.get('serviceAccountEmail')==
   '91309780603-compute@developer.gserviceaccount.com','RECEIVER_IDENTITY_DRIFT')
  # First install lifecycle cleanup. If unsupported, fail without enabling
  # public reads, the issuer or the HTTP receiver.
  existing_delete=request(token,'GET',
   'https://cloudfunctions.googleapis.com/v1/'+PARENT+'/functions/'+DELETE)
  check(existing_delete is None,'AUTH_DELETE_HOOK_ALREADY_EXISTS')
  os.symlink(Path('functions/node_modules').resolve(),delete/'node_modules')
  cmd=['npx','--yes','firebase-tools@14.18.0','deploy','--only',
   'functions:'+DELETE,'--project',PROJECT,'--non-interactive',
   '--config',str(base/'firebase.json')]
  run=subprocess.run(cmd,cwd=base,text=True,stdout=subprocess.PIPE,
   stderr=subprocess.STDOUT,timeout=1000)
  print('C_PROFILE_AUTH_DELETE_DEPLOY_EXIT='+str(run.returncode),flush=True)
  if run.returncode:
   print('C_PROFILE_AUTH_DELETE_ERROR='+run.stdout[-1400:].replace('\n',' '),flush=True)
  check(run.returncode==0,'DELETE_HOOK_FAILED_KEEP_RECEIVER_OFF')
  deployed_delete=request(token,'GET',
   'https://cloudfunctions.googleapis.com/v1/'+PARENT+'/functions/'+DELETE)
  check(deployed_delete and deployed_delete.get('status')=='ACTIVE',
   'DELETE_HOOK_NOT_ACTIVE')
  print('C_PROFILE_AUTH_DELETE_REVOCATION_ACTIVE=PASS',flush=True)
  # Update ONLY existing isolated receiver's source + READY env, retaining
  # all IAM, service identity, secret binding, limits and trigger metadata.
  uploaded=request(token,'POST',ROOT+PARENT+'/functions:generateUploadUrl',{})
  check(uploaded and uploaded.get('uploadUrl','').startswith('https://'),
   'UPLOAD_UNAVAILABLE')
  upload=urllib.request.Request(uploaded['uploadUrl'],data=archive.read_bytes(),
   method='PUT',headers={'Content-Type':'application/zip'})
  with urllib.request.urlopen(upload,timeout=120) as res:
   check(res.status in (200,201),'UPLOAD_FAILED')
  again=request(token,'GET',ROOT+PARENT+'/functions/'+FUNCTION)
  check(again and again.get('updateTime')==current.get('updateTime'),
   'CONCURRENT_RECEIVER_UPDATE')
  env={**config.get('environmentVariables',{}),
   'SORIDRAW_PUBLIC_FOLLOW_READY_669':'1',
   'SORIDRAW_PUBLIC_FOLLOW_SCOPE_669':'preview-only'}
  payload={'name':current['name'],
   'buildConfig':{'source':{'storageSource':uploaded['storageSource']}},
   'serviceConfig':{'environmentVariables':env}}
  op=request(token,'PATCH',ROOT+current['name']+
   '?updateMask=buildConfig.source,serviceConfig.environmentVariables',payload)
  check(op and op.get('name'),'RECEIVER_PATCH_NOT_ACCEPTED')
  deadline=time.monotonic()+900
  while not op.get('done'):
   check(time.monotonic()<deadline,'RECEIVER_UPDATE_TIMEOUT')
   time.sleep(10)
   op=request(token,'GET',ROOT+op['name'])
  check(not op.get('error'),'RECEIVER_UPDATE_FAILED')
  after=request(token,'GET',ROOT+PARENT+'/functions/'+FUNCTION)
  check(after and after.get('state')=='ACTIVE' and
   after['serviceConfig']['environmentVariables']==env and
   after['serviceConfig'].get('secretEnvironmentVariables')==
     config.get('secretEnvironmentVariables') and
   after['serviceConfig'].get('serviceAccountEmail')==
     config.get('serviceAccountEmail'),'RECEIVER_ACTIVATION_DRIFT')
  print('C_PROFILE_RECEIVER_ACTIVE_PREVIEW_ONLY=PASS',flush=True)
if __name__=='__main__':
 try:main()
 except Exception as error:
  print('C_PROFILE_FUNCTION_HOLD='+str(error)[:600],flush=True)
  raise SystemExit(2)
