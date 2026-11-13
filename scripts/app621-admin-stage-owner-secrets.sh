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
# APP624: One browser approval is enough. Do NOT auto-start OAuth again.
# If login is incomplete, ask the human to finish it separately and preserve
# the original reason for failure. Never stage secrets to an unverified account.
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT"
if [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  hold CONFLICTING_CLOUDFLARE_API_TOKEN
fi
if ! npx --yes "$WRANGLER" whoami --json > "$DIR/whoami.json" 2>/dev/null; then
  hold WRANGLER_LOGIN_NOT_SAVED_NO_AUTO_REAUTH
fi
echo APP624_CLOUDFLARE_CLI_LOGIN_SAVED=PASS
if ! npx --yes "$WRANGLER" whoami --account "$ACCOUNT" --json > "$DIR/target-account.json" 2>/dev/null; then
  hold TARGET_CLOUDFLARE_ACCOUNT_NOT_VERIFIED_NO_AUTO_REAUTH
fi
echo APP624_EXACT_ACCOUNT_MEMBERSHIP=PASS
# Explicit Worker membership via GET-only Wrangler commands, not whoami text.
for worker in "$EXPLORE" "$OWNER"; do
  if ! npx --yes "$WRANGLER" deployments status --name "$worker" --json > "$DIR/$worker-active.json" 2>/dev/null; then
    hold "TARGET_WORKER_READ_$worker"
  fi
done
echo APP624_BOTH_WORKERS_READ_ONLY_ACCESS=PASS
# APP624 does NOT upload yet. The previous APP621 staged each secret into a
# DIFFERENT unused version and could lose the prepared Service Bindings.
# A version-locked atomic secret staging strategy must be checked first.
echo APP624_SECRETS_STAGE=HOLD_PENDING_ATOMIC_VERSION_BINDING_PROOF
echo APP624_NO_CLOUDFLARE_WRITE_OR_USER_DATA_CHANGE=PASS
