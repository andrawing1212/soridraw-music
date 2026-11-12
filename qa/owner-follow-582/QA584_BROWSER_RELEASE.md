# APP584 — Independent QA browser receiver / Hosting gate

Scope: Firebase QA project soridraw-app, number 1083981050742, synthetic Auth A/B and a single dedicated QA Hosting site soridraw-qa-owner-584. Never use normal SORIDRAW src/firebase.js, PREVIEW, PRODUCTION or shared Cloudflare/Firebase backend.

Status: Source package and mocked two-browser follow/unfollow reception PASS. No actual Hosting deploy or PC/mobile Web SDK reception was performed. Reuse APP583 independent server transport evidence (follow 3,103ms; unfollow 1,690ms) without repeating that probe unless physical browser proof is ready.

Preflight before deployment (live provider console required):
- Confirm QA project ID and number, current billing, approx. KRW 7,000 project-filtered budget alert, service-specific spend controls, and separate IAM/credentials. Alert is NOT an enforceable overall cap.
- Verify QA Firebase Web app ID begins with 1:1083981050742:web:, QA API key, Auth email/password synthetic A/B, owner A epoch claim, and SG RTDB owner-only rules. Do not put password, HMAC, private token or even the QA Web configuration in GitHub.
- Verify the exact new site soridraw-qa-owner-584 belongs to QA project (or is absent). Never reuse or overwrite default/operating Hosting. Confirm that the QA Cloudflare Worker currently deployed is the successful isolated build; unrelated failed PR-head builds do not prove current live version.

Only after all gates pass, in authenticated QA Cloud Shell at the repository root run:

    node qa/owner-follow-582/build-qa584-static.mjs --qa-only
    node qa/owner-follow-582/verify-qa584-browser.mjs
    firebase hosting:sites:list --project soridraw-app

If exact QA target is confirmed absent and safe to create:

    firebase hosting:sites:create soridraw-qa-owner-584 --project soridraw-app

Then deploy this config ONLY (one QA site; no Functions, Rules, D1/R2 or production):

    firebase deploy --project soridraw-app --config firebase.qa584.json --only hosting

Test https://soridraw-qa-owner-584.web.app on PC and mobile. Enter QA Web app public config and synthetic A owner UID/password per session (nothing is committed). Both must receive initial count 0 and same version, then press the QA receiver-arm button. Initial snapshot alone is NOT PASS.

Only after both browsers are armed, in the existing QA-only Cloud Shell run the pre-existing synthetic B follow/unfollow probe once:

    node functions/qa577/qa-run-live-follow-583.cjs --qa-only

Each browser should see baseline+1 followerCount=1 and baseline+2 followerCount=0 without refresh, with identical final versions; record observed delay and provider cost only if independently metered. No secrets in browser/chat/repo. If a gate fails: HOLD, never substitute shared project or Worker.

QA Web SDK reception PASS still does NOT authorize PR #914 merge, operating canonical follow activation or production release.
