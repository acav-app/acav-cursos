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
    const course = await getCourseById(ctx.params.id);
    if (!course) return errorJson("course_not_found", 404, request);

    if (!actor) {
      if (course.status !== "activa") return errorJson("course_not_found", 404, request);
      return json({ course: toPublicCourse(course) }, { status: 200 }, request);
    }

    if (!canManageCourse(actor, course)) {
      if (course.status !== "activa") return errorJson("course_not_found", 404, request);
      return json({ course: toPublicCourse(course) }, { status: 200 }, request);
    }

    return json({ course }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function PATCH(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const course = await getCourseById(ctx.params.id);
    if (!course) return errorJson("course_not_found", 404, request);
    if (!canManageCourse(actor, course)) return errorJson("forbidden", 403, request);

    const body = await request.json();
    const updated = await updateCourse(ctx.params.id, body, actor);
    return json({ course: updated }, { status: 200 }, request);
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
