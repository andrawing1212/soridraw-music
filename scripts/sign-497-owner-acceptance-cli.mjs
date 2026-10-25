#!/usr/bin/env node
// app497 owner-triggered TEST acceptance issuer. This tool only signs a local
// JSON evidence file. It neither deploys code nor changes any user records.
import { readFileSync, writeFileSync } from 'node:fs';
import {
  canonicalJSON,sha256,signOwnerAcceptance,verifyOwnerAcceptance,
} from './release-owner-acceptance-497.mjs';

const [pendingPath, evidencePath, outputPath] = process.argv.slice(2);
if (!pendingPath || !evidencePath || !outputPath) throw Error('OWNER_ACCEPTANCE_USAGE');
if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    process.env.GITHUB_ACTOR !== process.env.GITHUB_REPOSITORY_OWNER ||
    process.env.GITHUB_TRIGGERING_ACTOR !== process.env.GITHUB_ACTOR ||
    process.env.OWNER_ACCEPTANCE_EXPLICIT_CONFIRMATION !== 'ACCEPT_TEST_RESULTS')
  throw Error('OWNER_ACCEPTANCE_ONLY_REPOSITORY_OWNER_EXPLICIT_MANUAL_ACTION');
const pending=JSON.parse(readFileSync(pendingPath,'utf8'));
const evidence=JSON.parse(readFileSync(evidencePath,'utf8'));
if (evidence.ownerLogin !== process.env.GITHUB_ACTOR)
  throw Error('OWNER_ACCEPTANCE_OWNER_ID_MISMATCH');
const authorizedAt=new Date();
if (!Number.isFinite(Date.parse(evidence.ownerAuthorizedAt)) ||
    Math.abs(authorizedAt.getTime()-Date.parse(evidence.ownerAuthorizedAt)) > 15*60*1000)
  throw Error('OWNER_ACCEPTANCE_EXPIRED_OR_STALE');
if (!evidence.ownerApprovalRef?.includes('/actions/runs/'))
  throw Error('OWNER_ACCEPTANCE_EXPECT_REAL_ACTION_RUN_REFERENCE');
if (evidence.ownerApprovalRef !==
    `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`)
  throw Error('OWNER_ACCEPTANCE_GITHUB_RUN_REFERENCE_MISMATCH');
if (evidence.pendingManifestSha256 !== sha256(canonicalJSON(pending)))
  throw Error('OWNER_ACCEPTANCE_WRONG_PENDING_MANIFEST');
const signed=signOwnerAcceptance(
  evidence,pending,process.env.GITHUB_ACTOR,process.env.SORIDRAW_RELEASE_ATTESTATION_KEY,
);
verifyOwnerAcceptance(
  signed,pending,process.env.GITHUB_ACTOR,process.env.SORIDRAW_RELEASE_ATTESTATION_KEY,
);
writeFileSync(outputPath,JSON.stringify(signed,null,2)+'\n',{flag:'wx',mode:0o600});
console.log('APP497_OWNER_APPROVAL_SIGNED_FOR_EXACT_TEST_ARTIFACT=PASS');
