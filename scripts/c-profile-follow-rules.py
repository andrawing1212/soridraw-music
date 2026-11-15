"""Apply exactly ONE public aggregate child to live shared RTDB Rules.
Never upload database.rules.json; never modify owner-private Rules or data.
"""
import json,hashlib,os,subprocess,urllib.request,urllib.error
from pathlib import Path
from google.auth import default
from google.auth.transport.requests import Request
EXPECTED='48f72b987ec4a1efd99919c261056354db826ed64afae874f3a8eeee477c6538'
URL='https://soridraw-app-866a5-default-rtdb.firebaseio.com/.settings/rules.json'
def sha(value):
 return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def check(cond,msg):
 if not cond:raise RuntimeError('C_PROFILE_RULES_HOLD_'+msg)
def get(url,etag=False):
 r=urllib.request.Request(url,headers={'X-Firebase-ETag':'true'} if etag else {})
 with urllib.request.urlopen(r,timeout=30) as response:
  return json.load(response),response.headers.get('ETag')
def main():
 import sys
 check(len(sys.argv)==2 and sys.argv[1] in ('--preflight','--apply'),'MODE')
 if sys.argv[1]=='--apply':
  check(os.environ.get('GITHUB_ACTIONS')=='true' and
   os.environ.get('GITHUB_REF')=='refs/heads/preview' and
   os.environ.get('GITHUB_SHA')==os.environ.get('APP_C_PROFILE_APPROVED_SHA'),
   'APPROVAL_CONTEXT')
 creds,_=default(scopes=['https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/userinfo.email'])
 creds.refresh(Request())
 check(creds.token,'RTDB_IDENTITY')
 url=URL+'?access_token='+creds.token
 live,etag=get(url,True)
 print('C_PROFILE_ACTIVE_SHARED_RULES_SHA='+sha(live),flush=True)
 original=json.loads(json.dumps(live))
 existing=original.get('rules',{}).get('publicSync',{}).pop('exploreFollowProfiles667',None)
 already=existing is not None
 check(sha(original if already else live)==EXPECTED,'RULES_BASELINE_DRIFT')
 Path('/tmp/c-profile-live-rules.json').write_text(json.dumps(live))
 # Retain the exact original rules before any operation. The workflow uploads
 # this file even on failure. No credentials or database records are included.
 Path('c-profile-rules-backup.json').write_text(json.dumps(live,sort_keys=True,indent=2)+chr(10))
 code="""
import {readFileSync,writeFileSync} from 'node:fs';
import {makeAdditivePublicFollowRules667} from './scripts/lib/public-follow-rules-667.mjs';
const current=JSON.parse(readFileSync('/tmp/c-profile-live-rules.json'));
const next=makeAdditivePublicFollowRules667(current);
if(!['ADD_EXACT_ONE_CHILD','ALREADY_EXACT'].includes(next.mode))throw Error('RULES_ADD_SCOPE');
writeFileSync('/tmp/c-profile-next-rules.json',JSON.stringify(next.candidate));
console.log('C_PROFILE_SHARED_RULES_EXACT_ONE_CHILD=PASS');
"""
 subprocess.run(['node','--input-type=module','-e',code],check=True)
 after=json.loads(Path('/tmp/c-profile-next-rules.json').read_text())
 check(after['rules']['publicSync'].get('exploreFollowProfiles667'),'NEW_CHILD_ABSENT')
 restored=json.loads(json.dumps(after))
 restored['rules']['publicSync'].pop('exploreFollowProfiles667',None)
 check(sha(restored)==EXPECTED,'UNRELATED_RULES_CHANGED')
 if already:
  check(sha(live)==sha(after),'EXISTING_CHILD_CONFLICT')
  print('C_PROFILE_SHARED_RULES_ALREADY_EXACT=PASS',flush=True)
  return
 if sys.argv[1]=='--preflight':return
 # Firebase RTDB Rules management GET does not reliably issue an ETag.
 # Without server CAS this is explicitly an operational maintenance release,
 # never an automatic push-deploy. Exact isolated GitHub workflow opt-in and
 # a declared freeze of other Rules publishers are mandatory.
 check(os.environ.get('C_PROFILE_RULES_MAINTENANCE_CONFIRMED')=='FREEZE_CONFIRMED',
  'MAINTENANCE_FREEZE_REQUIRED')
 compare,_=get(url)
 check(sha(compare)==EXPECTED,'CONCURRENT_RULE_UPDATE')
 final_check,_=get(url)
 check(sha(final_check)==EXPECTED,'CONCURRENT_RULE_UPDATE_FINAL')
 body=json.dumps(after,separators=(',',':')).encode()
 headers={'Content-Type':'application/json'}
 if etag:headers['If-Match']=etag
 req=urllib.request.Request(url,data=body,method='PUT',headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=40) as resp:
   check(resp.status in (200,204),'RULES_PUT_STATUS')
 except urllib.error.HTTPError as err:
  raise RuntimeError('C_PROFILE_RULES_CAS_REJECTED_'+str(err.code)) from None
 persisted,_=get(url)
 check(sha(persisted)==sha(after),'RULES_POSTFLIGHT_MISMATCH')
 print('C_PROFILE_SHARED_RULES_ONE_CHILD_ONLY_ACTIVE=PASS',flush=True)
if __name__=='__main__':
 try:main()
 except Exception as error:
  print(str(error)[:600],flush=True)
  raise SystemExit(2)
