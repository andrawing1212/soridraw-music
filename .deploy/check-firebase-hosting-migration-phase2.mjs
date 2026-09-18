import { readFileSync } from 'node:fs';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
};

const rootConfig = readJson('firebase.json');
const hostingOnlyConfig = readJson('firebase.hosting-only.json');
const appletConfig = readJson('firebase-applet-config.json');
const firebaseSource = readFileSync('src/firebase.js', 'utf8');
const workflow = readFileSync('.github/workflows/firebase-hosting-migration-phase2-canary.yml', 'utf8');

const hostingOnlyKeys = Object.keys(hostingOnlyConfig);
if (hostingOnlyKeys.length !== 1 || hostingOnlyKeys[0] !== 'hosting') {
  throw new Error(`Phase 2 hosting-only config must contain only "hosting". keys=${hostingOnlyKeys.join(',')}`);
}

if (JSON.stringify(stable(rootConfig.hosting)) !== JSON.stringify(stable(hostingOnlyConfig.hosting))) {
  throw new Error('firebase.hosting-only.json must exactly mirror the current firebase.json Hosting config.');
}

for (const forbidden of ['functions', 'firestore', 'database', 'storage', 'extensions']) {
  if (Object.prototype.hasOwnProperty.call(hostingOnlyConfig, forbidden)) {
    throw new Error(`Hosting-only config must not contain backend resource: ${forbidden}`);
  }
}

if (appletConfig.projectId !== 'soridraw-app-866a5') {
  throw new Error(`Existing app backend project changed unexpectedly: ${appletConfig.projectId}`);
}
if (!firebaseSource.includes('projectId: "soridraw-app-866a5"')) {
  throw new Error('src/firebase.js no longer points at the existing soridraw-app-866a5 backend.');
}

const requiredTokens = [
  'hosting:channel:deploy phase2-preview',
  '--project soridraw',
  '--config firebase.hosting-only.json',
  '--expires 7d',
  'https://soridraw.web.app/',
  'https://soridraw-music-git-preview-andrawing1212.vercel.app/',
];
for (const token of requiredTokens) {
  if (!workflow.includes(token)) {
    throw new Error(`Phase 2 workflow is missing required safety token: ${token}`);
  }
}

const forbiddenWorkflowTokens = [
  'firebase deploy',
  'hosting:channel:deploy live',
  'hosting:sites:create',
  'hosting:sites:delete',
  '--only functions',
  '--only firestore',
  '--only database',
  'firestore:delete',
];
for (const token of forbiddenWorkflowTokens) {
  if (workflow.includes(token)) {
    throw new Error(`Phase 2 canary workflow contains forbidden production/backend token: ${token}`);
  }
}

if (!workflow.includes('branches: [preview]') || !workflow.includes('ref: preview')) {
  throw new Error('Phase 2 canary must remain pinned to the preview branch.');
}

console.log('[Firebase Hosting migration] Phase 2 static safety: PASS');
console.log('  Canary channel: phase2-preview (expires in 7d)');
console.log('  Hosting project: soridraw');
console.log('  Existing app backend preserved: soridraw-app-866a5');
console.log('  Production live channel and backend resources are outside this workflow');
