import { getAdminDb, isDevBypassEnabled, verifyFirebaseToken } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import type {
  Course,
  CourseSettings,
  Enrollment,
  Institution,
  PortalUserProfile,
} from "@/lib/courses/schemas";
import { isAdminRole, isStudentRole, normalizePortalRole } from "@/lib/courses/roles";
import { err } from "@/lib/courses/server/errors";

export type CourseActor = PortalUserProfile & {
  isDevBypass?: boolean;
};

function normalizeCourseProfile(uid: string, data: any) {
  if (!data) return null;
  return {
    uid: String(uid || data?.uid || "").trim(),
    ...data,
    role: normalizePortalRole(data?.role),
    accountStatus: data?.accountStatus || "active",
    institutionId: data?.institutionId || data?.companyId,
    institutionName: data?.institutionName || data?.companyName,
  } as PortalUserProfile;
}

async function getCourseProfileByUid(uid: string) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.userProfiles).doc(String(uid)).get();
  if (!snap.exists) return null;
  return normalizeCourseProfile(snap.id, snap.data() as any);
}

async function getCourseProfileByEmail(email: string, authUid?: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return null;

  const db = getAdminDb();
  const snap = await db
    .collection(COURSE_COLLECTIONS.userProfiles)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return normalizeCourseProfile(authUid || doc.id, doc.data() as any);
}

export async function requireCourseActor(request: Request): Promise<CourseActor> {
  const decoded = (await verifyFirebaseToken(request.headers.get("authorization"))) as any;
  const uid = String(decoded?.uid || "");
  if (!uid) throw err(401, "unauthorized");

  const email = String(decoded?.email || "").trim().toLowerCase();
  const profile = (await getCourseProfileByUid(uid)) || (await getCourseProfileByEmail(email, uid));
  if (profile) return profile;

  if (isDevBypassEnabled()) {
    return {
      uid,
      email: String(decoded?.email || "admin@admin.com"),
      displayName: "Dev Admin",
      role: "admin",
      isMember: false,
      isActive: true,
      accountStatus: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDevBypass: true,
    };
  }

  throw err(403, "course_profile_not_found");
}

export async function readOptionalCourseActor(request: Request): Promise<CourseActor | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  try {
    return await requireCourseActor(request);
  } catch (error: any) {
    const status = Number(error?.status || 500);
    if (status === 401 || status === 403) {
      return null;
    }
    throw error;
  }
}

export function assertRole(actor: CourseActor, roles: CourseActor["role"][]) {
  const actorRole = normalizePortalRole(actor.role);
  const allowedRoles = roles.map((role) => normalizePortalRole(role));
  if (!allowedRoles.includes(actorRole)) {
    throw err(403, "forbidden");
  }
}

export function assertAdmin(actor: CourseActor) {
  assertRole(actor, ["admin"]);
}

export function canManageInstitution(actor: CourseActor, institution: Partial<Institution> | null | undefined) {
  void institution;
  return isAdminRole(actor.role);
}

export function canManageCourse(actor: CourseActor, course: Partial<Course> | null | undefined) {
  void course;
  return isAdminRole(actor.role);
}

export function canViewEnrollment(actor: CourseActor, enrollment: Partial<Enrollment> | null | undefined) {
  if (isAdminRole(actor.role)) return true;
  if (isStudentRole(actor.role)) {
    const actorEmail = String(actor.email || "").trim().toLowerCase();
    const enrollmentEmail = String(enrollment?.email || "").trim().toLowerCase();
    return Boolean(actorEmail) && actorEmail === enrollmentEmail;
  }
  return false;
}

export function canManageCourseSettings(actor: CourseActor, _settings?: Partial<CourseSettings> | null) {
  return isAdminRole(actor.role);
}
