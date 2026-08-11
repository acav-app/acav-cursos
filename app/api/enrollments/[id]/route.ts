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

function mergeLessonProgress(oldArr: unknown, newArr: unknown, allowedLessonIds: Set<string>) {
  const old = Array.isArray(oldArr) ? oldArr : [];
  const incoming = filterProgressAgainstCurriculum(Array.isArray(newArr) ? newArr : [], allowedLessonIds);
  const byId = new Map<string, any>();
  for (const entry of old) {
    if (!entry || typeof entry !== "object") continue;
    const lessonId = String((entry as Record<string, any>).lessonId || "").trim();
    if (!lessonId) continue;
    if (!allowedLessonIds.has(lessonId)) continue;
    byId.set(lessonId, entry);
  }
  for (const entry of incoming) {
    const lessonId = String((entry as Record<string, any>).lessonId || "").trim();
    if (!lessonId) continue;
    byId.set(lessonId, entry);
  }
  return Array.from(byId.values());
}

function mergeActivitySubmissions(oldArr: unknown, newArr: unknown, allowedLessonIds: Set<string>) {
  const old = Array.isArray(oldArr) ? oldArr : [];
  const incoming = filterActivitySubmissionsAgainstCurriculum(Array.isArray(newArr) ? newArr : [], allowedLessonIds);
  const keyOf = (e: any) => `${String(e?.lessonId || "")}:${String(e?.title || "submission")}`;
  const byKey = new Map<string, any>();
  for (const entry of old) {
    if (!entry || typeof entry !== "object") continue;
    const lessonId = String((entry as Record<string, any>).lessonId || "").trim();
    if (!lessonId) continue;
    if (!allowedLessonIds.has(lessonId)) continue;
    byKey.set(keyOf(entry), entry);
  }
  for (const entry of incoming) {
    const key = keyOf(entry);
    byKey.set(key, entry);
  }
  return Array.from(byKey.values());
}

function mergeGradebook(oldArr: unknown, newArr: unknown, allowedLessonIds: Set<string>, finalEvaluationEnabled: boolean) {
  const old = Array.isArray(oldArr) ? oldArr : [];
  const incoming = Array.isArray(newArr) ? newArr : [];
  const normalizeEntry = (raw: any) => {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, any>;
    const sourceTypeRaw = String(r.sourceType || "lesson").trim().toLowerCase();
    const normalizedSourceType =
      sourceTypeRaw === "final_evaluation" ||
      sourceTypeRaw === "final" ||
      String(r.sourceId || "") === "final_evaluation"
        ? "final_evaluation"
        : "lesson";
    const sourceId = String(r.sourceId || "").trim();
    if (!sourceId) return null;
    const isFinal = normalizedSourceType === "final_evaluation" || sourceId === "final_evaluation" || sourceId === "final";
    if (isFinal) {
      if (!finalEvaluationEnabled) return null;
    } else {
      if (!allowedLessonIds.has(sourceId)) return null;
    }
    const allowedSourceTypes = new Set(["lesson", "final_evaluation", "lesson_evaluation", "quiz", "class_evaluation"]);
    if (sourceTypeRaw && !allowedSourceTypes.has(sourceTypeRaw)) return null;
    const scoreRaw = Number(r.score);
    const maxScoreRaw = Number(r.maxScore);
    const weightRaw = Number(r.weight);
    return {
      sourceType: normalizedSourceType,
      sourceId,
      title: String(r.title || "Evaluación").trim(),
      score: Number.isFinite(scoreRaw) && scoreRaw >= 0 ? scoreRaw : undefined,
      maxScore: Number.isFinite(maxScoreRaw) && maxScoreRaw > 0 ? maxScoreRaw : undefined,
      weight: Number.isFinite(weightRaw) && weightRaw >= 0 && weightRaw <= 1 ? weightRaw : undefined,
      status: ["pending", "graded", "passed", "failed"].includes(String(r.status || "").trim())
        ? String(r.status).trim()
        : "graded",
      reviewedAt: String(r.reviewedAt || new Date().toISOString()).trim(),
      feedback: typeof r.feedback === "string" && r.feedback.trim() ? r.feedback.trim() : undefined,
    };
  };
  const keyOf = (e: any) => `${String(e?.sourceType || "")}:${String(e?.sourceId || "")}`;
  const byKey = new Map<string, any>();
  for (const entry of old) {
    const norm = normalizeEntry(entry);
    if (!norm) continue;
    byKey.set(keyOf(norm), norm);
  }
  for (const entry of incoming) {
    const norm = normalizeEntry(entry);
    if (!norm) continue;
    byKey.set(keyOf(norm), norm);
  }
  return Array.from(byKey.values());
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
      let course: any = null;
      if (courseId) {
        try {
          course = await getCourseById(courseId);
          allowedLessonIds = collectLessonIdsFromCurriculum(course?.curriculum);
        } catch {
          allowedLessonIds = new Set();
        }
      } else {
        allowedLessonIds = new Set();
      }

      const incomingLessonProgress = Array.isArray(body?.lessonProgress)
        ? mergeLessonProgress(enrollment.lessonProgress, body?.lessonProgress, allowedLessonIds || new Set())
        : Array.isArray(enrollment.lessonProgress)
        ? mergeLessonProgress(enrollment.lessonProgress, [], allowedLessonIds || new Set())
        : undefined;
      const incomingProgressNumber = Number.isFinite(Number(body?.progress)) && Number(body?.progress) >= 0 && Number(body?.progress) <= 100
        ? Number(body?.progress)
        : (Number.isFinite(Number(enrollment.progress)) ? Number(enrollment.progress) : undefined);
      const incomingSubmissions = Array.isArray(body?.activitySubmissions)
        ? mergeActivitySubmissions(enrollment.activitySubmissions || [], body?.activitySubmissions, allowedLessonIds || new Set())
        : undefined;

      const finalEvaluationEnabled = Boolean(course?.finalEvaluation?.enabled);
      const mergedGradebook = Array.isArray(body?.gradebook)
        ? mergeGradebook(enrollment.gradebook || [], body.gradebook, allowedLessonIds || new Set(), finalEvaluationEnabled)
        : undefined;

      safeBody = {
        progress: incomingProgressNumber,
        lessonProgress: incomingLessonProgress,
        activitySubmissions: incomingSubmissions,
        gradebook: mergedGradebook,
      };
    }

    const updated = await updateEnrollment(ctx.params.id, safeBody);
    return json({ enrollment: updated }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

