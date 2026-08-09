import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertRole, canViewEnrollment, requireCourseActor } from "@/lib/courses/server/auth";
import { getEnrollmentById, updateEnrollment } from "@/lib/courses/server/enrollments";
import { getCourseById } from "@/lib/courses/server/courses";

export const runtime = "nodejs";

function collectLessonIdsFromCurriculum(curriculum: unknown) {
  const ids = new Set<string>();
  const sections = Array.isArray(curriculum) ? curriculum : [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const lessons = Array.isArray((section as Record<string, any>).lessons)
      ? (section as Record<string, any>).lessons
      : [];
    for (const lesson of lessons) {
      if (!lesson || typeof lesson !== "object") continue;
      const id = String((lesson as Record<string, any>).id || "").trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

function filterProgressAgainstCurriculum(progress: unknown, allowedLessonIds: Set<string>) {
  if (!Array.isArray(progress)) return [];
  return progress.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const lessonId = String((entry as Record<string, any>).lessonId || "").trim();
    if (!lessonId) return false;
    return allowedLessonIds.has(lessonId);
  });
}

function filterActivitySubmissionsAgainstCurriculum(entries: unknown, allowedLessonIds: Set<string>) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const lessonId = String((entry as Record<string, any>).lessonId || "").trim();
    if (!lessonId) return false;
    return allowedLessonIds.has(lessonId);
  });
}

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    assertRole(actor, ["admin", "alumno"]);
    const enrollment = await getEnrollmentById(ctx.params.id);
    if (!enrollment) return errorJson("enrollment_not_found", 404, request);
    if (!canViewEnrollment(actor, enrollment)) return errorJson("forbidden", 403, request);
    return json({ enrollment }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    assertRole(actor, ["admin", "alumno"]);
    const enrollment = await getEnrollmentById(ctx.params.id);
    if (!enrollment) return errorJson("enrollment_not_found", 404, request);
    if (!canViewEnrollment(actor, enrollment)) return errorJson("forbidden", 403, request);

    const body = await request.json();
    let safeBody = body;

    if (actor.role === "alumno") {
      const courseId = String(enrollment.courseId || enrollment.jobId || "").trim();
      let allowedLessonIds: Set<string> | null = null;
      if (courseId) {
        try {
          const course = await getCourseById(courseId);
          allowedLessonIds = collectLessonIdsFromCurriculum((course as any)?.curriculum);
        } catch {
          allowedLessonIds = new Set();
        }
      } else {
        allowedLessonIds = new Set();
      }

      const incomingLessonProgress = Array.isArray(body?.lessonProgress)
        ? filterProgressAgainstCurriculum(body?.lessonProgress, allowedLessonIds || new Set())
        : undefined;
      const incomingProgress = Array.isArray(body?.progress)
        ? filterProgressAgainstCurriculum(body?.progress, allowedLessonIds || new Set())
        : undefined;
      const incomingSubmissions = Array.isArray(body?.activitySubmissions)
        ? filterActivitySubmissionsAgainstCurriculum(body?.activitySubmissions, allowedLessonIds || new Set())
        : undefined;

      safeBody = {
        progress: incomingProgress,
        lessonProgress: incomingLessonProgress,
        activitySubmissions: incomingSubmissions,
      };
    }

    const updated = await updateEnrollment(ctx.params.id, safeBody);
    return json({ enrollment: updated }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

