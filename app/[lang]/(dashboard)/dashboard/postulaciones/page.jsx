"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Briefcase, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { EMPLOYMENT_APPLICATION_STATUSES } from "@/lib/courses/constants";
import { resolveEmploymentStatusMeta } from "@/lib/courses/status-meta";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPostulacionesPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [applications, setApplications] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryEmail, setQueryEmail] = useState("");
  const [status, setStatus] = useState("");
  const [jobId, setJobId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const [appsData, jobsData, companiesData] = await Promise.all([
          authedFetch(user, "/api/enrollments", { method: "GET" }),
          authedFetch(user, "/api/courses", { method: "GET" }),
          authedFetch(user, "/api/institutions", { method: "GET" }),
        ]);
        if (!alive) return;
        setApplications(asArray(appsData?.enrollments));
        setJobs(asArray(jobsData?.courses));
        setCompanies(asArray(companiesData?.institutions));
      } catch (e) {
        toast.error(e?.message || "Error cargando postulaciones", { position: "top-right" });
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

  const hasActiveFilters = Boolean(queryEmail || status || jobId || companyId || fromDate || toDate);
  const resetFilters = () => {
    setQueryEmail("");
    setStatus("");
    setJobId("");
    setCompanyId("");
    setFromDate("");
    setToDate("");
  };

  const filtered = useMemo(() => {
    const email = String(queryEmail || "").trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999Z`).getTime() : null;
    return applications
      .filter((a) => (status ? a.status === status : true))
      .filter((a) => (jobId ? (a.courseId || a.jobId) === jobId : true))
      .filter((a) => (companyId ? (a.institutionId || a.companyId) === companyId : true))
      .filter((a) => (email ? String(a.email || "").toLowerCase().includes(email) : true))
      .filter((a) => {
        if (!from && !to) return true;
        const t = new Date(String(a.createdAt || "")).getTime();
        if (Number.isNaN(t)) return false;
        if (from && t < from) return false;
        if (to && t > to) return false;
        return true;
      });
  }, [applications, status, jobId, companyId, queryEmail, fromDate, toDate]);

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton showHeaderAction={false} filterColumns={3} rowCount={6} />;
  }

  if (actorError) {
    return (
      <div className="py-8 px-2 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-2 max-w-6xl mx-auto">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Búsqueda laboral</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Postulaciones a avisos laborales</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {actor?.role === "admin"
            ? "Revisá y ordená todas las postulaciones que recibieron las instituciones asociadas."
            : "Seguí el estado de tus postulaciones a avisos laborales publicados por las empresas."}
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">Filtros rápidos</div>
            <p className="mt-1 text-xs text-muted-foreground">Por estado, aviso, empresa o rango de fechas.</p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-slate-300 hover:text-foreground"
            >
              <FilterX className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input value={queryEmail} onChange={(e) => setQueryEmail(e.target.value)} placeholder="Buscar por email" />
          <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {EMPLOYMENT_APPLICATION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {resolveEmploymentStatusMeta(s).title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={jobId} onValueChange={(v) => setJobId(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por aviso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los avisos</SelectItem>
              {jobs.map((j) => (
                <SelectItem key={j.id} value={j.id}>
                  {j.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Select
            value={companyId}
            onValueChange={(v) => setCompanyId(v === "all" ? "" : v)}
            disabled={actor?.role !== "admin"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por institución" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="Desde" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="Hasta" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>
            Hay <span className="font-semibold text-foreground">{filtered.length}</span> postulación
            {filtered.length === 1 ? "" : "es"}.
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
            <Badge variant="soft" color="info">Recibida</Badge>
            <Badge variant="soft" color="secondary">Vista</Badge>
            <Badge variant="soft" color="success">Preseleccionada</Badge>
            <Badge variant="soft" color="destructive">Descartada</Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {filtered.length ? (
            filtered.map((a) => {
              const candidateName = [a.firstName, a.lastName].filter(Boolean).join(" ").trim() ||
                a.studentName ||
                a.candidateName ||
                "Postulante";
              const jobTitle = a.courseTitle || a.jobTitle || "Aviso laboral";
              const companyName = a.institutionName || a.companyName || "Empresa";
              const contact = [a.city, a.province].filter(Boolean).join(", ");
              const meta = resolveEmploymentStatusMeta(a.status);
              const Icon = meta.Icon;
              return (
                <Link
                  key={a.id}
                  href={buildLocalizedPath(`/dashboard/postulaciones/${a.id}`)}
                  className="group rounded-[28px] border border-border/60 bg-background p-5 transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#1B2B50]">
                          <Briefcase className="h-4 w-4" />
                        </span>
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">{candidateName}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/90">{jobTitle}</span>
                        <span className="opacity-60">·</span>
                        <span>{companyName}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{a.email}</span>
                        {a.phone ? <span>· {a.phone}</span> : null}
                        {contact ? <span>· {contact}</span> : null}
                        <span>· {dateLabel(a.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-3 md:items-end">
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge color={meta.tone} variant="soft" className="gap-1.5 rounded-full px-3 py-1 text-[11px]">
                              <Icon className="h-3 w-3" />
                              {meta.title}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="end">{meta.description}</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-sm font-semibold text-primary">
                        Abrir ficha <span className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-border/60 bg-background p-10 text-center">
              <div className="text-lg font-semibold text-foreground">No hay postulaciones que coincidan.</div>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Quitá algún filtro para ampliar la búsqueda."
                  : "Las postulaciones a avisos laborales aparecerán aquí en cuanto los candidatos postulen."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
