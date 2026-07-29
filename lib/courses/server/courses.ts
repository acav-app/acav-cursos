import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import { COURSE_MODALITIES, COURSE_SALES_MODALITIES, COURSE_VIDEO_ALLOWED_TYPES, COURSE_VIDEO_MAX_SIZE_BYTES } from "@/lib/courses/constants";
import { CourseCreateSchema, CourseUpdateSchema, type Course } from "@/lib/courses/schemas";
import type { CourseActor } from "@/lib/courses/server/auth";
import { err } from "@/lib/courses/server/errors";
import { getInstitutionById } from "@/lib/courses/server/institutions";
import { ensureDateIsTodayOrFuture, ensureUniqueSlug, isTruthy, nowIso, removeUndefined } from "@/lib/courses/server/utils";

type NormalizedCourse = Record<string, any> & {
  academyId?: string;
  institutionId?: string;
  institutionName?: string;
  institutionLogoUrl?: string;
  companyId?: string;
  companyName?: string;
  companyLogoUrl?: string;
  initialModality?: string;
  modality?: string;
  workMode?: string;
  publicationStatus?: string;
  allowEnrollment?: boolean;
  freeCourse?: boolean;
  includesCertificate?: boolean;
  lifetimeAccess?: boolean;
  downloadableResources?: boolean;
  recordedClasses?: boolean;
  support?: boolean;
  featured?: boolean;
  showOnHome?: boolean;
  attachments?: any[];
  learningObjectives?: any[];
  targetAudience?: any[];
  modules?: any[];
};

function normalizeCourse(course: Record<string, any>): NormalizedCourse {
  const institutionId = course?.institutionId || course?.companyId || "";
  const institutionName = course?.institutionName || course?.companyName || "";
  const institutionLogoUrl = course?.institutionLogoUrl || course?.companyLogoUrl || "";
  const modality = course?.modality || course?.initialModality || "";
  const academyId = course?.academyId || institutionId;

  return removeUndefined({
    ...course,
    academyId,
    institutionId,
    institutionName,
    institutionLogoUrl,
    companyId: institutionId || course?.companyId,
    companyName: institutionName || course?.companyName,
    companyLogoUrl: institutionLogoUrl || course?.companyLogoUrl,
    initialModality: course?.initialModality || course?.workMode,
    modality,
    workMode: course?.workMode || course?.initialModality || modality,
    publicationStatus: course?.publicationStatus || course?.status,
    allowEnrollment: course?.allowEnrollment ?? true,
    freeCourse: course?.freeCourse ?? false,
    includesCertificate: course?.includesCertificate ?? false,
    lifetimeAccess: course?.lifetimeAccess ?? false,
    downloadableResources: course?.downloadableResources ?? false,
    recordedClasses: course?.recordedClasses ?? false,
    support: course?.support ?? false,
    featured: course?.featured ?? false,
    showOnHome: course?.showOnHome ?? false,
    attachments: Array.isArray(course?.attachments) ? course.attachments : [],
    learningObjectives: Array.isArray(course?.learningObjectives) ? course.learningObjectives : [],
    targetAudience: Array.isArray(course?.targetAudience) ? course.targetAudience : [],
    modules: Array.isArray(course?.modules) ? course.modules : [],
  }) as NormalizedCourse;
}

function resolveCourseModality(value: unknown): (typeof COURSE_MODALITIES)[number] {
  const normalizedValue = String(value || "").trim();
  if (COURSE_MODALITIES.includes(normalizedValue as (typeof COURSE_MODALITIES)[number])) {
    return normalizedValue as (typeof COURSE_MODALITIES)[number];
  }
  return "Virtual";
}

function resolveCourseSalesModality(value: unknown): (typeof COURSE_SALES_MODALITIES)[number] {
  const normalizedValue = String(value || "").trim();
  if (COURSE_SALES_MODALITIES.includes(normalizedValue as (typeof COURSE_SALES_MODALITIES)[number])) {
    return normalizedValue as (typeof COURSE_SALES_MODALITIES)[number];
  }
  if (normalizedValue === "Virtual") return "100% Online";
  if (normalizedValue === "Remoto") return "En vivo";
  if (normalizedValue === "Hibrido") return "Híbrido";
  return "100% Online";
}

function toCourse(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return normalizeCourse({ id: doc.id, ...(doc.data() as any) }) as Course;
}

function validateCourseBusinessRules(input: Record<string, any>) {
  if (String(input.contractType || "") === "Otro" && !String(input.customContractType || "").trim()) {
    throw err(400, "custom_contract_type_required");
  }
  if (
    Array.isArray(input.scheduleAvailability) &&
    input.scheduleAvailability.includes("Otro") &&
    !String(input.customScheduleAvailability || "").trim()
  ) {
    throw err(400, "custom_schedule_availability_required");
  }
  if (isTruthy(input.mustSendCvByEmail) && !String(input.emailSubject || "").trim()) {
    throw err(400, "email_subject_required");
  }
  if (!isTruthy(input.freeCourse) && !Number.isFinite(Number(input.price))) {
    throw err(400, "price_required");
  }
  if (Number.isFinite(Number(input.oldPrice)) && Number(input.oldPrice) < Number(input.price || 0)) {
    throw err(400, "old_price_invalid");
  }
  if (input.videoUrl) {
    const videoMimeType = String(input.videoMimeType || "").trim();
    const videoSizeBytes = Number(input.videoSizeBytes || 0);
    if (!COURSE_VIDEO_ALLOWED_TYPES.includes(videoMimeType as (typeof COURSE_VIDEO_ALLOWED_TYPES)[number])) {
      throw err(400, "invalid_video_type");
    }
    if (!Number.isFinite(videoSizeBytes) || videoSizeBytes <= 0 || videoSizeBytes > COURSE_VIDEO_MAX_SIZE_BYTES) {
      throw err(400, "invalid_video_size");
    }
  }
  ensureDateIsTodayOrFuture(String(input.expiresAt || ""));
}

export function toPublicCourse(course: Course): Course {
  const normalized = normalizeCourse(course as Record<string, unknown>);
  const initialModality = resolveCourseModality(normalized.initialModality || normalized.workMode);
  const workMode = resolveCourseModality(normalized.workMode || normalized.initialModality);
  const modality = resolveCourseSalesModality(normalized.modality || normalized.initialModality || normalized.workMode);
  return {
    id: String(normalized.id || ""),
    slug: String(normalized.slug || ""),
    title: String(normalized.title || ""),
    academyId: String(normalized.academyId || normalized.institutionId || ""),
    institutionId: String(normalized.institutionId || ""),
    institutionName: String(normalized.institutionName || ""),
    institutionLogoUrl: normalized.institutionLogoUrl || "",
    companyId: String(normalized.companyId || ""),
    companyName: String(normalized.companyName || ""),
    companyLogoUrl: normalized.companyLogoUrl || "",
    subRubro: normalized.subRubro,
    area: normalized.area,
    level: normalized.level || "",
    language: normalized.language || "Español",
    shortDescription: normalized.shortDescription || "",
    initialModality,
    modality,
    city: normalized.city || "",
    contractType: normalized.contractType,
    workMode,
    description: normalized.description || "",
    requirements: normalized.requirements || "",
    learningObjectives: Array.isArray(normalized.learningObjectives) ? normalized.learningObjectives : [],
    targetAudience: Array.isArray(normalized.targetAudience) ? normalized.targetAudience : [],
    modules: Array.isArray(normalized.modules) ? normalized.modules : [],
    duration: normalized.duration || "",
    classes: Number(normalized.classes || 0),
    benefits: normalized.benefits || "",
    flyerUrl: normalized.flyerUrl || "",
    imageUrl: normalized.imageUrl || "",
    thumbnailUrl: normalized.thumbnailUrl || "",
    videoUrl: normalized.videoUrl || "",
    videoFileName: normalized.videoFileName || "",
    videoMimeType: normalized.videoMimeType || "",
    videoSizeBytes: Number(normalized.videoSizeBytes || 0),
    videoDurationSeconds: Number(normalized.videoDurationSeconds || 0),
    contactEmail: normalized.contactEmail || "",
    mustSendCvByEmail: Boolean(normalized.mustSendCvByEmail),
    emailSubject: normalized.emailSubject || "",
    attachments: Array.isArray(normalized.attachments) ? normalized.attachments : [],
    price: Number(normalized.price || 0),
    oldPrice: normalized.oldPrice === undefined ? undefined : Number(normalized.oldPrice || 0),
    freeCourse: Boolean(normalized.freeCourse),
    includesCertificate: Boolean(normalized.includesCertificate),
    lifetimeAccess: Boolean(normalized.lifetimeAccess),
    downloadableResources: Boolean(normalized.downloadableResources),
    recordedClasses: Boolean(normalized.recordedClasses),
    support: Boolean(normalized.support),
    featured: Boolean(normalized.featured),
    allowEnrollment: normalized.allowEnrollment !== false,
    showOnHome: Boolean(normalized.showOnHome),
    publicationStatus: normalized.publicationStatus || normalized.status,
    expiresAt: String(normalized.expiresAt || normalized.createdAt || ""),
    publishedAt: String(normalized.publishedAt || normalized.createdAt || normalized.expiresAt || ""),
    status: normalized.status || "borrador",
    createdAt: String(normalized.createdAt || normalized.publishedAt || normalized.expiresAt || nowIso()),
    updatedAt: String(normalized.updatedAt || normalized.createdAt || normalized.publishedAt || nowIso()),
  };
}

export async function listCourses(options?: {
  publicOnly?: boolean;
  actor?: CourseActor | null;
  filters?: Record<string, string | null | undefined>;
  scope?: "active" | "history";
}) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.courses).orderBy("createdAt", "desc").get();
  let courses = snap.docs.map(toCourse);

  if (options?.publicOnly) {
    const scope = options?.scope || "active";
    if (scope === "history") {
      courses = courses.filter((course) => ["cerrada", "vencida"].includes(course.status));
    } else {
      courses = courses.filter((course) => course.status === "activa");
    }
  }

  const filters = options?.filters || {};
  const q = String(filters.q || "").trim().toLowerCase();
  const institutionId = String(filters.institutionId || filters.companyId || "").trim();
  const area = String(filters.area || "").trim();
  const modality = String(filters.modality || filters.modalidad || "").trim();
  const pace = String(filters.pace || filters.contractType || filters.jornada || "").trim();
  const subRubro = String(filters.subRubro || "").trim();
  const city = String(filters.city || "").trim().toLowerCase();
  const status = String(filters.status || "").trim();
  const slug = String(filters.slug || "").trim();

  if (q) {
    courses = courses.filter((course) =>
      [course.title, course.institutionName, course.companyName, course.city, course.area]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(q))
    );
  }
  if (institutionId) {
    courses = courses.filter((course) => (course.institutionId || course.companyId) === institutionId);
  }
  if (area) courses = courses.filter((course) => course.area === area);
  if (modality) courses = courses.filter((course) => course.workMode === modality || course.initialModality === modality);
  if (pace) courses = courses.filter((course) => course.contractType === pace);
  if (subRubro) courses = courses.filter((course) => course.subRubro === subRubro);
  if (city) courses = courses.filter((course) => String(course.city || "").toLowerCase().includes(city));
  if (slug) courses = courses.filter((course) => course.slug === slug);
  if (status && !options?.publicOnly) courses = courses.filter((course) => course.status === status);

  return options?.publicOnly ? courses.map(toPublicCourse) : courses;
}

export async function getCourseById(id: string) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.courses).doc(String(id)).get();
  if (!snap.exists) return null;
  return toCourse(snap);
}

export async function createCourse(input: unknown, actor: CourseActor) {
  const parsed = CourseCreateSchema.parse(input);
  const institutionId = parsed.institutionId || parsed.companyId;

  const courseForValidation = normalizeCourse({
    ...parsed,
    institutionId,
    createdBy: parsed.createdBy || actor.uid,
    createdByRole: parsed.createdByRole || actor.role,
  });
  validateCourseBusinessRules(courseForValidation as any);

  const institution = institutionId ? await getInstitutionById(institutionId) : null;
  if (institutionId && !institution) throw err(404, "institution_not_found");

  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.courses).doc();
  const now = nowIso();
  const status = parsed.status || "borrador";
  const slug = await ensureUniqueSlug(COURSE_COLLECTIONS.courses, parsed.slug || parsed.title);

  const payload = normalizeCourse(
    removeUndefined({
      ...courseForValidation,
      slug,
      institutionId: institution?.id || institutionId || undefined,
      companyId: institution?.id || institutionId || undefined,
      institutionName: institution?.name || parsed.institutionName || parsed.companyName || undefined,
      companyName: institution?.name || parsed.companyName || parsed.institutionName || undefined,
      institutionLogoUrl: parsed.institutionLogoUrl || parsed.companyLogoUrl || institution?.logoUrl || undefined,
      companyLogoUrl: parsed.companyLogoUrl || parsed.institutionLogoUrl || institution?.logoUrl || undefined,
      status,
      createdAt: now,
      updatedAt: now,
      publishedAt: status === "activa" ? parsed.publishedAt || now : undefined,
      closedAt: status === "cerrada" ? parsed.closedAt || now : undefined,
    })
  );

  await ref.set(payload);
  return { id: ref.id, ...(payload as any) } as Course;
}

export async function updateCourse(id: string, input: unknown, actor: CourseActor) {
  const parsed = CourseUpdateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.courses).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) throw err(404, "course_not_found");

  const current = toCourse(existing);
  if (actor.role !== "admin") {
    throw err(403, "forbidden");
  }

  const merged = normalizeCourse({ ...current, ...parsed });
  validateCourseBusinessRules(merged);

  let institutionName = current.institutionName || current.companyName;
  let institutionLogoUrl = current.institutionLogoUrl || current.companyLogoUrl || "";
  const nextInstitutionId = parsed.institutionId || parsed.companyId;
  if (nextInstitutionId && nextInstitutionId !== (current.institutionId || current.companyId)) {
    const institution = await getInstitutionById(nextInstitutionId);
    if (!institution) throw err(404, "institution_not_found");
    institutionName = institution.name;
    institutionLogoUrl = institution.logoUrl || "";
  }

  const slug =
    parsed.slug || parsed.title
      ? await ensureUniqueSlug(COURSE_COLLECTIONS.courses, parsed.slug || parsed.title || current.slug, id)
      : undefined;

  const nextStatus = parsed.status || current.status;
  const payload = normalizeCourse(
    removeUndefined({
      ...parsed,
      slug,
      institutionName,
      institutionLogoUrl: parsed.institutionLogoUrl || parsed.companyLogoUrl || institutionLogoUrl,
      updatedAt: nowIso(),
      publishedAt: nextStatus === "activa" ? current.publishedAt || nowIso() : current.publishedAt,
      closedAt: nextStatus === "cerrada" ? current.closedAt || nowIso() : parsed.status ? undefined : current.closedAt,
    })
  );

  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return toCourse(updated);
}

export async function deleteCourse(id: string) {
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.courses).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) throw err(404, "course_not_found");
  await ref.delete();
}
