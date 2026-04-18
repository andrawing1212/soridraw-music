import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAdmin() {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log("[Test] Target Project:", firebaseConfig.projectId);

    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
    
    const db = admin.firestore();
    console.log("[Test] Attempting to list users collection...");
    const snapshot = await db.collection('users').limit(1).get();
    console.log("[Test] Success! Users count (limit 1):", snapshot.size);
    
  } catch (e: any) {
    console.error('[Test] Admin test failed:', e.message || e);
  }
}
testAdmin();
