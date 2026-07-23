"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Download, ExternalLink, Loader2, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import FilePreview from "@/components/courses/file-preview";
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
import { authedFetch } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { ENROLLMENT_STATUSES } from "@/lib/courses/constants";
import { DashboardDetailSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-AR");
}

export default function PostulacionDetailPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [application, setApplication] = useState(null);
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("");
  const [companyStatus, setCompanyStatus] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const data = await authedFetch(user, `/api/enrollments/${id}`, { method: "GET" });
        if (!alive) return;
        const nextApplication = data?.enrollment || null;
        setApplication(nextApplication);
        setStatus(nextApplication?.status || "");
        if (nextApplication?.institutionId || nextApplication?.companyId) {
          const companyData = await authedFetch(user, `/api/institutions/${nextApplication.institutionId || nextApplication.companyId}`, { method: "GET" });
          if (!alive) return;
          setCompanyStatus(String(companyData?.institution?.status || ""));
        } else {
          setCompanyStatus("");
        }
        if (nextApplication?.courseId || nextApplication?.jobId) {
          const jobData = await authedFetch(user, `/api/courses/${nextApplication.courseId || nextApplication.jobId}`, { method: "GET" });
          if (!alive) return;
          setJob(jobData?.course || null);
        } else {
          setJob(null);
        }
      } catch (e) {
        toast.error(e?.message || "Error cargando inscripcion", { position: "top-right" });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [id, user]);

  const companyAllowsManualManagement = companyStatus === "activa";
  const companyStatusLabel = companyStatus || "sin estado";

  const handleSave = async () => {
    if (!user) return;
    if (!companyAllowsManualManagement) {
      toast.error(`No se puede cambiar manualmente el estado mientras la institucion este ${companyStatusLabel}.`, {
        position: "top-right",
      });
      return;
    }
    try {
      setSaving(true);
      const data = await authedFetch(user, `/api/enrollments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setApplication(data?.enrollment || null);
      toast.success("Estado actualizado", { position: "top-right" });
    } catch (e) {
      toast.error(e?.message || "Error actualizando estado", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DashboardDetailSkeleton />;
  }

  if (!application) {
    return (
      <div className="py-8 px-2 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-border/60 bg-card p-8">
          <h1 className="text-2xl font-bold text-foreground">Inscripcion no encontrada</h1>
          <div className="mt-4">
            <Link href={buildLocalizedPath("/dashboard/inscripciones")} className="text-primary font-semibold">
              Volver
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-2 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href={buildLocalizedPath("/dashboard/inscripciones")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a inscripciones
        </Link>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card p-8">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Inscripcion</div>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          {[application.firstName, application.lastName].filter(Boolean).join(" ").trim() || application.studentName || application.candidateName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {application.courseTitle || application.jobTitle} · {application.institutionName || application.companyName}
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-border/60 bg-background p-6">
            <div className="text-sm font-semibold text-foreground">Datos del alumno</div>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
              <div>Email: <span className="font-semibold text-foreground">{application.email}</span></div>
              <div>Teléfono: <span className="font-semibold text-foreground">{application.phone}</span></div>
              <div>Ciudad: <span className="font-semibold text-foreground">{application.city}</span></div>
              <div>Provincia: <span className="font-semibold text-foreground">{application.province || "-"}</span></div>
              <div>Creada: <span className="font-semibold text-foreground">{dateLabel(application.createdAt)}</span></div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/60 bg-background p-6">
            <div className="text-sm font-semibold text-foreground">Estado</div>
            <div className="mt-4 grid gap-3">
              {!companyAllowsManualManagement ? (
                <Alert color="warning" variant="soft" className="items-start rounded-3xl border border-warning/20">
                  <div className="grid gap-1">
                    <AlertTitle>Gestión manual bloqueada</AlertTitle>
                    <AlertDescription>
                      La institucion asociada esta en estado {companyStatusLabel}. Para cambiar manualmente esta inscripcion,
                      primero la institucion debe volver a estar activa.
                    </AlertDescription>
                  </div>
                </Alert>
              ) : null}
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger disabled={!companyAllowsManualManagement || saving}>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {ENROLLMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleSave}
                disabled={!companyAllowsManualManagement || saving}
                className={saving ? "pointer-events-none" : ""}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar estado
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <FilePreview
            url={application.cvUrl}
            title="Documentacion"
            description="Imágenes, PDFs y textos se muestran directo. Documentos Office usan un visor embebido cuando la URL es pública."
          />
          <div className="rounded-3xl border border-border/60 bg-background p-6">
            <div className="text-sm font-semibold text-foreground">Links</div>
            <div className="mt-4 grid gap-3">
              <Input readOnly value={application.linkedinUrl || ""} placeholder="LinkedIn (no informado)" />
              <Input readOnly value={application.portfolioUrl || ""} placeholder="Portfolio (no informado)" />
            </div>
          </div>
        </div>

        {job?.flyerUrl || job?.imageUrl ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {job?.flyerUrl ? (
              <FilePreview
                url={job.flyerUrl}
                title="Programa o ficha del curso"
                description="Material grafico cargado en la publicacion asociada a esta inscripcion."
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 bg-background p-6 text-sm text-muted-foreground">
                No hay programa cargado para este curso.
              </div>
            )}
            {job?.imageUrl ? (
              <FilePreview
                url={job.imageUrl}
                title="Imagen del curso"
                description="Imagen principal publicada en el curso asociado."
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 bg-background p-6 text-sm text-muted-foreground">
                No hay imagen principal cargada para este curso.
              </div>
            )}
          </div>
        ) : null}

        {job?.externalLink ? (
          <div className="mt-8 rounded-3xl border border-border/60 bg-background p-6">
            <div className="text-sm font-semibold text-foreground">Link externo del curso</div>
            <div className="mt-4">
              <Button asChild variant="outline">
                <a href={job.externalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Abrir publicacion externa
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        {application.message ? (
          <div className="mt-8 rounded-3xl border border-border/60 bg-background p-6">
            <div className="text-sm font-semibold text-foreground">Mensaje</div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground whitespace-pre-wrap">{application.message}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
