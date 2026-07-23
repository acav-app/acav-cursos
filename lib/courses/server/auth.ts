import { getAdminDb, isDevBypassEnabled, verifyFirebaseToken } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import type {
  Course,
  CourseSettings,
  Enrollment,
  Institution,
  PortalUserProfile,
} from "@/lib/courses/schemas";
import { err } from "@/lib/courses/server/errors";

export type CourseActor = PortalUserProfile & {
  isDevBypass?: boolean;
};

async function getCourseProfile(uid: string) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.userProfiles).doc(String(uid)).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  return {
    uid: snap.id,
    ...data,
    institutionId: data?.institutionId || data?.companyId,
    institutionName: data?.institutionName || data?.companyName,
  } as PortalUserProfile;
}

export async function requireCourseActor(request: Request): Promise<CourseActor> {
  const decoded = (await verifyFirebaseToken(request.headers.get("authorization"))) as any;
  const uid = String(decoded?.uid || "");
  if (!uid) throw err(401, "unauthorized");

  const profile = await getCourseProfile(uid);
  if (profile) return profile;

  if (isDevBypassEnabled()) {
    return {
      uid,
      email: String(decoded?.email || "dev@example.com"),
      displayName: "Dev Admin",
      role: "admin",
      isActive: true,
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
  return requireCourseActor(request);
}

export function assertRole(actor: CourseActor, roles: CourseActor["role"][]) {
  if (!roles.includes(actor.role)) {
    throw err(403, "forbidden");
  }
}

export function assertAdmin(actor: CourseActor) {
  assertRole(actor, ["admin"]);
}

export function canManageInstitution(actor: CourseActor, institution: Partial<Institution> | null | undefined) {
  if (actor.role === "admin") return true;
  return actor.role === "empresa" && Boolean(actor.companyId) && actor.companyId === institution?.id;
}

export function canManageCourse(actor: CourseActor, course: Partial<Course> | null | undefined) {
  if (actor.role === "admin") return true;
  return actor.role === "empresa" && Boolean(actor.companyId) && actor.companyId === (course?.institutionId || course?.companyId);
}

export function canViewEnrollment(actor: CourseActor, enrollment: Partial<Enrollment> | null | undefined) {
  if (actor.role === "admin") return true;
  if (actor.role === "empresa") {
    return Boolean(actor.companyId) && actor.companyId === (enrollment?.institutionId || enrollment?.companyId);
  }
  if (actor.role === "candidato") {
    const actorEmail = String(actor.email || "").trim().toLowerCase();
    const enrollmentEmail = String(enrollment?.email || "").trim().toLowerCase();
    return Boolean(actorEmail) && actorEmail === enrollmentEmail;
  }
  return false;
}

export function canManageCourseSettings(actor: CourseActor, _settings?: Partial<CourseSettings> | null) {
  return actor.role === "admin";
}
