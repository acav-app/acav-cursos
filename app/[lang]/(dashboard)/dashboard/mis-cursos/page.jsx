"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bookmark, CheckCircle2, Clock3, ExternalLink, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";
import { readSavedCourses, writeSavedCourses } from "@/lib/courses/client/saved-courses";
import { useLocalizedPath } from "@/lib/utils";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import EnrollmentTrackingDialog from "@/components/courses/dashboard/enrollment-tracking-dialog";

function dateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR");
}

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
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingEnrollments(true);
        const resp = await authedFetch(`/api/enrollments?studentId=${encodeURIComponent(user?.id || actor?.id || "")}`);
        if (!resp) return;
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const items = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setEnrollments(items);
      } catch (e) {
        console.error("[mis-cursos] falló carga de inscripciones", e);
      } finally {
        if (!cancelled) setLoadingEnrollments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, actor?.id]);

  const removeSaved = (courseId) => {
    const next = readSavedCourses().filter((c) => String(c?.id) !== String(courseId));
    writeSavedCourses(next);
    setSavedCourses(next);
    toast.success("Curso removido de guardados");
  };

  const activeEnrollments = useMemo(
    () =>
      enrollments.filter((e) =>
        ["active", "aprobado", "aprobada", "confirmed", "pagado", "pagada", "paid", "inscrito", "inscripto"].includes(
          String(e?.status || "").toLowerCase()
        )
      ),
    [enrollments]
  );
  const pendingEnrollments = useMemo(
    () =>
      enrollments.filter((e) => {
        const s = String(e?.status || "").toLowerCase();
        return Boolean(s) && !activeEnrollments.includes(e);
      }),
    [enrollments, activeEnrollments]
  );

  const openTrackingFor = (enrollment) => {
    setSelectedEnrollment(enrollment);
    setTrackingOpen(true);
  };

  if (actorLoading || loadingEnrollments) return <DashboardPageShellSkeleton />;

  if (actorError) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-10 md:px-4">
        <div className="rounded-[28px] border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-semibold text-foreground">No se pudo cargar tu perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{String(actorError || "Volvé a intentar en unos segundos.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-3 py-8 md:px-4">
      {actor?.role === "alumno" ? (
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

      {actor?.role === "alumno" ? (
        <section className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <PlayCircle className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Cursos activos</h2>
            </div>
            {activeEnrollments.length ? (
              <div className="grid gap-4">
                {activeEnrollments.map((enrollment) => {
                  const progress = Number(enrollment?.progress || 0);
                  return (
                    <article key={enrollment.id} className="rounded-[26px] border border-border/60 bg-card p-5">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-border/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
                            <span>Pago {String(enrollment?.paymentStatus || "").replaceAll("_", " ") || "pendiente"}</span>
                          </div>
                          <div className="mt-4 h-2 max-w-md overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[#1B2B50]"
                              style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button asChild className="rounded-2xl">
                            <Link href={buildLocalizedPath(`/dashboard/mis-cursos/${enrollment.id}`)}>
                              Continuar cursada
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => openTrackingFor(enrollment)}
                          >
                            Ver seguimiento
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                buildLocalizedPath={buildLocalizedPath}
                title="Todavía no tienes cursos activos"
                text="Cuando una inscripción quede activa, la cursada aparecerá aquí con acceso completo al contenido privado."
                cta="Explorar cursos"
              />
            )}
          </div>

          <div>
            <div className="mb-4 flex items-center gap-3">
              <Clock3 className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Pendientes de activación</h2>
            </div>
            {pendingEnrollments.length ? (
              <div className="grid gap-4">
                {pendingEnrollments.map((enrollment) => (
                  <article key={enrollment.id} className="rounded-[26px] border border-border/60 bg-card p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-border/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {String(enrollment?.status || "pendiente").replaceAll("_", " ")}
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

                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => openTrackingFor(enrollment)}
                      >
                        Ver seguimiento
                      </Button>
                    </div>
                  </article>
                ))}
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
        {actor?.role === "alumno" ? (
          <div className="mb-4 flex items-center gap-3">
            <Bookmark className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Guardados</h2>
          </div>
        ) : null}
        {savedCourses.length ? (
          <div className="grid gap-4">
            {savedCourses.map((course) => {
              const category = String(course?.subRubro || course?.categoryLabel || "Sin categoría").trim();
              const modality = String(course?.modality || course?.modalityLabel || "Sin modalidad").trim();
              const level = String(course?.level || "Sin nivel").trim();
              const duration = String(course?.duration || "").trim();
              const savedAt = dateLabel(course?.savedAt);

              return (
                <article key={course.id} className="rounded-[26px] border border-border/60 bg-card p-5 transition hover:border-primary/20 hover:bg-muted/20">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-border/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Guardado
                        </span>
                        {savedAt ? <span className="text-xs text-muted-foreground">Última marca: {savedAt}</span> : null}
                      </div>
                      <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-foreground">{course?.title || "Curso"}</h2>
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
                        onClick={() => removeSaved(course.id)}
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
        ) : actor?.role !== "alumno" ? (
          <EmptyState
            buildLocalizedPath={buildLocalizedPath}
            title="Todavía no guardaste cursos"
            text="Marca cursos desde el catálogo y úsalos como shortlist personal. Aquí vas a tener una vista limpia para retomarlos cuando quieras."
            cta="Explorar cursos"
          />
        ) : (
          <div className="rounded-[24px] border border-dashed border-border/70 bg-card p-6">
            <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
              <Bookmark className="h-4 w-4 text-primary" />
              Todavía no guardaste ningún curso.
            </div>
          </div>
        )}
      </section>

      <EnrollmentTrackingDialog
        open={trackingOpen}
        onOpenChange={(next) => {
          setTrackingOpen(next);
          if (!next) setSelectedEnrollment(null);
        }}
        enrollment={selectedEnrollment}
        course={selectedEnrollment}
      />
    </div>
  );
}
