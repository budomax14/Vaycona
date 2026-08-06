import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";

const AuthContext = createContext(null);

// Wraps the whole app (AppRoot.jsx) so both the normal editor and the admin
// section sit behind one real login. Distinct from the local passcode gate
// in adminAuth.js, which only ever protected the admin dashboard from
// accidental access on a shared device — this is real per-user
// authentication via Firebase Auth.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const value = {
    user,
    loading: user === undefined,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signUp: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signOut: () => firebaseSignOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
