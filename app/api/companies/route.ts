import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertRole, readOptionalCourseActor, requireCourseActor } from "@/lib/courses/server/auth";
import { createInstitution, listInstitutions } from "@/lib/courses/server/institutions";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const actor = await readOptionalCourseActor(request);
    const canReadInternal = actor?.role === "admin" || actor?.role === "empresa";
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const institutionId = url.searchParams.get("institutionId") || undefined;
    const companyId = url.searchParams.get("companyId") || undefined;
    const slug = url.searchParams.get("slug") || undefined;

    const companies = await listInstitutions({
      publicOnly: !canReadInternal,
      actor: canReadInternal ? actor : null,
      status,
      institutionId,
      companyId,
      slug,
    });

    return json({ companies }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertRole(actor, ["admin"]);
    const body = await request.json();
    const company = await createInstitution(body, actor);
    return json({ company }, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
