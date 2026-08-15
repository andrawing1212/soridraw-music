import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

async function test() {
    console.log("Testing write to section_tags/test-id...");
    try {
        await setDoc(doc(db, 'section_tags', 'test-id'), { test: true, timestamp: Date.now() });
        console.log("Test write successful!");
    } catch (err) {
        console.error("Test write failed:", err);
    }
}

test();
