"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { EDUCATIONAL_ENROLLMENT_STATUSES, ENROLLMENT_STATUSES, PAYMENT_STATUSES } from "@/lib/courses/constants";
import { DashboardDetailSkeleton } from "@/components/courses/dashboard/page-skeletons";
import PaymentReceiptUploader from "@/components/courses/dashboard/payment-receipt-uploader";

function dateLabel(iso) {
  const d = new Date(String(iso || ""));
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-AR");
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "A definir";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function titleCase(value, fallback = "-") {
  const normalized = String(value || "")
    .replaceAll("_", " ")
    .trim();
  if (!normalized) return fallback;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function resolveTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["active", "approved"].includes(normalized)) return "success";
  if (["rejected", "cancelled", "canceled"].includes(normalized)) return "destructive";
  if (["pending", "waiting_payment", "payment_under_review", "under_review", "started"].includes(normalized)) return "warning";
  return "info";
}

function buildStudentNotice(status, paymentStatus) {
  const enrollment = String(status || "").trim().toLowerCase();
  const payment = String(paymentStatus || "").trim().toLowerCase();

  if (enrollment === "active") {
    return {
      title: "Tu acceso ya está habilitado",
      description: "La inscripción quedó activa. Todo el seguimiento futuro de este curso lo verás desde tu dashboard.",
      tone: "success",
    };
  }

  if (payment === "approved") {
    return {
      title: "Pago acreditado",
      description: "El cobro ya fue validado. Si el acceso todavía no aparece como activo, el equipo lo está terminando de habilitar.",
      tone: "success",
    };
  }

  if (payment === "under_review" || enrollment === "payment_under_review") {
    return {
      title: "Estamos revisando tu pago",
      description: "La inscripción sigue abierta y el equipo administrativo está validando el estado del pago manual.",
      tone: "warning",
    };
  }

  if (payment === "rejected" || enrollment === "rejected") {
    return {
      title: "La inscripción necesita revisión",
      description: "Hubo un inconveniente con la validación. Mantén esta vista a mano porque aquí verás el nuevo estado apenas se actualice.",
      tone: "destructive",
    };
  }

  return {
    title: "Inscripción iniciada",
    description: "Tu lugar ya fue reservado. El pago sigue pendiente y el seguimiento queda centralizado dentro del dashboard.",
    tone: "info",
  };
}

function MetricCard({ label, value, helper }) {
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-[#FAFAFA] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{label}</div>
      <div className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[#0F172A]">{value}</div>
      <p className="mt-2 text-sm leading-6 text-[#64748B]">{helper}</p>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-[22px] border border-[#E5E7EB] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{label}</div>
      <div className="mt-2 text-sm font-medium text-[#0F172A]">{value || "-"}</div>
    </div>
  );
}

export default function InscripcionDetailPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
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
          const institutionData = await authedFetch(
            user,
            `/api/institutions/${nextApplication.institutionId || nextApplication.companyId}`,
            { method: "GET" }
          );
          if (!alive) return;
          setInstitutionStatus(String(institutionData?.institution?.status || ""));
        } else {
          setInstitutionStatus("");
        }

        if (nextApplication?.courseId || nextApplication?.jobId) {
          const courseData = await authedFetch(user, `/api/courses/${nextApplication.courseId || nextApplication.jobId}`, {
            method: "GET",
          });
          if (!alive) return;
          setCourse(courseData?.course || null);
        } else {
          setCourse(null);
        }
      } catch (error) {
        toast.error(error?.message || "Error cargando inscripción", { position: "top-right" });
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

  const isAdmin = actor?.role === "admin";
  const institutionAllowsManualManagement = institutionStatus === "activa";
  const institutionStatusLabel = institutionStatus || "sin estado";
  const courseTitle = application?.courseTitle || application?.jobTitle || course?.title || "Inscripción";
  const institutionName = application?.institutionName || application?.companyName || course?.institutionName || "ACAV";
  const studentName =
    [application?.firstName, application?.lastName].filter(Boolean).join(" ").trim() ||
    application?.studentName ||
    actor?.displayName ||
    actor?.firstName ||
    "Alumno";
  const amountLabel = formatCurrency(application?.paymentAmount || application?.payment?.amount || application?.amount || course?.price);
  const paymentMethodLabel = titleCase(application?.paymentMethod || application?.payment?.method, "Transferencia");
  const paymentReferenceLabel = String(application?.paymentReference || application?.payment?.reference || "").trim() || "Sin referencia";
  const paymentReceiptUrl = String(application?.paymentReceiptUrl || application?.payment?.receiptUrl || "").trim();
  const hasPaymentAmount =
    application?.paymentAmount != null ||
    application?.payment?.amount != null ||
    application?.amount != null;
  const hasPaymentMetadata = Boolean(
    application?.paymentMethod ||
      application?.payment?.method ||
      application?.paymentReference ||
      application?.payment?.reference ||
      hasPaymentAmount ||
      paymentReceiptUrl
  );
  const allowedStatuses = hasPaymentMetadata
    ? EDUCATIONAL_ENROLLMENT_STATUSES
    : ENROLLMENT_STATUSES;
  const studentNotice = useMemo(() => buildStudentNotice(status, paymentStatus), [paymentStatus, status]);

  const handleSave = async () => {
    if (!user || !isAdmin) return;
    if (!institutionAllowsManualManagement) {
      toast.error(`No se puede cambiar manualmente el estado mientras la institución esté ${institutionStatusLabel}.`, {
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
    } catch (error) {
      toast.error(error?.message || "Error actualizando estado", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (!user || !isAdmin) return;
    if (!institutionAllowsManualManagement) {
      toast.error(`No se puede revisar manualmente mientras la institución esté ${institutionStatusLabel}.`, {
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
            : "Se solicitó una nueva revisión del pago.",
        { position: "top-right" }
      );
    } catch (error) {
      toast.error(error?.message || "No pudimos actualizar la revisión.", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || (user && actorLoading)) {
    return <DashboardDetailSkeleton />;
  }

  if (!application) {
    return (
      <div className="mx-auto px-2 py-8">
        <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-8">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[#0F172A]">Inscripción no encontrada</h1>
          <div className="mt-4">
            <Link href={buildLocalizedPath("/dashboard/inscripciones")} className="text-sm font-semibold text-[#1D4ED8]">
              Volver a inscripciones
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto px-2 py-8">
        <div className="mb-6">
          <Link
            href={buildLocalizedPath("/dashboard/inscripciones")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D4ED8]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a inscripciones
          </Link>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
          <div className="border-b border-[#EEF2F7] px-6 py-7 md:px-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Mi inscripción
            </div>
            <h1 className="mt-4 text-[34px] font-semibold tracking-[-0.04em] text-[#0F172A]">{courseTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              {institutionName} · registrada el {dateLabel(application.createdAt)}
            </p>
          </div>

          <div className="grid gap-4 border-b border-[#EEF2F7] px-6 py-6 md:grid-cols-3 md:px-8">
            <MetricCard label="Estado" value={titleCase(status)} helper="Seguimiento actual de tu inscripción." />
            <MetricCard label="Pago" value={titleCase(paymentStatus)} helper="Estado financiero asociado a esta reserva." />
            <MetricCard label="Importe" value={amountLabel} helper="Monto informado para este curso." />
          </div>

          <div className="px-6 py-6 md:px-8">
            <Alert
              color={studentNotice.tone}
              variant="soft"
              className="items-start rounded-[24px] border border-current/10 bg-[#FAFAFA]"
            >
              <div className="grid gap-1">
                <AlertTitle>{studentNotice.title}</AlertTitle>
                <AlertDescription>{studentNotice.description}</AlertDescription>
              </div>
            </Alert>

            {status !== "active" ? (
              <div className="mt-6">
                <PaymentReceiptUploader
                  enrollmentId={id}
                  initialReceiptUrl={paymentReceiptUrl}
                  initialReference={String(application?.paymentReference || application?.payment?.reference || "").trim()}
                  enrollmentStatus={status}
                  paymentStatus={paymentStatus}
                  onUpdated={(updated) => {
                    if (!updated) return;
                    setApplication(updated);
                    setStatus(updated.status || status);
                    setPaymentStatus(updated.paymentStatus || updated.payment?.status || paymentStatus);
                  }}
                />
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid gap-6">
                <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FAFAFA] p-6">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Resumen</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <DetailItem label="Alumno" value={studentName} />
                    <DetailItem label="Email" value={application.email || actor?.email} />
                    <DetailItem label="Teléfono" value={application.phone || actor?.phone || "-"} />
                    <DetailItem
                      label="Ubicación"
                      value={[application.city, application.province].filter(Boolean).join(", ") || actor?.city || "-"}
                    />
                    <DetailItem label="Método de pago" value={paymentMethodLabel} />
                    <DetailItem label="Referencia" value={paymentReferenceLabel} />
                  </div>
                </div>

                {(course?.flyerUrl || course?.imageUrl) && (
                  <div className="grid gap-6 md:grid-cols-2">
                    {course?.flyerUrl ? (
                      <FilePreview
                        url={course.flyerUrl}
                        title="Programa del curso"
                        description="Material de referencia publicado para esta formación."
                      />
                    ) : (
                      <div className="rounded-[28px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-6 text-sm text-[#64748B]">
                        Este curso no tiene programa adjunto.
                      </div>
                    )}

                    {course?.imageUrl ? (
                      <FilePreview
                        url={course.imageUrl}
                        title="Imagen del curso"
                        description="Vista principal del curso asociado a esta inscripción."
                      />
                    ) : (
                      <div className="rounded-[28px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-6 text-sm text-[#64748B]">
                        Este curso no tiene imagen principal cargada.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4">
                <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#1D4ED8]">
                      <CreditCard className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A]">Pago y seguimiento</div>
                      <p className="mt-1 text-sm leading-6 text-[#64748B]">
                        Todo el estado de este proceso se actualiza desde el panel.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                      <span className="text-sm text-[#64748B]">Estado del pago</span>
                      <Badge color={resolveTone(paymentStatus)} variant="soft" className="rounded-full">
                        {titleCase(paymentStatus)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                      <span className="text-sm text-[#64748B]">Estado de la inscripción</span>
                      <Badge color={resolveTone(status)} variant="soft" className="rounded-full">
                        {titleCase(status)}
                      </Badge>
                    </div>
                    {paymentReceiptUrl ? (
                      <Button asChild variant="outline" className="rounded-2xl">
                        <a href={paymentReceiptUrl} target="_blank" rel="noreferrer">
                          Ver comprobante
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FAFAFA] p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#EA580C]">
                      <AlertCircle className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A]">Siguiente paso</div>
                      <p className="mt-1 text-sm leading-6 text-[#64748B]">
                        Sigue tus cambios desde esta misma ficha o vuelve al listado general.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {String(status || "").trim().toLowerCase() === "active" ? (
                      <Button asChild className="rounded-2xl bg-[#0F172A] text-white hover:bg-[#1E293B]">
                        <Link href={buildLocalizedPath(`/dashboard/mis-cursos/${id}`)}>Entrar a la cursada</Link>
                      </Button>
                    ) : null}
                    <Button asChild className="rounded-2xl bg-[#0F172A] text-white hover:bg-[#1E293B]">
                      <Link href={buildLocalizedPath("/dashboard/inscripciones")}>Ver todas mis inscripciones</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl">
                      <Link href={buildLocalizedPath("/cursos")}>Explorar más cursos</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-2 py-8">
      <div className="mb-6">
        <Link
          href={buildLocalizedPath("/dashboard/inscripciones")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1D4ED8]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a inscripciones
        </Link>
      </div>

      <div className="overflow-hidden rounded-[32px] border border-[#E5E7EB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-[#EEF2F7] px-6 py-7 md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            <FileText className="h-3.5 w-3.5" />
            Gestión manual
          </div>
          <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.04em] text-[#0F172A]">{studentName}</h1>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            {courseTitle} · {institutionName}
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-2 md:px-8">
          <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FAFAFA] p-6">
            <div className="text-sm font-semibold text-[#0F172A]">Datos del alumno</div>
            <div className="mt-4 grid gap-3 text-sm text-[#64748B]">
              <div>Email: <span className="font-semibold text-[#0F172A]">{application.email || "-"}</span></div>
              <div>Teléfono: <span className="font-semibold text-[#0F172A]">{application.phone || "-"}</span></div>
              <div>Ciudad: <span className="font-semibold text-[#0F172A]">{application.city || "-"}</span></div>
              <div>Provincia: <span className="font-semibold text-[#0F172A]">{application.province || "-"}</span></div>
              <div>Creada: <span className="font-semibold text-[#0F172A]">{dateLabel(application.createdAt)}</span></div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FAFAFA] p-6">
            <div className="text-sm font-semibold text-[#0F172A]">Estado y pago</div>
            <div className="mt-4 grid gap-3">
              {!institutionAllowsManualManagement ? (
                <Alert color="warning" variant="soft" className="items-start rounded-[22px] border border-warning/20">
                  <div className="grid gap-1">
                    <AlertTitle>Gestión manual bloqueada</AlertTitle>
                    <AlertDescription>
                      La institución asociada está en estado {institutionStatusLabel}. Para cambiar manualmente esta inscripción,
                      primero debe volver a estar activa.
                    </AlertDescription>
                  </div>
                </Alert>
              ) : null}

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger disabled={!institutionAllowsManualManagement || saving}>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {allowedStatuses.map((item) => (
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
                  Revisar otra vez
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

              <Button onClick={handleSave} disabled={!institutionAllowsManualManagement || saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar estado
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 border-t border-[#EEF2F7] px-6 py-6 md:grid-cols-2 md:px-8">
          {paymentReceiptUrl ? (
            <FilePreview
              url={paymentReceiptUrl}
              title="Comprobante"
              description="Vista previa del comprobante cargado para validar el pago."
            />
          ) : (
            <div className="rounded-[28px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-6 text-sm text-[#64748B]">
              No hay comprobante adjunto en esta inscripción.
            </div>
          )}

          <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FAFAFA] p-6">
            <div className="text-sm font-semibold text-[#0F172A]">Pago</div>
            <div className="mt-4 grid gap-3">
              <Input readOnly value={amountLabel} />
              <Input readOnly value={paymentReferenceLabel} />
              <Input readOnly value={paymentMethodLabel} />
              <Input readOnly value={titleCase(paymentStatus)} />
              <Textarea
                readOnly
                value={application?.payment?.reviewComment || reviewComment || ""}
                placeholder="Comentario de revisión"
                className="min-h-[96px] rounded-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
