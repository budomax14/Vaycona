import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInAnonymously,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase";
import { ADMIN_EMAIL } from "./constants";

const AuthContext = createContext(null);

// Wraps the whole app (AppRoot.jsx) so both the normal editor and the admin
// section sit behind one real login — the SAME login form every user goes
// through. Whether that logged-in account is the admin is just an email
// check against ADMIN_EMAIL, exposed here as `isAdmin` so both AppRoot's
// routing and any "go to admin" entry points (TopNavBar) can use it without
// each re-deriving the comparison.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const isAdmin = !!user && user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  // Guests (Firebase anonymous auth) can design but not save, export or
  // print — see App.jsx's requireAccount.
  const isGuest = !!user?.isAnonymous;

  const value = {
    user,
    loading: user === undefined,
    isAdmin,
    isGuest,
    continueAsGuest: () => signInAnonymously(auth),
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signUp: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signOut: () => firebaseSignOut(auth),
    // Server-side delete (functions/accountDeletion.js) — the Auth user is
    // gone afterwards, so just clear the local session.
    deleteAccount: async () => {
      await httpsCallable(functions, "deleteAccount")();
      await firebaseSignOut(auth);
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
