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
    const company = await getInstitutionById(ctx.params.id);
    if (!company) return errorJson("company_not_found", 404, request);

    if (!actor) {
      if (company.status !== "activa") return errorJson("company_not_found", 404, request);
      return json({ company: toPublicInstitution(company) }, { status: 200 }, request);
    }

    if (actor.role === "empresa" && !canManageInstitution(actor, company)) {
      return errorJson("forbidden", 403, request);
    }

    return json({ company }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const company = await getInstitutionById(ctx.params.id);
    if (!company) return errorJson("company_not_found", 404, request);
    if (!canManageInstitution(actor, company)) return errorJson("forbidden", 403, request);

    const body = await request.json();
    if (actor.role === "empresa") {
      delete body.status;
      delete body.isVerified;
      delete body.ownerUserId;
    }

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
