
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFile } from 'fs/promises';

async function checkRead() {
  try {
    const config = JSON.parse(await readFile('./firebase-applet-config.json', 'utf-8'));
    const app = initializeApp(config);
    const db = getFirestore(app);
    const snapshot = await getDocs(collection(db, 'section_tags'));
    console.log(`Read success: ${snapshot.size} docs`);
  } catch (e) {
    console.error('Read failed:', e);
  }
}
checkRead();
