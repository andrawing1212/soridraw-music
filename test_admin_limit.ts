
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

async function testAdmin() {
  try {
    const config = JSON.parse(await readFile('./firebase-applet-config.json', 'utf-8'));
    admin.initializeApp({
      projectId: config.projectId
    });
    const db = admin.firestore();
    const snapshot = await db.collection('section_tags').limit(1).get();
    console.log('Docs found:', snapshot.size);
  } catch (e) {
    console.error('Admin test failed:', e);
  }
}
testAdmin();
