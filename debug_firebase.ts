
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFile } from 'fs/promises';

async function debugFirebase() {
  try {
    const config = JSON.parse(await readFile('./firebase-applet-config.json', 'utf-8'));
    console.log('Using config:', JSON.stringify(config, null, 2));
    const app = initializeApp(config);
    console.log('App initialized:', app.name);
    const db = getFirestore(app);
    console.log('Firestore initialized');
    const snapshot = await getDocs(collection(db, 'section_tags'));
    console.log('Docs found:', snapshot.size);
  } catch (e) {
    console.error('Debug failed:', e);
  }
}
debugFirebase();
