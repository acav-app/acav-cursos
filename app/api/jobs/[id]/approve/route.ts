import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { requireCourseActor } from "@/lib/courses/server/auth";
import { approveCourse } from "@/lib/courses/server/course-actions";
import { notifyInstitutionCourseStatus } from "@/lib/courses/server/notifications";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const job = await approveCourse(ctx.params.id, actor);
    await notifyInstitutionCourseStatus(job, "aprobada");
    return json({ job }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
