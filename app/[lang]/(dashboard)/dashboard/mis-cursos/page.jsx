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
    let alive = true;

    async function loadEnrollments() {
      if (!user || actor?.role !== "alumno") {
        if (alive) {
          setEnrollments([]);
          setLoadingEnrollments(false);
        }
        return;
      }

      try {
        setLoadingEnrollments(true);
        const data = await authedFetch(user, "/api/enrollments", { method: "GET" });
        if (!alive) return;
        setEnrollments(Array.isArray(data?.enrollments) ? data.enrollments : []);
      } catch (error) {
        if (!alive) return;
        toast.error(error?.message || "No pudimos cargar tus cursos.", { position: "top-right" });
      } finally {
        if (alive) setLoadingEnrollments(false);
      }
    }

    loadEnrollments();
    return () => {
      alive = false;
    };
  }, [actor?.role, user]);

  const summary = useMemo(() => {
    const total = savedCourses.length;
    const categories = new Set(savedCourses.map((item) => String(item?.subRubro || item?.categoryLabel || "").trim()).filter(Boolean)).size;
    const modalities = new Set(savedCourses.map((item) => String(item?.modality || item?.modalityLabel || "").trim()).filter(Boolean)).size;
    return { total, categories, modalities };
  }, [savedCourses]);

  const activeEnrollments = useMemo(
    () => enrollments.filter((item) => String(item?.status || "").trim().toLowerCase() === "active"),
    [enrollments]
  );

  const pendingEnrollments = useMemo(
    () => enrollments.filter((item) => String(item?.status || "").trim().toLowerCase() !== "active"),
    [enrollments]
  );

  const removeSavedCourse = (courseId) => {
    const next = savedCourses.filter((item) => String(item?.id || "") !== String(courseId || ""));
    writeSavedCourses(next);
    setSavedCourses(next);
  };

  if (actorLoading) {
    return <DashboardPageShellSkeleton showHeaderAction={false} filterColumns={3} rowCount={4} />;
  }

  if (loadingEnrollments && actor?.role === "alumno") {
    return <DashboardPageShellSkeleton showHeaderAction={false} filterColumns={3} rowCount={4} />;
  }

  if (actorError) {
    return (
      <div className="mx-auto max-w-6xl px-2 py-8">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-semibold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 py-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Mis cursos</div>
          <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-foreground">
            {actor?.role === "alumno" ? "Cursadas y accesos" : "Guardados para revisar"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            {actor?.role === "alumno"
              ? "Accede a tus cursos activos, sigue las inscripciones pendientes y mantén aparte tu shortlist personal."
              : "Una vista sobria para retomar cursos guardados, comparar opciones y volver a entrar al detalle sin ruido visual."}
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link href={buildLocalizedPath("/cursos")}>
            Ver catálogo
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-border/60 bg-card p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {actor?.role === "alumno" ? "Cursos activos" : "Guardados"}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {actor?.role === "alumno" ? activeEnrollments.length : summary.total}
          </div>
        </div>
        <div className="rounded-[24px] border border-border/60 bg-card p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {actor?.role === "alumno" ? "Pendientes" : "Categorías"}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {actor?.role === "alumno" ? pendingEnrollments.length : summary.categories}
          </div>
        </div>
        <div className="rounded-[24px] border border-border/60 bg-card p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {actor?.role === "alumno" ? "Guardados" : "Modalidades"}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {actor?.role === "alumno" ? summary.total : summary.modalities}
          </div>
        </div>
      </section>

      {actor?.role === "alumno" ? (
        <section className="mt-8 space-y-8">
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
                            <div className="h-full rounded-full bg-[#1B2B50]" style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }} />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button asChild className="rounded-2xl">
                            <Link href={buildLocalizedPath(`/dashboard/mis-cursos/${enrollment.id}`)}>
                              Continuar cursada
                              <ExternalLink className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="outline" className="rounded-2xl">
                            <Link href={buildLocalizedPath(`/dashboard/inscripciones/${enrollment.id}`)}>Ver inscripción</Link>
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

                      <Button asChild variant="outline" className="rounded-2xl">
                        <Link href={buildLocalizedPath(`/dashboard/inscripciones/${enrollment.id}`)}>
                          Ver seguimiento
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Link>
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
                        <span>{category}</span>
                        <span>·</span>
                        <span>{modality}</span>
                        <span>·</span>
                        <span>{level}</span>
                        {duration ? (
                          <>
                            <span>·</span>
                            <span>{duration}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {course?.slug ? (
                        <Button asChild variant="outline" className="rounded-2xl">
                          <Link href={buildLocalizedPath(`/cursos/${course.slug}`)}>Ver curso</Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-2xl text-muted-foreground hover:text-foreground"
                        onClick={() => removeSavedCourse(course.id)}
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
        ) : (
          <EmptyState buildLocalizedPath={buildLocalizedPath} />
        )}
      </section>
    </div>
  );
}
