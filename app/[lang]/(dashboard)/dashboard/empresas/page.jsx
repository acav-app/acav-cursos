"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

export default function DashboardEmpresasPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const data = await authedFetch(user, "/api/institutions", { method: "GET" });
        if (!alive) return;
        setCompanies(asArray(data?.institutions));
      } catch (e) {
        toast.error(e?.message || "Error cargando instituciones", { position: "top-right" });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      [c.name, c.city, c.subRubro, c.slug].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [companies, query]);

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton showHeaderAction={actor?.role === "admin"} filterColumns={1} rowCount={5} />;
  }

  if (actorError) {
    return (
      <div className="py-8 px-2 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Instituciones</div>
          <h1 className="mt-3 text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-2 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Instituciones</div>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Gestion de instituciones</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {actor?.role === "admin"
              ? "Crea, edita y administra instituciones visibles en la web publica."
              : "Administra la ficha de tu institucion."}
          </p>
        </div>

        {actor?.role === "admin" ? (
          <Button asChild>
            <Link href={buildLocalizedPath("/dashboard/instituciones/nueva")} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva institucion
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, ciudad, rubro o slug"
            className="md:max-w-sm"
          />
          <div className="text-sm text-muted-foreground">{filtered.length} resultado(s)</div>
        </div>

        <div className="mt-6 grid gap-4">
          {filtered.length ? (
            filtered.map((company) => (
              <Link
                key={company.id}
                href={buildLocalizedPath(`/dashboard/instituciones/${company.id}`)}
                className="rounded-3xl border border-border/60 bg-background p-5 transition hover:shadow-md"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <Avatar className="h-14 w-14 rounded-2xl border border-border/60 bg-white">
                      {company.logoUrl ? (
                        <AvatarImage
                          src={normalizePublicR2Url(company.logoUrl)}
                          alt={company.name || "Logo de institucion"}
                          className="bg-white object-contain p-1.5"
                        />
                      ) : null}
                      <AvatarFallback className="rounded-2xl bg-primary/10 font-semibold text-primary">
                        {String(company.name || "EM")
                          .trim()
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-foreground">{company.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {company.city || "Sin ciudad"} · {company.subRubro || "Sin rubro"} · {company.status}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      <span className="text-sm font-semibold text-primary">Editar</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-3xl border border-border/60 bg-background p-8 text-center">
              <div className="text-lg font-semibold text-foreground">No hay instituciones cargadas todavia.</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Carga instituciones activas para que se vean en la web publica y puedan publicar cursos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
