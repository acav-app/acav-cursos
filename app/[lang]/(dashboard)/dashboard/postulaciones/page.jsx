"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { ENROLLMENT_STATUSES } from "@/lib/courses/constants";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-AR");
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
        toast.error(e?.message || "Error cargando inscripciones", { position: "top-right" });
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
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Inscripciones</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Gestion de inscripciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {actor?.role === "admin"
            ? "Visualiza y filtra inscripciones por curso, institucion y estado."
            : "Visualiza inscripciones recibidas para tu institucion."}
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={queryEmail} onChange={(e) => setQueryEmail(e.target.value)} placeholder="Filtrar por email" />
          <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ENROLLMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={jobId} onValueChange={(v) => setJobId(v === "all" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
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
              <SelectValue placeholder="Filtrar por institucion" />
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

        <div className="mt-2 text-sm text-muted-foreground">{filtered.length} resultado(s)</div>

        <div className="mt-6 grid gap-4">
          {filtered.length ? (
            filtered.map((a) => (
              <Link
                key={a.id}
                href={buildLocalizedPath(`/dashboard/inscripciones/${a.id}`)}
                className="rounded-3xl border border-border/60 bg-background p-5 transition hover:shadow-md"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {[a.firstName, a.lastName].filter(Boolean).join(" ").trim() || a.studentName || a.candidateName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {a.courseTitle || a.jobTitle} · {a.institutionName || a.companyName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {a.email} · {a.phone} · {a.city} · {a.province || "-"} · {a.status} · {dateLabel(a.createdAt)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-primary">Ver detalle</div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-3xl border border-border/60 bg-background p-8 text-center">
              <div className="text-lg font-semibold text-foreground">No hay inscripciones.</div>
              <p className="mt-2 text-sm text-muted-foreground">Las inscripciones se veran aqui cuando haya cursos activos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
