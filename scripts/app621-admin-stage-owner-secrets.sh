#!/usr/bin/env bash
# APP621: human admin only. Stage exact owner HMAC secrets in UNUSED
# Cloudflare Worker versions. Does not deploy traffic, change Firebase,
# grant IAM, alter any user record, or print a secret/token.
set -Eeuo pipefail
set +x
umask 077
[[ "${1:-}" == '--stage' && $# -eq 1 ]] || { echo APP621_USAGE_STAGE_ONLY; exit 2; }
hold(){ echo "APP621_HOLD_$1" >&2; exit 2; }
PROJECT='soridraw-app-866a5'
ACCOUNT='e1a30fc9ef497fda1d34f4ab3dc1da45'
EXPLORE='soridraw-explore-preview'
OWNER='soridraw-owner-follow-preview-candidate'
WRANGLER='wrangler@4.119.0'
for tool in gcloud node npm npx python3 openssl; do
  command -v "$tool" >/dev/null 2>&1 || hold "MISSING_$tool"
done
[[ "$(gcloud projects describe "$PROJECT" --format='value(projectId)' 2>/dev/null)" == "$PROJECT" ]] || hold WRONG_FIREBASE_PROJECT
identity="$(gcloud auth list --filter='status:ACTIVE' --format='value(account)' 2>/dev/null)"
[[ -n "$identity" && "$identity" != *gserviceaccount.com ]] || hold HUMAN_ADMIN_REQUIRED
DIR="$(mktemp -d -t soridraw-app621-XXXXXXXX)" || hold TEMP_UNAVAILABLE
trap 'rm -rf -- "$DIR"' EXIT
# Verify both exact secrets are readable BEFORE asking for Cloudflare OAuth.
for secret in SORIDRAW_OWNER_FOLLOW_HMAC_539 SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544; do
  if ! gcloud secrets versions access latest --project="$PROJECT" --secret="$secret" > "$DIR/$secret" 2>/dev/null; then
    hold "GCP_SECRET_ACCESS_$secret"
  fi
  SECRET="$secret" TMP="$DIR" python3 - <<'PY' || hold "SECRET_FORMAT_$secret"
import os,sys
data=open(os.path.join(os.environ['TMP'],os.environ['SECRET']),'rb').read()
if not (32 <= len(data) <= 256) or any(b in data for b in (0,10,13)):
    sys.exit(2)
print('APP621_GCP_SECRET_FORMAT_'+os.environ['SECRET']+'=PASS')
PY
done
echo APP621_HUMAN_ADMIN_EXACT_GCP_SECRETS_READABLE=PASS
# APP622: The generic 'wrangler whoami' table is not authoritative for
# account membership. Use an explicit target account plus an actual read-only
# deployment listing for BOTH existing Workers before any secret staging.
# Never use a different account or rely on a previously cached selection.
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"
cloudflare_target_read_only() {
  npx --yes "$WRANGLER" whoami --account "$ACCOUNT" --json > "$DIR/whoami-target.json" 2>/dev/null &&
  npx --yes "$WRANGLER" deployments list --name "$EXPLORE" --json > "$DIR/explore-active.json" 2>/dev/null &&
  npx --yes "$WRANGLER" deployments list --name "$OWNER" --json > "$DIR/owner-active.json" 2>/dev/null
}
if ! cloudflare_target_read_only; then
  if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    hold ACCOUNT_TOKEN_OVERRIDES_OAUTH_CHECK_TOKEN_SCOPE
  fi
  echo APP622_CORRECT_CLOUDFLARE_ACCOUNT_LOGIN_REQUIRED
  npx --yes "$WRANGLER" login --device --browser=false || hold CLOUDFLARE_DEVICE_LOGIN_FAILED
  cloudflare_target_read_only || hold CORRECT_CLOUDFLARE_ACCOUNT_NOT_ACCESSIBLE
fi
echo APP622_EXACT_ACCOUNT_AND_BOTH_WORKERS_READ_ONLY=PASS
# Official 'versions secret put' creates a new UNUSED version; 'secret put'
# (without 'versions') would immediately deploy and is strictly prohibited.
if ! npx --yes "$WRANGLER" versions secret put SORIDRAW_OWNER_FOLLOW_HMAC_539 \
  --name "$EXPLORE" --message 'APP621 canary receiver HMAC, no deployment' \
  < "$DIR/SORIDRAW_OWNER_FOLLOW_HMAC_539" > "$DIR/cf1.log" 2>&1; then
  hold RECEIVER_HMAC_STAGE_FAILED_NO_DEPLOY
fi
echo APP621_EXPLORE_RECEIVER_HMAC_INACTIVE_VERSION=PASS
if ! npx --yes "$WRANGLER" versions secret put SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544 \
  --name "$EXPLORE" --message 'APP621 canary enrollment HMAC, no deployment' \
  < "$DIR/SORIDRAW_OWNER_FOLLOW_ENROLL_HMAC_544" > "$DIR/cf2.log" 2>&1; then
  hold ENROLL_HMAC_STAGE_FAILED_NO_DEPLOY
fi
echo APP621_EXPLORE_ENROLL_HMAC_INACTIVE_VERSION=PASS
# Generate one fresh shared internal capability, never echo its value.
openssl rand -hex 32 > "$DIR/owner-bridge"
test "$(wc -c < "$DIR/owner-bridge")" -ge 64 || hold BRIDGE_RANDOM_FAILED
if ! npx --yes "$WRANGLER" versions secret put SORIDRAW_OWNER_DO_BRIDGE_SECRET_600 \
  --name "$EXPLORE" --message 'APP621 private bridge capability, no deployment' \
  < "$DIR/owner-bridge" > "$DIR/cf3.log" 2>&1; then
  hold EXPLORE_BRIDGE_STAGE_FAILED_NO_DEPLOY
fi
echo APP621_EXPLORE_PRIVATE_BRIDGE_INACTIVE_VERSION=PASS
if ! npx --yes "$WRANGLER" versions secret put SORIDRAW_OWNER_DO_BRIDGE_SECRET_600 \
  --name "$OWNER" --message 'APP621 matching owner capability, no deployment' \
  < "$DIR/owner-bridge" > "$DIR/cf4.log" 2>&1; then
  hold OWNER_BRIDGE_STAGE_FAILED_NO_DEPLOY
fi
echo APP621_STANDALONE_PRIVATE_BRIDGE_INACTIVE_VERSION=PASS
echo APP621_ONLY_NONDEPLOYED_CLOUDFLARE_VERSIONS=PASS
echo APP621_SECRET_BYTES_NOT_PRINTED_OR_GITHUB_STORED=PASS
echo APP621_USER_DATA_FUNCTIONS_RULES_HOSTING_CHANGES=ZERO
