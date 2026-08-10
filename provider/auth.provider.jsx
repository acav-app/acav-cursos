"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, onAuthStateChangedFirebase, logoutFirebase } from "@/lib/firebase";

const TOKEN_STORAGE_KEY = "acav:auth:last_token";

async function saveTokenFromUser(firebaseUser) {
  if (!firebaseUser) {
    try {
      if (typeof window !== "undefined") window.localStorage?.removeItem?.(TOKEN_STORAGE_KEY);
    } catch (_) {}
    return;
  }
  try {
    const token = typeof firebaseUser.getIdToken === "function" ? await firebaseUser.getIdToken(false) : firebaseUser?.stsTokenManager?.accessToken || firebaseUser?.accessToken || null;
    if (token && typeof window !== "undefined") {
      window.localStorage?.setItem?.(TOKEN_STORAGE_KEY, String(token));
    }
  } catch (_) {}
}

const AuthContext = createContext({
  user: null,
  loading: true,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedFirebase((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      saveTokenFromUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      if (typeof window !== "undefined") window.localStorage?.removeItem?.(TOKEN_STORAGE_KEY);
    } catch (_) {}
    await logoutFirebase();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
