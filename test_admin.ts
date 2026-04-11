
import admin from 'firebase-admin';

async function testAdmin() {
  try {
    admin.initializeApp();
    const db = admin.firestore();
    const collections = await db.listCollections();
    console.log('Collections:', collections.map(c => c.id));
  } catch (e) {
    console.error('Admin test failed:', e);
  }
}
testAdmin();
