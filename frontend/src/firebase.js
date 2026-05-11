import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB2Hi8rwBmrFByt2z7X5yq3Kx9Zo0xJkQI",
  authDomain: "kudos-61fd2.firebaseapp.com",
  projectId: "kudos-61fd2",
  storageBucket: "kudos-61fd2.firebasestorage.app",
  messagingSenderId: "577670925743",
  appId: "1:577670925743:web:18e6b6a0eb574dadb4335a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;

