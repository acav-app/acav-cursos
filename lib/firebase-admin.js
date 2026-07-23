import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminAuthInstance = null;
let adminDbInstance = null;

const DEBUG_FIREBASE_ADMIN = process.env.DEBUG_FIREBASE_ADMIN === "1";
function debugLog(...args) {
  if (!DEBUG_FIREBASE_ADMIN) return;
  console.log(...args);
}

function getServiceAccountConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    if (
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))
    ) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");
  }
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

export function getAdminAuth() {
  if (adminAuthInstance) return adminAuthInstance;
  const apps = getApps();
  if (apps.length === 0) {
    const svc = getServiceAccountConfig();
    if (svc) {
      try {
        initializeApp({
          credential: cert({
            projectId: svc.projectId,
            clientEmail: svc.clientEmail,
            privateKey: svc.privateKey,
          }),
        });
        debugLog("Firebase Admin inicializado con service account");
      } catch (initError) {
        console.error("Error inicializando Firebase Admin:", initError);
        throw initError;
      }
    } else {
      // Fallback: initialize with default credentials (if present in environment)
      initializeApp();
    }
  }
  adminAuthInstance = getAuth();
  return adminAuthInstance;
}

export function getAdminDb() {
  if (adminDbInstance) return adminDbInstance;
  getAdminAuth();
  adminDbInstance = getFirestore();
  return adminDbInstance;
}

export function isDevBypassEnabled() {
  return process.env.DEV_BYPASS_AUTH === "1";
}

export async function verifyFirebaseToken(authorizationHeader) {
  const bypassEnabled = isDevBypassEnabled();
  if (bypassEnabled) {
    debugLog("DEV_BYPASS_AUTH activo: omitiendo verificación de Firebase");
    return { uid: "dev-user", email: "dev@example.com" };
  }

  if (!authorizationHeader || !authorizationHeader.toLowerCase().startsWith("bearer ")) {
    const error = new Error("Missing or invalid Authorization header");
    error.status = 401;
    throw error;
  }
  const token = authorizationHeader.substring(7);
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
    return decoded;
  } catch (e) {
    console.error("Error verificando token de Firebase:", {
      message: e?.message,
      code: e?.code,
    });
    const error = new Error(e?.message || "Unauthorized");
    error.status = 401;
    error.code = e?.code;
    throw error;
  }
}


