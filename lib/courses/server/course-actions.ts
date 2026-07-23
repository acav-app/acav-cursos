import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import type { CourseActor } from "@/lib/courses/server/auth";
import { getCourseById, updateCourse } from "@/lib/courses/server/courses";
import { err } from "@/lib/courses/server/errors";
import { ensureUniqueSlug, nowIso, removeUndefined } from "@/lib/courses/server/utils";

export async function approveCourse(id: string, actor: CourseActor) {
  const course = await getCourseById(id);
  if (!course) throw err(404, "course_not_found");
  if (actor.role !== "admin") throw err(403, "forbidden");
  if (!["pendiente_revision", "borrador", "pausada"].includes(course.status)) {
    throw err(400, "invalid_status_transition");
  }

  return updateCourse(
    id,
    {
      status: "activa",
      rejectionReason: "",
      closeReason: undefined,
      closeComment: undefined,
      closedAt: undefined,
      publishedAt: nowIso(),
    },
    actor
  );
}

export async function rejectCourse(id: string, actor: CourseActor, rejectionReason: string) {
  const course = await getCourseById(id);
  if (!course) throw err(404, "course_not_found");
  if (actor.role !== "admin") throw err(403, "forbidden");
  const reason = String(rejectionReason || "").trim();
  if (!reason) throw err(400, "rejection_reason_required");

  return updateCourse(
    id,
    {
      status: "rechazada",
      rejectionReason: reason,
    },
    actor
  );
}

export async function pauseCourse(id: string, actor: CourseActor) {
  const course = await getCourseById(id);
  if (!course) throw err(404, "course_not_found");
  if (actor.role === "empresa" && actor.companyId !== course.companyId) throw err(403, "forbidden");
  if (!["activa"].includes(course.status)) throw err(400, "invalid_status_transition");
  return updateCourse(id, { status: "pausada" }, actor);
}

export async function resumeCourse(id: string, actor: CourseActor) {
  const course = await getCourseById(id);
  if (!course) throw err(404, "course_not_found");
  if (actor.role === "empresa" && actor.companyId !== course.companyId) throw err(403, "forbidden");
  if (!["pausada"].includes(course.status)) throw err(400, "invalid_status_transition");
  return updateCourse(id, { status: "activa" }, actor);
}

export async function closeCourse(id: string, actor: CourseActor, closeReason: string) {
  const course = await getCourseById(id);
  if (!course) throw err(404, "course_not_found");
  if (actor.role !== "admin" && !(actor.role === "empresa" && actor.companyId === course.companyId)) {
    throw err(403, "forbidden");
  }
  const reason = String(closeReason || "").trim();
  if (!reason) throw err(400, "close_reason_required");
  return updateCourse(
    id,
    {
      status: "cerrada",
      closeReason: reason as any,
      closedAt: nowIso(),
    },
    actor
  );
}

export async function duplicateCourse(id: string, actor: CourseActor) {
  const course = await getCourseById(id);
  if (!course) throw err(404, "course_not_found");
  if (actor.role === "empresa" && actor.companyId !== course.companyId) throw err(403, "forbidden");

  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.courses).doc();
  const now = nowIso();
  const title = `${course.title} (copia)`;
  const slug = await ensureUniqueSlug(COURSE_COLLECTIONS.courses, title);
  const status = actor.role === "admin" ? "borrador" : "pendiente_revision";

  const next = removeUndefined({
    ...course,
    id: undefined,
    title,
    slug,
    status,
    rejectionReason: undefined,
    closeReason: undefined,
    closeComment: undefined,
    publishedAt: undefined,
    closedAt: undefined,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
    createdByRole: actor.role,
  });

  await ref.set(next);
  const created = await ref.get();
  return { id: created.id, ...(created.data() as any) };
}
