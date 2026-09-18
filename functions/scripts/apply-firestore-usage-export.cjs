const fs = require('node:fs');
const path = require('node:path');

const functionsRoot = path.resolve(__dirname, '..');
const outputPath = path.join(functionsRoot, 'src', 'securedIndex.ts');
const exportLine = 'export { getFirestoreServerUsage } from "./firestoreUsageMetrics";';

let source = fs.readFileSync(outputPath, 'utf8');
if (!source.includes(exportLine)) {
  source = `${source.trimEnd()}\n\n${exportLine}\n`;
  fs.writeFileSync(outputPath, source, 'utf8');
}

console.log('Applied Firestore Cloud Monitoring callable export to securedIndex.ts.');
