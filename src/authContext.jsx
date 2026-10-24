import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  signInAnonymously,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { auth, functions } from "./firebase";
import { isMobileApp } from "./platform";
import { ADMIN_EMAIL } from "./constants";
import { enterAccountStorage } from "./storageScope";

const AuthContext = createContext(null);

// The iOS/Android WebViews can't run Google's sign-in popup, so the apps show
// the native Google / Apple sheet (skipNativeAuth in capacitor.config.json)
// and hand its token to the JS SDK — the session then lives in `auth` exactly
// as on the website.
async function signInWithGoogleNatively() {
  const result = await FirebaseAuthentication.signInWithGoogle();
  return signInWithCredential(auth, GoogleAuthProvider.credential(result.credential?.idToken));
}

async function signInWithAppleNatively() {
  const result = await FirebaseAuthentication.signInWithApple();
  const credential = new OAuthProvider("apple.com").credential({
    idToken: result.credential?.idToken,
    rawNonce: result.credential?.nonce,
  });
  return signInWithCredential(auth, credential);
}

// Wraps the whole app (AppRoot.jsx) so both the normal editor and the admin
// section sit behind one real login — the SAME login form every user goes
// through. Whether that logged-in account is the admin is just an email
// check against ADMIN_EMAIL, exposed here as `isAdmin` so both AppRoot's
// routing and any "go to admin" entry points (TopNavBar) can use it without
// each re-deriving the comparison.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      // Another account's on-device data must never load — when the
      // account changes, the page reloads into this one's storage first.
      if (next && enterAccountStorage(next, next.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())) return;
      setUser(next);
    });
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
    signInWithGoogle: () =>
      isMobileApp ? signInWithGoogleNatively() : signInWithPopup(auth, new GoogleAuthProvider()),
    signInWithApple: signInWithAppleNatively,
    signOut: async () => {
      // Also drop the native Google session, or the next Google sign-in
      // silently reuses this account instead of offering the picker.
      if (isMobileApp) await FirebaseAuthentication.signOut().catch(() => {});
      await firebaseSignOut(auth);
    },
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
