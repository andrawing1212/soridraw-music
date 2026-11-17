"""APP713: director-approved IAM permission for ONE new Firebase Function.
Reads current IAM and runtime OFF status first, fails closed and rolls back
the exact one-role binding if the OFF handler cannot be reached.
"""
import json,os,subprocess,urllib.request,urllib.error,sys
PROJECT="soridraw-app-866a5"
REGION="asia-northeast3"
FUNCTION="verifyExploreFollowActor713"
SERVICE="verifyexplorefollowactor713"
URL="https://"+REGION+"-"+PROJECT+".cloudfunctions.net/"+FUNCTION
def hold(message):
 raise RuntimeError("APP713_ONE_INVOKER_HOLD_"+message)
def check(condition,message):
 if not condition:hold(message)
def gcloud(*args):
 x=subprocess.run(("gcloud",)+args,capture_output=True,text=True,timeout=60)
 if x.returncode:hold("GCLOUD_FAILURE_"+str(x.returncode)+"_"+x.stderr.strip()[:250])
 return x.stdout.strip()
def data(*args):return json.loads(gcloud(*args,"--format=json"))
scope=("--region="+REGION,"--project="+PROJECT)
def policy():
 return data("run","services","get-iam-policy",SERVICE,*scope)
def members(pol,role):
 return [m for b in pol.get("bindings",[]) if b.get("role")==role for m in b.get("members",[])]
def status():
 try:
  with urllib.request.urlopen(urllib.request.Request(URL,method="GET"),timeout=30) as x:
   return x.status
 except urllib.error.HTTPError as e:return e.code
def main():
 check(os.environ.get("GITHUB_ACTIONS")=="true" and
  os.environ.get("GITHUB_REF")=="refs/heads/fix/app713-server-owned-follow" and
  os.environ.get("GITHUB_SHA")==os.environ.get("APP713_APPROVED_SHA"),
  "EXACT_GITHUB_WORKFLOW_ONLY")
 fn=data("functions","describe",FUNCTION,"--gen2",*scope)
 check(fn.get("state")=="ACTIVE" and fn.get("buildConfig",{}).get("runtime")=="nodejs22",
  "NEW_FUNCTION_NOT_ACTIVE")
 config=fn.get("serviceConfig",{})
 check(config.get("service")=="projects/"+PROJECT+"/locations/"+REGION+"/services/"+SERVICE,
  "CLOUD_RUN_SERVICE_NOT_EXACT")
 check(config.get("environmentVariables",{}).get("SORIDRAW_FOLLOW_ACTOR_PROOF_713")=="0" and
  config.get("environmentVariables",{}).get("SORIDRAW_FOLLOW_ACTOR_SCOPE_713")=="preview-only",
  "FUNCTION_NOT_RUNTIME_OFF")
 check(config.get("serviceAccountEmail")=="91309780603-compute@developer.gserviceaccount.com" and
  int(config.get("maxInstanceCount",0))==2 and
  int(config.get("minInstanceCount",0))==0,
  "FUNCTION_SHARED_IDENTITY_OR_COST_LIMIT")
 check(len([x for x in config.get("secretEnvironmentVariables",[])
  if x.get("key")=="SORIDRAW_OWNER_FOLLOW_HMAC_539"])==1,"HMAC_SECRET_BINDING")
 resource=data("run","services","describe",SERVICE,*scope)
 check(resource.get("metadata",{}).get("name")==SERVICE or
  resource.get("name","").endswith("/"+SERVICE),"CLOUD_RUN_RESOURCE_MISMATCH")
 before=policy()
 check("allUsers" not in members(before,"roles/run.invoker"),"ALREADY_PUBLIC")
 check(not any("allAuthenticatedUsers" in b.get("members",[]) for b in before.get("bindings",[])),
  "UNEXPECTED_BROAD_BINDING")
 check(not any("allUsers" in b.get("members",[]) for b in before.get("bindings",[])),
  "UNEXPECTED_OTHER_PUBLIC_BINDING")
 check(status()==403,"PRE_IAM_EXTERNAL_NOT_403")
 print("APP713_EXACT_FUNCTION_IAM_PRECHECK=PASS",flush=True)
 attempted=False
 successful=False
 try:
  attempted=True
  gcloud("run","services","add-iam-policy-binding",SERVICE,*scope,
   "--member=allUsers","--role=roles/run.invoker","--condition=None","--quiet")
  after=policy()
  check("allUsers" in members(after,"roles/run.invoker"),
   "NEW_BINDING_NOT_PRESENT")
  for b in before.get("bindings",[]):
   for m in b.get("members",[]):
    check(any(x.get("role")==b.get("role") and x.get("condition")==b.get("condition") and
      m in x.get("members",[]) for x in after.get("bindings",[])),
      "OLD_BINDING_REMOVED")
  check(status()==503,"IAM_OPEN_DID_NOT_REACH_OFF_HANDLER")
  successful=True
  with open("app713-invoker-result.json","w") as f:
   json.dump({"status":"PASS","sourceSha":os.environ["GITHUB_SHA"],
    "function":FUNCTION,"service":SERVICE,"IAM":"allUsers roles/run.invoker",
    "runtimeReady":False,"response":503,"otherFunctionChanges":0,"userDataWrites":0},f)
  print("APP713_ONLY_NEW_FUNCTION_INVOKER_OPEN_WITH_OFF_HANDLER=PASS",flush=True)
 finally:
  if attempted and not successful:
   if "allUsers" in members(policy(),"roles/run.invoker"):
    gcloud("run","services","remove-iam-policy-binding",SERVICE,*scope,
     "--member=allUsers","--role=roles/run.invoker","--quiet")
   check("allUsers" not in members(policy(),"roles/run.invoker"),"IAM_ROLLBACK_FAILED")
   print("APP713_INVOCATION_FAILURE_IAM_ROLLED_BACK=PASS",flush=True)
if __name__=="__main__":
 try:main()
 except Exception as e:
  print(str(e)[:400],flush=True)
  sys.exit(2)
