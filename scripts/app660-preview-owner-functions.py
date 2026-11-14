"""Update only the three existing owner Functions. Keep IAM/secrets/runtime intact.
Uses the Functions API's narrow updateMask, not full-codebase Firebase discovery.
"""
import copy, json, os, re, subprocess, sys, tempfile, time, urllib.request, urllib.error, zipfile
from pathlib import Path
PROJECT='soridraw-app-866a5'
ROOT='https://cloudfunctions.googleapis.com/v2/'
PARENT=f'projects/{PROJECT}/locations/asia-northeast3'
NAMES=['verifyOwnerFollowEpoch547Candidate','publishExploreOwnerFollower542','enrollOwnerFollow544Candidate']
MODULES={
 'ownerFollowAuthProof547':'APP547_AUTH_PROOF_COMPILED_OPEN',
 'exploreOwnerFollowerWebhook542':'APP542_OWNER_HTTP_COMPILED_OPEN',
 'ownerFollowEnrollment544':'APP544_ENROLLMENT_COMPILED_OPEN',
}
FLAGS={'SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653':'1','SORIDRAW_OWNER_FOLLOW_SOURCE_BOUNDARY_653':'preview-only'}
def package(dest):
    base=Path('functions')
    with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED) as z:
        p=json.loads((base/'package.json').read_text())
        p.update(main='lib/ownerFollowRelease660.js',scripts={'gcp-build':''})
        z.writestr('package.json',json.dumps(p))
        z.write(base/'package-lock.json','package-lock.json')
        for module in [*MODULES,'ownerFollowScope653','ownerFollowLifecycle534']:
            code=(base/'lib'/f'{module}.js').read_text()
            if module in MODULES:
                old=f'exports.{MODULES[module]} = false;'
                assert code.count(old)==1, 'COMPILED_SOURCE_DRIFT_'+module
                code=code.replace(old,f'exports.{MODULES[module]} = true;')
            z.writestr(f'lib/{module}.js',code)
        entry="require('firebase-admin/app').initializeApp({projectId:'"+PROJECT+"',databaseURL:'https://"+PROJECT+"-default-rtdb.firebaseio.com'});\n"
        for name,module in zip(NAMES,['ownerFollowAuthProof547','exploreOwnerFollowerWebhook542','ownerFollowEnrollment544']):
            entry+=f"exports.{name}=require('./{module}').{name};\n"
        z.writestr('lib/ownerFollowRelease660.js',entry)
    with zipfile.ZipFile(dest) as z:
        assert len(z.namelist())==8 and 'securedIndex' not in z.read('lib/ownerFollowRelease660.js').decode()
    print('APP660_FUNCTION_PACKAGE_THREE_EXPORTS_NO_OTHER_FUNCTIONS=PASS')
def run():
    assert sys.argv[1] in ('--package-check','--apply-once')
    with tempfile.TemporaryDirectory(prefix='soridraw660-') as temp:
        archive=Path(temp)/'owner-functions.zip'
        package(archive)
        if sys.argv[1]=='--package-check':return
        assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('GITHUB_REF')=='refs/heads/preview'
        assert re.fullmatch('[0-9a-f]{40}',os.environ.get('APP660_APPROVED_PARENT',''))
        token=subprocess.run(['gcloud','auth','print-access-token'],check=True,text=True,capture_output=True).stdout.strip()
        def api(method,path,body=None):
            data=None if body is None else json.dumps(body).encode()
            req=urllib.request.Request(ROOT+path,data=data,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
            try:
                with urllib.request.urlopen(req,timeout=90) as response:return json.load(response)
            except urllib.error.HTTPError as error:
                try:message=json.load(error).get('error',{}).get('message','UNKNOWN')
                except Exception:message='UNREADABLE_ERROR'
                # GCP permission errors contain resource and permission names, not credentials.
                raise RuntimeError(f'FUNCTION_API_{method}_{error.code}: {message[:1800]}') from None
        before={n:api('GET',PARENT+'/functions/'+n) for n in NAMES}
        for n,f in before.items():
            assert f['state']=='ACTIVE' and f['buildConfig']['runtime']=='nodejs22', 'FUNCTION_STATE_RUNTIME_'+n
            assert f['buildConfig']['entryPoint']==n
            env=f['serviceConfig'].get('environmentVariables',{})
            assert env.get('SORIDRAW_OWNER_FOLLOW_READY_608')=='1'
            assert env.get('SORIDRAW_OWNER_FOLLOW_CANARY_UID_574')=='rcZ2GZrBndOZzT8C635eiNBjYIJ2'
            assert env.get('SORIDRAW_OWNER_FOLLOW_GENERAL_PREVIEW_653')!='1','ALREADY_GENERAL_OR_DRIFT'
            assert f['serviceConfig']['serviceAccountEmail']=='91309780603-compute@developer.gserviceaccount.com'
            assert f['serviceConfig'].get('secretEnvironmentVariables'), 'EXISTING_SECRET_BINDINGS_MISSING'
        uploaded=api('POST',PARENT+'/functions:generateUploadUrl',{})
        assert uploaded['storageSource']['bucket'] and uploaded['uploadUrl'].startswith('https://')
        req=urllib.request.Request(uploaded['uploadUrl'],data=archive.read_bytes(),method='PUT',headers={'Content-Type':'application/zip'})
        with urllib.request.urlopen(req,timeout=120) as response:assert response.status in (200,201)
        done=[]
        for name in NAMES:
            old=before[name]
            current=api('GET',old['name'])
            assert current['updateTime']==old['updateTime'],'CONCURRENT_FUNCTION_DEPLOY_'+name
            env={**old['serviceConfig'].get('environmentVariables',{}),**FLAGS}
            body={'name':old['name'],'buildConfig':{'source':{'storageSource':uploaded['storageSource']}},'serviceConfig':{'environmentVariables':env}}
            op=api('PATCH',old['name']+'?updateMask=buildConfig.source,serviceConfig.environmentVariables',body)
            print('APP660_FUNCTION_UPDATE_ACCEPTED='+name,flush=True)
            deadline=time.monotonic()+1200
            while not op.get('done'):
                assert time.monotonic()<deadline,'FUNCTION_OPERATION_TIMEOUT_'+name
                time.sleep(10)
                op=api('GET',op['name'])
            if op.get('error'):raise RuntimeError('FUNCTION_OPERATION_'+name+': '+json.dumps(op['error'])[:1800])
            after=api('GET',old['name'])
            assert after['state']=='ACTIVE' and after['updateTime']!=old['updateTime']
            assert after['serviceConfig'].get('environmentVariables')==env,'FUNCTION_ENV_POSTFLIGHT_'+name
            for key in ['runtime','entryPoint','serviceAccount','workerPool','environmentVariables','dockerRepository']:
                assert after['buildConfig'].get(key)==old['buildConfig'].get(key),'BUILD_CONFIG_DRIFT_'+key
            for key in ['serviceAccountEmail','secretEnvironmentVariables','secretVolumes','ingressSettings','availableMemory','availableCpu','timeoutSeconds','minInstanceCount','maxInstanceCount','maxInstanceRequestConcurrency','vpcConnector','vpcConnectorEgressSettings','allTrafficOnLatestRevision']:
                assert after['serviceConfig'].get(key)==old['serviceConfig'].get(key),'SERVICE_CONFIG_DRIFT_'+key
            actual=after['buildConfig']['source']['storageSource']
            assert all(str(actual.get(k))==str(v) for k,v in uploaded['storageSource'].items()),'SOURCE_POSTFLIGHT'
            done.append(name)
            print('APP660_FUNCTION_ACTIVE='+name+';updated='+after['updateTime']+';revision='+str(after['serviceConfig'].get('revision','')),flush=True)
        print('APP660_FUNCTIONS_ACTIVE_GENERAL_PREVIEW_SCOPED=PASS')
        # Only sanitized evidence; never upload metadata containing existing env values.
        Path('app660-functions-result.json').write_text(json.dumps({'project':PROJECT,'functions':done,'source_parent':os.environ['APP660_APPROVED_PARENT'],'status':'PASS'}))
if __name__=='__main__':
    try:run()
    except Exception as error:
        # A failure stops subsequent Worker/Hosting activation. Existing queues/data
        # are retained. Do not force a rollback over an uncertain in-flight update.
        print('APP660_FUNCTIONS_HOLD='+str(error),flush=True)
        sys.exit(2)
