#!/usr/bin/env bash
# APP616: human-admin-only, exact three existing PREVIEW owner-follow Functions.
# No Cloudflare, IAM, Secret Manager mutation, Rules, RTDB, Auth, D1/R2 or Hosting.
set -Eeuo pipefail
set +x
umask 077
[[ "${1:-}" == '--apply' && $# -eq 1 ]] || { echo 'APP616_USAGE: bash script --apply'; exit 2; }
PROJECT='soridraw-app-866a5'
REGION='asia-northeast3'
SOURCE='763844501b1097fae54630bf88ee9c04620f8268'
PREVIEW='028e51a2d52b50e1f021dd6d689268518077c2e1'
REPO='https://github.com/andrawing1212/soridraw-music.git'
NAMES=(publishExploreOwnerFollower542 enrollOwnerFollow544Candidate verifyOwnerFollowEpoch547Candidate)
fail(){ echo "APP616_HOLD_$1" >&2; exit 2; }
for bin in git gcloud firebase node npm python3; do
 command -v "$bin" >/dev/null 2>&1 || fail "MISSING_${bin}"
done
[[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 22 ]] || fail NODE_22_REQUIRED
account="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)')" || fail ADMIN_AUTH_REQUIRED
[[ -n "$account" && "$account" != *gserviceaccount.com ]] || fail HUMAN_ADMIN_REQUIRED
[[ "$(gcloud projects describe "$PROJECT" --format='value(projectId)')" == "$PROJECT" ]] || fail WRONG_PROJECT
TMP="$(mktemp -d -t soridraw-app616-XXXXXX)" || fail TEMP_FAILED
trap 'rm -rf -- "$TMP"' EXIT
echo APP616_HUMAN_ADMIN_AND_PROJECT=PASS
# GET-only baseline of three existing Functions. Never dump unrelated metadata.
for name in "${NAMES[@]}"; do
 gcloud functions describe "$name" --gen2 --region "$REGION" --project "$PROJECT" --format=json > "$TMP/$name-before.json" || fail "BASELINE_UNAVAILABLE_$name"
 NAME="$name" TMPDIR="$TMP" python3 - <<'PY' || fail "BASELINE_NOT_SAFE_$name"
import json,os
name=os.environ['NAME']
p=json.load(open(os.environ['TMPDIR']+'/'+name+'-before.json'))
if p.get('state')!='ACTIVE': raise SystemExit(1)
if p.get('serviceConfig',{}).get('environmentVariables',{}).get('SORIDRAW_OWNER_FOLLOW_READY_608')=='1': raise SystemExit(2)
key='SORIDRAW_OWNER_FOLLOW_HMAC_539' if name=='publishExploreOwnerFollower542' else 'SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544'
if not any(x.get('key')==key or x.get('secret')==key for x in p.get('serviceConfig',{}).get('secretEnvironmentVariables',[])): raise SystemExit(3)
if not p.get('updateTime'): raise SystemExit(4)
PY
 echo "APP616_BASELINE_READY_OFF_$name=PASS"
done
# Firebase CLI must use the logged-in human administrator and the fixed project.
firebase projects:list --json > "$TMP/firebase-projects.json" || fail FIREBASE_ADMIN_AUTH_REQUIRED
PROJECT="$PROJECT" TMPDIR="$TMP" node - <<'NODE' || fail FIREBASE_PROJECT_NOT_VISIBLE
const fs=require('node:fs');
const p=JSON.parse(fs.readFileSync(process.env.TMPDIR+'/firebase-projects.json','utf8'));
const list=Array.isArray(p.result)?p.result:Array.isArray(p.projects)?p.projects:[];
if(!list.some(v=>v.projectId===process.env.PROJECT))process.exit(2);
NODE
echo APP616_ADMIN_FIREBASE_TARGET=PASS
# The SHA is immutable. Do not build a moving preview or change the branch.
git clone --quiet --no-tags --depth 15 --branch feat/app600-owner-standalone-isolated "$REPO" "$TMP/repo" || fail SOURCE_CLONE_FAILED
if ! git -C "$TMP/repo" cat-file -e "${SOURCE}^{commit}" 2>/dev/null; then
 git -C "$TMP/repo" fetch --quiet origin "$SOURCE" || fail PINNED_SOURCE_UNAVAILABLE
fi
git -C "$TMP/repo" checkout --quiet --detach "$SOURCE" || fail SOURCE_CHECKOUT_FAILED
[[ "$(git -C "$TMP/repo" rev-parse HEAD)" == "$SOURCE" ]] || fail SOURCE_IDENTITY_MISMATCH
[[ "$(git ls-remote "$REPO" refs/heads/preview | cut -f1)" == "$PREVIEW" ]] || fail PREVIEW_CHANGED_HOLD
for token in 'APP542_OWNER_HTTP_COMPILED_OPEN=true;' 'APP544_ENROLLMENT_COMPILED_OPEN=true;' 'APP547_AUTH_PROOF_COMPILED_OPEN=true;'; do
 grep -RFq "$token" "$TMP/repo/functions/src" || fail COMPILED_ON_SOURCE_MISSING
done
npm ci --prefix "$TMP/repo/functions" --no-audit --no-fund || fail INSTALL_FAILED
npm run build --prefix "$TMP/repo/functions" || fail BUILD_FAILED
(
 cd "$TMP/repo"
 node scripts/app615-scoped-functions-main.mjs
 node - <<'NODE'
const assert=require('node:assert/strict');
const pkg=require('./functions/package.json');
assert.equal(pkg.main,'lib/ownerFollowOnlyEntry615.js');
const defs=require('./functions/'+pkg.main);
assert.deepEqual(Object.keys(defs).sort(),[
 'enrollOwnerFollow544Candidate','publishExploreOwnerFollower542','verifyOwnerFollowEpoch547Candidate']);
assert.equal(Object.keys(require.cache).some(x=>x.endsWith('/securedIndex.js')),false);
NODE
) || fail NARROW_OWNER_ENTRYPOINT_FAILED
echo APP616_THREE_FUNCTIONS_ONLY_NO_OTHER_SECRET_IMPORT=PASS
# This is the only deployment attempt, never --force and never retry.
set +e
(
 cd "$TMP/repo"
 firebase deploy \
 --only 'functions:publishExploreOwnerFollower542,functions:enrollOwnerFollow544Candidate,functions:verifyOwnerFollowEpoch547Candidate' \
 --project "$PROJECT" --config firebase.json --non-interactive
)
rc=$?
set -e
echo "APP616_FIREBASE_CLI_EXIT=$rc"
# Firebase can report Artifact Registry cleanup-policy failure AFTER all three
# revisions succeeded. Validate each new revision before interpreting the code update.
for name in "${NAMES[@]}"; do
 gcloud functions describe "$name" --gen2 --region "$REGION" --project "$PROJECT" --format=json > "$TMP/$name-after.json" || fail "POSTFLIGHT_UNAVAILABLE_$name"
 NAME="$name" TMPDIR="$TMP" python3 - <<'PY' || fail "POSTFLIGHT_NOT_SAFE_$name"
import json,os
name=os.environ['NAME'];folder=os.environ['TMPDIR']
old=json.load(open(folder+'/'+name+'-before.json'))
new=json.load(open(folder+'/'+name+'-after.json'))
if new.get('state')!='ACTIVE': raise SystemExit(1)
if new.get('updateTime','')<=old.get('updateTime',''): raise SystemExit(2)
if new.get('serviceConfig',{}).get('environmentVariables',{}).get('SORIDRAW_OWNER_FOLLOW_READY_608')=='1': raise SystemExit(3)
key='SORIDRAW_OWNER_FOLLOW_HMAC_539' if name=='publishExploreOwnerFollower542' else 'SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544'
if not any(x.get('key')==key or x.get('secret')==key for x in new.get('serviceConfig',{}).get('secretEnvironmentVariables',[])): raise SystemExit(4)
PY
 echo "APP616_FUNCTION_UPDATED_READY_OFF_$name=PASS"
done
echo APP616_ALL_THREE_NEW_REVISIONS_READY_OFF=PASS
echo APP616_CLOUDFLARE_D1_R2_RTDB_AUTH_RULES_HOSTING_WRITES=ZERO
if [[ "$rc" != 0 ]]; then
 echo APP616_FIREBASE_CLI_NONZERO_AFTER_THREE_VERIFIED_UPDATES_ARTIFACT_CLEANUP_REVIEW=HOLD
fi
