import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import { PortalRoleSchema, PortalUserProfileSchema, type PortalUserProfile } from "@/lib/courses/schemas";
import { isAdminRole, normalizePortalRole } from "@/lib/courses/roles";
import { getInstitutionById } from "@/lib/courses/server/institutions";
import { err } from "@/lib/courses/server/errors";
import { nowIso, removeUndefined } from "@/lib/courses/server/utils";

const PortalUserCreateSchema = z.object({
  uid: z.string().min(1).optional(),
  email: z.string().email(),
  displayName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  documentNumber: z.string().min(1).optional(),
  agency: z.string().min(1).optional(),
  employeeFileNumber: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  isMember: z.boolean().optional(),
  password: z.string().min(6).optional(),
  role: PortalRoleSchema,
  companyId: z.string().min(1).optional(),
  institutionId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const PortalUserUpdateSchema = z.object({
  displayName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  documentNumber: z.string().min(1).optional(),
  agency: z.string().min(1).optional(),
  employeeFileNumber: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  isMember: z.boolean().optional(),
  city: z.string().min(1).optional(),
  province: z.string().min(1).optional(),
  avatar: z.string().url().optional(),
  role: PortalRoleSchema.optional(),
  password: z.string().min(6).optional(),
  companyId: z.string().min(1).optional(),
  institutionId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

function buildDisplayName(input: { firstName?: string; lastName?: string; displayName?: string }) {
  const firstName = String(input?.firstName || "").trim();
  const lastName = String(input?.lastName || "").trim();
  const composed = [firstName, lastName].filter(Boolean).join(" ").trim();
  return composed || String(input?.displayName || "").trim();
}

async function resolveUidByEmail(email: string) {
  const auth = getAdminAuth();
  try {
    const user = await auth.getUserByEmail(email);
    return {
      uid: String(user.uid),
      displayName: user.displayName || "",
      firstName: String(user.displayName || "").trim().split(/\s+/).filter(Boolean).slice(0, 1).join(" "),
      lastName: String(user.displayName || "").trim().split(/\s+/).filter(Boolean).slice(1).join(" "),
    };
  } catch {
    throw err(404, "firebase_user_not_found");
  }
}

async function assertNoPortalUserConflicts(input: {
  uid: string;
  email: string;
  role: string;
  institutionId?: string;
}) {
  const db = getAdminDb();
  const uid = String(input.uid || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const role = normalizePortalRole(input.role);

  if (email) {
    const emailSnap = await db
      .collection(COURSE_COLLECTIONS.userProfiles)
      .where("email", "==", email)
      .limit(10)
      .get();

    const emailConflict = emailSnap.docs.find((doc) => doc.id !== uid);
    if (emailConflict) throw err(409, "portal_user_email_already_exists");
  }

  void role;
}

export async function listPortalUsers() {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.userProfiles).orderBy("createdAt", "desc").limit(500).get();
  return snap.docs
    .map((doc) => ({ uid: doc.id, ...(doc.data() as any) }))
    .map((raw) => {
      const parsed = PortalUserProfileSchema.safeParse({
        ...raw,
        uid: raw.uid || raw.id,
        role: normalizePortalRole(raw.role),
        institutionId: raw.institutionId || raw.companyId,
        institutionName: raw.institutionName || raw.companyName,
      });
      return parsed.success ? parsed.data : null;
    })
    .filter(Boolean) as PortalUserProfile[];
}

export async function createPortalUserProfile(input: unknown) {
  const parsed = PortalUserCreateSchema.parse(input);
  const email = String(parsed.email || "").trim().toLowerCase();
  if (!email) throw err(400, "email_required");

  const auth = getAdminAuth();
  const fullName = buildDisplayName(parsed);
  const firstName = String(parsed.firstName || "").trim();
  const lastName = String(parsed.lastName || "").trim();
  const documentNumber = String(parsed.documentNumber || "").trim() || undefined;
  const agency = String(parsed.agency || "").trim() || undefined;
  const employeeFileNumber = String(parsed.employeeFileNumber || "").trim() || undefined;
  const phone = String(parsed.phone || "").trim() || undefined;
  const contactEmailRaw = String(parsed.contactEmail || "").trim() || undefined;
  const contactEmail = contactEmailRaw || email;
  const isMember = typeof parsed.isMember === "boolean" ? parsed.isMember : false;
  let resolved: { uid: string; displayName?: string; firstName?: string; lastName?: string } | undefined;

  if (parsed.uid) {
    try {
      const existingAuthUser = await auth.getUser(String(parsed.uid));
      resolved = {
        uid: String(existingAuthUser.uid),
        displayName: existingAuthUser.displayName || "",
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      };
    } catch {
      if (!String(parsed.password || "").trim()) throw err(400, "password_required");
      const createdAuthUser = await auth.createUser({
        uid: String(parsed.uid),
        email,
        password: String(parsed.password),
        displayName: fullName || undefined,
        disabled: parsed.isActive === false,
      });
      resolved = { uid: String(createdAuthUser.uid), displayName: createdAuthUser.displayName || fullName };
    }
  } else {
    try {
      resolved = await resolveUidByEmail(email);
    } catch (error: any) {
      if (error?.message !== "firebase_user_not_found") throw error;
      if (!String(parsed.password || "").trim()) throw err(400, "password_required");
      const createdAuthUser = await auth.createUser({
        email,
        password: String(parsed.password),
        displayName: fullName || undefined,
        disabled: parsed.isActive === false,
      });
      resolved = { uid: String(createdAuthUser.uid), displayName: createdAuthUser.displayName || fullName };
    }
  }

  const uid = String(resolved?.uid || "").trim();
  if (!uid) throw err(400, "uid_required");

  const role = normalizePortalRole(parsed.role);
  const isActive = parsed.isActive !== false;
  const institutionId = isAdminRole(role) ? String(parsed.institutionId || parsed.companyId || "").trim() : "";

  let institutionName = "";
  if (institutionId) {
    const institution = await getInstitutionById(institutionId);
    if (!institution) throw err(404, "institution_not_found");
    institutionName = institution.name;
  }

  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.userProfiles).doc(uid);
  const existing = await ref.get();
  if (existing.exists) throw err(409, "portal_user_already_exists");
  const now = nowIso();

  await assertNoPortalUserConflicts({
    uid,
    email,
    role,
    institutionId,
  });

  const payload = removeUndefined({
    email,
    displayName:
      buildDisplayName({
        displayName: parsed.displayName || resolved?.displayName || "",
        firstName: firstName || resolved?.firstName || "",
        lastName: lastName || resolved?.lastName || "",
      }) || undefined,
    firstName: firstName || resolved?.firstName || undefined,
    lastName: lastName || resolved?.lastName || undefined,
    fullName:
      [firstName || resolved?.firstName || "", lastName || resolved?.lastName || ""].filter(Boolean).join(" ").trim() ||
      undefined,
    documentNumber,
    agency,
    employeeFileNumber,
    phone,
    contactEmail,
    isMember,
    role,
    institutionId: institutionId || undefined,
    institutionName: institutionName || undefined,
    companyId: institutionId || undefined,
    companyName: institutionName || undefined,
    isActive,
    createdAt: existing.exists ? (existing.data() as any)?.createdAt || now : now,
    updatedAt: now,
  });

  await auth.updateUser(
    uid,
    removeUndefined({
      email,
      displayName: String(payload.displayName || "").trim() || undefined,
      disabled: !isActive,
    })
  );
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return PortalUserProfileSchema.parse({ uid: updated.id, ...(updated.data() as any), role: normalizePortalRole(updated.data()?.role) });
}

export async function updatePortalUserProfile(uid: string, input: unknown) {
  const parsed = PortalUserUpdateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.userProfiles).doc(String(uid));
  const existing = await ref.get();
  if (!existing.exists) throw err(404, "portal_user_not_found");

  const current = { uid: existing.id, ...(existing.data() as any) } as PortalUserProfile;
  const nextRole = normalizePortalRole(parsed.role || current.role);
  const nextInstitutionId =
    isAdminRole(nextRole)
      ? String(parsed.institutionId ?? parsed.companyId ?? current.institutionId ?? current.companyId ?? "").trim()
      : "";

  let institutionName = current.institutionName || current.companyName || "";
  if (nextInstitutionId) {
    const institution = await getInstitutionById(nextInstitutionId);
    if (!institution) throw err(404, "institution_not_found");
    institutionName = institution.name;
  } else {
    institutionName = "";
  }

  const nextFirstName = parsed.firstName ? String(parsed.firstName).trim() : String(current.firstName || "").trim();
  const nextLastName = parsed.lastName ? String(parsed.lastName).trim() : String(current.lastName || "").trim();
  const nextFullName = parsed.fullName
    ? String(parsed.fullName).trim()
    : [nextFirstName, nextLastName].filter(Boolean).join(" ").trim() || String(current.fullName || "").trim();
  const nextDisplayName = buildDisplayName({
    displayName: parsed.displayName ? String(parsed.displayName).trim() : String(current.displayName || "").trim(),
    firstName: nextFirstName,
    lastName: nextLastName,
  });

  await assertNoPortalUserConflicts({
    uid: String(uid),
    email: String(current.email || "").trim().toLowerCase(),
    role: nextRole,
    institutionId: nextInstitutionId || undefined,
  });

  const payload = removeUndefined({
    displayName: nextDisplayName || undefined,
    firstName: nextFirstName || undefined,
    lastName: nextLastName || undefined,
    fullName: nextFullName || undefined,
    documentNumber: parsed.documentNumber ? String(parsed.documentNumber).trim() : undefined,
    agency: parsed.agency ? String(parsed.agency).trim() : undefined,
    employeeFileNumber: parsed.employeeFileNumber ? String(parsed.employeeFileNumber).trim() : undefined,
    phone: parsed.phone ? String(parsed.phone).trim() : undefined,
    contactEmail: parsed.contactEmail ? String(parsed.contactEmail).trim() : undefined,
    isMember: typeof parsed.isMember === "boolean" ? parsed.isMember : undefined,
    city: parsed.city ? String(parsed.city).trim() : undefined,
    province: parsed.province ? String(parsed.province).trim() : undefined,
    avatar: parsed.avatar ? String(parsed.avatar).trim() : undefined,
    role: parsed.role ? normalizePortalRole(parsed.role) : undefined,
    institutionId: nextInstitutionId || undefined,
    institutionName: nextInstitutionId ? institutionName || undefined : undefined,
    companyId: nextInstitutionId || undefined,
    companyName: nextInstitutionId ? institutionName || undefined : undefined,
    isActive: typeof parsed.isActive === "boolean" ? parsed.isActive : undefined,
    updatedAt: nowIso(),
  });

  await ref.set(payload, { merge: true });

  const authPatch: Record<string, any> = removeUndefined({
    displayName: nextDisplayName || undefined,
    disabled: typeof parsed.isActive === "boolean" ? !parsed.isActive : undefined,
  });
  if (typeof parsed.password === "string" && parsed.password.length >= 6) {
    authPatch.password = parsed.password;
  }
  if (Object.keys(authPatch).length) {
    await getAdminAuth().updateUser(String(uid), authPatch);
  }
  const updated = await ref.get();
  return PortalUserProfileSchema.parse({ uid: updated.id, ...(updated.data() as any), role: normalizePortalRole(updated.data()?.role) });
}

export async function getPortalUserProfileByUid(uid: string) {
  const uidValue = String(uid || "").trim();
  if (!uidValue) return null;
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.userProfiles).doc(uidValue);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const parsed = PortalUserProfileSchema.safeParse({
    uid: snap.id,
    ...(snap.data() as any),
    role: normalizePortalRole(snap.data()?.role),
    institutionId: (snap.data() as any)?.institutionId || (snap.data() as any)?.companyId,
    institutionName: (snap.data() as any)?.institutionName || (snap.data() as any)?.companyName,
  });
  return parsed.success ? parsed.data : null;
}
