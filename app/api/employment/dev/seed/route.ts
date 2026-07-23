import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertAdmin, requireCourseActor } from "@/lib/courses/server/auth";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    return json({ ok: false, message: "deprecated_seed_route" }, { status: 410 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
