"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";
import { readSavedCourses, writeSavedCourses } from "@/lib/courses/client/saved-courses";
import { useLocalizedPath } from "@/lib/utils";

function dateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR");
}

function EmptyState({ buildLocalizedPath }) {
  return (
    <div className="rounded-[28px] border border-dashed border-border/70 bg-card p-10 text-center">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-primary">
        <Bookmark className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">Todavía no guardaste cursos</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
        Marca cursos desde el catálogo y úsalos como shortlist personal. Aquí vas a tener una vista limpia para retomarlos cuando quieras.
      </p>
      <Button asChild className="mt-6 rounded-2xl">
        <Link href={buildLocalizedPath("/cursos")}>Explorar cursos</Link>
      </Button>
    </div>
  );
}

export default function DashboardMisCursosPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [savedCourses, setSavedCourses] = useState([]);

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

  const summary = useMemo(() => {
    const total = savedCourses.length;
    const categories = new Set(savedCourses.map((item) => String(item?.subRubro || item?.categoryLabel || "").trim()).filter(Boolean)).size;
    const modalities = new Set(savedCourses.map((item) => String(item?.modality || item?.modalityLabel || "").trim()).filter(Boolean)).size;
    return { total, categories, modalities };
  }, [savedCourses]);

  const removeSavedCourse = (courseId) => {
    const next = savedCourses.filter((item) => String(item?.id || "") !== String(courseId || ""));
    writeSavedCourses(next);
    setSavedCourses(next);
  };

  if (actorLoading) {
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
          <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-foreground">Guardados para revisar</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
            Una vista sobria para retomar cursos guardados, comparar opciones y volver a entrar al detalle sin ruido visual.
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
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Guardados</div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">{summary.total}</div>
        </div>
        <div className="rounded-[24px] border border-border/60 bg-card p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Categorías</div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">{summary.categories}</div>
        </div>
        <div className="rounded-[24px] border border-border/60 bg-card p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Modalidades</div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">{summary.modalities}</div>
        </div>
      </section>

      <section className="mt-8">
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
