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
const workflow = readFileSync('.github/workflows/firebase-hosting-migration-phase1-preflight.yml', 'utf8');

const hostingOnlyKeys = Object.keys(hostingOnlyConfig);
if (hostingOnlyKeys.length !== 1 || hostingOnlyKeys[0] !== 'hosting') {
  throw new Error(`Phase 1 hosting-only config must contain only "hosting". keys=${hostingOnlyKeys.join(',')}`);
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

const forbiddenDeployTokens = [
  'channelId: live',
  'firebase deploy',
  'hosting:channel:deploy',
  'hosting:sites:create',
  'hosting:sites:delete',
];
for (const token of forbiddenDeployTokens) {
  if (workflow.includes(token)) {
    throw new Error(`Phase 1 preflight workflow must remain read-only; forbidden token: ${token}`);
  }
}

if (!workflow.includes('hosting:sites:list') || !workflow.includes('--project soridraw')) {
  throw new Error('Phase 1 workflow must read the existing soridraw Hosting site list explicitly.');
}

console.log('[Firebase Hosting migration] Phase 1 static safety: PASS');
console.log('  Hosting project (read-only preflight): soridraw');
console.log('  Existing app backend project preserved: soridraw-app-866a5');
console.log('  firebase.json backend resources untouched by hosting-only config');
