"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, Save, XCircle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { ENROLLMENT_STATUSES, PAYMENT_STATUSES } from "@/lib/courses/constants";
import { DashboardDetailSkeleton } from "@/components/courses/dashboard/page-skeletons";

function dateLabel(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-AR");
}

export default function InscripcionDetailPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [application, setApplication] = useState(null);
  const [course, setCourse] = useState(null);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [institutionStatus, setInstitutionStatus] = useState("");

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
        setPaymentStatus(nextApplication?.paymentStatus || nextApplication?.payment?.status || "");
        setReviewComment(nextApplication?.payment?.reviewComment || "");
        if (nextApplication?.institutionId || nextApplication?.companyId) {
          const institutionData = await authedFetch(user, `/api/institutions/${nextApplication.institutionId || nextApplication.companyId}`, { method: "GET" });
          if (!alive) return;
          setInstitutionStatus(String(institutionData?.institution?.status || ""));
        } else {
          setInstitutionStatus("");
        }
        if (nextApplication?.courseId || nextApplication?.jobId) {
          const courseData = await authedFetch(user, `/api/courses/${nextApplication.courseId || nextApplication.jobId}`, { method: "GET" });
          if (!alive) return;
          setCourse(courseData?.course || null);
        } else {
          setCourse(null);
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

  const institutionAllowsManualManagement = institutionStatus === "activa";
  const institutionStatusLabel = institutionStatus || "sin estado";

  const handleSave = async () => {
    if (!user) return;
    if (!institutionAllowsManualManagement) {
      toast.error(`No se puede cambiar manualmente el estado mientras la institucion este ${institutionStatusLabel}.`, {
        position: "top-right",
      });
      return;
    }
    try {
      setSaving(true);
      const data = await authedFetch(user, `/api/enrollments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          paymentStatus,
          reviewComment: reviewComment || undefined,
          reviewedBy: user?.email || user?.uid || "admin",
        }),
      });
      setApplication(data?.enrollment || null);
      setStatus(data?.enrollment?.status || status);
      setPaymentStatus(data?.enrollment?.paymentStatus || data?.enrollment?.payment?.status || paymentStatus);
      setReviewComment(data?.enrollment?.payment?.reviewComment || reviewComment);
      toast.success("Estado actualizado", { position: "top-right" });
    } catch (e) {
      toast.error(e?.message || "Error actualizando estado", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (!user) return;
    if (!institutionAllowsManualManagement) {
      toast.error(`No se puede revisar manualmente mientras la institucion este ${institutionStatusLabel}.`, {
        position: "top-right",
      });
      return;
    }

    const payloadByAction = {
      approve: {
        status: "active",
        paymentStatus: "approved",
        approvedBy: user?.email || user?.uid || "admin",
      },
      reject: {
        status: "rejected",
        paymentStatus: "rejected",
      },
      request_receipt: {
        status: "waiting_payment",
        paymentStatus: "rejected",
      },
    };

    const payload = payloadByAction[action];
    if (!payload) return;

    try {
      setSaving(true);
      const data = await authedFetch(user, `/api/enrollments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          reviewComment: reviewComment || undefined,
          reviewedBy: user?.email || user?.uid || "admin",
        }),
      });
      setApplication(data?.enrollment || null);
      setStatus(data?.enrollment?.status || payload.status);
      setPaymentStatus(data?.enrollment?.paymentStatus || data?.enrollment?.payment?.status || payload.paymentStatus);
      setReviewComment(data?.enrollment?.payment?.reviewComment || reviewComment);
      toast.success(
        action === "approve"
          ? "Pago aprobado y curso activado."
          : action === "reject"
            ? "Inscripción rechazada."
            : "Se solicitó un nuevo comprobante.",
        { position: "top-right" }
      );
    } catch (e) {
      toast.error(e?.message || "No pudimos actualizar la revisión.", { position: "top-right" });
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
            <div className="text-sm font-semibold text-foreground">Estado y pago</div>
            <div className="mt-4 grid gap-3">
              {!institutionAllowsManualManagement ? (
                <Alert color="warning" variant="soft" className="items-start rounded-3xl border border-warning/20">
                  <div className="grid gap-1">
                    <AlertTitle>Gestión manual bloqueada</AlertTitle>
                    <AlertDescription>
                      La institucion asociada esta en estado {institutionStatusLabel}. Para cambiar manualmente esta inscripcion,
                      primero la institucion debe volver a estar activa.
                    </AlertDescription>
                  </div>
                </Alert>
              ) : null}
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger disabled={!institutionAllowsManualManagement || saving}>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {ENROLLMENT_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger disabled={!institutionAllowsManualManagement || saving}>
                  <SelectValue placeholder="Seleccionar estado del pago" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="Comentario interno o motivo de revisión"
                className="min-h-[110px] rounded-2xl"
                disabled={!institutionAllowsManualManagement || saving}
              />

              <div className="grid gap-3 md:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleQuickAction("approve")}
                  disabled={!institutionAllowsManualManagement || saving}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprobar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleQuickAction("request_receipt")}
                  disabled={!institutionAllowsManualManagement || saving}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Nuevo comprobante
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleQuickAction("reject")}
                  disabled={!institutionAllowsManualManagement || saving}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
              </div>

              <Button
                onClick={handleSave}
                disabled={!institutionAllowsManualManagement || saving}
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
            url={application.paymentReceiptUrl || application?.payment?.receiptUrl || application.cvUrl}
            title="Comprobante"
            description="Vista previa del comprobante cargado para validar el pago de la inscripción."
          />
          <div className="rounded-3xl border border-border/60 bg-background p-6">
            <div className="text-sm font-semibold text-foreground">Pago</div>
            <div className="mt-4 grid gap-3">
              <Input readOnly value={String(application.paymentAmount || application.amount || "")} placeholder="Monto (no informado)" />
              <Input readOnly value={application.paymentReference || application?.payment?.reference || ""} placeholder="Referencia (no informada)" />
              <Input readOnly value={application.paymentMethod || application?.payment?.method || ""} placeholder="Método (no informado)" />
              <Input readOnly value={application.paymentStatus || application?.payment?.status || ""} placeholder="Estado del pago (no informado)" />
              <Textarea readOnly value={application?.payment?.reviewComment || reviewComment || ""} placeholder="Comentario de revisión (sin comentario)" className="min-h-[96px] rounded-2xl" />
            </div>
          </div>
        </div>

        {course?.flyerUrl || course?.imageUrl ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {course?.flyerUrl ? (
              <FilePreview
                url={course.flyerUrl}
                title="Programa o ficha del curso"
                description="Material grafico cargado en la publicacion asociada a esta inscripcion."
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 bg-background p-6 text-sm text-muted-foreground">
                No hay programa cargado para este curso.
              </div>
            )}
            {course?.imageUrl ? (
              <FilePreview
                url={course.imageUrl}
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
      </div>
    </div>
  );
}
