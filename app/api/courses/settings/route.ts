import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import {
  canManageCourseSettings,
  readOptionalCourseActor,
  requireCourseActor,
} from "@/lib/courses/server/auth";
import { getCourseSettings, toPublicCourseSettings, updateCourseSettings } from "@/lib/courses/server/settings";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const actor = await readOptionalCourseActor(request);
    const settings = await getCourseSettings();

    if (!actor) {
      return json({ settings: toPublicCourseSettings(settings) }, { status: 200 }, request);
    }

    if (!canManageCourseSettings(actor, settings)) {
      return errorJson("forbidden", 403, request);
    }

    return json({ settings }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    if (!canManageCourseSettings(actor)) {
      return errorJson("forbidden", 403, request);
    }

    const body = await request.json();
    const settings = await updateCourseSettings(body);
    return json({ settings }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
