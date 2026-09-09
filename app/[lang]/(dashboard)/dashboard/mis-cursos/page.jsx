"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Bookmark, CheckCircle2, Clock3, ExternalLink, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";
import { readSavedCourses, writeSavedCourses } from "@/lib/courses/client/saved-courses";
import { useLocalizedPath } from "@/lib/utils";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { isStudentRole, isAdminRole } from "@/lib/courses/roles";

function dateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray((value || {}).data)) return (value || {}).data;
  return [];
}

const ACTIVE_STATUSES = new Set(
  [
    "active",
    "curso_activo",
    "curso activo",
    "aprobado",
    "aprobada",
    "approved",
    "confirmed",
    "confirmado",
    "confirmada",
    "pagado",
    "pagada",
    "paid",
    "inscrito",
    "inscripto",
    "inscripta",
    "matriculado",
    "matriculada",
    "accredited",
    "acreditado",
    "acreditada",
    "habilitada",
    "habilitado",
  ].map((s) => s.toLowerCase())
);

const PENDING_HINT_STATUSES = new Set(
  ["started", "waiting_payment", "payment_under_review", "pendiente", "en_revision", "revisión", "revision", "rejected", "cancelled", "cancelada", "cancelado", "payment_pending", "pending_payment", "waiting_review", "review_pending", "en_proceso", "proceso", "processing", "received", "recibida"].map((s) => s.toLowerCase())
);

function EmptyState({
  buildLocalizedPath,
  title = "Todavía no guardaste cursos",
  text = "Marca cursos desde el catálogo y úsalos como shortlist personal. Aquí vas a tener una vista limpia para retomarlos cuando quieras.",
  cta = "Explorar cursos",
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-border/70 bg-card p-10 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-primary">
        <Bookmark className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{text}</p>
      <Button asChild className="mt-6 rounded-2xl">
        <Link href={buildLocalizedPath("/cursos")}>{cta}</Link>
      </Button>
    </div>
  );
}

export default function DashboardMisCursosPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [savedCourses, setSavedCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);

  useEffect(() => {
    const syncSaved = () => {
      setSavedCourses(readSavedCourses());
    };

    syncSaved();
    window.addEventListener("storage", syncSaved);
    window.addEventListener("focus", syncSaved);

    return () => {
      window.removeEventListener("storage", syncSaved);
      window.removeEventListener("focus", syncSaved);
    };
  }, []);

  const loadEnrollments = useCallback(async () => {
    let cancelled = false;
    try {
      setLoadingEnrollments(true);
      if (!user) {
        setEnrollments([]);
        return;
      }
      const actorRoleRaw = actor?.role;
      const actorEmailRaw = actor?.email;
      const uidUser = user?.uid;
      const emailUser = user?.email;
      if (typeof window !== "undefined") {
        try {
          // eslint-disable-next-line no-console
          console.info("[mis-cursos] loadEnrollments — contexto", {
            actorRole: actorRoleRaw,
            actorEmail: actorEmailRaw,
            userUid: uidUser,
            userEmail: emailUser,
          });
        } catch (_) {}
      }
      const payload = await authedFetch(user, "/api/enrollments", { method: "GET" });
      if (cancelled) return;
      const items = asArray(payload?.enrollments || payload?.data || payload);
      if (typeof window !== "undefined") {
        try {
          // eslint-disable-next-line no-console
          console.info("[mis-cursos] enrollments raw payload", {
            keys: Object.keys(payload || {}),
            totalItems: items.length,
            sample: items.slice(0, 3).map((e) => ({
              id: e?.id,
              status: e?.status,
              paymentStatus: e?.paymentStatus,
              email: e?.email,
              userId: e?.userId || e?.uid,
              courseTitle: e?.courseTitle || e?.jobTitle,
            })),
          });
        } catch (_) {}
      }
      setEnrollments(items);
    } catch (e) {
      console.error("[mis-cursos] falló carga de inscripciones", e);
      setEnrollments([]);
    } finally {
      if (!cancelled) setLoadingEnrollments(false);
    }
  }, [user, actor?.role, actor?.email]);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  const removeSaved = (courseId) => {
    const next = readSavedCourses().filter((c) => String(c?.id) !== String(courseId));
    writeSavedCourses(next);
    setSavedCourses(next);
    toast.success("Curso removido de guardados");
  };

  const activeIds = useMemo(() => new Set(), []);
  const activeEnrollments = useMemo(() => {
    const list = enrollments.filter((e) => {
      const status = String(e?.status || "").trim().toLowerCase();
      if (!status) return false;
      return ACTIVE_STATUSES.has(status);
    });
    activeIds.clear();
    list.forEach((e) => activeIds.add(String(e?.id)));
    return list;
  }, [enrollments, activeIds]);

  const pendingEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      const id = String(e?.id || "");
      const status = String(e?.status || "").trim().toLowerCase();
      if (!status) return Boolean(id);
      if (activeIds.has(id)) return false;
      return ACTIVE_STATUSES.has(status) === false;
    });
  }, [enrollments, activeIds]);

  if (actorLoading) return <DashboardPageShellSkeleton />;

  const actorErrorCode = String(actorError || "").trim().toLowerCase();
  const userAuthenticated = Boolean(user);
  const isBonaFideAdmin = isAdminRole(actor?.role);
  const profileNotFound = !actor && (actorErrorCode.includes("course_profile_not_found") || actorErrorCode.includes("profile_not_found"));
  const hasAnyEnrollment = Array.isArray(enrollments) && enrollments.length > 0;
  const ignoreMissingProfile = profileNotFound && userAuthenticated;

  if (actorError && !ignoreMissingProfile && !isBonaFideAdmin && !hasAnyEnrollment) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-10 md:px-4">
        <div className="rounded-[28px] border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-semibold text-foreground">No se pudo cargar tu perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{String(actorError || "Volvé a intentar en unos segundos.")}</p>
        </div>
      </div>
    );
  }

  const isStudentLike = userAuthenticated && (isStudentRole(actor?.role) || ignoreMissingProfile || hasAnyEnrollment);
  const shouldShowStudentPanel = isStudentLike || (userAuthenticated && !isBonaFideAdmin);

  return (
    <div className="mx-auto max-w-6xl px-3 py-8 md:px-4">
      {shouldShowStudentPanel ? (
        <section className="rounded-[30px] border border-border/60 bg-card p-6 shadow-[0_20px_55px_rgba(15,23,42,0.05)] sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-2xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Panel alumno
              </div>
              <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-foreground">
                Cursadas y accesos
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                Accede a tus cursos activos, sigue las inscripciones pendientes y mantén aparte tu shortlist personal.
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={buildLocalizedPath("/cursos")}>
                <Bookmark className="mr-2 h-4 w-4" />
                Explorar catálogo
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {shouldShowStudentPanel ? (
        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <PlayCircle className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Cursos activos</h2>
              {loadingEnrollments ? (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cargando…
                </span>
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {activeEnrollments.length} curso{activeEnrollments.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {loadingEnrollments ? (
              <div className="grid gap-4">
                <div className="rounded-[26px] border border-border/60 bg-card p-5">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-4 h-6 w-56 animate-pulse rounded-xl bg-slate-200" />
                  <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-slate-200" />
                </div>
                <div className="rounded-[26px] border border-border/60 bg-card p-5">
                  <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-4 h-6 w-56 animate-pulse rounded-xl bg-slate-200" />
                  <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-slate-200" />
                </div>
              </div>
            ) : activeEnrollments.length ? (
              <div className="grid gap-4">
                {activeEnrollments.map((enrollment) => {
                  const progress = Math.max(0, Math.min(Number(enrollment?.progress || 0), 100));
                  return (
                    <article key={String(enrollment?.id || `active-${enrollment?.courseId || Math.random()}`)} className="rounded-[26px] border border-border/60 bg-card p-5">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                              Activo
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {enrollment?.institutionName || enrollment?.companyName || "ACAV Cursos"}
                            </span>
                          </div>
                          <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
                            {enrollment?.courseTitle || enrollment?.jobTitle || "Curso"}
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Progreso {progress}%</span>
                            <span>·</span>
                            <span>
                              Pago {String(enrollment?.paymentStatus || enrollment?.payment?.status || "").replaceAll("_", " ") || "pendiente"}
                            </span>
                          </div>
                          <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[#1B2B50]"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button asChild className="rounded-2xl">
                            <Link href={buildLocalizedPath(`/dashboard/mis-cursos/${String(enrollment?.id)}`)}>
                              Continuar cursada
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild className="rounded-2xl">
                          <Link href={buildLocalizedPath(`/dashboard/mis-cursos/${String(enrollment?.id)}`)}>
                            Ver seguimiento
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-card p-6">
                <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                  <PlayCircle className="h-4 w-4 text-primary" />
                  Todavía no tienes cursos activos.
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cuando una inscripción quede activa aparecerá aquí con el acceso completo al contenido.
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center gap-3">
              <Clock3 className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Pendientes de activación</h2>
              {loadingEnrollments ? (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Cargando…
                </span>
              ) : (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {pendingEnrollments.length} pendiente{pendingEnrollments.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {loadingEnrollments ? (
              <div className="grid gap-4">
                <div className="rounded-[26px] border border-border/60 bg-card p-5">
                  <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
                  <div className="mt-4 h-6 w-60 animate-pulse rounded-xl bg-slate-200" />
                </div>
              </div>
            ) : pendingEnrollments.length ? (
              <div className="grid gap-4">
                {pendingEnrollments.map((enrollment) => {
                  const status = String(enrollment?.status || "").trim();
                  const statusLabel =
                    status.length > 0
                      ? status.replaceAll("_", " ")
                      : PENDING_HINT_STATUSES.has(String(enrollment?.paymentStatus || "").toLowerCase())
                        ? "Pago pendiente"
                        : "Pendiente";
                  return (
                    <article key={String(enrollment?.id || `pending-${enrollment?.courseId || Math.random()}`)} className="rounded-[26px] border border-border/60 bg-card p-5">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                              {statusLabel}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {enrollment?.institutionName || enrollment?.companyName || "ACAV Cursos"}
                            </span>
                          </div>
                          <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
                            {enrollment?.courseTitle || enrollment?.jobTitle || "Curso"}
                          </h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            El contenido completo se habilita solo cuando la inscripción quede activa.
                          </p>
                        </div>

                        <Button asChild className="rounded-2xl">
                          <Link href={buildLocalizedPath(`/dashboard/mis-cursos/${String(enrollment?.id)}`)}>
                            Ver seguimiento
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-border/70 bg-card p-6">
                <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  No hay cursos pendientes de activación.
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        {shouldShowStudentPanel ? (
          <div className="mb-4 flex items-center gap-3">
            <Bookmark className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Guardados</h2>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-3">
            <Bookmark className="h-4 w-4 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Cursos guardados</h2>
          </div>
        )}
        {savedCourses.length ? (
          <div className="grid gap-4">
            {savedCourses.map((course) => {
              const category = String(course?.subRubro || course?.categoryLabel || "Sin categoría").trim();
              const modality = String(course?.modality || course?.modalityLabel || "Sin modalidad").trim();
              const level = String(course?.level || "Sin nivel").trim();
              const duration = String(course?.duration || "").trim();
              const savedAt = dateLabel(course?.savedAt);

              return (
                <article key={String(course?.id)} className="rounded-[26px] border border-border/60 bg-card p-5 transition hover:border-primary/20 hover:bg-muted/20">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-border/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Guardado
                        </span>
                        {savedAt ? <span className="text-xs text-muted-foreground">Última marca: {savedAt}</span> : null}
                      </div>
                      <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">
                        {course?.title || "Curso"}
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">{course?.companyName || "ACAV Cursos"}</p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {category ? <span>{category}</span> : null}
                        {category && (modality || level) ? <span>·</span> : null}
                        {modality ? <span>{modality}</span> : null}
                        {modality && level ? <span>·</span> : null}
                        {level ? <span>{level}</span> : null}
                        {(modality || level) && duration ? <span>·</span> : null}
                        {duration ? <span>{duration}</span> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button asChild className="rounded-2xl">
                        <Link href={buildLocalizedPath(`/cursos/${course.slug || course.id}`)}>
                          Ver curso
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-2xl border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => removeSaved(course?.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Quitar
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : shouldShowStudentPanel ? (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-card p-6">
            <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
              <Bookmark className="h-4 w-4 text-primary" />
              Todavía no guardaste ningún curso.
            </div>
          </div>
        ) : (
          <EmptyState
            buildLocalizedPath={buildLocalizedPath}
            title="Todavía no guardaste cursos"
            text="Marca cursos desde el catálogo y úsalos como shortlist personal. Aquí vas a tener una vista limpia para retomarlos cuando quieras."
            cta="Explorar cursos"
          />
        )}
      </section>
    </div>
  );
}
