import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertAdmin, requireCourseActor } from "@/lib/courses/server/auth";
import { reconcileEnrollmentAmounts } from "@/lib/courses/server/enrollments";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (!ids.length) return errorJson("ids_required", 400, request);
    const result = await reconcileEnrollmentAmounts({
      ids,
      reviewedBy: String(body?.reviewedBy || actor.email || actor.uid || "admin"),
    });
    return json(result, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
