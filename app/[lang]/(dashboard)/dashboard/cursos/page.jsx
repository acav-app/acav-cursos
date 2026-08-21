"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Copy,
  Trash2,
  XCircle,
  Building2,
  CalendarDays,
  GraduationCap,
  Clock3,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTableEnhanced } from "@/components/ui/data-table-enhanced";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import CourseRejectDialog from "@/components/courses/dashboard/course-reject-dialog";
import CourseCloseDialog from "@/components/courses/dashboard/course-close-dialog";
import DeleteConfirmationDialog from "@/components/delete-confirmation-dialog";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const date = new Date(String(iso || ""));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
}

function statusBadge(status) {
  const s = String(status || "");
  const map = {
    borrador: { color: "secondary", label: "Borrador" },
    pendiente_revision: { color: "warning", label: "Pendiente" },
    activa: { color: "success", label: "Activa" },
    pausada: { color: "warning", label: "Pausada" },
    cerrada: { color: "destructive", label: "Cerrada" },
    vencida: { color: "destructive", label: "Vencida" },
    rechazada: { color: "destructive", label: "Rechazada" },
  };
  const cfg = map[s] || { color: "secondary", label: s || "Sin estado" };
  return (
    <Badge variant="soft" color={cfg.color} className="rounded-full">
      {cfg.label}
    </Badge>
  );
}

export default function DashboardCursosPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [courses, setCourses] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [rejectCourseId, setRejectCourseId] = useState("");
  const [closeCourseId, setCloseCourseId] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");

  const refresh = async () => {
    if (!user) return;
    const data = await authedFetch(user, "/api/courses", { method: "GET" });
    setCourses(asArray(data?.courses));
  };

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const [coursesData, institutionsData] = await Promise.all([
          authedFetch(user, "/api/courses", { method: "GET" }),
          authedFetch(user, "/api/institutions", { method: "GET" }),
        ]);
        if (!alive) return;
        setCourses(asArray(coursesData?.courses));
        setInstitutions(asArray(institutionsData?.institutions));
      } catch (e) {
        toast.error(e?.message || "Error cargando cursos", { position: "top-right" });
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
    return courses
      .filter((course) => (statusFilter ? course.status === statusFilter : true))
      .filter((course) => (institutionFilter ? course.companyId === institutionFilter : true));
  }, [courses, statusFilter, institutionFilter]);

  const handleApprove = async (id) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/courses/${id}/approve`, { method: "POST" });
      toast.success("Curso aprobado", { position: "top-right" });
      await refresh();
    } catch (e) {
      toast.error(e?.message || "Error aprobando", { position: "top-right" });
    }
  };

  const handlePause = async (id) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/courses/${id}/pause`, { method: "POST" });
      toast.success("Curso pausado", { position: "top-right" });
      await refresh();
    } catch (e) {
      toast.error(e?.message || "Error pausando", { position: "top-right" });
    }
  };

  const handleResume = async (id) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/courses/${id}/resume`, { method: "POST" });
      toast.success("Curso reactivado", { position: "top-right" });
      await refresh();
    } catch (e) {
      toast.error(e?.message || "Error reactivando", { position: "top-right" });
    }
  };

  const handleDuplicate = async (id) => {
    if (!user) return;
    try {
      const data = await authedFetch(user, `/api/courses/${id}/duplicate`, { method: "POST" });
      toast.success("Curso duplicado", { position: "top-right" });
      const newId = data?.course?.id;
      await refresh();
      if (newId) window.location.href = buildLocalizedPath(`/dashboard/cursos/${newId}`);
    } catch (e) {
      toast.error(e?.message || "Error duplicando", { position: "top-right" });
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteCourseId) return;
    await authedFetch(user, `/api/courses/${deleteCourseId}`, { method: "DELETE" });
    toast.success("Curso eliminado", { position: "top-right" });
    setDeleteCourseId("");
    await refresh();
  };

  const columns = useMemo(() => {
    return [
      {
        id: "curso",
        header: "Curso",
        accessorKey: "title",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4338CA] ring-1 ring-[#E0E7FF]">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#0F172A]">{c.title || "Sin título"}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
                  <span className="inline-flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {c.subRubro || "Sin categoría"}
                  </span>
                  {c.level ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[#CBD5E1]">·</span>
                      {c.level}
                    </span>
                  ) : null}
                  {c.modality ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-[#CBD5E1]">·</span>
                      {c.modality}
                    </span>
                  ) : null}
                  {c.duration ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {c.duration}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "company",
        header: "Institución",
        accessorKey: "companyName",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 220,
        cell: ({ row }) => {
          const c = row.original;
          const name = c.companyName || c.institutionName || null;
          const city = c.city;
          return (
            <div className="flex items-start gap-2 text-sm">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" />
              <div className="min-w-0">
                <div className="truncate text-[#0F172A]">{name || "Sin institución"}</div>
                {city ? <div className="truncate text-xs text-[#94A3B8]">{city}</div> : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Estado",
        accessorKey: "status",
        enableSorting: true,
        meta: { enableColumnFilter: true },
        size: 160,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">{statusBadge(row.original.status)}</div>
        ),
      },
      {
        id: "dates",
        header: "Fechas",
        accessorKey: "createdAt",
        enableSorting: true,
        meta: { enableColumnFilter: false },
        size: 200,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="grid gap-1 text-xs text-[#475569]">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-[#94A3B8]" />
                <span className="text-[#64748B]">Creado</span>
                <span className="font-medium text-[#0F172A]">{dateLabel(c.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-[#94A3B8]" />
                <span className="text-[#64748B]">Cierre</span>
                <span className="font-medium text-[#0F172A]">{dateLabel(c.expiresAt)}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        meta: { enableColumnFilter: false },
        size: 380,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="h-9 rounded-2xl border-[#E5E7EB] bg-white text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <Link href={buildLocalizedPath(`/dashboard/cursos/${c.id}`)}>Editar</Link>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  asChild
                  className="h-9 rounded-2xl border-[#E5E7EB] bg-white text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <Link href={buildLocalizedPath(`/dashboard/cursos/${c.id}/foro`)}>Foro</Link>
                </Button>

                {actor?.role === "admin" && c.status === "pendiente_revision" ? (
                  <Button
                    type="button"
                    onClick={() => handleApprove(c.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-2xl px-3 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Aprobar
                  </Button>
                ) : null}

                {actor?.role === "admin" && c.status === "pendiente_revision" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setRejectCourseId(c.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-2xl px-3 text-sm"
                  >
                    <XCircle className="h-4 w-4" />
                    Rechazar
                  </Button>
                ) : null}

                {["activa"].includes(c.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePause(c.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-2xl border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <PauseCircle className="h-4 w-4" />
                    Pausar
                  </Button>
                ) : null}

                {["pausada"].includes(c.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleResume(c.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-2xl border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Reactivar
                  </Button>
                ) : null}

                {["activa", "pausada"].includes(c.status) ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCloseCourseId(c.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-2xl border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    <XCircle className="h-4 w-4" />
                    Cerrar
                  </Button>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDuplicate(c.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-2xl border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] hover:bg-[#F8FAFC]"
                >
                  <Copy className="h-4 w-4" />
                  Duplicar
                </Button>

                {actor?.role === "admin" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteCourseId(c.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-2xl px-3 text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                ) : null}
              </div>
            </div>
          );
        },
      },
    ];
  }, [actor, buildLocalizedPath]);

  const filtersToolbar = (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-2">
      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
        <SelectTrigger className="h-11 w-full md:w-[200px] rounded-2xl border-[#E5E7EB] bg-white px-3 text-sm">
          <SelectValue placeholder="Filtrar por estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="borrador">Borrador</SelectItem>
          <SelectItem value="pendiente_revision">Pendiente revisión</SelectItem>
          <SelectItem value="activa">Activa</SelectItem>
          <SelectItem value="pausada">Pausada</SelectItem>
          <SelectItem value="cerrada">Cerrada</SelectItem>
          <SelectItem value="vencida">Vencida</SelectItem>
          <SelectItem value="rechazada">Rechazada</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={institutionFilter}
        onValueChange={(v) => setInstitutionFilter(v === "all" ? "" : v)}
        disabled={actor?.role !== "admin"}
      >
        <SelectTrigger className="h-11 w-full md:w-[220px] rounded-2xl border-[#E5E7EB] bg-white px-3 text-sm disabled:cursor-not-allowed">
          <SelectValue placeholder="Filtrar por institución" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {institutions.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton filterColumns={3} rowCount={6} />;
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Cursos</div>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Gestión de cursos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {actor?.role === "admin"
              ? "Aprueba, rechaza, pausa o cierra cursos."
              : "Crea cursos y gestiona su estado dentro de tu institución."}
          </p>
        </div>

        <Button asChild>
          <Link href={buildLocalizedPath("/dashboard/cursos/nueva")} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo curso
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        <DataTableEnhanced
          data={filtered}
          columns={columns}
          defaultPageSize={20}
          pageSizes={[10, 20, 40, 60, 100]}
          searchPlaceholder="Buscar curso, categoría, modalidad, nivel, ciudad o institución"
          searchableColumnKeys={[
            "title",
            "subRubro",
            "area",
            "modality",
            "level",
            "city",
            "companyName",
            "companyId",
          ]}
          showFiltersRow={true}
          showColumnVisibility={true}
          toolbarLeft={filtersToolbar}
          emptyTitle="No hay cursos para mostrar"
          emptySubtitle="Ajusta los filtros o crea un curso nuevo para empezar."
          onRowClick={(row) => {
            if (row?.id) {
              window.location.href = buildLocalizedPath(`/dashboard/cursos/${row.id}`);
            }
          }}
        />
      </div>

      <CourseRejectDialog
        open={Boolean(rejectCourseId)}
        onClose={() => setRejectCourseId("")}
        jobId={rejectCourseId}
        onDone={() => refresh()}
      />
      <CourseCloseDialog
        open={Boolean(closeCourseId)}
        onClose={() => setCloseCourseId("")}
        jobId={closeCourseId}
        onDone={() => refresh()}
      />
      <DeleteConfirmationDialog
        open={Boolean(deleteCourseId)}
        onClose={() => setDeleteCourseId("")}
        onConfirm={handleDelete}
        defaultToast={false}
        toastMessage="Curso eliminado"
      />
    </div>
  );
}
