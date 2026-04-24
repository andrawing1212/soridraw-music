import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, writeBatch } from "firebase/firestore";
import { TAG_META, ALLOWED_TAGS_BY_SECTION, TAG_DESCRIPTIONS } from "../src/constants";

const firebaseConfig = {
  apiKey: "AIzaSyB_XyRUffNmJ5iugtvqx_3yY-rLi6PaumA",
  authDomain: "soridraw-app-866a5.firebaseapp.com",
  projectId: "soridraw-app-866a5",
  storageBucket: "soridraw-app-866a5.firebasestorage.app",
  messagingSenderId: "91309780603",
  appId: "1:91309780603:web:cde703895e2cf31ecffcde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const slugifyTagId = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-가-힣]/g, '');

async function migrate() {
  console.log("Starting migration...");
  const existingTagsSnapshot = await getDocs(collection(db, 'section_tags'));
  const existingIds = new Set(existingTagsSnapshot.docs.map((d) => d.id));
  console.log(`Found ${existingIds.size} existing tags in Firestore.`);

  const batch = writeBatch(db);
  let count = 0;

  // Collect all unique labels from both TAG_META and ALLOWED_TAGS_BY_SECTION
  const allLabels = new Set<string>(Object.keys(TAG_META));
  Object.values(ALLOWED_TAGS_BY_SECTION).forEach((sectionTags) => {
    sectionTags.forEach((label) => allLabels.add(label));
  });

  console.log(`Total labels to process from constants.ts: ${allLabels.size}`);

  for (const label of allLabels) {
    const id = slugifyTagId(label);

    if (existingIds.has(id)) {
        // console.log(`Skipping existing tag: ${id}`);
        continue;
    }

    const sections: string[] = [];
    for (const [section, allowedTags] of Object.entries(ALLOWED_TAGS_BY_SECTION)) {
      if (allowedTags.includes(label)) {
        sections.push(section);
      }
    }

    const tagRef = doc(db, 'section_tags', id);
    const meta = TAG_META[label as keyof typeof TAG_META];

    const tagData = {
      id,
      label,
      description: (TAG_DESCRIPTIONS as any)[label] || `${label}에 대한 설명입니다.`,
      tier: meta?.tier || 'free',
      sections,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    batch.set(tagRef, tagData);
    count++;
    console.log(`Adding tag: ${id} (${label})`);
  }

  if (count > 0) {
    await batch.commit();
    console.log(`${count} tags successfully migrated.`);
  } else {
    console.log('No new tags to migrate.');
  }
  
  // Final check
  const finalSnapshot = await getDocs(collection(db, 'section_tags'));
  console.log(`Final tag count in Firestore: ${finalSnapshot.size}`);
  
  console.log("\nExample documents (first 5):");
  finalSnapshot.docs.slice(0, 5).forEach(doc => {
      console.log(JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
  });
}

migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
