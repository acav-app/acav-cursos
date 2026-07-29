import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertRole, requireCourseActor } from "@/lib/courses/server/auth";
import { createEnrollment, listEnrollments } from "@/lib/courses/server/enrollments";
import { notifyInstitutionNewEnrollment, notifyStudentEnrollmentConfirmation } from "@/lib/courses/server/notifications";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertRole(actor, ["admin", "alumno"]);
    const url = new URL(request.url);
    const applications = await listEnrollments({
      actor,
      filters: {
        courseId: url.searchParams.get("courseId"),
        jobId: url.searchParams.get("jobId"),
        institutionId: url.searchParams.get("institutionId"),
        companyId: url.searchParams.get("companyId"),
        status: url.searchParams.get("status"),
        email: url.searchParams.get("email"),
      },
    });
    return json({ applications }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const application = await createEnrollment(body);
    await Promise.all([
      notifyInstitutionNewEnrollment(application),
      notifyStudentEnrollmentConfirmation(application),
    ]);
    return json({ application }, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
