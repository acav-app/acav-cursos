import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import {
  assertAdmin,
  canManageInstitution,
  readOptionalCourseActor,
  requireCourseActor,
} from "@/lib/courses/server/auth";
import {
  deleteInstitution,
  getInstitutionById,
  toPublicInstitution,
  updateInstitution,
} from "@/lib/courses/server/institutions";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await readOptionalCourseActor(request);
    const institution = await getInstitutionById(ctx.params.id);
    if (!institution) return errorJson("institution_not_found", 404, request);

    if (!actor) {
      if (institution.status !== "activa") return errorJson("institution_not_found", 404, request);
      return json({ institution: toPublicInstitution(institution) }, { status: 200 }, request);
    }

    if (!canManageInstitution(actor, institution)) {
      return errorJson("forbidden", 403, request);
    }

    return json({ institution }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const institution = await getInstitutionById(ctx.params.id);
    if (!institution) return errorJson("institution_not_found", 404, request);
    if (!canManageInstitution(actor, institution)) return errorJson("forbidden", 403, request);

    const body = await request.json();
    const updated = await updateInstitution(ctx.params.id, body, { actor });
    return json(updated, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function DELETE(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    await deleteInstitution(ctx.params.id);
    return json({ ok: true }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
