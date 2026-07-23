"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLocalizedPath } from "@/lib/utils";
import InstitutionForm from "@/components/courses/dashboard/institution-form";

export default function NuevaInstitucionPage() {
  const buildLocalizedPath = useLocalizedPath();

  return (
    <div className="py-8 px-2 max-w-5xl mx-auto">
      <div className="mb-6">
        <Link
          href={buildLocalizedPath("/dashboard/instituciones")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a instituciones
        </Link>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Instituciones</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Crear institucion</h1>
        <p className="mt-2 text-sm text-muted-foreground">Completa la ficha publica para habilitar cursos e inscripciones.</p>

        <div className="mt-8">
          <InstitutionForm />
        </div>
      </div>
    </div>
  );
}
