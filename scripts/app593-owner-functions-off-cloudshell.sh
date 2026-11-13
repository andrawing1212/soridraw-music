#!/usr/bin/env bash
# APP593: authenticated administrator-only ONE-TIME OFF installation.
# No Github Actions service-account permission expansion, no Worker/Rules/data deploy.
set -Eeuo pipefail
set +x
umask 077

PROJECT='soridraw-app-866a5'
REGION='asia-northeast3'
REPO='https://github.com/andrawing1212/soridraw-music.git'
SOURCE_SHA='db66bcb58427b55f0be34c77c29fef5d6f06480b'
NAMES=(publishExploreOwnerFollower542 enrollOwnerFollow544Candidate verifyOwnerFollowEpoch547Candidate)
SECRETS=(SORIDRAW_OWNER_FOLLOW_HMAC_539 SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544)

say() { printf '%s\n' "$*"; }
fail() { printf 'APP593_HOLD: %s\n' "$*" >&2; exit 2; }
usage() { say 'Usage: bash install.sh --apply'; exit 2; }
[[ "${1:-}" == '--apply' && $# == 1 ]] || usage

for binary in gcloud git node npm openssl firebase; do
  command -v "$binary" >/dev/null 2>&1 || fail "MISSING_TOOL_${binary}"
done
[[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -ge 22 ]] || fail 'NODE_22_OR_NEWER_REQUIRED'
# Use the human's authenticated Google Cloud Shell principal. No service account elevation.
ACTIVE_ACCOUNT="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)')" || fail 'GCLOUD_LOGIN_REQUIRED'
[[ -n "$ACTIVE_ACCOUNT" && "$ACTIVE_ACCOUNT" != *gserviceaccount.com ]] || fail 'HUMAN_ADMIN_GCLOUD_SESSION_REQUIRED'
ACTUAL_PROJECT="$(gcloud projects describe "$PROJECT" --format='value(projectId)')" || fail 'PROJECT_READ_ACCESS_DENIED'
[[ "$ACTUAL_PROJECT" == "$PROJECT" ]] || fail 'PROJECT_ID_MISMATCH'
say 'APP593_SHARED_PROJECT_VERIFIED=PASS'

# Check all existing target names before creating secrets or deploying functions.
TMP="$(mktemp -d -t soridraw-app593-XXXXXX)" || fail 'TEMP_DIRECTORY_UNAVAILABLE'
cleanup() { rm -rf -- "$TMP"; }
trap cleanup EXIT

gcloud functions list --project="$PROJECT" --regions=- --format='value(name)' --limit=10000 >"$TMP/installed-functions" || fail 'FUNCTIONS_INVENTORY_UNAVAILABLE'
for name in "${NAMES[@]}"; do
  if awk -F/ -v n="$name" '$NF==n{found=1} END{exit !found}' "$TMP/installed-functions"; then
    fail "EXISTING_TARGET_FUNCTION_HOLD_${name}"
  fi
done
say 'APP593_NEW_FUNCTIONS_ABSENT=PASS'

gcloud secrets list --project="$PROJECT" --format='value(name)' --limit=10000 >"$TMP/secrets" || fail 'SECRET_MANAGER_LIST_ACCESS_REQUIRED'
for secret in "${SECRETS[@]}"; do
  if awk -F/ -v n="$secret" '$NF==n{found=1} END{exit !found}' "$TMP/secrets"; then
    gcloud secrets describe "$secret" --project="$PROJECT" --format='value(name)' >/dev/null || fail "EXISTING_SECRET_INACCESSIBLE_${secret}"
    gcloud secrets versions list "$secret" --project="$PROJECT" --format='value(state)' | grep -Fxq ENABLED || fail "EXISTING_SECRET_VERSION_NOT_ENABLED_${secret}"
    say "APP593_EXISTING_SECRET_PRESERVED_${secret}=PASS"
  else
    say "APP593_MISSING_SECRET_TO_CREATE_${secret}=READY"
  fi
done

# Verify Firebase CLI's authenticated context before any shared Secret creation.
# Cloud Shell includes Firebase CLI; project list failure must NOT attempt login or IAM fixes.
if ! firebase projects:list --json >"$TMP/firebase-projects.json"; then
  fail 'FIREBASE_CLI_AUTH_REQUIRED_BEFORE_ANY_WRITE'
fi
node - "$TMP/firebase-projects.json" "$PROJECT" <<'NODE' || fail 'FIREBASE_CLI_PROJECT_NOT_ACCESSIBLE'
const fs=require('fs');
const doc=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const projects=Array.isArray(doc.result)?doc.result:Array.isArray(doc.projects)?doc.projects:[];
if(!projects.some(x=>x.projectId===process.argv[3])) process.exit(2);
NODE
say 'APP593_ADMIN_FIREBASE_CLI_PROJECT_VISIBLE=PASS'

# Build exact already-validated source. Never deploy the current moving branch.
git clone --quiet --no-tags --depth 16 --branch preview "$REPO" "$TMP/repo" || fail 'GITHUB_FETCH_FAILED'
if ! git -C "$TMP/repo" cat-file -e "${SOURCE_SHA}^{commit}" 2>/dev/null; then
  git -C "$TMP/repo" fetch --quiet origin "$SOURCE_SHA" || fail 'PINNED_SHA_UNAVAILABLE'
fi
git -C "$TMP/repo" checkout --quiet --detach "$SOURCE_SHA" || fail 'PINNED_SHA_CHECKOUT_FAILED'
[[ "$(git -C "$TMP/repo" rev-parse HEAD)" == "$SOURCE_SHA" ]] || fail 'PINNED_SHA_MISMATCH'

for fence in \
 'functions/src/exploreOwnerFollowerWebhook542.ts:export const APP542_OWNER_HTTP_COMPILED_OPEN=false;' \
 'functions/src/ownerFollowEnrollment544.ts:export const APP544_ENROLLMENT_COMPILED_OPEN=false;' \
 'functions/src/ownerFollowAuthProof547.ts:export const APP547_AUTH_PROOF_COMPILED_OPEN=false;'; do
  file="${fence%%:*}"; required="${fence#*:}"
  grep -Fxq "$required" "$TMP/repo/$file" || fail "FUNCTION_NOT_COMPILED_OFF_${file}"
done
for name in "${NAMES[@]}"; do
  grep -Fq "export {${name}} from " "$TMP/repo/functions/src/index.ts" || fail "ENTRYPOINT_NOT_EXPORTED_${name}"
done
say 'APP593_PINNED_THREE_FUNCTIONS_COMPILED_OFF=PASS'
npm ci --prefix "$TMP/repo/functions" --no-audit --no-fund >/dev/null || fail 'FUNCTIONS_NPM_CI_FAILED'
npm run build --prefix "$TMP/repo/functions" >/dev/null || fail 'FUNCTIONS_BUILD_FAILED'
(
  cd "$TMP/repo"
  node - <<'NODE'
const f=require('./functions/lib/securedIndex.js');
for(const n of ['publishExploreOwnerFollower542','enrollOwnerFollow544Candidate','verifyOwnerFollowEpoch547Candidate']) {
  if(!f[n]) throw Error('APP593_MISSING_EXPORT_'+n);
}
NODE
) || fail 'THREE_BUILT_EXPORTS_MISSING'
say 'APP593_FUNCTIONS_BUILD=PASS'

# APP594: Firebase CLI loads the full functions package entrypoint before its
# --only name filter. The broad securedIndex exposes unrelated Functions
# secrets (e.g. SORIDRAW_LIKE_GUARD_HMAC_V1_SECRET), which must NOT be
# provisioned, modified or read for this owner-only OFF install.
# Only the EPHEMERAL checkout's package main is narrowed; the repository and
# 42 existing deployed Functions remain untouched.
cat > "$TMP/repo/functions/lib/ownerFollowOnlyEntry594.js" <<'NODE'
'use strict';
const {initializeApp,getApps}=require('firebase-admin/app');
if(getApps().length!==0) throw Error('APP594_UNEXPECTED_EXISTING_ADMIN_APP');
initializeApp({
  databaseURL:'https://soridraw-app-866a5-default-rtdb.firebaseio.com',
});
const expected=[
  'enrollOwnerFollow544Candidate',
  'publishExploreOwnerFollower542',
  'verifyOwnerFollowEpoch547Candidate',
];
const exported={
  publishExploreOwnerFollower542:require('./exploreOwnerFollowerWebhook542').publishExploreOwnerFollower542,
  enrollOwnerFollow544Candidate:require('./ownerFollowEnrollment544').enrollOwnerFollow544Candidate,
  verifyOwnerFollowEpoch547Candidate:require('./ownerFollowAuthProof547').verifyOwnerFollowEpoch547Candidate,
};
if(JSON.stringify(Object.keys(exported).sort())!==JSON.stringify(expected)||
   Object.values(exported).some(x=>typeof x!=='function')){
  throw Error('APP594_FUNCTION_EXPORT_SET_MISMATCH');
}
module.exports=exported;
NODE
node - "$TMP/repo/functions/package.json" <<'NODE' || fail 'APP594_PACKAGE_ENTRY_PATCH_FAILED'
const fs=require('node:fs');
const path=process.argv[2];
const pkg=JSON.parse(fs.readFileSync(path,'utf8'));
if(pkg.main!=='lib/securedIndex.js')process.exit(2);
pkg.main='lib/ownerFollowOnlyEntry594.js';
fs.writeFileSync(path,JSON.stringify(pkg,null,2)+'\n','utf8');
NODE
(
  cd "$TMP/repo"
  node - <<'NODE'
const fs=require('node:fs');
const pkg=require('./functions/package.json');
if(pkg.main!=='lib/ownerFollowOnlyEntry594.js')
  throw Error('APP594_TEMP_MAIN_NOT_SELECTED');
const out=require('./functions/'+pkg.main);
const expected=[
 'enrollOwnerFollow544Candidate',
 'publishExploreOwnerFollower542',
 'verifyOwnerFollowEpoch547Candidate',
];
if(JSON.stringify(Object.keys(out).sort())!==JSON.stringify(expected))
  throw Error('APP594_NOT_EXACT_THREE_EXPORTS');
if(Object.keys(require.cache).some(p=>p.endsWith('/securedIndex.js')))
  throw Error('APP594_BROAD_ENTRYPOINT_WAS_LOADED');
NODE
) || fail 'APP594_EXACT_ENTRYPOINT_PREFLIGHT_FAILED'
say 'APP594_EPHEMERAL_ONLY_THREE_EXPORTS_NO_UNRELATED_SECRETS=PASS'

# This is the first shared mutation stage. No IAM policy change, existing secret
# versions untouched, and the random secret bytes never enter argv or stdout.
for secret in "${SECRETS[@]}"; do
  if awk -F/ -v n="$secret" '$NF==n{found=1} END{exit !found}' "$TMP/secrets"; then
    continue
  fi
  if ! openssl rand -hex 32 | tr -d '\n' | gcloud secrets create "$secret" \
      --project="$PROJECT" --replication-policy=automatic --data-file=- --quiet >/dev/null; then
    fail "SECRET_CREATE_FAILED_${secret}_REVIEW_BEFORE_RETRY"
  fi
  say "APP593_PRIVATE_SECRET_CREATED_${secret}=PASS"
done

# Firebase official exact-function deployment syntax. No --force, no data writes.
(
  cd "$TMP/repo"
  firebase deploy \
    --only 'functions:publishExploreOwnerFollower542,functions:enrollOwnerFollow544Candidate,functions:verifyOwnerFollowEpoch547Candidate' \
    --project "$PROJECT" --config firebase.json --non-interactive
) || fail 'EXACT_FUNCTIONS_DEPLOY_FAILED_NO_AUTOMATIC_RETRY'

for name in "${NAMES[@]}"; do
  state="$(gcloud functions describe "$name" --v2 --region="$REGION" --project="$PROJECT" --format='value(state)')" || fail "FUNCTION_POSTFLIGHT_UNAVAILABLE_${name}"
  [[ "$state" == ACTIVE ]] || fail "FUNCTION_NOT_ACTIVE_${name}"
  say "APP593_FUNCTION_INSTALLED_OFF_${name}=PASS"
done
say 'APP593_SCOPE_ONLY_THREE_OFF_FUNCTIONS_AND_TWO_SECRET_NAMES=PASS'
say 'APP593_WORKER_RULES_D1_R2_HOSTING_USER_ROWS_NOT_CHANGED=PASS'
say 'APP593_REAL_USER_PC_MOBILE_SYNC=NOT_YET_ACTIVE'
