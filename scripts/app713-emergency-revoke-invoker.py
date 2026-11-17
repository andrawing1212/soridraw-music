"""APP713 emergency follow rollback: remove ONLY invoker permission
added to the NEW actor verifier. No project/service-account IAM updates.
"""
import json,os,subprocess,sys
P='soridraw-app-866a5';R='asia-northeast3';S='verifyexplorefollowactor713'
def check(v,s):
 if not v:raise RuntimeError('APP713_IAM_REVERT_HOLD_'+s)
def run(*args):
 p=subprocess.run(('gcloud',)+args,text=True,capture_output=True,timeout=90)
 check(p.returncode==0,'GCLOUD_'+str(p.returncode)+'_'+p.stderr[:220])
 return p.stdout.strip()
scope=('--region='+R,'--project='+P)
def policy():return json.loads(run('run','services','get-iam-policy',S,*scope,'--format=json'))
def contains(p):
 return any(b.get('role')=='roles/run.invoker' and 'allUsers' in b.get('members',[])
  for b in p.get('bindings',[]))
def main():
 check(os.environ.get('GITHUB_ACTIONS')=='true' and
  os.environ.get('GITHUB_REF')=='refs/heads/fix/app713-server-owned-follow' and
  os.environ.get('GITHUB_SHA')==os.environ.get('APP713_ROLLBACK_SHA'),
  'APPROVED_ONE_SHOT')
 before=policy()
 if contains(before):
  run('run','services','remove-iam-policy-binding',S,*scope,
   '--member=allUsers','--role=roles/run.invoker','--quiet')
 after=policy()
 check(not contains(after),'PUBLIC_INVOKER_STILL_ACTIVE')
 for b in before.get('bindings',[]):
  if b.get('role')=='roles/run.invoker' and 'allUsers' in b.get('members',[]):continue
  for member in b.get('members',[]):
   check(any(x.get('role')==b.get('role') and x.get('condition')==b.get('condition')
    and member in x.get('members',[]) for x in after.get('bindings',[])),
    'UNRELATED_IAM_MEMBER_CHANGED')
 print('APP713_ONLY_NEW_FUNCTION_PUBLIC_INVOKER_REVERTED=PASS',flush=True)
if __name__=='__main__':
 try:main()
 except Exception as e:
  print(str(e)[:400],flush=True);sys.exit(2)
