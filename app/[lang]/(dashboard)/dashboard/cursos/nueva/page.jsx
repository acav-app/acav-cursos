"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocalizedPath } from "@/lib/utils";
import CourseWizard from "@/components/courses/dashboard/course-wizard";

export default function NuevoCursoPage() {
  const buildLocalizedPath = useLocalizedPath();

  return (
    <div className="py-8 px-2 max-w-8xl mx-auto">
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

        <div className="mt-8">
          <CourseWizard />
        </div>
      </div>
    </div>
  );
}
