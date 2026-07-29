import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { assertRole, readOptionalCourseActor, requireCourseActor } from "@/lib/courses/server/auth";
import { createCourse, listCourses } from "@/lib/courses/server/courses";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const actor = await readOptionalCourseActor(request);
    const canReadInternal = actor?.role === "admin";
    const url = new URL(request.url);
    const courses = await listCourses({
      publicOnly: !canReadInternal,
      actor: canReadInternal ? actor : null,
      scope: (url.searchParams.get("scope") as "active" | "history" | null) || "active",
      filters: {
        q: url.searchParams.get("q"),
        slug: url.searchParams.get("slug"),
        institutionId: url.searchParams.get("institutionId"),
        companyId: url.searchParams.get("companyId"),
        area: url.searchParams.get("area"),
        modality: url.searchParams.get("modality"),
        modalidad: url.searchParams.get("modalidad"),
        pace: url.searchParams.get("pace"),
        jornada: url.searchParams.get("jornada"),
        contractType: url.searchParams.get("contractType"),
        subRubro: url.searchParams.get("subRubro"),
        city: url.searchParams.get("city"),
        status: url.searchParams.get("status"),
      },
    });
    return json({ courses }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertRole(actor, ["admin"]);
    const body = await request.json();
    const course = await createCourse(body, actor);
    return json({ course }, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
