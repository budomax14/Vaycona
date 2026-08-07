import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";
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

  const value = {
    user,
    loading: user === undefined,
    isAdmin,
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
