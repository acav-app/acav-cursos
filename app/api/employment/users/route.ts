import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertAdmin, requireCourseActor } from "@/lib/courses/server/auth";
import { createPortalUserProfile, listPortalUsers } from "@/lib/courses/server/users";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    const users = await listPortalUsers();
    return json({ users }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    const body = await request.json();
    const user = await createPortalUserProfile(body);
    return json({ user }, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
