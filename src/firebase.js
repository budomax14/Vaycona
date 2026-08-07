// Firebase app + Auth + Firestore initialization. Auth provides real user
// accounts; Firestore backs the one piece of shared server state this app
// has — the admin-published template gallery (see firestoreTemplates.js) —
// so admin changes there propagate live to every user. Everything else
// (personal reusable content, drafts, favorites) stays local per-browser
// via templateService.js's IndexedDB store, unaffected by this.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD4uDhMqJDEtEd0CzZSqduCUvYjjugOut0",
  authDomain: "vaycona-editor.firebaseapp.com",
  projectId: "vaycona-editor",
  storageBucket: "vaycona-editor.firebasestorage.app",
  messagingSenderId: "1085152535464",
  appId: "1:1085152535464:web:d524827a93eb9ead52339d",
};

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
