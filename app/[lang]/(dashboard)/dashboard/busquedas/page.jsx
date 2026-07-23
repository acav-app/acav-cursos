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

export default function DashboardBusquedasPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [jobs, setJobs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [rejectJobId, setRejectJobId] = useState("");
  const [closeJobId, setCloseJobId] = useState("");
  const [deleteJobId, setDeleteJobId] = useState("");

  const refresh = async () => {
    if (!user) return;
    const data = await authedFetch(user, "/api/courses", { method: "GET" });
    setJobs(asArray(data?.courses));
  };

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const [jobsData, companiesData] = await Promise.all([
          authedFetch(user, "/api/courses", { method: "GET" }),
          authedFetch(user, "/api/institutions", { method: "GET" }),
        ]);
        if (!alive) return;
        setJobs(asArray(jobsData?.courses));
        setCompanies(asArray(companiesData?.institutions));
      } catch (e) {
        toast.error(e?.message || "Error cargando búsquedas", { position: "top-right" });
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
    return jobs
      .filter((j) => (status ? j.status === status : true))
      .filter((j) => (companyId ? j.companyId === companyId : true))
      .filter((j) =>
        q
          ? [j.title, j.companyName, j.city, j.area, j.subRubro].some((v) => String(v || "").toLowerCase().includes(q))
          : true
      );
  }, [jobs, query, status, companyId]);

  const handleApprove = async (id) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/courses/${id}/approve`, { method: "POST" });
      toast.success("Búsqueda aprobada", { position: "top-right" });
      await refresh();
    } catch (e) {
      toast.error(e?.message || "Error aprobando", { position: "top-right" });
    }
  };

  const handlePause = async (id) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/courses/${id}/pause`, { method: "POST" });
      toast.success("Búsqueda pausada", { position: "top-right" });
      await refresh();
    } catch (e) {
      toast.error(e?.message || "Error pausando", { position: "top-right" });
    }
  };

  const handleResume = async (id) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/courses/${id}/resume`, { method: "POST" });
      toast.success("Búsqueda reactivada", { position: "top-right" });
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
    if (!user || !deleteJobId) return;
    await authedFetch(user, `/api/courses/${deleteJobId}`, { method: "DELETE" });
    toast.success("Curso eliminado", { position: "top-right" });
    setDeleteJobId("");
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
          <Select value={status} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
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
        </div>

        <div className="mt-2 text-sm text-muted-foreground">{filtered.length} resultado(s)</div>

        <div className="mt-6 grid gap-4">
          {filtered.map((job) => (
            <div key={job.id} className="rounded-3xl border border-border/60 bg-background p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-foreground">{job.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {job.companyName} · {job.city || "Sin ciudad"} · {job.status}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Cierre: {dateLabel(job.expiresAt)} · Creada: {dateLabel(job.createdAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild>
                    <Link href={buildLocalizedPath(`/dashboard/cursos/${job.id}`)}>Editar</Link>
                  </Button>

                  {actor?.role === "admin" && job.status === "pendiente_revision" ? (
                    <Button onClick={() => handleApprove(job.id)} className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Aprobar
                    </Button>
                  ) : null}

                  {actor?.role === "admin" && job.status === "pendiente_revision" ? (
                    <Button
                      variant="destructive"
                      onClick={() => setRejectJobId(job.id)}
                      className="inline-flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rechazar
                    </Button>
                  ) : null}

                  {["activa"].includes(job.status) ? (
                    <Button variant="outline" onClick={() => handlePause(job.id)} className="inline-flex items-center gap-2">
                      <PauseCircle className="h-4 w-4" />
                      Pausar
                    </Button>
                  ) : null}

                  {["pausada"].includes(job.status) ? (
                    <Button variant="outline" onClick={() => handleResume(job.id)} className="inline-flex items-center gap-2">
                      <PlayCircle className="h-4 w-4" />
                      Reactivar
                    </Button>
                  ) : null}

                  {["activa", "pausada"].includes(job.status) ? (
                    <Button variant="outline" onClick={() => setCloseJobId(job.id)} className="inline-flex items-center gap-2">
                      <StopCircle className="h-4 w-4" />
                      Cerrar
                    </Button>
                  ) : null}

                  <Button variant="outline" onClick={() => handleDuplicate(job.id)} className="inline-flex items-center gap-2">
                    <Copy className="h-4 w-4" />
                    Duplicar
                  </Button>

                  {actor?.role === "admin" ? (
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteJobId(job.id)}
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
              <div className="text-lg font-semibold text-foreground">No hay búsquedas para mostrar.</div>
              <p className="mt-2 text-sm text-muted-foreground">Crea una búsqueda para comenzar.</p>
            </div>
          ) : null}
        </div>
      </div>

      <CourseRejectDialog
        open={Boolean(rejectJobId)}
        onClose={() => setRejectJobId("")}
        jobId={rejectJobId}
        onDone={() => refresh()}
      />
      <CourseCloseDialog
        open={Boolean(closeJobId)}
        onClose={() => setCloseJobId("")}
        jobId={closeJobId}
        onDone={() => refresh()}
      />
      <DeleteConfirmationDialog
        open={Boolean(deleteJobId)}
        onClose={() => setDeleteJobId("")}
        onConfirm={handleDelete}
        defaultToast={false}
        toastMessage="Búsqueda eliminada"
      />
    </div>
  );
}
