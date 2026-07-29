import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";

function getRequiredEnv(name, value) {
  const resolvedValue = String(value || "").trim();
  if (!resolvedValue) {
    throw new Error(`Missing Firebase environment variable: ${name}`);
  }
  return resolvedValue;
}

const firebaseConfig = {
  apiKey: getRequiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: getRequiredEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: getRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  messagingSenderId: getRequiredEnv(
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  ),
  appId: getRequiredEnv("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: String(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "").trim() || undefined,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail({ email, password, displayName }) {
  const credentials = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credentials.user, { displayName });
  }
  return credentials;
}

export async function sendResetPasswordEmail(email) {
  return sendPasswordResetEmail(auth, email);
}

export async function logoutFirebase() {
  return signOut(auth);
}

export function onAuthStateChangedFirebase(callback) {
  return onAuthStateChanged(auth, callback);
}

// Subir clientes iniciales a Firestore
export async function uploadInitialClientes(clientes) {
  const snapshot = await getDocs(collection(db, "clientes"));
  if (!snapshot.empty) return; // Ya existen clientes
  for (const cliente of clientes) {
    await addDoc(collection(db, "clientes"), cliente);
  }
}

// Funciones para leads (si no se usan, se pueden eliminar)
export async function updateLeadInFirebase(leadId, data) {
  const { doc, updateDoc } = await import("firebase/firestore");
  const leadRef = doc(db, "leads", leadId);
  return updateDoc(leadRef, data);
}

export async function saveLeadToFirebase(data) {
  return addDoc(collection(db, "leads"), {
    ...data,
    createdAt: serverTimestamp(),
  });
} 
