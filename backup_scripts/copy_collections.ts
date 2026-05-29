
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { readFile } from 'fs/promises';

async function copyCollections() {
  console.log('Waiting 10 seconds for rules to propagate...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    const config = JSON.parse(await readFile('./firebase-applet-config.json', 'utf-8'));
    const app = initializeApp(config);
    const db = getFirestore(app);

    const sourceCollectionName = 'section_tags';
    const targetCollections = ['section_tags_draft', 'section_tags_live'];

    console.log(`Fetching documents from ${sourceCollectionName}...`);
    const snapshot = await getDocs(collection(db, sourceCollectionName));
    console.log(`Found ${snapshot.size} documents.`);

    if (snapshot.empty) {
      console.log('No documents to copy.');
      // Even if empty, we might want to check if the collection exists or if it's just empty.
      // But getDocs will return empty if it doesn't exist or is empty.
    }

    for (const targetName of targetCollections) {
      console.log(`Copying to ${targetName}...`);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        const targetDocRef = doc(db, targetName, snapshotDoc.id);
        batch.set(targetDocRef, data);
      });

      if (snapshot.size > 0) {
        await batch.commit();
        console.log(`Successfully copied to ${targetName}.`);
      } else {
        console.log(`Nothing to copy to ${targetName}.`);
      }
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

copyCollections();
