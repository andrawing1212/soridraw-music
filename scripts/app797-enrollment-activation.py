# APP797: exact existing enrollment callable only. No new function/IAM/rules.
# PREVIEW's existing source and runtime preserved; patch the two compiled
# origin gates from the current deployed archive, not the whole codebase.
import os,sys,json,subprocess,urllib.request,urllib.error,zipfile,re,time,hashlib
from pathlib import Path
ROOT='https://cloudfunctions.googleapis.com/v2/'
PROJECT='soridraw-app-866a5'
PARENT='projects/'+PROJECT+'/locations/asia-northeast3'
NAME=PARENT+'/functions/enrollOwnerFollow544Candidate'
FLAG='SORIDRAW_OWNER_FOLLOW_PRODUCTION_ENROLL_797'
DIR=Path(os.environ['RUNNER_TEMP'])/'app797-function'
def need(x,m):
 if not x: raise RuntimeError('APP797_ENROLL_HOLD_'+m)
def api(method,url,body=None):
 token=subprocess.run(['gcloud','auth','print-access-token'],check=True,capture_output=True,text=True).stdout.strip()
 req=urllib.request.Request(url,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},data=json.dumps(body).encode() if body is not None else None)
 try:
  with urllib.request.urlopen(req,timeout=60) as f:return json.load(f)
 except urllib.error.HTTPError as e:raise RuntimeError('APP797_ENROLL_HTTP_'+method+'_'+str(e.code)) from None
def read():return api('GET',ROOT+NAME)
def check_current(f):
 e=f.get('serviceConfig',{}).get('environmentVariables',{})
 need(f.get('name')==NAME and f.get('state')=='ACTIVE','EXACT_ACTIVE_FUNCTION')
 need(f['buildConfig'].get('entryPoint')=='enrollOwnerFollow544Candidate' and f['buildConfig'].get('runtime')=='nodejs22','RUNTIME')
 need(e.get('SORIDRAW_OWNER_FOLLOW_READY_608')=='1' and e.get('SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653')=='1' and e.get('SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653')=='preview-only' and FLAG not in e,'CURRENT_SCOPE')
 need(any(x.get('key')=='SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544' for x in f['serviceConfig'].get('secretEnvironmentVariables',[])),'EXISTING_HMAC')
def replace_once(s,a,b):
 need(s.count(a)==1,'COMPILED_ANCHOR')
 return s.replace(a,b)
def preflight():
 DIR.mkdir(mode=0o700,exist_ok=False)
 f=read();check_current(f)
 # Check the permission on the exact existing callable before any worker changes.
 perms=api('POST',ROOT+NAME+':testIamPermissions',{'permissions':['cloudfunctions.functions.get','cloudfunctions.functions.update']})
 need('cloudfunctions.functions.update' in perms.get('permissions',[]),'FUNCTION_UPDATE_PERMISSION')
 source=f['buildConfig']['source']['storageSource']
 need(source.get('bucket') and source.get('object') and source.get('generation'),'ROLLBACK_SOURCE_PIN')
 uri='gs://'+source['bucket']+'/'+source['object']+'#'+str(source['generation'])
 p=subprocess.run(['gcloud','storage','cp',uri,str(DIR/'old.zip'),'--quiet'],capture_output=True,text=True,timeout=90)
 need(p.returncode==0,'EXACT_DEPLOYED_SOURCE_READ')
 with zipfile.ZipFile(DIR/'old.zip') as z:
  files={n:z.read(n) for n in z.namelist() if not n.endswith('/')}
 need(set(files)=={'package.json','package-lock.json','lib/ownerFollowRelease660.js','lib/ownerFollowScope653.js','lib/ownerFollowEnrollment544.js','lib/ownerFollowLifecycle534.js','lib/ownerFollowAuthProof547.js','lib/exploreOwnerFollowerWebhook542.js'},'SOURCE_LAYOUT')
 scope='lib/ownerFollowScope653.js';enroll='lib/ownerFollowEnrollment544.js'
 a=files[scope].decode();c=files[enroll].decode()
 need('exports.APP544_ENROLLMENT_COMPILED_OPEN = true;' in c and 'enforceAppCheck: true' in c,'LIVE_ENROLLMENT_AUTH')
 need("https://soridraw-explore-preview.andrawing1212.workers.dev/internal/owner-follow/epoch-544" in c,'SHARED_EPOCH_TARGET')
 # TypeScript output may lower optional chaining into a temporary variable.
 # Locate the single existing general-origin denial and balance its condition,
 # preserving every byte of the old predicate, Auth and AppCheck checks.
 matches=list(re.finditer(r'\bif\s*\(\s*scope\.general\s*&&',c))
 need(len(matches)==1,'GENERAL_ORIGIN_CONDITION')
 start=c.index('(',matches[0].start());depth=0;end=None;quote=None;escape=False
 for i in range(start,len(c)):
  ch=c[i]
  if quote:
   if escape:escape=False
   elif ch=='\\':escape=True
   elif ch==quote:quote=None
  elif ch in ('"',"'"):quote=ch
  elif ch=='(':depth+=1
  elif ch==')':
   depth-=1
   if depth==0:end=i;break
 need(end is not None,'ORIGIN_CONDITION_BALANCE')
 condition=c[start+1:end]
 need('isPreviewOwnerEnrollmentOrigin653' in condition and 'rawRequest' in condition and 'origin' in condition,'ORIGIN_CONDITION_IDENTITY')
 need('PREVIEW_ORIGIN_REQUIRED' in c[end+1:end+220],'ORIGIN_DENIAL_IDENTITY')
 need(FLAG not in c,'ALREADY_PATCHED')
 # Same explicit production-only predicate as the reviewed TS source.
 # Keep the existing preview helper untouched and add no dependency.
 extra=" && !(request.rawRequest?.get('origin') === 'https://soridraw.com' && process.env.SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653 === '1' && process.env.SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653 === 'preview-only' && process.env.SORIDRAW_OWNER_FOLLOW_PRODUCTION_ENROLL_797 === '1')"
 c=c[:end]+extra+c[end:]
 files[enroll]=c.encode()
 for name in [scope,enroll]:
  p=DIR/Path(name).name;p.write_bytes(files[name]);subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
 with zipfile.ZipFile(DIR/'new.zip','w',zipfile.ZIP_DEFLATED) as z:
  for n,v in files.items():z.writestr(n,v)
 (DIR/'before.json').write_text(json.dumps(f))
 os.chmod(DIR/'before.json',0o600)
 print('APP797_ENROLLMENT_EXACT_LIVE_SOURCE_PATCH_AND_UPDATE_PERMISSION=PASS',flush=True)
def upload(path):
 u=api('POST',ROOT+PARENT+'/functions:generateUploadUrl',{})
 need(u.get('uploadUrl','').startswith('https://') and u.get('storageSource'),'UPLOAD_TARGET')
 req=urllib.request.Request(u['uploadUrl'],data=path.read_bytes(),method='PUT',headers={'Content-Type':'application/zip'})
 with urllib.request.urlopen(req,timeout=90) as resp:need(resp.status in (200,201),'UPLOAD')
 return u['storageSource']
def wait(op):
 deadline=time.monotonic()+900
 while not op.get('done'):
  need(time.monotonic()<deadline,'UPDATE_UNCERTAIN_TIMEOUT')
  time.sleep(10);op=api('GET',ROOT+op['name'])
 need(not op.get('error'),'FUNCTION_UPDATE_FAILED')
def verify(after,before,expected_env,archive):
 need(after['state']=='ACTIVE','AFTER_NOT_ACTIVE')
 need(after['serviceConfig'].get('environmentVariables',{})==expected_env,'ENV_DRIFT')
 for k in ['serviceAccountEmail','secretEnvironmentVariables','secretVolumes','ingressSettings','availableMemory','availableCpu','timeoutSeconds','minInstanceCount','maxInstanceCount','maxInstanceRequestConcurrency','vpcConnector','vpcConnectorEgressSettings','allTrafficOnLatestRevision']:
  need(after['serviceConfig'].get(k)==before['serviceConfig'].get(k),'SERVICE_DRIFT_'+k)
 for k in ['runtime','entryPoint','serviceAccount','workerPool','environmentVariables','dockerRepository']:
  need(after['buildConfig'].get(k)==before['buildConfig'].get(k),'BUILD_DRIFT_'+k)
 src=after['buildConfig']['source']['storageSource']
 need(src.get('generation'),'AFTER_SOURCE_GENERATION')
 p=subprocess.run(['gcloud','storage','cp','gs://'+src['bucket']+'/'+src['object']+'#'+str(src['generation']),str(DIR/'actual.zip'),'--quiet'],capture_output=True,text=True,timeout=90)
 need(p.returncode==0,'AFTER_SOURCE_READ')
 def digest(p):
  with zipfile.ZipFile(p) as z:return {n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if not n.endswith('/')}
 need(digest(DIR/'actual.zip')==digest(archive),'AFTER_SOURCE_DRIFT')
def apply():
 before=json.loads((DIR/'before.json').read_text());current=read()
 need(current.get('updateTime')==before.get('updateTime'),'CONCURRENT_UPDATE')
 env={**before['serviceConfig'].get('environmentVariables',{}),FLAG:'1'}
 source=upload(DIR/'new.zip')
 need(read().get('updateTime')==before.get('updateTime'),'CONCURRENT_UPDATE_BEFORE_PATCH')
 (DIR/'patch-attempted').touch()
 op=api('PATCH',ROOT+NAME+'?updateMask=buildConfig.source,serviceConfig.environmentVariables',{'name':NAME,'buildConfig':{'source':{'storageSource':source}},'serviceConfig':{'environmentVariables':env}})
 print('APP797_ENROLLMENT_UPDATE_ACCEPTED',flush=True)
 wait(op)
 after=read()
 (DIR/'after.json').write_text(json.dumps(after));os.chmod(DIR/'after.json',0o600)
 verify(after,before,env,DIR/'new.zip')
 (DIR/'applied').touch()
 print('APP797_ENROLLMENT_PREVIEW_AND_PRODUCTION_ORIGIN_ACTIVE=PASS',flush=True)
def rollback():
 # Only after a proven completed activation; never override uncertain updates.
 if not (DIR/'applied').exists():return
 before=json.loads((DIR/'before.json').read_text());after=json.loads((DIR/'after.json').read_text())
 need(read().get('updateTime')==after.get('updateTime'),'ROLLBACK_CONCURRENT_UPDATE')
 env=before['serviceConfig'].get('environmentVariables',{})
 source=upload(DIR/'old.zip')
 wait(api('PATCH',ROOT+NAME+'?updateMask=buildConfig.source,serviceConfig.environmentVariables',{'name':NAME,'buildConfig':{'source':{'storageSource':source}},'serviceConfig':{'environmentVariables':env}}))
 verify(read(),before,env,DIR/'old.zip')
 print('APP797_ENROLLMENT_ORIGINAL_SOURCE_AND_SCOPE_RESTORED=PASS',flush=True)
if __name__=='__main__':
 try:
  need(os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_REPOSITORY')=='andrawing1212/soridraw-music' and os.environ.get('GITHUB_ACTOR')==os.environ.get('GITHUB_REPOSITORY_OWNER'),'APPROVED_CONTEXT')
  {'preflight':preflight,'apply':apply,'rollback':rollback}[sys.argv[1]]()
 except Exception as e:
  print(str(e) if str(e).startswith('APP797_') else 'APP797_ENROLL_HOLD_'+type(e).__name__,flush=True);sys.exit(2)
