"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  HelpCircle,
  Info,
  Landmark,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { APPLICATION_CREATED_EVENT } from "@/components/courses/course-enroll-button";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

const FALLBACK_PAYMENT_SETTINGS = {
  paymentAlias: "EQUITACION.JADE.PEZ",
  paymentCbu: "2850307140095916661858",
  paymentCvu: "",
  paymentAccountHolder: "Asociación Cordobesa de Agencias de Viajes",
  paymentInstructions:
    "Tu inscripción quedará iniciada y podrás continuar el seguimiento del pago desde tu panel.",
};

// Temporal: ocultar el paso de Pago en el flujo (activar más tarde cambiando a false)
const HIDE_PAYMENT_STEP = false;

function toTitleCase(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizePhone(value) {
  const raw = String(value || "");
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function notifyApplicationCreated(jobId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(APPLICATION_CREATED_EVENT, {
      detail: {
        courseId: String(jobId || "").trim(),
        jobId: String(jobId || "").trim(),
      },
    })
  );
}

export default function CourseCheckoutForm({ lang, job, variant = "modal", onClose = null, onSubmittedChange = null }) {
  const { user } = useAuth();
  const { actor } = useCourseActor();
  const isModal = variant === "modal";
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState(FALLBACK_PAYMENT_SETTINGS);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdEnrollmentId, setCreatedEnrollmentId] = useState("");
  const [copyState, setCopyState] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);

  const amount = Number(job?.price || 0);
  const requiresPayment = !job?.freeCourse && amount > 0;
  const hasReceipt = Boolean(receiptUrl);
  const steps = useMemo(
    () => {
      const allSteps = [
        {
          id: "profile",
          title: "Tu perfil",
          description: "Confirma tus datos personales y de contacto.",
          icon: User,
          fields: ["phone", "city", "province"],
        },
        (requiresPayment && !HIDE_PAYMENT_STEP) ? {
          id: "payment",
          title: "Pago",
          description: "Revisa los datos bancarios y el importe a transferir.",
          icon: Landmark,
          fields: ["paymentMethod"],
        } : null,
        {
          id: "confirmation",
          title: "Confirmación",
          description: "Acepta los términos y confirma tu inscripción.",
          icon: Receipt,
          fields: ["acceptedTerms", "acceptedSecurity"],
        },
      ];
      return allSteps.filter(Boolean);
    },
    [requiresPayment]
  );

  const schema = useMemo(
    () =>
      z.object({
        firstName: z.string().min(2, "Nombre requerido"),
        lastName: z.string().min(2, "Apellido requerido"),
        email: z.string().email("Email inválido"),
        phone: z
          .string()
          .min(6, "Teléfono requerido")
          .refine((value) => String(value || "").replace(/\D/g, "").length >= 6, "Teléfono inválido"),
        city: z.string().min(2, "Ciudad requerida"),
        province: z.string().min(2, "Provincia requerida"),
        paymentMethod: requiresPayment
          ? z.string().min(1, "Método requerido")
          : z.string().optional(),
        paymentReference: z.string().optional(),
        acceptedTerms: z.boolean().refine((value) => value === true, { message: "Debes aceptar los términos." }),
        acceptedSecurity: z.boolean().refine((value) => value === true, { message: "Debes confirmar la seguridad." }),
      }),
    [requiresPayment]
  );

  const draftKey = useMemo(() => `course-checkout-draft:${job?.id || "global"}`, [job?.id]);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      city: "",
      province: "",
      paymentMethod: "transferencia",
      paymentReference: "",
      acceptedTerms: false,
      acceptedSecurity: false,
    },
    mode: "onChange",
  });

  const watchedValues = watch(["firstName", "lastName", "email", "phone", "city", "province", "paymentReference", "acceptedTerms", "acceptedSecurity"]);
  const [firstNameValue, lastNameValue, emailValue, phoneValue, cityValue, provinceValue, paymentReferenceValue, acceptedTermsValue, acceptedSecurityValue] = watchedValues;

  useEffect(() => {
    let alive = true;
    async function loadSettings() {
      try {
        const res = await fetch("/api/courses/settings", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive || !res.ok) return;
        setSettings({ ...FALLBACK_PAYMENT_SETTINGS, ...(data?.settings || {}) });
      } catch {
        if (!alive) return;
        setSettings(FALLBACK_PAYMENT_SETTINGS);
      }
    }
    loadSettings();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const actorFirstName = String(actor?.firstName || "").trim();
    const actorLastName = String(actor?.lastName || "").trim();
    const displayName = String(actor?.displayName || user?.displayName || "").trim();
    const displayNameParts = displayName.split(/\s+/).filter(Boolean);
    const inferredFirstName = actorFirstName || displayNameParts.slice(0, 1).join(" ");
    const inferredLastName = actorLastName || displayNameParts.slice(1).join(" ");

    const currentValues = getValues();
    reset({
      ...currentValues,
      firstName: toTitleCase(inferredFirstName || currentValues.firstName),
      lastName: toTitleCase(inferredLastName || currentValues.lastName),
      email: normalizeEmail(actor?.email || user?.email || currentValues.email),
      phone: String(actor?.phone || currentValues.phone || "").trim(),
      city: toTitleCase(actor?.city || currentValues.city),
      province: toTitleCase(actor?.province || currentValues.province),
      paymentMethod: "transferencia",
    });
  }, [actor, getValues, reset, user?.displayName, user?.email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const currentValues = getValues();
        reset({
          ...currentValues,
          ...parsed,
        });
      }
    } catch {
      // Ignore malformed drafts.
    } finally {
      setDraftReady(true);
    }
  }, [draftKey, getValues, reset]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftReady || submitted) return;
    window.localStorage.setItem(
      draftKey,
      JSON.stringify({
        firstName: firstNameValue,
        lastName: lastNameValue,
        email: emailValue,
        phone: phoneValue,
        city: cityValue,
        province: provinceValue,
        paymentReference: paymentReferenceValue,
        acceptedTerms: acceptedTermsValue,
        acceptedSecurity: acceptedSecurityValue,
      })
    );
  }, [
    acceptedSecurityValue,
    acceptedTermsValue,
    cityValue,
    draftKey,
    draftReady,
    emailValue,
    firstNameValue,
    lastNameValue,
    paymentReferenceValue,
    phoneValue,
    provinceValue,
    submitted,
  ]);

  useEffect(() => {
    onSubmittedChange?.(submitted);
  }, [onSubmittedChange, submitted]);

  const goNext = async () => {
    const valid = await trigger(steps[currentStep].fields);
    if (!valid) return;
    setCurrentStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const goBack = () => {
    setCurrentStep((value) => Math.max(value - 1, 0));
  };

  useEffect(() => {
    setCurrentStep((current) => Math.min(current, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  const handleCopy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      setCopyState(label);
      toast.success(`${label} copiado`, { position: "top-right" });
      window.setTimeout(() => setCopyState(""), 1400);
    } catch {
      toast.error("No pudimos copiar el dato.", { position: "top-right" });
    }
  };

  const handleReceiptFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("El comprobante no puede superar los 10MB.", { position: "top-right" });
      return;
    }
    const allowed = new Set([
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]);
    if (!allowed.has(file.type)) {
      toast.error("Solo se admiten PDF, JPG, PNG o WEBP.", { position: "top-right" });
      return;
    }

    try {
      setReceiptFile(file);
      setReceiptUploading(true);
      const result = await uploadToR2(file, "payment-receipts");
      const url = result?.url;
      setReceiptUrl(normalizePublicR2Url(url));
      toast.success("Comprobante cargado correctamente.", { position: "top-right" });
    } catch (error) {
      setReceiptFile(null);
      toast.error(error?.message || "No pudimos subir el comprobante.", { position: "top-right" });
    } finally {
      setReceiptUploading(false);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptUrl("");
  };

  const onSubmit = async (values) => {
    if (!user) {
      toast.error("Necesitas iniciar sesión para continuar.", { position: "top-right" });
      return;
    }

    try {
      setSubmitting(true);

      await authedFetch(user, "/api/courses/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          city: values.city,
          province: values.province,
        }),
      }).catch(() => null);

      const payload = {
        userId: actor?.uid || user?.uid || undefined,
        courseId: job.id,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        city: values.city,
        province: values.province,
        acceptedPrivacy: true,
        status: requiresPayment
          ? hasReceipt
            ? "payment_under_review"
            : "waiting_payment"
          : "active",
        paymentStatus: requiresPayment
          ? hasReceipt
            ? "under_review"
            : "pending"
          : "approved",
        paymentMethod: values.paymentMethod,
        paymentReference: values.paymentReference || undefined,
        paymentReceiptUrl: receiptUrl || undefined,
        paymentAmount: amount || 0,
        paymentCurrency: "ARS",
      };

      const response = await authedFetch(user, "/api/enrollments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreatedEnrollmentId(String(response?.enrollment?.id || ""));

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
      notifyApplicationCreated(job.id);
      setSubmitted(true);
      if (!requiresPayment) {
        toast.success("Inscripción confirmada.", { position: "top-right" });
      } else if (hasReceipt) {
        toast.success("Comprobante recibido. En revisión.", { position: "top-right" });
      } else {
        toast.success("Inscripción iniciada. Pago pendiente.", { position: "top-right" });
      }
    } catch (error) {
      if (error?.message === "enrollment_already_exists" || error?.message === "application_already_exists") {
        notifyApplicationCreated(job.id);
        toast("Ya estás inscripto en este curso.", { icon: "i", position: "top-right" });
        return;
      }
      toast.error(error?.message || "No pudimos completar la inscripción.", { position: "top-right" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`relative flex items-center justify-center px-6 py-8 md:px-10 ${isModal ? "h-full" : "min-h-[560px]"}`}>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E6EBF4] text-[#64748B] transition hover:bg-slate-50"
            aria-label="Cerrar checkout"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div className="mx-auto flex w-full max-w-[620px] flex-col items-center text-center">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold ${!requiresPayment
              ? "bg-[#ECFDF3] text-[#127A45]"
              : hasReceipt
                ? "bg-[#FFF8E6] text-[#92610C]"
                : "bg-[#EEF4FF] text-[#2356B8]"
              }`}
          >
            {!requiresPayment ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Inscripción activa
              </>
            ) : hasReceipt ? (
              <>
                <Receipt className="h-3.5 w-3.5" />
                Comprobante en revisión
              </>
            ) : (
              <>
                <CreditCard className="h-3.5 w-3.5" />
                Pago pendiente
              </>
            )}
          </div>

          <h2 className="mt-4 text-[32px] font-semibold tracking-[-0.03em] text-[#0F172A]">
            {!requiresPayment
              ? "Tu acceso ya quedó confirmado"
              : hasReceipt
                ? "Recibimos tu comprobante de pago"
                : "Tu inscripción ya quedó iniciada"}
          </h2>

          <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#667085]">
            {!requiresPayment
              ? "La inscripción se activó automáticamente y ya puedes continuar desde tu panel."
              : hasReceipt
                ? "El equipo administrativo está validando tu pago. Recibirás una novedad apenas se apruebe."
                : "Registramos tu inscripción. El pago queda pendiente y podrás continuar el seguimiento desde tu panel."}
          </p>

          <div className="mt-8 grid w-full gap-3 rounded-[22px] border border-[#E6EBF4] bg-[#FAFBFD] p-5 text-left text-sm md:grid-cols-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Curso</div>
              <div className="mt-1 font-semibold text-[#0F172A]">{job.title}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Alumno</div>
              <div className="mt-1 font-semibold text-[#0F172A]">{`${firstNameValue} ${lastNameValue}`.trim()}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Estado</div>
              <div className="mt-1 font-semibold text-[#0F172A]">
                {!requiresPayment ? "Activo" : hasReceipt ? "En revisión" : "Esperando pago"}
              </div>
            </div>
          </div>

          <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:flex-row">
            {onClose ? (
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-[#D7DEEA] text-[#0F172A]">
                Cerrar
              </Button>
            ) : null}
            <Link
              href={createdEnrollmentId ? `/${lang}/dashboard/mis-cursos/${createdEnrollmentId}` : `/${lang}/dashboard/mis-cursos`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B2B50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#133778]"
            >
              {createdEnrollmentId ? "Ir al curso" : "Ir a mis cursos"}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const ActiveIcon = steps[currentStep].icon;
  const progressValue = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="h-full">
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col overflow-hidden bg-white">
        <div className="border-b border-[#EEF2F7] px-5 py-5 md:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[14px] border border-[#E5EAF2] bg-gradient-to-br from-[#EEF4FF] to-[#F8FBFF] text-[#1B2B50] shadow-[0_12px_28px_rgba(27,43,80,0.08)]">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="soft" color="info" className="rounded-full">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Inscripción simple, {steps.length} pasos
                  </Badge>
                  {job?.institutionPlanTier || job?.accreditations?.length ? (
                    <Badge variant="soft" color="success" className="rounded-full">
                      Certificado oficial
                    </Badge>
                  ) : null}
                </div>
                <h2 className="mt-2 truncate text-[28px] font-semibold tracking-[-0.03em] text-[#0F172A]">
                  {job?.title || "Inscripción"}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">Completá el proceso y accedé a tu cursada en segundos.</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-[#667085]">
                  <span className="inline-flex items-center gap-1">
                    <Landmark className="h-3.5 w-3.5 text-[#1B2B50]" />
                    {job?.companyName || "ACAV"}
                  </span>
                  {job?.oldPrice && Number(job.oldPrice) !== Number(job?.price) ? (
                    <>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="text-sm font-bold text-[#1B2B50]">{formatCurrency(job.oldPrice)} <span className="text-[10px] font-semibold text-[#1B2B50]/70">Público general</span></span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="font-semibold text-[#1B2B50]">{formatCurrency(amount)} <span className="text-[10px] font-semibold text-[#1B2B50]/70">Socios</span></span>
                    </>
                  ) : (
                    <>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span className="font-semibold text-[#0F172A]">
                        {amount > 0 ? formatCurrency(amount) : "Gratuito"}
                      </span>
                    </>
                  )}
                  {job?.duration ? (
                    <>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{job.duration}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E6EBF4] text-[#64748B] transition hover:bg-slate-50"
                aria-label="Cerrar checkout"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="border-b border-[#EEF2F7] px-5 py-4 md:px-7">
          <div className="mb-3 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
            <span>Paso {currentStep + 1} de {steps.length}</span>
            <span>{Math.round(progressValue)}% completado</span>
          </div>
          <Progress value={progressValue} size="sm" color="primary" className="bg-slate-100 [&>div]:bg-[#1B2B50]" />

          <div className={`mt-4 grid gap-3 ${steps.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {steps.map((step, index) => {
              const completed = index < currentStep;
              const active = index === currentStep;
              const StepIcon = step.icon;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (index <= currentStep) setCurrentStep(index);
                  }}
                  className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2 text-left transition hover:bg-slate-50"
                  disabled={index > currentStep}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={[
                          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                          completed
                            ? "bg-[#1B2B50] text-white shadow-[0_10px_24px_rgba(27,43,80,0.24)]"
                            : active
                              ? "bg-[#1B2B50] text-white"
                              : "bg-[#F1F5F9] text-[#94A3B8]",
                        ].join(" ")}
                      >
                        {completed ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="font-semibold">{step.title}</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-100/90">{step.description}</div>
                    </TooltipContent>
                  </Tooltip>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-semibold ${active ? "text-[#1B2B50]" : "text-[#94A3B8]"}`}>{step.title}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-[#94A3B8]">{step.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 md:px-7 md:py-7">
          {/* <div className="mb-5 rounded-[20px] border border-[#E5EAF2] bg-gradient-to-br from-[#F8FBFF] via-white to-[#FAFBFD] p-5">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1B2B50] text-white shadow-[0_12px_30px_rgba(27,43,80,0.24)]">
                <ActiveIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Paso activo</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:text-slate-700">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="font-semibold">¿Qué hago en este paso?</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-100/90">{steps[currentStep].description}</div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#1B2B50]">{steps[currentStep].title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{steps[currentStep].description}</p>
              </div>
            </div>
          </div> */}

          {steps[currentStep]?.id === "profile" ? (
            <div className="grid gap-6">
              <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold text-[#0F172A]">Tus datos personales</div>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">
                      Los campos de tu perfil se completan automáticamente. Modificá solo lo que necesites.
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE6F7] bg-[#F8FBFF] px-2.5 py-1 text-[11px] font-semibold text-[#1B2B50]">
                        <Info className="h-3 w-3" />
                        ¿Por qué pedimos esto?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="max-w-xs leading-5">
                        <div className="font-semibold">Para validar tu certificado</div>
                        <div className="mt-1 text-[11px] text-slate-100/90">
                          Estos datos se usan solo para identificar tu certificación oficial y comunicar novedades de tu cursada.
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Nombre</Label>
                    <Input value={firstNameValue || ""} readOnly className="h-12 rounded-[14px] bg-slate-50" {...register("firstName", { setValueAs: toTitleCase })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Apellido</Label>
                    <Input value={lastNameValue || ""} readOnly className="h-12 rounded-[14px] bg-slate-50" {...register("lastName", { setValueAs: toTitleCase })} />
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input value={emailValue || ""} readOnly className="h-12 rounded-[14px] bg-slate-50" {...register("email", { setValueAs: normalizeEmail })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>
                      Teléfono{" "}
                      <span className="text-[11px] font-normal text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="+54 9 351..."
                      className="h-12 rounded-[14px]"
                      inputMode="tel"
                      {...register("phone", { setValueAs: normalizePhone })}
                    />
                    {errors.phone ? <p className="text-sm text-destructive">{errors.phone.message}</p> : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>
                      Ciudad{" "}
                      <span className="text-[11px] font-normal text-destructive">*</span>
                    </Label>
                    <Input placeholder="Ej. Córdoba" className="h-12 rounded-[14px]" {...register("city", { setValueAs: toTitleCase })} />
                    {errors.city ? <p className="text-sm text-destructive">{errors.city.message}</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label>
                      Provincia{" "}
                      <span className="text-[11px] font-normal text-destructive">*</span>
                    </Label>
                    <Input placeholder="Ej. Córdoba" className="h-12 rounded-[14px]" {...register("province", { setValueAs: toTitleCase })} />
                    {errors.province ? <p className="text-sm text-destructive">{errors.province.message}</p> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[#DCE6F7] bg-gradient-to-br from-[#F8FBFF] to-white p-5 text-sm text-[#52607A]">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1B2B50] ring-1 ring-[#DCE6F7]">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-semibold text-[#1B2B50]">Tu perfil se actualiza automáticamente</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Cuando confirmes, guardamos estos datos en tu cuenta para la próxima inscripción y no tengas que volver a escribirlos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {steps[currentStep]?.id === "payment" ? (
            <div className="grid gap-6">
              {requiresPayment ? (
                <>
                  <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-[#0F172A]">Datos para la transferencia</div>
                        <p className="mt-1 text-xs leading-5 text-[#667085]">Usá el botón copiar y luego pegá en tu banco.</p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700">
                            <Info className="h-4 w-4" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="max-w-xs leading-5">
                            El importe es el mismo para cualquier método de envío. Si tu banco acepta alias, CBU o CVU, usá el que te sea más cómodo.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="grid gap-3">
                      {[
                        ["Alias", settings.paymentAlias],
                        ["CBU", settings.paymentCbu],
                        ["Titular", settings.paymentAccountHolder],
                      ].map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-3 rounded-[16px] border border-[#E5EAF2] bg-[#FAFBFD] px-4 py-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                            <div className="mt-0.5 truncate font-medium text-[#0F172A]">{value}</div>
                          </div>
                          {label !== "Titular" ? (
                            <Button type="button" variant="outline" className="rounded-xl" onClick={() => handleCopy(label, value)}>
                              <Copy className="mr-2 h-4 w-4" />
                              {copyState === label ? "Copiado ✓" : `Copiar ${label}`}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 rounded-[16px] border border-[#DCE6F7] bg-gradient-to-br from-[#F8FBFF] to-white p-4 text-sm leading-6 text-[#52607A]">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1B2B50] ring-1 ring-[#DCE6F7]">
                          <Landmark className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="font-semibold text-[#1B2B50]">Información importante</div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{settings.paymentInstructions}</p>
                        </div>
                      </div>
                    </div>
                    <input type="hidden" {...register("paymentMethod")} value="transferencia" readOnly />
                  </div>
                </>
              ) : (
                <div className="rounded-[20px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-sm text-emerald-800">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-200">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-base font-semibold text-emerald-900">Este curso no requiere pago</div>
                      <p className="mt-1 text-xs leading-5 text-emerald-700">
                        Confirmá tus datos en el próximo paso y te damos acceso de inmediato a todo el contenido.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {requiresPayment ? (
                <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF8E6] text-[#92610C] ring-1 ring-[#FDE68A]">
                      <Receipt className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-[#0F172A]">Adjuntar comprobante</div>
                        <Badge variant="soft" color="secondary" className="rounded-full">opcional</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#667085]">
                        Si ya hiciste la transferencia, subí el comprobante y aceleramos la aprobación. También podés adjuntarlo después desde tu panel.
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700">
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <div className="max-w-xs leading-5">
                          Si no tienes el comprobante a mano, no te preocupes: podés subirlo más tarde desde tu ficha de inscripción.
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="mt-5">
                    {receiptUrl ? (
                      <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-200">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-emerald-900">
                                {receiptFile?.name || "Comprobante adjunto"}
                              </div>
                              <div className="mt-0.5 text-xs text-emerald-700">
                                Se envía con tu inscripción para validación manual.
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              asChild
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            >
                              <a href={receiptUrl} target="_blank" rel="noreferrer">
                                Ver
                              </a>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                              onClick={handleRemoveReceipt}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Quitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed px-6 py-7 text-center transition ${receiptUploading
                          ? "border-amber-300 bg-amber-50/50"
                          : "border-[#DCE6F7] bg-gradient-to-br from-[#F8FBFF] to-white hover:border-[#2356B8]/40 hover:bg-[#EEF4FF]/60"
                          }`}
                      >
                        <span
                          className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${receiptUploading ? "bg-white text-amber-600 ring-1 ring-amber-200" : "bg-white text-[#1B2B50] ring-1 ring-[#DCE6F7]"
                            }`}
                        >
                          {receiptUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Upload className="h-5 w-5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#1B2B50]">
                            {receiptUploading ? "Subiendo comprobante..." : "Seleccionar comprobante"}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[#667085]">
                            PDF, JPG, PNG o WEBP · máximo 10MB
                          </div>
                        </div>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                          className="hidden"
                          disabled={receiptUploading}
                          onChange={handleReceiptFileChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {steps[currentStep]?.id === "confirmation" ? (
            <div className="grid gap-6">
              <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-[#0F172A]">Resumen de tu inscripción</div>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">Confirmá los datos antes de finalizar.</p>
                  </div>
                  {receiptUrl ? (
                    <Badge variant="soft" color="success" className="rounded-full">
                      <FileText className="mr-1 h-3 w-3" />
                      Comprobante incluido
                    </Badge>
                  ) : requiresPayment ? (
                    <Badge variant="soft" color="warning" className="rounded-full">
                      <Clock3 className="mr-1 h-3 w-3" />
                      Pago pendiente
                    </Badge>
                  ) : (
                    <Badge variant="soft" color="success" className="rounded-full">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Acceso inmediato
                    </Badge>
                  )}
                </div>
                <div className="rounded-[20px] border border-[#E5EAF2] bg-white divide-y divide-[#E5EAF2]">
                  <div className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Curso</div>
                    <div className="text-sm font-semibold text-right text-[#0F172A]">{job.title}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Alumno</div>
                    <div className="text-sm font-semibold text-right text-[#0F172A]">{`${firstNameValue} ${lastNameValue}`.trim()}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Institución</div>
                    <div className="text-sm font-semibold text-right text-[#0F172A]">{job.companyName || "ACAV"}</div>
                  </div>
                  <div className={`flex items-center justify-between gap-4 px-5 py-3 ${requiresPayment ? "" : "bg-emerald-50/50"}`}>
                    <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${requiresPayment ? "text-[#1B2B50]/70" : "text-emerald-700"}`}>Valores</div>
                    <div className="text-right">
                      {requiresPayment && job?.oldPrice && Number(job.oldPrice) !== Number(job?.price) ? (
                        <div className="space-y-0.5">
                           <div className="text-sm font-bold text-[#1B2B50]">{formatCurrency(job.oldPrice)} <span className="text-[10px] font-semibold text-[#1B2B50]/70">Público general</span></div>
                          <div className="text-sm font-bold text-[#1B2B50]">{formatCurrency(amount)} <span className="text-[10px] font-semibold text-[#1B2B50]/70">Socios</span></div>
                        </div>
                      ) : (
                        <div className={`text-sm font-bold ${requiresPayment ? "text-[#1B2B50]" : "text-emerald-800"}`}>
                          {amount > 0 ? formatCurrency(amount) : "Gratuito"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* {requiresPayment ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-1.5">
                        Referencia de pago
                        <Badge variant="soft" color="secondary" className="rounded-full text-[10px]">opcional</Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <div className="max-w-xs leading-5 text-[11px]">
                              Podés anotar últimos dígitos de la operación, banco o cualquier dato que ayude a identificar tu transferencia.
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input placeholder="Ej. últimos 4 números, banco Nación" className="h-12 rounded-[14px]" {...register("paymentReference")} />
                    </div>
                    <div className="rounded-[16px] border border-[#DCE6F7] bg-gradient-to-br from-[#F8FBFF] to-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1B2B50] ring-1 ring-[#DCE6F7]">
                          <Landmark className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0F172A]">
                            {receiptUrl ? "Comprobante adjuntado ✓" : "Recordá transferir los datos bancarios"}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {receiptUrl
                              ? "Tu comprobante se envía junto a la inscripción para validación manual."
                              : "Podés adjuntar el comprobante después desde tu panel de inscripciones."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null} */}
              </div>

              <div className="rounded-[20px] border border-[#DCE6F7] bg-[#F8FBFF] p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1B2B50] ring-1 ring-[#DCE6F7]">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-[#0F172A]">Confirmación final</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs leading-5 text-[11px]">
                            {requiresPayment
                              ? "Tu inscripción queda creada y el equipo administrativo valida el pago."
                              : "El curso se activa instantáneamente y podés empezar la cursada."}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">
                      {requiresPayment
                        ? "Crearemos tu inscripción para que puedas continuar el seguimiento desde tu panel."
                        : "Al confirmar, tu curso quedará disponible de inmediato."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="acceptedTerms-checkout"
                        checked={Boolean(acceptedTermsValue)}
                        onCheckedChange={(value) => setValue("acceptedTerms", Boolean(value), { shouldValidate: true, shouldDirty: true })}
                        className="mt-0.5"
                      />
                      <div className="grid gap-1">
                        <Label htmlFor="acceptedTerms-checkout" className="text-sm font-semibold text-[#0F172A]">
                          Acepto términos y condiciones
                        </Label>
                        <p className="text-xs leading-5 text-[#667085]">Autorizo el uso de la plataforma y la gestión de esta inscripción.</p>
                        {errors.acceptedTerms ? <p className="text-sm text-destructive">{errors.acceptedTerms.message}</p> : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="acceptedSecurity-checkout"
                        checked={Boolean(acceptedSecurityValue)}
                        onCheckedChange={(value) => setValue("acceptedSecurity", Boolean(value), { shouldValidate: true, shouldDirty: true })}
                        className="mt-0.5"
                      />
                      <div className="grid gap-1">
                        <Label htmlFor="acceptedSecurity-checkout" className="text-sm font-semibold text-[#0F172A]">
                          Confirmo la validez de la información
                        </Label>
                        <p className="text-xs leading-5 text-[#667085]">
                          {requiresPayment
                            ? "Comprendo que el curso se activará luego de validar el comprobante de pago."
                            : "Comprendo que mis datos se validan para emitir el certificado."}
                        </p>
                        {errors.acceptedSecurity ? <p className="text-sm text-destructive">{errors.acceptedSecurity.message}</p> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 border-t border-[#EEF2F7] bg-[#FCFDFE] px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-3 text-sm text-[#667085]">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB] cursor-help">
                  <ShieldCheck className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="max-w-xs leading-5 text-[11px]">
                  Tu progreso se guarda automáticamente en este navegador. Si cerrás esta ventana, tus datos estarán cuando vuelvas.
                </div>
              </TooltipContent>
            </Tooltip>
            <span>{draftReady ? "Tu progreso se guarda temporalmente en este dispositivo." : "Preparando borrador temporal..."}</span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={currentStep > 0 ? goBack : onClose || (() => { })}
                    className="h-11 rounded-xl border-[#D7DEEA] px-6 text-[#344054]"
                  >
                    {currentStep > 0 ? "Volver" : "Cerrar"}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="text-[11px]">
                  {currentStep > 0 ? "Volver al paso anterior sin perder lo cargado." : "Cerrar este formulario. Tus datos se guardan como borrador."}
                </div>
              </TooltipContent>
            </Tooltip>

            {currentStep < steps.length - 1 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button type="button" onClick={goNext} className="h-11 rounded-xl bg-[#1B2B50] px-6 font-semibold text-white hover:bg-[#133778]">
                      Continuar
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-[11px]">
                    Valida los campos actuales y avanza al siguiente paso.
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button type="submit" className={`h-11 rounded-xl bg-[#1B2B50] px-6 font-semibold text-white hover:bg-[#133778] ${submitting ? "pointer-events-none" : ""}`}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {submitting ? "Confirmando..." : "Confirmar inscripción"}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="max-w-xs text-[11px] leading-5">
                    {requiresPayment
                      ? "Crea tu inscripción y envía los datos para validación. Si adjuntaste comprobante, empieza la revisión."
                      : "Activa tu curso inmediatamente y accedé al contenido."}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
