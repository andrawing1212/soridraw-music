#!/usr/bin/env node
// app497 independent PRODUCTION gate. Missing approval secret or evidence fails
// closed before Worker/Hosting/branch mutation. No remote I/O.
import { readFileSync } from 'node:fs';
import { verifyOwnerAcceptance } from './release-owner-acceptance-497.mjs';

const [manifestPath, ownerAcceptancePath, ownerLogin] = process.argv.slice(2);
if (!manifestPath || !ownerAcceptancePath || !ownerLogin)
  throw Error('usage: verify-497-owner-acceptance-cli.mjs <pending-manifest> <signed-owner-acceptance> <authorized-owner>');
if (ownerLogin !== process.env.GITHUB_REPOSITORY_OWNER)
  throw Error('OWNER_ACCEPTANCE_OWNER_NOT_REPOSITORY_OWNER');

const pending = JSON.parse(readFileSync(manifestPath,'utf8'));
const acceptance = JSON.parse(readFileSync(ownerAcceptancePath,'utf8'));
verifyOwnerAcceptance(
  acceptance,pending,ownerLogin,process.env.SORIDRAW_RELEASE_ATTESTATION_KEY,
);
console.log('APP497_PROD_SIGNED_OWNER_ACCEPTANCE=PASS');
