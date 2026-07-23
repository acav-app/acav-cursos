"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import DeleteConfirmationDialog from "@/components/delete-confirmation-dialog";
import { DashboardDetailSkeleton } from "@/components/courses/dashboard/page-skeletons";
import { useLocalizedPath } from "@/lib/utils";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import InstitutionForm from "@/components/courses/dashboard/institution-form";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

export default function EmpresaEditPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [company, setCompany] = useState(null);
  const isCompanyActor = actor?.role === "empresa";

  useEffect(() => {
    let alive = true;
    async function loadCompany() {
      if (!user) return;
      try {
        const data = await authedFetch(user, `/api/institutions/${id}`, { method: "GET" });
        if (!alive) return;
        setCompany(data?.institution || null);
      } catch (_error) {
        if (!alive) return;
        setCompany(null);
      }
    }
    loadCompany();
    return () => {
      alive = false;
    };
  }, [id, user]);

  const handleDelete = async () => {
    if (!user) return;
    await authedFetch(user, `/api/institutions/${id}`, { method: "DELETE" });
    toast.success("Institucion eliminada", { position: "top-right" });
    window.location.href = buildLocalizedPath("/dashboard/instituciones");
  };

  if (actorLoading) {
    return <DashboardDetailSkeleton />;
  }

  if (actorError) {
    return (
      <div className="max-w-5xl mx-auto px-2 py-8">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Mi institucion</div>
          <h1 className="mt-3 text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  const coverUrl = company?.coverUrl ? normalizePublicR2Url(company.coverUrl) : "";
  const logoUrl = company?.logoUrl ? normalizePublicR2Url(company.logoUrl) : "";
  const initials = String(company?.name || "EM").slice(0, 2).toUpperCase();

  return (
    <div className="py-8 px-2 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {!isCompanyActor ? (
          <Link
            href={buildLocalizedPath("/dashboard/instituciones")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a instituciones
          </Link>
        ) : (
          <div />
        )}

        {actor?.role === "admin" ? (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        ) : null}
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-8">
        <div className="overflow-hidden rounded-[28px] border border-border/60 bg-background">
          {coverUrl ? (
            <div className="h-48 w-full overflow-hidden border-b border-border/60 bg-muted/20">
              <img src={coverUrl} alt={company?.name || "Portada de institucion"} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-40 w-full border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-muted/30" />
          )}
          <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
            <Avatar className="h-24 w-24 rounded-[28px] border border-border/60 bg-white">
              {logoUrl ? <AvatarImage src={logoUrl} alt={company?.name || "Logo de institucion"} className="object-contain bg-white p-2" /> : null}
              <AvatarFallback className="rounded-[28px] bg-primary/10 text-xl font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-2xl font-bold text-foreground">{company?.name || (isCompanyActor ? "Mi institucion" : "Institucion")}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {[company?.city, company?.province, company?.subRubro].filter(Boolean).join(" · ") || "Completa la ficha publica de tu institucion."}
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {isCompanyActor ? "Mi institucion" : "Instituciones"}
        </div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          {isCompanyActor ? "Gestiona tu institucion" : "Editar institucion"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isCompanyActor
            ? "Actualiza la ficha publica y los datos operativos de tu institucion."
            : "Actualiza datos publicos y configuracion interna."}
        </p>

        <div className="mt-8">
          <InstitutionForm companyId={id} />
        </div>
      </div>

      <DeleteConfirmationDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        defaultToast={false}
        toastMessage="Institucion eliminada"
      />
    </div>
  );
}
