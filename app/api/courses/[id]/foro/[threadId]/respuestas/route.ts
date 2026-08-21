import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { requireCourseActor } from "@/lib/courses/server/auth";
import { addForumReply } from "@/lib/courses/server/forum";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(
  request: Request,
  ctx: { params: { id: string; threadId: string } },
) {
  try {
    const actor = await requireCourseActor(request);
    const body = await request.json();
    const thread = await addForumReply(ctx.params.id, ctx.params.threadId, actor, body);
    return json({ thread }, { status: 201 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
