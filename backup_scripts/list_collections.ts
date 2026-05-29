
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

async function listCollections() {
  try {
    const config = JSON.parse(await readFile('./firebase-applet-config.json', 'utf-8'));
    admin.initializeApp({
      projectId: config.projectId
    });
    const db = admin.firestore();
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(c => c.id));
  } catch (e) {
    console.error('List failed:', e);
  }
}
listCollections();
