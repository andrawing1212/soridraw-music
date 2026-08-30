// 2026-08-30: no-op marker to redeploy the pre-Stage3 safe Preview baseline after rollback.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const fail = (message) => {
  console.error(`[Custom Preview Safety] FAIL: ${message}`);
  process.exit(1);
};
const pass = (message) => console.log(`[Custom Preview Safety] ${message}: PASS`);

const hostingConfig = JSON.parse(read('firebase.hosting-preview.json'));
if (!hostingConfig?.hosting || Array.isArray(hostingConfig.hosting)) fail('hosting config must contain one isolated hosting object');
if (hostingConfig.hosting.site !== 'soridraw-preview') fail('hosting site must be soridraw-preview');
if (hostingConfig.functions || hostingConfig.firestore || hostingConfig.database || hostingConfig.storage) {
  fail('preview hosting config must not contain backend resources');
}
pass('isolated soridraw-preview Hosting config');

const firebaseSource = read('src/firebase.js');
if (!firebaseSource.includes('projectId: "soridraw-app-866a5"')) fail('backend project changed');
if (!firebaseSource.includes('preview.soridraw.com')) fail('preview custom domain missing from Firebase client host recognition');
if (!firebaseSource.includes('soridraw-preview.web.app')) fail('preview Firebase site host missing from Firebase client host recognition');
pass('backend stays soridraw-app-866a5 and preview hosts are recognized');

const workflow = read('.github/workflows/firebase-hosting-custom-preview.yml');
const required = [
  'branches: [preview]',
  'firebase.hosting-preview.json',
  '--project soridraw',
  '--only hosting',
  'preview.soridraw.com',
  'soridraw-preview.web.app',
  'soridraw-preview.firebaseapp.com',
  'soridraw-app-866a5',
];
for (const marker of required) {
  if (!workflow.includes(marker)) fail(`workflow marker missing: ${marker}`);
}

const forbidden = [
  '--only functions',
  '--only firestore',
  '--only database',
  'firestore:delete',
  'database:remove',
  'hosting:channel:deploy',
  'firebase deploy --project soridraw --config firebase.hosting-only.json',
];
for (const marker of forbidden) {
  if (workflow.includes(marker)) fail(`forbidden workflow marker found: ${marker}`);
}
pass('workflow is preview Hosting-only with no backend deploy');

console.log('[Custom Preview Safety] All checks passed.');
