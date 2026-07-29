"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
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
import { ENROLLMENT_STATUSES } from "@/lib/courses/constants";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-AR");
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
          <Select value={status} onValueChange={(value) => setStatus(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ENROLLMENT_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={courseId} onValueChange={(value) => setCourseId(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
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
              <SelectValue placeholder="Filtrar por institucion" />
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

        <div className="mt-2 text-sm text-muted-foreground">{filtered.length} resultado(s)</div>

        <div className="mt-6 grid gap-4">
          {filtered.length ? (
            filtered.map((application) => (
              <Link
                key={application.id}
                href={buildLocalizedPath(`/dashboard/inscripciones/${application.id}`)}
                className="rounded-3xl border border-border/60 bg-background p-5 transition hover:shadow-md"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {[application.firstName, application.lastName].filter(Boolean).join(" ").trim() || application.studentName || application.candidateName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {application.courseTitle || application.jobTitle} · {application.institutionName || application.companyName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {application.email} · {application.phone} · {application.city} · {application.province || "-"} · {application.status} · Pago: {application.paymentStatus || application?.payment?.status || "-"} · {dateLabel(application.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                    <div className="text-sm font-semibold text-primary">Ver detalle</div>
                  </div>
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
