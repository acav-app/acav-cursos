import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertAdmin, requireCourseActor } from "@/lib/courses/server/auth";
import { updatePortalUserProfile } from "@/lib/courses/server/users";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(request: Request, ctx: { params: { uid: string } }) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    const body = await request.json();
    const user = await updatePortalUserProfile(ctx.params.uid, body);
    return json({ user }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
