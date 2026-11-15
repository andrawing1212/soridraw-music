#!/usr/bin/env bash
# Existing public HMAC receiver needs a public Cloud Run invoker. Scope this IAM
# change to ONE newly created PREVIEW-only Function; no other service or user.
set -euo pipefail
test "${GITHUB_ACTIONS:-}" = true
test "${GITHUB_REF:-}" = refs/heads/preview
test "${APP_C_PROFILE_APPROVED_SHA:-}" = "${GITHUB_SHA:-}"
project=soridraw-app-866a5
region=asia-northeast3
service=publishexplorepublicfollow669
function=publishExplorePublicFollow669
gcloud config set project "$project" >/dev/null
gcloud functions describe "$function" --gen2 --region "$region" --format=json > /tmp/c-profile-function.json
python3 - <<'PY'
import json
f=json.load(open('/tmp/c-profile-function.json'))
assert f.get('name')=='projects/soridraw-app-866a5/locations/asia-northeast3/functions/publishExplorePublicFollow669'
assert f.get('buildConfig',{}).get('entryPoint')=='publishExplorePublicFollow669'
config=f.get('serviceConfig',{})
assert config.get('environmentVariables',{}).get('SORIDRAW_PUBLIC_FOLLOW_READY_669')=='0'
assert config.get('environmentVariables',{}).get('SORIDRAW_PUBLIC_FOLLOW_SCOPE_669')=='preview-only'
assert config.get('serviceAccountEmail')=='91309780603-compute@developer.gserviceaccount.com'
assert config.get('service','').endswith('/services/publishexplorepublicfollow669')
assert config.get('ingressSettings')=='ALLOW_ALL'
print('C_PROFILE_EXACT_ISOLATED_RECEIVER_IAM_TARGET=PASS')
PY
gcloud run services get-iam-policy "$service" --region "$region" --format=json > /tmp/c-profile-invoker-before.json
python3 - <<'PY'
import json
p=json.load(open('/tmp/c-profile-invoker-before.json'))
grants=p.get('bindings',[])
assert not any('allUsers' in b.get('members',[]) and b.get('role')=='roles/run.invoker' for b in grants),'ALREADY_PUBLIC_BUT_403'
assert not any('allUsers' in b.get('members',[]) and b.get('role')=='roles/owner' for b in grants),'PUBLIC_OWNER_GRANT'
print('C_PROFILE_INVOKER_BEFORE_NONPUBLIC=PASS')
PY
gcloud run services add-iam-policy-binding "$service" --region "$region" --member allUsers --role roles/run.invoker --quiet >/dev/null
gcloud run services get-iam-policy "$service" --region "$region" --format=json > /tmp/c-profile-invoker-after.json
python3 - <<'PY'
import json
before=json.load(open('/tmp/c-profile-invoker-before.json'))
after=json.load(open('/tmp/c-profile-invoker-after.json'))
def strip(p):
 return sorted([(b['role'],tuple(sorted(m for m in b.get('members',[]) if not (b['role']=='roles/run.invoker' and m=='allUsers')))) for b in p.get('bindings',[]) if b.get('members') and (b['role']!='roles/run.invoker' or any(m!='allUsers' for m in b.get('members',[])))])
assert strip(before)==strip(after),'UNRELATED_IAM_CHANGED'
assert any(b.get('role')=='roles/run.invoker' and 'allUsers' in b.get('members',[]) for b in after.get('bindings',[])),'MISSING_SINGLE_INVOKER_GRANT'
print('C_PROFILE_ONLY_PUBLIC_RECEIVER_INVOKER_ADDED=PASS')
PY
url=https://asia-northeast3-soridraw-app-866a5.cloudfunctions.net/publishExplorePublicFollow669
code="$(curl -sS --max-time 25 -o /tmp/c-profile-off-endpoint.json -w '%{http_code}' "$url")"
if [[ "$code" != 503 ]] || ! grep -Fq PREVIEW_PUBLIC_FOLLOW_DISABLED /tmp/c-profile-off-endpoint.json; then
 echo "C_PROFILE_RECEIVER_POST_IAM_UNEXPECTED_HTTP=$code"
 # Roll back only the newly added invoker grant; never touch other bindings.
 gcloud run services remove-iam-policy-binding "$service" --region "$region" --member allUsers --role roles/run.invoker --quiet >/dev/null || true
 exit 2
fi
echo C_PROFILE_PUBLIC_HMAC_RECEIVER_OFF_BUT_REACHABLE=PASS
