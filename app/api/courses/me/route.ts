import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { requireCourseActor } from "@/lib/courses/server/auth";
import { normalizePortalRole } from "@/lib/courses/roles";
import { updatePortalUserProfile } from "@/lib/courses/server/users";
import { z } from "zod";

export const runtime = "nodejs";

function serializeActor(actor: Record<string, any>) {
  return {
    ...actor,
    role: normalizePortalRole(actor?.role),
  };
}

const StudentSelfUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
});

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    return json({ actor: serializeActor(actor) }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    const body = await request.json();
    const payload = StudentSelfUpdateSchema.parse(body);

    if (normalizePortalRole(actor.role) === "alumno") {
      const updated = await updatePortalUserProfile(actor.uid, payload);
      return json({ actor: serializeActor(updated) }, { status: 200 }, request);
    }

    return errorJson("forbidden", 403, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
