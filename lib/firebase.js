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

const firebaseConfig = {
  apiKey: "AIzaSyDSu5Q-EnE9Ab5knk3ZSDka6ID-c-ZaZaY",
  authDomain: "acav-empleos.firebaseapp.com",
  projectId: "acav-empleos",
  messagingSenderId: "53935186430",
  appId: "1:53935186430:web:087157f79b250c375c20af",
  measurementId: "G-E6R6XG5YL9"
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
