"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Award, FileBadge2, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
}

function resolveCertificateMeta(enrollment) {
  const certificateUrl = String(
    enrollment?.certificateUrl ||
      enrollment?.certificate?.url ||
      enrollment?.certificate?.downloadUrl ||
      enrollment?.certificateDownloadUrl ||
      ""
  ).trim();
  const issuedAt = enrollment?.certificateIssuedAt || enrollment?.certificate?.issuedAt || enrollment?.certificateGeneratedAt || "";
  const enrollmentStatus = String(enrollment?.status || "").trim().toLowerCase();

  if (certificateUrl) {
    return {
      label: "Emitido",
      tone: "success",
      helper: issuedAt ? `Emitido el ${dateLabel(issuedAt)}.` : "Ya existe un archivo de certificado disponible.",
      downloadUrl: certificateUrl,
    };
  }

  if (["descartada", "rechazada"].includes(enrollmentStatus)) {
    return {
      label: "Sin emisión",
      tone: "destructive",
      helper: "La inscripción quedó cerrada sin certificado emitido.",
      downloadUrl: "",
    };
  }

  return {
    label: "Pendiente",
    tone: "warning",
    helper: "Aún no se registró un certificado para esta inscripción.",
    downloadUrl: "",
  };
}

export default function DashboardCertificadosPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [query, setQuery] = useState("");
  const [courseId, setCourseId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [certificateState, setCertificateState] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!user) return;
      setLoading(true);

      try {
        const [enrollmentsData, coursesData, institutionsData] = await Promise.all([
          authedFetch(user, "/api/enrollments", { method: "GET" }),
          authedFetch(user, "/api/courses", { method: "GET" }),
          authedFetch(user, "/api/institutions", { method: "GET" }),
        ]);

        if (!alive) return;

        setEnrollments(asArray(enrollmentsData?.enrollments));
        setCourses(asArray(coursesData?.courses));
        setInstitutions(asArray(institutionsData?.institutions));
      } catch (error) {
        toast.error(error?.message || "No pudimos cargar el módulo de certificados.", { position: "top-right" });
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

  const rows = useMemo(
    () =>
      enrollments.map((enrollment) => ({
        ...enrollment,
        certificateMeta: resolveCertificateMeta(enrollment),
      })),
    [enrollments]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();

    return rows
      .filter((row) => (certificateState ? row.certificateMeta.label === certificateState : true))
      .filter((row) => (courseId ? String(row.jobId || "") === courseId : true))
      .filter((row) => (institutionId ? String(row.companyId || "") === institutionId : true))
      .filter((row) => {
        if (!normalizedQuery) return true;

        return [
          row.jobTitle,
          row.companyName,
          row.email,
          row.candidateName,
          [row.firstName, row.lastName].filter(Boolean).join(" "),
        ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
      });
  }, [certificateState, courseId, institutionId, query, rows]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const emitted = filtered.filter((row) => row.certificateMeta.label === "Emitido").length;
    const pending = filtered.filter((row) => row.certificateMeta.label === "Pendiente").length;
    const unavailable = filtered.filter((row) => row.certificateMeta.label === "Sin emisión").length;
    return { total, emitted, pending, unavailable };
  }, [filtered]);

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton showHeaderAction={false} filterColumns={4} rowCount={6} />;
  }

  if (actorError) {
    return (
      <div className="mx-auto max-w-6xl px-2 py-8">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Certificados</div>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Emisión y seguimiento</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {actor?.role === "admin"
              ? "Controla certificados emitidos, pendientes y accesos de descarga."
              : "Consulta tus constancias emitidas y el estado de cada certificado desde el mismo dashboard."}
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
          El archivo se mostrará aquí apenas exista un registro de emisión.
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="grid gap-3 md:grid-cols-4">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por curso, email o alumno" />
          <Select value={courseId} onValueChange={(value) => setCourseId(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={institutionId}
            onValueChange={(value) => setInstitutionId(value === "all" ? "" : value)}
            disabled={actor?.role !== "admin"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por institución" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {institutions.map((institution) => (
                <SelectItem key={institution.id} value={institution.id}>
                  {institution.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={certificateState} onValueChange={(value) => setCertificateState(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Estado de emisión" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Emitido">Emitido</SelectItem>
              <SelectItem value="Pendiente">Pendiente</SelectItem>
              <SelectItem value="Sin emisión">Sin emisión</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricCard icon={GraduationCap} label="Registros" value={String(summary.total)} helper="Inscripciones con seguimiento de certificación" />
          <MetricCard icon={Award} label="Emitidos" value={String(summary.emitted)} helper="Constancias disponibles para descarga" />
          <MetricCard icon={FileBadge2} label="Pendientes" value={String(summary.pending)} helper="Inscripciones sin archivo emitido" />
          <MetricCard icon={Award} label="Sin emisión" value={String(summary.unavailable)} helper="Procesos cerrados sin certificado" />
        </div>

        <div className="mt-2 text-sm text-muted-foreground">{filtered.length} resultado(s)</div>

        <div className="mt-6 grid gap-4">
          {filtered.length ? (
            filtered.map((row) => (
              <article key={row.id} className="rounded-3xl border border-border/60 bg-background p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={row.certificateMeta.tone} variant="soft" className="rounded-full">
                        {row.certificateMeta.label}
                      </Badge>
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Inscripción {row.status || "sin estado"}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-foreground">{row.jobTitle || "Curso"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.companyName || "Institución"} · {[row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.candidateName || row.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.email || "Sin email"} · {dateLabel(row.createdAt)}
                    </p>
                    <p className="mt-4 rounded-2xl border border-border/50 bg-card px-4 py-3 text-sm text-muted-foreground">
                      {row.certificateMeta.helper}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {row.certificateMeta.downloadUrl ? (
                      <Button asChild variant="outline">
                        <a href={row.certificateMeta.downloadUrl} target="_blank" rel="noreferrer">
                          Descargar
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild variant="ghost">
                      <Link href={buildLocalizedPath(`/dashboard/inscripciones/${row.id}`)}>Ver inscripción</Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-border/60 bg-background p-8 text-center">
              <div className="text-lg font-semibold text-foreground">No hay certificados para mostrar.</div>
              <p className="mt-2 text-sm text-muted-foreground">Ajusta los filtros o espera nuevas emisiones para revisar constancias.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper }) {
  const ResolvedIcon = typeof Icon === "function" ? Icon : null;

  return (
    <div className="rounded-3xl border border-border/60 bg-background p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {ResolvedIcon ? <ResolvedIcon className="h-5 w-5" /> : <span className="text-base font-semibold">•</span>}
        </span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{helper}</p>
    </div>
  );
}
