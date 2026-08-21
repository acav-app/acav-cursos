import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { requireCourseActor } from "@/lib/courses/server/auth";
import { assertCourseForumAccess, deleteForumThread, getForumThreadById } from "@/lib/courses/server/forum";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(
  request: Request,
  ctx: { params: { id: string; threadId: string } },
) {
  try {
    const actor = await requireCourseActor(request);
    await assertCourseForumAccess(actor, ctx.params.id);
    const thread = await getForumThreadById(ctx.params.id, ctx.params.threadId);
    return json({ thread }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: { id: string; threadId: string } },
) {
  try {
    const actor = await requireCourseActor(request);
    await deleteForumThread(ctx.params.id, ctx.params.threadId, actor);
    return json({ ok: true }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
