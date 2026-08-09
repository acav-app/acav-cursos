import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { canViewEnrollment, requireCourseActor } from "@/lib/courses/server/auth";
import { getCourseById } from "@/lib/courses/server/courses";
import { getEnrollmentById } from "@/lib/courses/server/enrollments";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, ctx: { params: { enrollmentId: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const enrollment = await getEnrollmentById(ctx.params.enrollmentId);
    if (!enrollment) return errorJson("enrollment_not_found", 404, request);
    if (!canViewEnrollment(actor, enrollment)) return errorJson("forbidden", 403, request);

    const isAdmin = actor.role === "admin";
    if (!isAdmin && enrollment.status !== "active") {
      return errorJson("course_content_locked", 403, request);
    }

    const courseId = String(enrollment.courseId || enrollment.jobId || "").trim();
    if (!courseId) return errorJson("course_not_found", 404, request);

    const course = await getCourseById(courseId);
    if (!course) return errorJson("course_not_found", 404, request);

    return json({ course, enrollment }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
