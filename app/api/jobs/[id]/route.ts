import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import {
  assertAdmin,
  canManageCourse,
  readOptionalCourseActor,
  requireCourseActor,
} from "@/lib/courses/server/auth";
import {
  deleteCourse,
  getCourseById,
  toPublicCourse,
  updateCourse,
} from "@/lib/courses/server/courses";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await readOptionalCourseActor(request);
    const job = await getCourseById(ctx.params.id);
    if (!job) return errorJson("job_not_found", 404, request);

    if (!actor) {
      if (job.status !== "activa") return errorJson("job_not_found", 404, request);
      return json({ job: toPublicCourse(job) }, { status: 200 }, request);
    }

    if (actor.role === "empresa" && !canManageCourse(actor, job)) {
      return errorJson("forbidden", 403, request);
    }

    return json({ job }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const job = await getCourseById(ctx.params.id);
    if (!job) return errorJson("job_not_found", 404, request);
    if (!canManageCourse(actor, job)) return errorJson("forbidden", 403, request);

    const body = await request.json();
    const updated = await updateCourse(ctx.params.id, body, actor);
    return json({ job: updated }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function DELETE(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);
    await deleteCourse(ctx.params.id);
    return json({ ok: true }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
