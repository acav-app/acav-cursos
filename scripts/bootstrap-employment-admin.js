const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(`No se encontro ${envPath}`);
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getServiceAccountConfig() {
  loadLocalEnv();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY");
  }

  return { projectId, clientEmail, privateKey };
}

function getAdminApp() {
  const apps = getApps();
  if (apps.length) return apps[0];

  const svc = getServiceAccountConfig();
  return initializeApp({
    credential: cert({
      projectId: svc.projectId,
      clientEmail: svc.clientEmail,
      privateKey: svc.privateKey,
    }),
  });
}

async function bootstrapEmploymentAdmin(email) {
  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const firebaseUser = await auth.getUserByEmail(email);
  const now = new Date().toISOString();
  const ref = db.collection("employmentUsers").doc(String(firebaseUser.uid));
  const existing = await ref.get();

  const payload = {
    email: String(firebaseUser.email || email).trim().toLowerCase(),
    displayName: String(firebaseUser.displayName || "Administrador").trim(),
    role: "admin",
    isActive: true,
    createdAt: existing.exists ? existing.data()?.createdAt || now : now,
    updatedAt: now,
  };

  await ref.set(payload, { merge: true });
  const saved = await ref.get();

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: app.options.credential.projectId,
        email: firebaseUser.email,
        uid: firebaseUser.uid,
        collection: "employmentUsers",
        existsBefore: existing.exists,
        data: saved.data(),
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  const email = process.argv[2] || "admin@admin.com";
  bootstrapEmploymentAdmin(email).catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          email,
          message: error?.message || String(error),
          stack: error?.stack || null,
        },
        null,
        2
      )
    );
    process.exit(1);
  });
}

module.exports = { bootstrapEmploymentAdmin };
