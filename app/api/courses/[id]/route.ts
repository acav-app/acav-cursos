import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import {
  assertAdmin,
  canManageCourse,
  readOptionalCourseActor,
  requireCourseActor,
} from "@/lib/courses/server/auth";
import { isAdminRole, isStudentRole } from "@/lib/courses/roles";
import {
  deleteCourse,
  getCourseById,
  appendForumAnswersForStudent,
  toPublicCourse,
  updateCourse,
} from "@/lib/courses/server/courses";
import { listEnrollments } from "@/lib/courses/server/enrollments";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await readOptionalCourseActor(request);
    const course = await getCourseById(ctx.params.id);
    if (!course) return errorJson("course_not_found", 404, request);

    if (!actor) {
      if (course.status !== "activa")
        return errorJson("course_not_found", 404, request);
      return json({ course: toPublicCourse(course) }, { status: 200 }, request);
    }

    if (!canManageCourse(actor, course)) {
      if (course.status !== "activa")
        return errorJson("course_not_found", 404, request);
      return json({ course: toPublicCourse(course) }, { status: 200 }, request);
    }

    return json({ course }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

async function studentHasActiveEnrollmentForCourse(actor: Awaited<ReturnType<typeof requireCourseActor>>, courseId: string) {
  const normalizedCourseId = String(courseId || "").trim();
  if (!normalizedCourseId) return false;

  const enrollments = await listEnrollments({
    actor,
    filters: { courseId: normalizedCourseId },
  });

  return enrollments.some(
    (enrollment) =>
      enrollment.status === "active" &&
      String(enrollment.courseId || enrollment.jobId || "").trim() === normalizedCourseId,
  );
}

export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const course = await getCourseById(ctx.params.id);
    if (!course) return errorJson("course_not_found", 404, request);

    const body = await request.json();

    if (isAdminRole(actor.role) && canManageCourse(actor, course)) {
      const updated = await updateCourse(ctx.params.id, body, actor);
      return json({ course: updated }, { status: 200 }, request);
    }

    if (isStudentRole(actor.role)) {
      const incomingForumQ = (body as Record<string, any>)?.forumQuestions;
      if (incomingForumQ === undefined || !Array.isArray(incomingForumQ)) {
        return errorJson("forbidden", 403, request);
      }
      const studentAuthorized = await studentHasActiveEnrollmentForCourse(
        actor,
        String(ctx.params.id).trim(),
      );
      if (!studentAuthorized) {
        return errorJson("forbidden", 403, request);
      }
      const updated = await appendForumAnswersForStudent(ctx.params.id, incomingForumQ);
      return json({ course: updated }, { status: 200 }, request);
    }

    return errorJson("forbidden", 403, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: { id: string } },
) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    await deleteCourse(ctx.params.id);
    return json({ ok: true }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
