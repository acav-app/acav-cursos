"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocalizedPath } from "@/lib/utils";
import CourseWizard from "@/components/courses/dashboard/course-wizard";

export default function NuevoCursoPage() {
  const buildLocalizedPath = useLocalizedPath();

  return (
    <div className="py-8 px-2 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={buildLocalizedPath("/dashboard/cursos")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cursos
        </Link>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Cursos</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Publicar curso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Completa el wizard en 3 pasos. Guarda como borrador o envia a revision segun tu rol.
        </p>

        <div className="mt-8">
          <CourseWizard />
        </div>
      </div>
    </div>
  );
}
