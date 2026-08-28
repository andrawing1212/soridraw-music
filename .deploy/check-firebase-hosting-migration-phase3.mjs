import { readFileSync } from 'node:fs';

const firebaseSource = readFileSync('src/firebase.js', 'utf8');
const workflow = readFileSync('.github/workflows/firebase-hosting-migration-phase3-auth.yml', 'utf8');

const requiredFirebaseTokens = [
  'authDomain: "soridraw-app-866a5.firebaseapp.com"',
  'projectId: "soridraw-app-866a5"',
  'isFirebaseHostingPreviewApp',
  '/^soridraw--[a-z0-9-]+\\.web\\.app$/',
  'ReCaptchaEnterpriseProvider',
  '6Le6bGEtAAAAAOVROhuXew0lxJcpVNVwPZN0ZWKO',
];
for (const token of requiredFirebaseTokens) {
  if (!firebaseSource.includes(token)) {
    throw new Error(`Phase 3 firebase source missing required token: ${token}`);
  }
}

const requiredWorkflowTokens = [
  'soridraw-app-866a5',
  'identitytoolkit.googleapis.com/admin/v2/projects/soridraw-app-866a5/config',
  'updateMask=authorizedDomains',
  'recaptchaenterprise.googleapis.com/v1/projects/soridraw-app-866a5/keys/',
  'updateMask=webSettings.allowedDomains',
  'hosting:channel:deploy phase2-preview',
  '--project soridraw',
  '--config firebase.hosting-only.json',
  'https://soridraw.web.app/',
];
for (const token of requiredWorkflowTokens) {
  if (!workflow.includes(token)) {
    throw new Error(`Phase 3 workflow missing required safety token: ${token}`);
  }
}

const forbiddenWorkflowTokens = [
  'firebase deploy',
  'hosting:channel:deploy live',
  '--only functions',
  '--only firestore',
  '--only database',
  'firestore:delete',
  'functions:delete',
  'hosting:sites:delete',
];
for (const token of forbiddenWorkflowTokens) {
  if (workflow.includes(token)) {
    throw new Error(`Phase 3 workflow contains forbidden production/backend deploy token: ${token}`);
  }
}

if (!workflow.includes('branches: [preview]') || !workflow.includes('ref: preview')) {
  throw new Error('Phase 3 workflow must remain pinned to preview.');
}

console.log('[Firebase Hosting migration] Phase 3 static safety: PASS');
console.log('  Existing Firebase backend project remains soridraw-app-866a5');
console.log('  Only Canary authorized-domain/App Check domain allowlists may be extended');
console.log('  Hosting deploy remains preview channel only; live Hosting/Rules/Functions excluded');
