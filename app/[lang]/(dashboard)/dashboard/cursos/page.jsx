"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, CheckCircle2, PauseCircle, PlayCircle, Copy, Trash2, XCircle, StopCircle } from "lucide-react";
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
import CourseRejectDialog from "@/components/courses/dashboard/course-reject-dialog";
import CourseCloseDialog from "@/components/courses/dashboard/course-close-dialog";
import DeleteConfirmationDialog from "@/components/delete-confirmation-dialog";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const date = new Date(String(iso || ""));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
}

export default function DashboardCursosPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [courses, setCourses] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [institutionId, setInstitutionId] = useState("");
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
    const q = String(query || "").trim().toLowerCase();
    return courses
      .filter((course) => (status ? course.status === status : true))
      .filter((course) => (institutionId ? course.companyId === institutionId : true))
      .filter((course) =>
        q
          ? [course.title, course.companyName, course.city, course.area, course.subRubro].some((value) =>
              String(value || "").toLowerCase().includes(q)
            )
          : true
      );
  }, [courses, query, status, institutionId]);

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

  if (actorLoading || loading) {
    return <DashboardPageShellSkeleton filterColumns={3} rowCount={6} />;
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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Cursos</div>
          <h1 className="mt-3 text-3xl font-bold text-foreground">Gestion de cursos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {actor?.role === "admin"
              ? "Aproba, rechaza, pausa o cierra cursos."
              : "Crea cursos y gestiona su estado dentro de tu institucion."}
          </p>
        </div>

        <Button asChild>
          <Link href={buildLocalizedPath("/dashboard/cursos/nueva")} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo curso
          </Link>
        </Button>
      </div>

      <div className="mt-8 rounded-3xl border border-border/60 bg-card p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por curso, institucion, ciudad o categoria" />
          <Select value={status} onValueChange={(value) => setStatus(value === "all" ? "" : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="borrador">borrador</SelectItem>
              <SelectItem value="pendiente_revision">pendiente_revision</SelectItem>
              <SelectItem value="activa">activa</SelectItem>
              <SelectItem value="pausada">pausada</SelectItem>
              <SelectItem value="cerrada">cerrada</SelectItem>
              <SelectItem value="vencida">vencida</SelectItem>
              <SelectItem value="rechazada">rechazada</SelectItem>
            </SelectContent>
          </Select>
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
        </div>

        <div className="mt-2 text-sm text-muted-foreground">{filtered.length} resultado(s)</div>

        <div className="mt-6 grid gap-4">
          {filtered.map((course) => (
            <div key={course.id} className="rounded-3xl border border-border/60 bg-background p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-foreground">{course.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {course.companyName} · {course.city || "Sin ciudad"} · {course.status}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Cierre: {dateLabel(course.expiresAt)} · Creada: {dateLabel(course.createdAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link href={buildLocalizedPath(`/dashboard/cursos/${course.id}`)}>Editar</Link>
                  </Button>

                  {actor?.role === "admin" && course.status === "pendiente_revision" ? (
                    <Button onClick={() => handleApprove(course.id)} className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Aprobar
                    </Button>
                  ) : null}

                  {actor?.role === "admin" && course.status === "pendiente_revision" ? (
                    <Button
                      variant="destructive"
                      onClick={() => setRejectCourseId(course.id)}
                      className="inline-flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rechazar
                    </Button>
                  ) : null}

                  {["activa"].includes(course.status) ? (
                    <Button variant="outline" onClick={() => handlePause(course.id)} className="inline-flex items-center gap-2">
                      <PauseCircle className="h-4 w-4" />
                      Pausar
                    </Button>
                  ) : null}

                  {["pausada"].includes(course.status) ? (
                    <Button variant="outline" onClick={() => handleResume(course.id)} className="inline-flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" />
                      Reactivar
                    </Button>
                  ) : null}

                  {["activa", "pausada"].includes(course.status) ? (
                    <Button variant="outline" onClick={() => setCloseCourseId(course.id)} className="inline-flex items-center gap-2">
                      <StopCircle className="h-4 w-4" />
                      Cerrar
                    </Button>
                  ) : null}

                  <Button variant="outline" onClick={() => handleDuplicate(course.id)} className="inline-flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </Button>

                  {actor?.role === "admin" ? (
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteCourseId(course.id)}
                      className="inline-flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {!filtered.length ? (
            <div className="rounded-3xl border border-border/60 bg-background p-8 text-center">
              <div className="text-lg font-semibold text-foreground">No hay cursos para mostrar.</div>
              <p className="mt-2 text-sm text-muted-foreground">Crea un curso para comenzar.</p>
            </div>
          ) : null}
        </div>
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
