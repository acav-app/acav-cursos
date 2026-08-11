"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowUpRight, GraduationCap, Loader2, MapPin, Phone, RotateCcw, Mail } from "lucide-react";
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
import { DataTableEnhanced } from "@/components/ui/data-table-enhanced";
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
  const router = useRouter();
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
      request_receipt: {
        status: "waiting_payment",
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
      toast.success("Se solicitó un nuevo comprobante.", { position: "top-right" });
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

  const columns = useMemo(() => {
    const openDetail = (row) => {
      router.push(buildLocalizedPath(`/dashboard/inscripciones/${row.id}`));
    };
    return [
      {
        id: "student",
        header: "Alumno",
        accessorKey: "email",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 280,
        cell: ({ row }) => {
          const app = row.original;
          const studentName =
            [app.firstName, app.lastName].filter(Boolean).join(" ").trim() ||
            app.studentName ||
            app.candidateName ||
            "Postulante";
          const contact = [app.city, app.province].filter(Boolean).join(", ");
          return (
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E0F2FE] text-[#0369A1] ring-1 ring-[#BAE6FD]">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#0F172A]">{studentName}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-[#64748B]">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{app.email || "-"}</span>
                </div>
                {app.phone || contact ? (
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#94A3B8]">
                    {app.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {app.phone}
                      </span>
                    ) : null}
                    {contact ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {contact}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "course",
        header: "Curso",
        accessorKey: "courseTitle",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 240,
        cell: ({ row }) => {
          const app = row.original;
          const courseTitle = app.courseTitle || app.jobTitle || "Curso";
          const institutionName = app.institutionName || app.companyName || "ACAV";
          return (
            <div className="grid gap-0.5 text-sm">
              <div className="truncate font-semibold text-[#0F172A]">{courseTitle}</div>
              <div className="truncate text-xs text-[#64748B]">{institutionName}</div>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Estado inscripción",
        accessorKey: "status",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 180,
        cell: ({ row }) => {
          const app = row.original;
          const educationalMeta = resolveEducationalStatusMeta(app.status);
          const EdIcon = educationalMeta.Icon;
          return (
            <Badge
              color={educationalMeta.tone}
              variant="soft"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px]"
            >
              <EdIcon className="h-3 w-3" />
              {educationalMeta.title}
            </Badge>
          );
        },
      },
      {
        id: "paymentStatus",
        header: "Estado de pago",
        accessorKey: "paymentStatus",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 180,
        cell: ({ row }) => {
          const app = row.original;
          const paymentMeta = resolvePaymentStatusMeta(
            app.paymentStatus || app?.payment?.status || ""
          );
          const PayIcon = paymentMeta.Icon;
          return (
            <Badge
              color={paymentMeta.tone}
              variant="soft"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px]"
            >
              <PayIcon className="h-3 w-3" />
              {paymentMeta.title}
            </Badge>
          );
        },
      },
      {
        id: "createdAt",
        header: "Fecha",
        accessorKey: "createdAt",
        enableSorting: true,
        meta: { enableColumnFilter: false },
        size: 180,
        cell: ({ row }) => (
          <div className="text-sm text-[#475569]">{dateLabel(row.original.createdAt)}</div>
        ),
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        meta: { enableColumnFilter: false },
        size: 220,
        cell: ({ row }) => {
          const app = row.original;
          const detailHref = buildLocalizedPath(`/dashboard/inscripciones/${app.id}`);
          return (
            <div
              className="flex flex-wrap items-center justify-end gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {actor?.role === "admin" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickAction(app, "request_receipt")}
                  disabled={actionLoadingId === String(app.id)}
                  className="h-9 rounded-2xl border-[#FDE68A] bg-white text-[#B45309] hover:bg-[#FFFBEB]"
                >
                  {actionLoadingId === String(app.id) ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Nuevo comprobante
                </Button>
              ) : null}
              <Link
                href={detailHref}
                onClick={(e) => e.stopPropagation()}
                passHref
                legacyBehavior
              >
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-2xl bg-[#2356B8] text-white hover:bg-[#1D4ED8]"
                  onClick={() => openDetail(app)}
                >
                  Abrir ficha
                  <ArrowUpRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          );
        },
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actor?.role, actionLoadingId, buildLocalizedPath, router]);

  const searchableColumnKeys = useMemo(
    () => [
      "email",
      "firstName",
      "lastName",
      "studentName",
      "candidateName",
      "phone",
      "city",
      "province",
      "courseId",
      "courseTitle",
      "jobId",
      "jobTitle",
      "institutionId",
      "institutionName",
      "companyId",
      "companyName",
      "status",
      "paymentStatus",
      "documentNumber",
      "agency",
      "employeeFileNumber",
    ],
    []
  );

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
    <div className="py-8 px-2 mx-auto space-y-6">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Inscripciones</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">Inscripciones a cursos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {actor?.role === "admin"
            ? "Aprobá pagos, solicitás nuevos comprobantes o revisá solicitudes curso por curso, desde un solo lugar."
            : "Seguí el estado de tus inscripciones y accedé a tu cursada cuando tu inscripción quede aprobada."}
        </p>
      </div>

      <section className="rounded-[28px] border border-[#E5E7EB] bg-[#FFFFFF] p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)] md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-base font-semibold text-[#0F172A]">Filtros rápidos</div>
            <p className="mt-1 text-xs text-[#64748B]">Combinalos con la búsqueda global para encontrar lo que buscás en segundos.</p>
          </div>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-9 rounded-2xl border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpiar filtros
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            value={queryEmail}
            onChange={(e) => setQueryEmail(e.target.value)}
            placeholder="Buscar por email"
            className="h-11 rounded-2xl bg-white"
          />
          <Select value={status} onValueChange={(value) => setStatus(value === "all" ? "" : value)}>
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
            <SelectTrigger className="h-11 rounded-2xl bg-white">
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
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="Desde"
            className="h-11 rounded-2xl bg-white"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="Hasta"
            className="h-11 rounded-2xl bg-white"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#64748B]">
          <Badge variant="soft" color="info">En revisión</Badge>
          <Badge variant="soft" color="success">Activo</Badge>
          <Badge variant="soft" color="warning">En espera</Badge>
          <Badge variant="soft" color="destructive">Rechazado</Badge>
        </div>
      </section>

      <DataTableEnhanced
        data={filtered}
        columns={columns}
        searchPlaceholder="Buscar alumno, curso, DNI, estado, contacto o institución"
        searchableColumnKeys={searchableColumnKeys}
        defaultPageSize={20}
        defaultSorting={[{ id: "createdAt", desc: true }]}
        showFiltersRow
        showColumnVisibility
        emptyTitle="No hay inscripciones con estos filtros"
        emptySubtitle={
          hasActiveFilters
            ? "Limpiá los filtros o modificá la búsqueda para ver más resultados."
            : "Las inscripciones nuevas aparecerán aquí en cuanto los alumnos comiencen el proceso."
        }
        onRowClick={(row) => router.push(buildLocalizedPath(`/dashboard/inscripciones/${row.id}`))}
        toolbarRight={
          <div className="hidden items-center gap-2 md:flex">
            <Badge variant="soft" color="secondary">
              Total {filtered.length}
            </Badge>
          </div>
        }
      />
    </div>
  );
}
