import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import {
  CourseForumReplyCreateSchema,
  CourseForumThreadCreateSchema,
  type CourseForumThread,
  type CourseForumThreadReply,
} from "@/lib/courses/schemas";
import type { CourseActor } from "@/lib/courses/server/auth";
import { getCourseById } from "@/lib/courses/server/courses";
import { studentHasActiveEnrollmentForCourse } from "@/lib/courses/server/enrollments";
import { err } from "@/lib/courses/server/errors";
import { isAdminRole, isStudentRole } from "@/lib/courses/roles";
import { nowIso, removeUndefined } from "@/lib/courses/server/utils";

function randomId(prefix: string) {
  const rnd = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${rnd}`;
}

function toForumThread(
  doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
): CourseForumThread {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...(data as any),
    replies: Array.isArray((data as any).replies) ? (data as any).replies : [],
  } as CourseForumThread;
}

function actorDisplayName(actor: CourseActor) {
  return (
    String((actor as any)?.displayName || "").trim() ||
    [((actor as any)?.firstName || ""), ((actor as any)?.lastName || "")]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    String(actor?.email || "").trim() ||
    "Usuario"
  );
}

export async function assertCourseForumAccess(actor: CourseActor, courseId: string) {
  const normalizedCourseId = String(courseId || "").trim();
  if (!normalizedCourseId) throw err(400, "course_id_required");

  const course = await getCourseById(normalizedCourseId);
  if (!course) throw err(404, "course_not_found");

  if (isAdminRole(actor.role)) return course;

  if (isStudentRole(actor.role)) {
    const hasAccess = await studentHasActiveEnrollmentForCourse(actor, normalizedCourseId);
    if (!hasAccess) throw err(403, "forbidden");
    return course;
  }

  throw err(403, "forbidden");
}

export async function listForumThreads(courseId: string) {
  const normalizedCourseId = String(courseId || "").trim();
  if (!normalizedCourseId) throw err(400, "course_id_required");

  const db = getAdminDb();
  const snap = await db
    .collection(COURSE_COLLECTIONS.forumThreads)
    .where("courseId", "==", normalizedCourseId)
    .get();

  const threads = snap.docs.map(toForumThread);
  threads.sort((a, b) => {
    const aDate = new Date(a.lastActivityAt || a.createdAt).getTime();
    const bDate = new Date(b.lastActivityAt || b.createdAt).getTime();
    return bDate - aDate;
  });
  return threads;
}

export async function getForumThreadById(courseId: string, threadId: string) {
  const normalizedCourseId = String(courseId || "").trim();
  const normalizedThreadId = String(threadId || "").trim();
  if (!normalizedCourseId || !normalizedThreadId) throw err(400, "thread_id_required");

  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.forumThreads).doc(normalizedThreadId);
  const snap = await ref.get();
  if (!snap.exists) throw err(404, "thread_not_found");

  const thread = toForumThread(snap);
  if (String(thread.courseId || "").trim() !== normalizedCourseId) throw err(404, "thread_not_found");
  return thread;
}

export async function createForumThread(courseId: string, actor: CourseActor, input: unknown) {
  const normalizedCourseId = String(courseId || "").trim();
  await assertCourseForumAccess(actor, normalizedCourseId);

  const parsed = CourseForumThreadCreateSchema.parse(input);
  const now = nowIso();
  const id = randomId("forum-thread");

  const thread: CourseForumThread = removeUndefined({
    id,
    courseId: normalizedCourseId,
    title: parsed.title,
    message: parsed.message,
    createdBy: String(actor.uid || actor.email || ""),
    createdByName: actorDisplayName(actor),
    createdByEmail: String(actor.email || "").trim() || undefined,
    createdByRole: isAdminRole(actor.role) ? "admin" : "alumno",
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    repliesCount: 0,
    replies: [],
  });

  const db = getAdminDb();
  await db.collection(COURSE_COLLECTIONS.forumThreads).doc(id).set(thread);
  return thread;
}

export async function addForumReply(
  courseId: string,
  threadId: string,
  actor: CourseActor,
  input: unknown,
) {
  const normalizedCourseId = String(courseId || "").trim();
  const normalizedThreadId = String(threadId || "").trim();
  await assertCourseForumAccess(actor, normalizedCourseId);

  const parsed = CourseForumReplyCreateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.forumThreads).doc(normalizedThreadId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw err(404, "thread_not_found");

    const current = toForumThread(snapshot);
    if (String(current.courseId || "").trim() !== normalizedCourseId) throw err(404, "thread_not_found");

    const now = nowIso();
    const reply: CourseForumThreadReply = removeUndefined({
      id: randomId("forum-reply"),
      message: parsed.message,
      createdBy: String(actor.uid || actor.email || ""),
      createdByName: actorDisplayName(actor),
      createdByEmail: String(actor.email || "").trim() || undefined,
      createdByRole: isAdminRole(actor.role) ? "admin" : "alumno",
      createdAt: now,
    });

    const replies = [...(current.replies || []), reply];
    transaction.update(ref, {
      replies,
      repliesCount: replies.length,
      updatedAt: now,
      lastActivityAt: now,
    });

    return { ...current, replies, repliesCount: replies.length, updatedAt: now, lastActivityAt: now };
  });
}

export async function deleteForumThread(courseId: string, threadId: string, actor: CourseActor) {
  const normalizedCourseId = String(courseId || "").trim();
  const normalizedThreadId = String(threadId || "").trim();
  const thread = await getForumThreadById(normalizedCourseId, normalizedThreadId);

  const isOwner = String(thread.createdBy || "") === String(actor.uid || actor.email || "");
  if (!isAdminRole(actor.role) && !isOwner) throw err(403, "forbidden");

  const db = getAdminDb();
  await db.collection(COURSE_COLLECTIONS.forumThreads).doc(normalizedThreadId).delete();
}

export async function deleteForumReply(
  courseId: string,
  threadId: string,
  replyId: string,
  actor: CourseActor,
) {
  const normalizedCourseId = String(courseId || "").trim();
  const normalizedThreadId = String(threadId || "").trim();
  const normalizedReplyId = String(replyId || "").trim();
  if (!normalizedReplyId) throw err(400, "reply_id_required");

  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.forumThreads).doc(normalizedThreadId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw err(404, "thread_not_found");

    const current = toForumThread(snapshot);
    if (String(current.courseId || "").trim() !== normalizedCourseId) throw err(404, "thread_not_found");

    const target = (current.replies || []).find((reply) => reply.id === normalizedReplyId);
    if (!target) throw err(404, "reply_not_found");

    const isOwner = String(target.createdBy || "") === String(actor.uid || actor.email || "");
    if (!isAdminRole(actor.role) && !isOwner) throw err(403, "forbidden");

    const replies = (current.replies || []).filter((reply) => reply.id !== normalizedReplyId);
    const now = nowIso();
    transaction.update(ref, {
      replies,
      repliesCount: replies.length,
      updatedAt: now,
    });

    return { ...current, replies, repliesCount: replies.length, updatedAt: now };
  });
}
