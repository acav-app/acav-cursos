import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { registerCourseStudent } from "@/lib/courses/server/register";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await registerCourseStudent(body);
    return json(result, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
