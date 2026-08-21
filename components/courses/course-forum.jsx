"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { cn } from "@/lib/utils";

function formatDateTime(iso) {
  try {
    const date = new Date(String(iso || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function AuthorBadge({ role }) {
  if (role === "admin") {
    return (
      <Badge variant="soft" color="info" className="rounded-full">
        <ShieldCheck className="mr-1 h-3 w-3" />
        Administración
      </Badge>
    );
  }
  return (
    <Badge variant="soft" color="secondary" className="rounded-full">
      Alumno
    </Badge>
  );
}

/**
 * Foro general del curso: espacio de comunidad separado del "Foro de la clase".
 * Tanto administración como alumnos inscriptos pueden crear preguntas y responder.
 */
export default function CourseForum({ courseId, user, actor, className }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState("");
  const [deletingKey, setDeletingKey] = useState("");

  const normalizedCourseId = String(courseId || "").trim();
  const currentUid = String(actor?.uid || user?.uid || user?.email || "").trim();
  const isAdmin = String(actor?.role || "").trim() === "admin";

  const loadThreads = useCallback(async () => {
    if (!normalizedCourseId || !user) return;
    setLoading(true);
    setLoadError("");
    try {
      const data = await authedFetch(user, `/api/courses/${normalizedCourseId}/foro`, {
        method: "GET",
      });
      setThreads(Array.isArray(data?.threads) ? data.threads : []);
    } catch (error) {
      setLoadError(error?.message || "No pudimos cargar el foro del curso.");
    } finally {
      setLoading(false);
    }
  }, [normalizedCourseId, user]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  async function handleCreateThread() {
    const title = newTitle.trim();
    const message = newMessage.trim();
    if (title.length < 3) {
      toast.error("El título debe tener al menos 3 caracteres.", { position: "top-right" });
      return;
    }
    if (message.length < 3) {
      toast.error("Escribí un mensaje para tu pregunta.", { position: "top-right" });
      return;
    }
    setCreating(true);
    try {
      const data = await authedFetch(user, `/api/courses/${normalizedCourseId}/foro`, {
        method: "POST",
        body: JSON.stringify({ title, message }),
      });
      if (data?.thread) {
        setThreads((current) => [data.thread, ...current]);
        setExpandedId(data.thread.id);
      }
      setNewTitle("");
      setNewMessage("");
      setShowNewForm(false);
      toast.success("Pregunta publicada en el foro.", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No pudimos publicar tu pregunta.", { position: "top-right" });
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(threadId) {
    const message = String(replyDrafts[threadId] || "").trim();
    if (!message) {
      toast.error("Escribí una respuesta antes de enviar.", { position: "top-right" });
      return;
    }
    setReplyingId(threadId);
    try {
      const data = await authedFetch(
        user,
        `/api/courses/${normalizedCourseId}/foro/${threadId}/respuestas`,
        {
          method: "POST",
          body: JSON.stringify({ message }),
        },
      );
      if (data?.thread) {
        setThreads((current) =>
          current.map((thread) => (thread.id === threadId ? data.thread : thread)),
        );
      }
      setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
      toast.success("Respuesta publicada.", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No pudimos publicar tu respuesta.", { position: "top-right" });
    } finally {
      setReplyingId("");
    }
  }

  async function handleDeleteThread(threadId) {
    setDeletingKey(`thread-${threadId}`);
    try {
      await authedFetch(user, `/api/courses/${normalizedCourseId}/foro/${threadId}`, {
        method: "DELETE",
      });
      setThreads((current) => current.filter((thread) => thread.id !== threadId));
      toast.success("Pregunta eliminada.", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No pudimos eliminar la pregunta.", { position: "top-right" });
    } finally {
      setDeletingKey("");
    }
  }

  async function handleDeleteReply(threadId, replyId) {
    setDeletingKey(`reply-${replyId}`);
    try {
      const data = await authedFetch(
        user,
        `/api/courses/${normalizedCourseId}/foro/${threadId}/respuestas/${replyId}`,
        { method: "DELETE" },
      );
      if (data?.thread) {
        setThreads((current) =>
          current.map((thread) => (thread.id === threadId ? data.thread : thread)),
        );
      }
      toast.success("Respuesta eliminada.", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No pudimos eliminar la respuesta.", { position: "top-right" });
    } finally {
      setDeletingKey("");
    }
  }

  return (
    <section
      id="foro-general"
      className={cn(
        "rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#334155]">
            <MessagesSquare className="h-3 w-3" />
            Foro del curso
          </div>
          <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
            Comunidad y consultas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Espacio abierto para preguntar y responder dudas generales del curso.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="soft" color="secondary" className="rounded-full shrink-0">
            {threads.length} pregunta{threads.length === 1 ? "" : "s"}
          </Badge>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowNewForm((v) => !v)}
            className="rounded-2xl bg-[#1B2B50] hover:bg-[#233A6A]"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Nueva pregunta
          </Button>
        </div>
      </div>

      {showNewForm ? (
        <div className="mt-5 rounded-[22px] border border-slate-200 bg-[#FCFDFF] p-4 md:p-5">
          <div className="grid gap-3">
            <Input
              value={newTitle}
              placeholder="Título de tu pregunta"
              maxLength={180}
              onChange={(e) => setNewTitle(e.target.value)}
              className="rounded-[16px] border-slate-300 bg-white"
            />
            <Textarea
              value={newMessage}
              placeholder="Describí tu consulta con el mayor detalle posible..."
              rows={4}
              maxLength={4000}
              onChange={(e) => setNewMessage(e.target.value)}
              className="rounded-[16px] border-slate-300 bg-white"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewForm(false);
                  setNewTitle("");
                  setNewMessage("");
                }}
                className="rounded-2xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={creating}
                onClick={handleCreateThread}
                className="rounded-2xl bg-[#1B2B50] hover:bg-[#233A6A]"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Publicar pregunta
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-8 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando foro...
          </div>
        ) : loadError ? (
          <div className="rounded-[22px] border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            {loadError}
          </div>
        ) : threads.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-background/50 p-6 md:p-8 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2356B8]">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div className="mt-4 text-sm font-semibold text-foreground">
              Aún no hay preguntas en el foro
            </div>
            <p className="mt-2 text-xs text-muted-foreground mx-auto max-w-md">
              Sé el primero en abrir una consulta para compartir con el resto de la comunidad del curso.
            </p>
          </div>
        ) : (
          threads.map((thread) => {
            const isExpanded = expandedId === thread.id;
            const replies = Array.isArray(thread.replies) ? thread.replies : [];
            const canDeleteThread = isAdmin || String(thread.createdBy || "") === currentUid;
            return (
              <article
                key={thread.id}
                className="rounded-[22px] border border-slate-200 bg-[#FCFDFF] p-4 md:p-5"
              >
                <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AuthorBadge role={thread.createdByRole} />
                      <span className="text-[11px] text-slate-400">
                        {thread.createdByName || thread.createdByEmail}
                      </span>
                      <span className="text-[11px] text-slate-400">·</span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(thread.createdAt)}
                      </span>
                    </div>
                    <h3 className="mt-2 text-[15px] font-semibold text-slate-950">
                      {thread.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600 whitespace-pre-wrap">
                      {thread.message}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="soft" color={replies.length ? "success" : "secondary"} className="rounded-full">
                      {replies.length} respuesta{replies.length === 1 ? "" : "s"}
                    </Badge>
                    {canDeleteThread ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        disabled={deletingKey === `thread-${thread.id}`}
                        onClick={() => handleDeleteThread(thread.id)}
                        className="h-8 w-8 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setExpandedId(isExpanded ? "" : thread.id)}
                      className="h-8 w-8 rounded-full"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </header>

                {isExpanded ? (
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                    {replies.map((reply) => {
                      const canDeleteReply = isAdmin || String(reply.createdBy || "") === currentUid;
                      return (
                        <div
                          key={reply.id}
                          className="rounded-[18px] border border-slate-200 bg-white p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <AuthorBadge role={reply.createdByRole} />
                              <span className="font-semibold text-slate-700">
                                {reply.createdByName || reply.createdByEmail}
                              </span>
                              <span>·</span>
                              <span>{formatDateTime(reply.createdAt)}</span>
                            </div>
                            {canDeleteReply ? (
                              <button
                                type="button"
                                disabled={deletingKey === `reply-${reply.id}`}
                                onClick={() => handleDeleteReply(thread.id, reply.id)}
                                className="text-slate-400 hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1.5 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                            {reply.message}
                          </p>
                        </div>
                      );
                    })}

                    <div className="space-y-2">
                      <Textarea
                        value={replyDrafts[thread.id] || ""}
                        rows={3}
                        placeholder="Escribí tu respuesta..."
                        maxLength={4000}
                        onChange={(e) =>
                          setReplyDrafts((current) => ({ ...current, [thread.id]: e.target.value }))
                        }
                        className="rounded-[16px] border-slate-300 bg-white"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          disabled={replyingId === thread.id || !String(replyDrafts[thread.id] || "").trim()}
                          onClick={() => handleReply(thread.id)}
                          className="rounded-2xl bg-[#1B2B50] hover:bg-[#233A6A]"
                        >
                          {replyingId === thread.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Publicando...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 h-4 w-4" />
                              Responder
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
