import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { requireCourseActor } from "@/lib/courses/server/auth";
import { assertCourseForumAccess, createForumThread, listForumThreads } from "@/lib/courses/server/forum";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    await assertCourseForumAccess(actor, ctx.params.id);
    const threads = await listForumThreads(ctx.params.id);
    return json({ threads }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const body = await request.json();
    const thread = await createForumThread(ctx.params.id, actor, body);
    return json({ thread }, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
