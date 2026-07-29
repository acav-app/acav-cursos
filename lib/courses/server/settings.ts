import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import { DEFAULT_COURSE_SETTINGS } from "@/lib/courses/defaults";
import { CourseSettingsSchema, type CourseSettings } from "@/lib/courses/schemas";
import { nowIso, removeUndefined } from "@/lib/courses/server/utils";

const SETTINGS_DOC_ID = "portal";

const PUBLIC_SETTINGS_KEYS = [
  "heroTitle",
  "heroSubtitle",
  "heroEyebrow",
  "heroImageUrl",
  "stats",
  "aboutTitle",
  "aboutText",
  "howItWorks",
  "footerInfo",
  "contactEmail",
  "phone",
  "address",
  "socialLinks",
  "legalLinks",
  "testimonials",
  "paymentAlias",
  "paymentCbu",
  "paymentCvu",
  "paymentAccountHolder",
  "paymentInstructions",
] as const;

function normalizeSettings(settings: Record<string, any>) {
  return {
    ...DEFAULT_COURSE_SETTINGS,
    ...settings,
    notifyAdminOnNewCourse: settings?.notifyAdminOnNewCourse ?? settings?.notifyAdminOnNewJob ?? true,
    notifyAdminOnNewEnrollment: settings?.notifyAdminOnNewEnrollment ?? settings?.notifyAdminOnNewApplication ?? true,
    notifyInstitutionOnCourseStatusChange:
      settings?.notifyInstitutionOnCourseStatusChange ?? settings?.notifyCompanyOnJobStatusChange ?? true,
    notifyInstitutionOnNewEnrollment:
      settings?.notifyInstitutionOnNewEnrollment ?? settings?.notifyCompanyOnNewApplication ?? true,
    notifyStudentOnEnrollment: settings?.notifyStudentOnEnrollment ?? settings?.notifyCandidateOnApplication ?? true,
    notifyAdminOnNewJob: settings?.notifyAdminOnNewJob ?? settings?.notifyAdminOnNewCourse ?? true,
    notifyAdminOnNewApplication: settings?.notifyAdminOnNewApplication ?? settings?.notifyAdminOnNewEnrollment ?? true,
    notifyCompanyOnJobStatusChange:
      settings?.notifyCompanyOnJobStatusChange ?? settings?.notifyInstitutionOnCourseStatusChange ?? true,
    notifyCompanyOnNewApplication:
      settings?.notifyCompanyOnNewApplication ?? settings?.notifyInstitutionOnNewEnrollment ?? true,
    notifyCandidateOnApplication: settings?.notifyCandidateOnApplication ?? settings?.notifyStudentOnEnrollment ?? true,
  } as CourseSettings;
}

export async function getCourseSettings() {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.settings).doc(SETTINGS_DOC_ID).get();
  const raw = snap.exists ? (snap.data() as any) : {};
  return normalizeSettings(raw);
}

export function toPublicCourseSettings(settings: CourseSettings) {
  const next: Record<string, any> = {};
  PUBLIC_SETTINGS_KEYS.forEach((key) => {
    next[key] = (settings as any)?.[key];
  });
  return next;
}

export async function updateCourseSettings(input: unknown) {
  const parsed = CourseSettingsSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.settings).doc(SETTINGS_DOC_ID);
  const existing = await ref.get();
  const now = nowIso();

  const payload = removeUndefined(
    normalizeSettings({
      ...parsed,
      createdAt: existing.exists ? (existing.data() as any)?.createdAt || now : now,
      updatedAt: now,
    })
  );

  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return normalizeSettings(updated.data() as any);
}
