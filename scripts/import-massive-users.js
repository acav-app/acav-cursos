const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const USERS_JSON_PATH = process.env.USERS_JSON_PATH
  ? path.resolve(process.env.USERS_JSON_PATH)
  : path.join(__dirname, "..", "usuarios.json");
const COLLECTION = "employmentUsers";
const DEFAULT_ROLE = "alumno";

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

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

function parseEsSocio(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (["si", "s", "yes", "true", "1", "socio"].includes(value)) return true;
  if (["no", "n", "false", "0", "ninguno"].includes(value)) return false;
  return false;
}

function splitFullName(raw) {
  const text = String(raw || "").trim();
  if (!text) return { firstName: "", lastName: "" };
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  if (parts.length === 3) return { firstName: parts.slice(0, 2).join(" "), lastName: parts[2] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizePhone(raw) {
  return String(raw || "")
    .replace(/[^\d+]/g, "")
    .trim();
}

function readUsersFromJson() {
  if (!fs.existsSync(USERS_JSON_PATH)) {
    throw new Error(`No existe el archivo JSON en ${USERS_JSON_PATH}`);
  }
  const raw = fs.readFileSync(USERS_JSON_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("El JSON debe ser un arreglo de objetos con usuarios.");
  }
  return parsed;
}

function normalizeUser(raw, index) {
  const fullNameRaw = String(raw?.nombre_y_apellido || "").trim();
  const { firstName, lastName } = splitFullName(fullNameRaw);
  const email = String(raw?.email_contacto || "").trim().toLowerCase();
  const password = String(
    raw?.contrasena ||
      raw?.password ||
      raw?.dni ||
      ""
  ).trim();
  const documentNumber = String(raw?.dni || "").trim();
  const agency = String(raw?.agencia || "").trim();
  const employeeFileNumber = String(raw?.legajo || "").trim();
  const phone = normalizePhone(raw?.telefono_contacto || raw?.telefono || "");
  const isMember = parseEsSocio(raw?.es_socio);

  const warnings = [];
  if (!email) warnings.push("sin email");
  if (!password || password.length < 6) warnings.push("password <6, se setea password fallback");
  if (!firstName || !lastName) warnings.push("nombre/apellido incompletos");

  return {
    index,
    email,
    password: password && password.length >= 6 ? password : `Acav${documentNumber || index + 1}!`,
    displayName: fullNameRaw || `${firstName} ${lastName}`.trim() || email,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim() || fullNameRaw,
    documentNumber,
    agency: agency || "No informado",
    employeeFileNumber: employeeFileNumber || "No informado",
    phone,
    contactEmail: email,
    isMember,
    warnings,
    source: raw,
  };
}

function dedupeUsers(users) {
  const byEmail = new Map();
  for (const u of users) {
    if (!u.email) continue;
    const current = byEmail.get(u.email);
    if (!current) {
      byEmail.set(u.email, u);
      continue;
    }
    const merged = {
      ...current,
      firstName: current.firstName || u.firstName,
      lastName: current.lastName || u.lastName,
      fullName: current.fullName || u.fullName,
      displayName: current.displayName || u.displayName,
      phone: current.phone || u.phone,
      documentNumber: current.documentNumber || u.documentNumber,
      agency: current.agency && current.agency !== "No informado" ? current.agency : u.agency,
      employeeFileNumber:
        current.employeeFileNumber && current.employeeFileNumber !== "No informado"
          ? current.employeeFileNumber
          : u.employeeFileNumber,
      isMember: current.isMember || u.isMember,
      warnings: [...new Set([...current.warnings, ...u.warnings, "DUPLICADO x email"])],
    };
    byEmail.set(u.email, merged);
  }
  return Array.from(byEmail.values());
}

async function findExistingProfile(db, email) {
  const snap = await db
    .collection(COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();
  return snap.docs[0] || null;
}

async function importSingleUser({ auth, db }, input, dryRun = false) {
  const { email, password, displayName, firstName, lastName, fullName, documentNumber, agency, employeeFileNumber, phone, contactEmail, isMember } = input;

  const existingAuthUser = await auth
    .getUserByEmail(email)
    .catch(() => null);

  const existingProfileDoc = await findExistingProfile(db, email);

  let uid = existingAuthUser ? existingAuthUser.uid : null;
  let authCreated = false;
  let authUpdated = false;
  let profileCreated = false;
  let profileUpdated = false;

  if (!uid) {
    if (dryRun) {
      uid = `DRY-${Buffer.from(email).toString("hex").slice(0, 12)}`;
      authCreated = true;
    } else {
      const created = await auth.createUser({
        email,
        password,
        displayName: displayName || undefined,
        disabled: false,
      });
      uid = created.uid;
      authCreated = true;
    }
  } else if (!existingAuthUser.displayName && displayName) {
    authUpdated = true;
    if (!dryRun) {
      await auth.updateUser(uid, { displayName });
    }
  }

  const now = new Date().toISOString();
  const rawPayload = {
    email,
    displayName: displayName || existingAuthUser?.displayName || fullName || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName: fullName || undefined,
    documentNumber: documentNumber || undefined,
    agency: agency || undefined,
    employeeFileNumber: employeeFileNumber || undefined,
    phone: phone || undefined,
    contactEmail: contactEmail || email,
    isMember: Boolean(isMember),
    role: DEFAULT_ROLE,
    isActive: true,
    accountStatus: "active",
    updatedAt: now,
  };
  const payload = Object.fromEntries(
    Object.entries(rawPayload).filter(([_, v]) => typeof v !== "undefined")
  );

  const currentProfile = existingProfileDoc ? existingProfileDoc.data() : null;
  if (!currentProfile) {
    profileCreated = true;
    const doc = { ...payload, createdAt: now, updatedAt: now };
    if (!dryRun) {
      await db.collection(COLLECTION).doc(uid).set(doc, { merge: true });
    }
  } else {
    const patch = Object.fromEntries(
      Object.entries(payload).filter(([k, v]) => {
        if (k === "updatedAt") return true;
        const currentVal = currentProfile[k];
        if (typeof currentVal === "undefined" || currentVal === null || currentVal === "") {
          return !(v === undefined);
        }
        if (k === "isMember") return Boolean(currentVal) !== Boolean(v);
        if (k === "role") return currentVal !== v;
        return false;
      })
    );
    if (Object.keys(patch).length > 0) {
      profileUpdated = true;
      if (!dryRun) {
        await db.collection(COLLECTION).doc(uid).set(patch, { merge: true });
      }
    }
  }

  return {
    email,
    uid,
    authCreated,
    authUpdated,
    profileCreated,
    profileUpdated,
    alreadyExistedInAuth: Boolean(existingAuthUser),
    alreadyHadProfile: Boolean(currentProfile),
    assignedPassword: authCreated ? password : null,
    role: DEFAULT_ROLE,
  };
}

async function main() {
  loadLocalEnv();
  const dryRun = process.env.DRY_RUN !== "false" && process.env.DRY_RUN !== "0" && process.env.DRY_RUN !== "no";
  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const rawUsers = readUsersFromJson();
  const normalized = rawUsers.map(normalizeUser);
  const totalNormalized = normalized.length;
  const usersToImport = dedupeUsers(normalized);
  const skippedDuplicates = totalNormalized - usersToImport.length;

  const report = {
    dryRun,
    projectId: app.options.credential.projectId,
    usersJson: USERS_JSON_PATH,
    totalRowsInJson: totalNormalized,
    dedupedUniqueEmails: usersToImport.length,
    skippedBecauseDuplicateEmail: skippedDuplicates,
    createdAt: new Date().toISOString(),
    results: [],
    summary: {
      success: 0,
      failed: 0,
      authCreated: 0,
      authUpdated: 0,
      profileCreated: 0,
      profileUpdated: 0,
      warnings: normalized.flatMap((u) => u.warnings.map((w) => `${u.email || `#${u.index}`}: ${w}`)),
    },
    failures: [],
  };

  const ctx = { auth, db };
  for (let i = 0; i < usersToImport.length; i++) {
    const user = usersToImport[i];
    const idx = user.index;
    process.stdout.write(`[${i + 1}/${usersToImport.length}] ${user.email} (dryRun=${dryRun}) ... `);
    try {
      const res = await importSingleUser(ctx, user, dryRun);
      report.results.push({ idx, warnings: user.warnings, ...res });
      if (res.authCreated) report.summary.authCreated++;
      if (res.authUpdated) report.summary.authUpdated++;
      if (res.profileCreated) report.summary.profileCreated++;
      if (res.profileUpdated) report.summary.profileUpdated++;
      report.summary.success++;
      process.stdout.write("OK\n");
    } catch (error) {
      report.summary.failed++;
      const failure = {
        idx,
        email: user.email,
        warnings: user.warnings,
        message: error?.message || String(error),
        stack: error?.stack || null,
      };
      report.failures.push(failure);
      process.stdout.write(`FAIL: ${failure.message}\n`);
    }
  }

  const outPath = path.join(__dirname, `..`, `import-users-report-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log("\n=== RESUMEN ===");
  console.log("Proyecto Firebase:", report.projectId);
  console.log("Dry Run (no se escribio):", dryRun);
  console.log("Filas JSON:", report.totalRowsInJson, "| Deduplicados:", report.dedupedUniqueEmails, "| Skipeados dup email:", report.skippedBecauseDuplicateEmail);
  console.log("OK:", report.summary.success, "| FALLIDOS:", report.summary.failed);
  console.log("Auth Creados:", report.summary.authCreated, "| Auth Actualizados:", report.summary.authUpdated);
  console.log("Perfiles Creados:", report.summary.profileCreated, "| Perfiles Actualizados:", report.summary.profileUpdated);
  console.log("Advertencias:", report.summary.warnings.length);
  if (report.summary.warnings.length) {
    console.log("- " + report.summary.warnings.slice(0, 10).join("\n- "));
  }
  console.log("Reporte JSON guardado en:", outPath);

  if (dryRun) {
    console.log("\nPara ejecutar de verdad y escribir en Firebase:");
    console.log(`  DRY_RUN=false node scripts/import-massive-users.js`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("FATAL:", error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  readUsersFromJson,
  normalizeUser,
  dedupeUsers,
  importSingleUser,
  getAdminApp,
  DEFAULT_ROLE,
  COLLECTION,
};
