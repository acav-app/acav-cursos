import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { requireCourseActor } from "@/lib/courses/server/auth";
import { rejectCourse } from "@/lib/courses/server/course-actions";
import { notifyInstitutionCourseStatus } from "@/lib/courses/server/notifications";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const body = await request.json().catch(() => ({}));
    const job = await rejectCourse(ctx.params.id, actor, body?.rejectionReason);
    await notifyInstitutionCourseStatus(job, "rechazada");
    return json({ job }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
