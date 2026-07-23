import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { registerInstitution } from "@/lib/courses/server/institution-signup";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = new URL(request.url);
    const result = await registerInstitution(body, { appBaseUrl: url.origin });
    return json(result, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
