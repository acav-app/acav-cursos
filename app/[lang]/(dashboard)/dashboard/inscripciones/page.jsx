"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, FilterX, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { EDUCATIONAL_ENROLLMENT_STATUSES } from "@/lib/courses/constants";
import { resolveEducationalStatusMeta, resolvePaymentStatusMeta } from "@/lib/courses/status-meta";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardInscripcionesPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [applications, setApplications] = useState([]);
  const [courses, setCourses] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queryEmail, setQueryEmail] = useState("");
  const [status, setStatus] = useState("");
  const [courseId, setCourseId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const [appsData, coursesData, institutionsData] = await Promise.all([
          authedFetch(user, "/api/enrollments", { method: "GET" }),
          authedFetch(user, "/api/courses", { method: "GET" }),
          authedFetch(user, "/api/institutions", { method: "GET" }),
        ]);
        if (!alive) return;
        setApplications(asArray(appsData?.enrollments));
        setCourses(asArray(coursesData?.courses));
        setInstitutions(asArray(institutionsData?.institutions));
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

  const syncEnrollment = (updatedEnrollment) => {
    if (!updatedEnrollment?.id) return;
    setApplications((current) =>
      current.map((item) => (item.id === updatedEnrollment.id ? updatedEnrollment : item))
    );
  };

  const handleQuickAction = async (application, action) => {
    if (!user || !application?.id) return;

    const payloadByAction = {
      approve: {
        status: "active",
        paymentStatus: "approved",
        approvedBy: user?.email || user?.uid || "admin",
      },
      request_receipt: {
        status: "waiting_payment",
        paymentStatus: "rejected",
      },
      reject: {
        status: "rejected",
        paymentStatus: "rejected",
      },
    };

    const payload = payloadByAction[action];
    if (!payload) return;

    try {
      setActionLoadingId(String(application.id));
      const data = await authedFetch(user, `/api/enrollments/${application.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          reviewedBy: user?.email || user?.uid || "admin",
        }),
      });
      syncEnrollment(data?.enrollment);
      toast.success(
        action === "approve"
          ? "Pago aprobado y curso activado."
          : action === "request_receipt"
            ? "Se solicitó un nuevo comprobante."
            : "Inscripción rechazada.",
        { position: "top-right" }
      );
    } catch (error) {
      toast.error(error?.message || "No pudimos actualizar la inscripción.", {
        position: "top-right",
      });
    } finally {
      setActionLoadingId("");
    }
  };

  const filtered = useMemo(() => {
    const email = String(queryEmail || "").trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00.000Z`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59.999Z`).getTime() : null;
    return applications
      .filter((application) => (status ? application.status === status : true))
      .filter((application) => (courseId ? (application.courseId || application.jobId) === courseId : true))
      .filter((application) => (institutionId ? (application.institutionId || application.companyId) === institutionId : true))
      .filter((application) => (email ? String(application.email || "").toLowerCase().includes(email) : true))
      .filter((application) => {
        if (!from && !to) return true;
        const createdAt = new Date(String(application.createdAt || "")).getTime();
        if (Number.isNaN(createdAt)) return false;
        if (from && createdAt < from) return false;
        if (to && createdAt > to) return false;
        return true;
      });
  }, [applications, status, courseId, institutionId, queryEmail, fromDate, toDate]);

  const hasActiveFilters = Boolean(queryEmail || status || courseId || institutionId || fromDate || toDate);
  const resetFilters = () => {
    setQueryEmail("");
    setStatus("");
    setCourseId("");
    setInstitutionId("");
    setFromDate("");
    setToDate("");
  };

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton showHeaderAction={false} filterColumns={3} rowCount={6} />;
  }

  if (actorError) {
    return (
      <div className="py-8 px-2 mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">No se pudo cargar el perfil</h1>
          <p className="mt-3 text-sm text-muted-foreground">{actorError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-2 mx-auto">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Inscripciones</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Inscripciones a cursos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {actor?.role === "admin"
            ? "Aprobá pagos, solicitás nuevos comprobantes o revisá solicitudes curso por curso, desde un solo lugar."
            : "Seguí el estado de tus inscripciones y accedé a tu cursada cuando tu inscripción quede aprobada."}
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">Filtros rápidos</div>
            <p className="mt-1 text-xs text-muted-foreground">Combinalos para encontrar lo que buscás en segundos.</p>
          </div>
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
              <FilterX className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input value={queryEmail} onChange={(e) => setQueryEmail(e.target.value)} placeholder="Buscar por email" />
          <Select value={status} onValueChange={(value) => setStatus(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {EDUCATIONAL_ENROLLMENT_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {resolveEducationalStatusMeta(item).title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={courseId} onValueChange={(value) => setCourseId(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cursos</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
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
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="Desde" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="Hasta" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>
            Se encontraron{" "}
            <span className="font-semibold text-foreground">{filtered.length}</span> inscripción
            {filtered.length === 1 ? "" : "es"}.
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em]">
            <Badge variant="soft" color="info">En revisión</Badge>
            <Badge variant="soft" color="success">Activo</Badge>
            <Badge variant="soft" color="warning">En espera</Badge>
            <Badge variant="soft" color="destructive">Rechazado</Badge>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {filtered.length ? (
            filtered.map((application) => {
              const studentName = [application.firstName, application.lastName].filter(Boolean).join(" ").trim() ||
                application.studentName ||
                application.candidateName ||
                "Postulante";
              const courseTitle = application.courseTitle || application.jobTitle || "Curso";
              const institutionName = application.institutionName || application.companyName || "ACAV";
              const contact = [application.city, application.province].filter(Boolean).join(", ");
              const educationalMeta = resolveEducationalStatusMeta(application.status);
              const paymentMeta = resolvePaymentStatusMeta(
                application.paymentStatus || application?.payment?.status || ""
              );
              const EdIcon = educationalMeta.Icon;
              const PayIcon = paymentMeta.Icon;
              return (
                <Link
                  key={application.id}
                  href={buildLocalizedPath(`/dashboard/inscripciones/${application.id}`)}
                  className="group rounded-[28px] border border-border/60 bg-background p-5 transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">{studentName}</h3>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/90">{courseTitle}</span>
                        <span className="opacity-60">·</span>
                        <span>{institutionName}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{application.email}</span>
                        {application.phone ? <span>· {application.phone}</span> : null}
                        {contact ? <span>· {contact}</span> : null}
                        <span>· {dateLabel(application.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-stretch gap-3 md:items-end">
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge color={educationalMeta.tone} variant="soft" className="gap-1.5 rounded-full px-3 py-1 text-[11px]">
                              <EdIcon className="h-3 w-3" />
                              {educationalMeta.title}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="end">{educationalMeta.description}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge color={paymentMeta.tone} variant="soft" className="gap-1.5 rounded-full px-3 py-1 text-[11px]">
                              <PayIcon className="h-3 w-3" />
                              Pago · {paymentMeta.title}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="end">{paymentMeta.description}</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                        {actor?.role === "admin" ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.preventDefault();
                                handleQuickAction(application, "approve");
                              }}
                              disabled={actionLoadingId === String(application.id)}
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              {actionLoadingId === String(application.id) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              Aprobar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.preventDefault();
                                handleQuickAction(application, "request_receipt");
                              }}
                              disabled={actionLoadingId === String(application.id)}
                              className="border-amber-200 text-amber-700 hover:bg-amber-50"
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Nuevo comprobante
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.preventDefault();
                                handleQuickAction(application, "reject");
                              }}
                              disabled={actionLoadingId === String(application.id)}
                              className="border-rose-200 text-rose-700 hover:bg-rose-50"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Rechazar
                            </Button>
                          </>
                        ) : null}
                        <Button type="button" variant="ghost" size="sm" className="md:ml-2">
                          Abrir ficha
                          <span className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-border/60 bg-background p-10 text-center">
              <div className="text-lg font-semibold text-foreground">Todavía no hay inscripciones con estos filtros.</div>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Probá limpiando los filtros o ajustando la búsqueda para ver más resultados."
                  : "Las inscripciones nuevas aparecerán aquí en cuanto los alumnos comiencen el proceso."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
