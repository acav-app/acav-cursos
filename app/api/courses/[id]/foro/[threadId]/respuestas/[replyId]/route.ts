import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { requireCourseActor } from "@/lib/courses/server/auth";
import { deleteForumReply } from "@/lib/courses/server/forum";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function DELETE(
  request: Request,
  ctx: { params: { id: string; threadId: string; replyId: string } },
) {
  try {
    const actor = await requireCourseActor(request);
    const thread = await deleteForumReply(ctx.params.id, ctx.params.threadId, ctx.params.replyId, actor);
    return json({ thread }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
