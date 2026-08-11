"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  CreditCard,
  FileDown,
  FileText,
  Loader2,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import FilePreview from "@/components/courses/file-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ALLOWED_SCORE_ATTACHMENT_MIME_TYPES,
  COURSE_COMPLETION_STATUSES,
  MAX_SCORE_ATTACHMENT_SIZE_BYTES,
} from "@/lib/courses/constants";
import { DashboardDetailSkeleton } from "@/components/courses/dashboard/page-skeletons";
import PaymentReceiptUploader from "@/components/courses/dashboard/payment-receipt-uploader";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";
import { resolveCourseCompletionStatusMeta } from "@/lib/courses/status-meta";

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

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function allowedScoreMimeLabel() {
  const labels = new Map([
    ["application/pdf", "PDF"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "DOCX"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "XLSX"],
    ["image/png", "PNG"],
    ["image/jpeg", "JPG"],
    ["image/jpg", "JPG"],
  ]);
  return ALLOWED_SCORE_ATTACHMENT_MIME_TYPES.map((m) => labels.get(m) || m).join(", ");
}

export default function InscripcionDetailPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
  const attachmentInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseStatusSaving, setCourseStatusSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [application, setApplication] = useState(null);
  const [course, setCourse] = useState(null);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [institutionStatus, setInstitutionStatus] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [courseStatus, setCourseStatus] = useState("in_progress");
  const [manualScore, setManualScore] = useState("");
  const [courseStatusReason, setCourseStatusReason] = useState("");
  const [scoreAttachments, setScoreAttachments] = useState([]);

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
        setFirstName(nextApplication?.firstName || "");
        setLastName(nextApplication?.lastName || "");
        setPhone(nextApplication?.phone || "");
        setEmail(nextApplication?.email || "");
        setCity(nextApplication?.city || "");
        setProvince(nextApplication?.province || "");
        setCourseStatus(nextApplication?.courseStatus || "in_progress");
        setManualScore(
          typeof nextApplication?.manualScore === "number" ? String(nextApplication.manualScore) : ""
        );
        setCourseStatusReason(nextApplication?.courseStatusReason || "");
        setScoreAttachments(Array.isArray(nextApplication?.scoreAttachments) ? [...nextApplication.scoreAttachments] : []);

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
  const completionMeta = useMemo(() => resolveCourseCompletionStatusMeta(courseStatus), [courseStatus]);
  const completionIcon = useMemo(() => completionMeta?.Icon, [completionMeta]);
  const isCourseSuspended = String(courseStatus || "").trim().toLowerCase() === "suspended";

  const handleSaveStudentData = async () => {
    if (!user || !isAdmin) return;
    const firstNameTrim = String(firstName || "").trim();
    const lastNameTrim = String(lastName || "").trim();
    const emailTrim = String(email || "").trim().toLowerCase();
    if (!firstNameTrim || !lastNameTrim) {
      toast.error("Nombre y Apellido son obligatorios.", { position: "top-right" });
      return;
    }
    if (!emailTrim) {
      toast.error("El email es obligatorio.", { position: "top-right" });
      return;
    }
    try {
      setSaving(true);
      const data = await authedFetch(user, `/api/enrollments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstNameTrim,
          lastName: lastNameTrim,
          studentName: `${firstNameTrim} ${lastNameTrim}`.trim(),
          candidateName: `${firstNameTrim} ${lastNameTrim}`.trim(),
          email: emailTrim,
          phone: String(phone || "").trim() || undefined,
          city: String(city || "").trim() || undefined,
          province: String(province || "").trim() || undefined,
          reviewedBy: user?.email || user?.uid || "admin",
        }),
      });
      setApplication(data?.enrollment || null);
      toast.success("Datos del alumno actualizados.", { position: "top-right" });
    } catch (err) {
      toast.error(err?.message || "No pudimos guardar los datos del alumno.", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  const handleAttachmentUpload = async (event) => {
    const file = event.target.files?.[0] || null;
    if (attachmentInputRef?.current) attachmentInputRef.current.value = "";
    if (!file) return;
    if (!user) {
      toast.error("Necesitas iniciar sesión.", { position: "top-right" });
      return;
    }
    if (file.size > MAX_SCORE_ATTACHMENT_SIZE_BYTES) {
      toast.error(`El archivo no puede superar los ${formatBytes(MAX_SCORE_ATTACHMENT_SIZE_BYTES)}.`, { position: "top-right" });
      return;
    }
    const allowed = new Set(ALLOWED_SCORE_ATTACHMENT_MIME_TYPES);
    if (!allowed.has(file.type)) {
      toast.error(`Formato no permitido. Solo: ${allowedScoreMimeLabel()}.`, { position: "top-right" });
      return;
    }
    try {
      setUploadingAttachment(true);
      const url = await uploadToR2(file, "score-attachments");
      const normalized = normalizePublicR2Url(url);
      const attachment = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        url: normalized,
        storagePath: normalized,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedByUid: user?.uid || user?.email || undefined,
        uploadedAt: new Date().toISOString(),
      };
      setScoreAttachments((arr) => [...(Array.isArray(arr) ? arr : []), attachment]);
      toast.success("Archivo cargado. Guardalo para persistirlo.", { position: "top-right" });
    } catch (err) {
      toast.error(err?.message || "No pudimos subir el archivo.", { position: "top-right" });
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = (attachId) => {
    setScoreAttachments((arr) =>
      (Array.isArray(arr) ? arr : []).filter((item) => String(item?.id || "") !== String(attachId || ""))
    );
  };

  const handleSaveCourseStatus = async () => {
    if (!user || !isAdmin) return;
    if (!institutionAllowsManualManagement) {
      toast.error(`No se puede gestionar la cursada mientras la institución esté ${institutionStatusLabel}.`, {
        position: "top-right",
      });
      return;
    }
    if (!String(courseStatus || "").trim()) {
      toast.error("Seleccioná un estado de cursada.", { position: "top-right" });
      return;
    }
    try {
      setCourseStatusSaving(true);
      const body = {
        courseStatus: String(courseStatus).trim(),
        courseStatusReason: String(courseStatusReason || "").trim() || undefined,
        scoreAttachments: Array.isArray(scoreAttachments) && scoreAttachments.length ? scoreAttachments : [],
      };
      const scoreNum = Number(manualScore);
      if (String(manualScore || "").trim() !== "") {
        if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
          toast.error("El puntaje debe estar entre 0 y 100.", { position: "top-right" });
          return;
        }
        body.manualScore = scoreNum;
      }
      const data = await authedFetch(user, `/api/enrollments/${id}/course-status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const updated = data?.enrollment || null;
      setApplication(updated);
      if (updated) {
        setCourseStatus(updated.courseStatus || "in_progress");
        setManualScore(typeof updated.manualScore === "number" ? String(updated.manualScore) : "");
        setCourseStatusReason(updated.courseStatusReason || "");
        setScoreAttachments(Array.isArray(updated.scoreAttachments) ? [...updated.scoreAttachments] : []);
      }
      toast.success("Gestión de cursada actualizada.", { position: "top-right" });
    } catch (err) {
      toast.error(err?.message || "No pudimos guardar la gestión de la cursada.", { position: "top-right" });
    } finally {
      setCourseStatusSaving(false);
    }
  };

  if (loading || (user && actorLoading)) {
    return <DashboardDetailSkeleton />;
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-6xl px-2 py-8">
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
      <div className="mx-auto max-w-6xl px-2 py-8">
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

          <div className="grid gap-4 border-b border-[#EEF2F7] px-6 py-6 md:grid-cols-4 md:px-8">
            <MetricCard label="Estado" value={titleCase(status)} helper="Seguimiento actual de tu inscripción." />
            <MetricCard label="Pago" value={titleCase(paymentStatus)} helper="Estado financiero asociado a esta reserva." />
            <MetricCard label="Importe" value={amountLabel} helper="Monto informado para este curso." />
            <MetricCard
              label="Cursada"
              value={completionMeta?.title || "En curso"}
              helper={
                typeof application?.manualScore === "number"
                  ? `Puntaje final: ${application.manualScore}/100.`
                  : completionMeta?.description || "Seguimiento académico."
              }
            />
          </div>

          <div className="px-6 py-6 md:px-8">
            {isCourseSuspended ? (
              <Alert
                color="warning"
                variant="soft"
                className="mb-6 items-start rounded-[24px] border border-warning/20 bg-[#FAFAFA]"
              >
                <div className="grid gap-1">
                  <AlertTitle>Acceso temporalmente suspendido</AlertTitle>
                  <AlertDescription>
                    {String(application?.courseStatusReason || courseStatusReason || "").trim()
                      ? `Motivo informado: ${String(application?.courseStatusReason || courseStatusReason).trim()}`
                      : "Por el momento tu acceso a la cursada se encuentra suspendido. Comunicate con administración para regularizar tu situación."}
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}

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
                    {String(status || "").trim().toLowerCase() === "active" && !isCourseSuspended ? (
                      <Button asChild className="rounded-2xl bg-[#0F172A] text-white hover:bg-[#1E293B]">
                        <Link href={buildLocalizedPath(`/dashboard/mis-cursos/${id}`)}>Entrar a la cursada</Link>
                      </Button>
                    ) : null}
                    {isCourseSuspended && String(status || "").trim().toLowerCase() === "active" ? (
                      <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Acceso temporalmente bloqueado hasta regularizar la situación administrativa.
                      </div>
                    ) : null}
                    <Button asChild className="rounded-2xl bg-[#0F172A] text-white hover:bg-[#1E293B]">
                      <Link href={buildLocalizedPath("/dashboard/inscripciones")}>Ver todas mis inscripciones</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-2xl">
                      <Link href={buildLocalizedPath("/cursos")}>Explorar más cursos</Link>
                    </Button>
                  </div>
                </div>

                {typeof application?.manualScore === "number" ||
                (Array.isArray(application?.scoreAttachments) && application.scoreAttachments.length) ? (
                  <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4338CA]">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-[#0F172A]">Resultado académico</div>
                        <p className="mt-1 text-sm leading-6 text-[#64748B]">Información oficial cargada por administración.</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3">
                      <div className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                        <span className="text-sm text-[#64748B]">Estado de cursada</span>
                        {completionIcon ? (
                          <Badge
                            color={completionMeta?.tone || "info"}
                            variant="soft"
                            className="gap-1.5 rounded-full"
                          >
                            {(() => {
                              const Icon = completionIcon;
                              return Icon ? <Icon className="h-3 w-3" /> : null;
                            })()}
                            {completionMeta?.title || titleCase(courseStatus)}
                          </Badge>
                        ) : (
                          <Badge color={completionMeta?.tone || "info"} variant="soft" className="rounded-full">
                            {completionMeta?.title || titleCase(courseStatus)}
                          </Badge>
                        )}
                      </div>
                      {typeof application?.manualScore === "number" ? (
                        <div className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3">
                          <span className="text-sm text-[#64748B]">Puntaje final</span>
                          <span className="text-sm font-semibold text-[#0F172A]">{application.manualScore}/100</span>
                        </div>
                      ) : null}
                      {Array.isArray(application?.scoreAttachments) && application.scoreAttachments.length ? (
                        <div className="grid gap-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
                            Material adjunto
                          </div>
                          {application.scoreAttachments.map((attach) => (
                            <div
                              key={String(attach.id || attach.name || Math.random())}
                              className="flex items-center justify-between rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#0F172A]">
                                  {attach.name || "Archivo adjunto"}
                                </div>
                                <div className="text-xs text-[#64748B]">
                                  {formatBytes(attach.sizeBytes)} · {attach.mimeType || "archivo"}
                                  {attach.uploadedAt ? ` · ${dateLabel(attach.uploadedAt)}` : ""}
                                </div>
                              </div>
                              {attach.url ? (
                                <Button
                                  asChild
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 rounded-2xl"
                                >
                                  <a href={attach.url} target="_blank" rel="noreferrer">
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Descargar
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-2 py-8">
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

        <div className="grid gap-6 px-6 py-6 md:grid-cols-1 md:px-8">
          <div className="rounded-[28px] border border-[#E5E7EB] bg-[#FAFAFA] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-[#0F172A]">Datos del alumno</div>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">
                  Podés editar la información asociada a esta inscripción. Los cambios se guardan aquí.
                </p>
              </div>
              <Badge variant="soft" color="info" className="rounded-full">
                Administración
              </Badge>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nombre</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Nombre del alumno"
                    disabled={saving || !institutionAllowsManualManagement}
                    className="rounded-2xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Apellido</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Apellido del alumno"
                    disabled={saving || !institutionAllowsManualManagement}
                    className="rounded-2xl"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@alumno.com"
                  disabled={saving || !institutionAllowsManualManagement}
                  className="rounded-2xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+54..."
                  disabled={saving || !institutionAllowsManualManagement}
                  className="rounded-2xl"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ciudad"
                    disabled={saving || !institutionAllowsManualManagement}
                    className="rounded-2xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Provincia</Label>
                  <Input
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    placeholder="Provincia"
                    disabled={saving || !institutionAllowsManualManagement}
                    className="rounded-2xl"
                  />
                </div>
              </div>
              <div className="grid gap-2 text-xs text-[#64748B]">
                <div>Creada: <span className="font-semibold text-[#0F172A]">{dateLabel(application.createdAt)}</span></div>
                {application?.userId ? <div>UID: <span className="font-mono text-[#0F172A]">{application.userId}</span></div> : null}
              </div>
              <Button
                type="button"
                onClick={handleSaveStudentData}
                disabled={saving || !institutionAllowsManualManagement}
                className="mt-1 rounded-2xl bg-[#0F172A] text-white hover:bg-[#1E293B]"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Guardar datos del alumno
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#EEF2F7] px-6 py-6 md:px-8">
          <div className="rounded-[28px] border border-[#E5E7EB] bg-white p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4338CA]">
                  <Award className="h-3.5 w-3.5" />
                  Gestión académica
                </div>
                <div className="mt-4 text-lg font-semibold text-[#0F172A]">
                  Estado, puntaje y material de apoyo
                </div>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">
                  Solo administración puede modificar estos campos. Al cambiar el estado se envían notificaciones automáticas al alumno,
                  se actualiza el libro de calificaciones y, en caso de aprobar, se genera el certificado.
                </p>
              </div>
              {completionIcon ? (
                <Badge color={completionMeta?.tone || "info"} variant="soft" className="gap-1.5 rounded-full">
                  {(() => {
                    const Icon = completionIcon;
                    return Icon ? <Icon className="h-3 w-3" /> : null;
                  })()}
                  {completionMeta?.title || titleCase(courseStatus)}
                </Badge>
              ) : (
                <Badge color={completionMeta?.tone || "info"} variant="soft" className="rounded-full">
                  {completionMeta?.title || titleCase(courseStatus)}
                </Badge>
              )}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>
                    Estado de cursada <span className="text-rose-600">*</span>
                  </Label>
                  <Select value={courseStatus} onValueChange={(val) => setCourseStatus(val)}>
                    <SelectTrigger
                      disabled={courseStatusSaving || !institutionAllowsManualManagement}
                      className="rounded-2xl"
                    >
                      <SelectValue placeholder="Seleccionar estado de cursada" />
                    </SelectTrigger>
                    <SelectContent>
                      {COURSE_COMPLETION_STATUSES.map((raw) => {
                        const meta = resolveCourseCompletionStatusMeta(raw);
                        return (
                          <SelectItem key={raw} value={raw}>
                            {meta?.title || titleCase(raw)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-5 text-[#64748B]">{completionMeta?.description || ""}</p>
                </div>
                <div className="grid gap-2">
                  <Label>
                    Puntaje final (0 a 100) <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={manualScore}
                    onChange={(e) => setManualScore(e.target.value)}
                    placeholder="Ej: 85"
                    inputMode="numeric"
                    disabled={courseStatusSaving || !institutionAllowsManualManagement}
                    className="rounded-2xl"
                  />
                  <p className="text-xs leading-5 text-[#64748B]">
                    Es obligatorio antes de marcar la cursada como aprobada. Este puntaje se vincula al certificado.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Motivo u observaciones</Label>
                  <Textarea
                    value={courseStatusReason}
                    onChange={(e) => setCourseStatusReason(e.target.value)}
                    placeholder="Motivo de desaprobación, detalle de suspensión o comentarios de aprobación. Se incluye en la notificación al alumno."
                    className="min-h-[120px] rounded-2xl"
                    disabled={courseStatusSaving || !institutionAllowsManualManagement}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Archivos de respaldo (opcional)</Label>
                  <div>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      accept={ALLOWED_SCORE_ATTACHMENT_MIME_TYPES.join(",")}
                      onChange={handleAttachmentUpload}
                      className="hidden"
                      multiple
                    />
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={courseStatusSaving || uploadingAttachment || !institutionAllowsManualManagement}
                      className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-5 text-sm font-medium text-[#0F172A] transition hover:border-[#93A4E9] hover:bg-[#EFF4FF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4 text-[#4338CA]" />
                      <span>
                        {uploadingAttachment ? "Subiendo archivo…" : "Cargar archivo (PDF, DOCX, XLSX, PNG, JPG, JPEG)"}
                      </span>
                    </button>
                    <p className="mt-2 text-xs leading-5 text-[#64748B]">
                      Peso máximo por archivo: {formatBytes(MAX_SCORE_ATTACHMENT_SIZE_BYTES)}. Formatos: {allowedScoreMimeLabel()}.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
                    Adjuntos ({(scoreAttachments || []).length})
                  </div>
                  <div className="grid gap-2">
                    {!(Array.isArray(scoreAttachments) && scoreAttachments.length) ? (
                      <div className="rounded-[18px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 text-xs leading-5 text-[#64748B]">
                        No hay archivos adjuntos. Podés cargar evaluaciones finales, certificados complementarios o material de respaldo.
                      </div>
                    ) : (
                      scoreAttachments.map((attach) => (
                        <div
                          key={String(attach.id || attach.name || Math.random())}
                          className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[#0F172A]">
                              {attach.name || "Archivo adjunto"}
                            </div>
                            <div className="text-xs text-[#64748B]">
                              {formatBytes(attach.sizeBytes)} · {attach.mimeType || "archivo"}
                              {attach.uploadedAt ? ` · ${dateLabel(attach.uploadedAt)}` : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {attach.url ? (
                              <Button
                                asChild
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-xl"
                              >
                                <a href={attach.url} target="_blank" rel="noreferrer">
                                  <FileDown className="h-4 w-4" />
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                              onClick={() => handleRemoveAttachment(attach.id)}
                              disabled={courseStatusSaving || !institutionAllowsManualManagement}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-[#64748B]">
                Al guardar se validan los campos obligatorios, se actualiza el historial académico y se notifica al alumno por email.
              </p>
              <Button
                type="button"
                onClick={handleSaveCourseStatus}
                disabled={courseStatusSaving || !institutionAllowsManualManagement || saving}
                className="w-full rounded-2xl bg-[#4338CA] text-white hover:bg-[#3730A3] sm:w-auto"
              >
                {courseStatusSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Guardar gestión de cursada
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
