import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertAdmin, requireCourseActor } from "@/lib/courses/server/auth";
import { rejectCourse } from "@/lib/courses/server/course-actions";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    const body = await request.json();
    const course = await rejectCourse(ctx.params.id, actor, body?.rejectionReason || "");
    return json({ course }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
