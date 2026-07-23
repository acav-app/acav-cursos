import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertRole, canViewEnrollment, requireCourseActor } from "@/lib/courses/server/auth";
import { getEnrollmentById, updateEnrollment } from "@/lib/courses/server/enrollments";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    assertRole(actor, ["admin", "empresa", "candidato"]);
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
    assertRole(actor, ["admin", "empresa"]);
    const enrollment = await getEnrollmentById(ctx.params.id);
    if (!enrollment) return errorJson("enrollment_not_found", 404, request);
    if (!canViewEnrollment(actor, enrollment)) return errorJson("forbidden", 403, request);

    const body = await request.json();
    const updated = await updateEnrollment(ctx.params.id, body);
    return json({ enrollment: updated }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
