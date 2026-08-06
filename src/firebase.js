// Firebase app + Auth initialization. This project uses Firebase only for
// static hosting and (as of this file) real user accounts via Firebase
// Authentication — there is still no other backend (no Firestore/DB calls
// anywhere in this app).
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

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
