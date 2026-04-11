
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import { readFile } from 'fs/promises';

async function debugFirebase() {
  try {
    const config = JSON.parse(await readFile('./firebase-applet-config.json', 'utf-8'));
    const app = initializeApp(config);
    const db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    });
    console.log('Firestore initialized with long polling');
    const snapshot = await getDocs(collection(db, 'section_tags'));
    console.log('Docs found:', snapshot.size);
  } catch (e) {
    console.error('Debug failed:', e);
  }
}
debugFirebase();
