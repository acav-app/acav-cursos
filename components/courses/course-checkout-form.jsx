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
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  Receipt,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { APPLICATION_CREATED_EVENT } from "@/components/courses/course-enroll-button";
import { authedFetch } from "@/lib/auth/authed-fetch";

const FALLBACK_PAYMENT_SETTINGS = {
  paymentAlias: "acav.cursos",
  paymentCbu: "00000000000000000",
  paymentCvu: "00000000000000000",
  paymentAccountHolder: "ACAV",
  paymentInstructions:
    "Realiza la transferencia con estos datos. Tu inscripción quedará iniciada y podrás continuar el seguimiento del pago desde tu panel.",
};

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

  const amount = Number(job?.price || 0);
  const requiresPayment = !job?.freeCourse && amount > 0;
  const steps = useMemo(
    () => [
      {
        id: "profile",
        title: "Tu perfil",
        description: "Confirma tus datos personales y de contacto.",
        icon: User,
        fields: ["phone", "city", "province"],
      },
      {
        id: "payment",
        title: "Pago",
        description: "Revisa los datos bancarios y el importe a transferir.",
        icon: Landmark,
        fields: ["paymentMethod"],
      },
      {
        id: "confirmation",
        title: "Confirmación",
        description: "Acepta los términos y confirma tu inscripción.",
        icon: Receipt,
        fields: ["acceptedTerms", "acceptedSecurity"],
      },
    ],
    []
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
        paymentMethod: z.string().min(1, "Método requerido"),
        paymentReference: z.string().optional(),
        acceptedTerms: z.boolean().refine((value) => value === true, { message: "Debes aceptar los términos." }),
        acceptedSecurity: z.boolean().refine((value) => value === true, { message: "Debes confirmar la seguridad." }),
      }),
    []
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
        status: requiresPayment ? "waiting_payment" : "active",
        paymentStatus: requiresPayment ? "pending" : "approved",
        paymentMethod: values.paymentMethod,
        paymentReference: values.paymentReference || undefined,
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
      toast.success(requiresPayment ? "Inscripción iniciada. Pago pendiente." : "Inscripción confirmada.", {
        position: "top-right",
      });
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
          <div className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF3] px-3 py-1 text-[11px] font-bold text-[#127A45]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {requiresPayment ? "Pago pendiente" : "Inscripción activa"}
          </div>

          <h2 className="mt-4 text-[32px] font-semibold tracking-[-0.03em] text-[#0F172A]">
            {requiresPayment ? "Tu inscripción ya quedó iniciada" : "Tu acceso ya quedó confirmado"}
          </h2>

          <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#667085]">
            {requiresPayment
              ? "Registramos tu inscripción. El pago queda pendiente y podrás continuar el seguimiento desde tu panel."
              : "La inscripción se activó automáticamente y ya puedes continuar desde tu panel."}
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
              <div className="mt-1 font-semibold text-[#0F172A]">{requiresPayment ? "Esperando pago" : "Activo"}</div>
            </div>
          </div>

          <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:flex-row">
            {onClose ? (
              <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-[#D7DEEA] text-[#0F172A]">
                Cerrar
              </Button>
            ) : null}
            <Link
              href={createdEnrollmentId ? `/${lang}/dashboard/inscripciones/${createdEnrollmentId}` : `/${lang}/dashboard`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B2B50] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#133778]"
            >
              {createdEnrollmentId ? "Ver inscripción" : "Ir a mi panel"}
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
              <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[14px] border border-[#E5EAF2] bg-[#F8FAFC] text-[#2563EB]">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1 rounded-full border border-[#DCE6F7] bg-[#F8FBFF] px-2.5 py-1 text-[11px] font-bold text-[#1B2B50]">
                  <CreditCard className="h-3 w-3" />
                  Checkout del curso
                </div>
                <h2 className="mt-2 truncate text-[28px] font-semibold tracking-[-0.03em] text-[#0F172A]">
                  {job?.title || "Inscripción"}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">Un proceso corto: perfil, pago y confirmación.</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[13px] text-[#667085]">
                  <span>{job?.companyName || "ACAV"}</span>
                  {amount > 0 ? <span>· {formatCurrency(amount)}</span> : <span>· Gratuito</span>}
                  {job?.duration ? <span>· {job.duration}</span> : null}
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
            <span>{Math.round(progressValue)}%</span>
          </div>
          <Progress value={progressValue} size="sm" color="primary" className="bg-slate-100 [&>div]:bg-[#1B2B50]" />

          <div className="mt-4 grid grid-cols-3 gap-3">
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
                  className="flex items-center gap-3 text-left"
                >
                  <span
                    className={[
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                      completed ? "bg-[#DBEAFE] text-[#2563EB]" : active ? "bg-[#1B2B50] text-white" : "bg-[#F1F5F9] text-[#94A3B8]",
                    ].join(" ")}
                  >
                    {completed ? <CheckCircle2 className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                  </span>
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
          <div className="mb-5 rounded-[20px] border border-[#E5EAF2] bg-[#FAFBFD] p-5">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1B2B50] text-white">
                <ActiveIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Paso activo</div>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#1B2B50]">{steps[currentStep].title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{steps[currentStep].description}</p>
              </div>
            </div>
          </div>

          {currentStep === 0 ? (
            <div className="grid gap-6">
              <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
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
                    <Label>Teléfono</Label>
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
                    <Label>Ciudad</Label>
                    <Input placeholder="Ciudad" className="h-12 rounded-[14px]" {...register("city", { setValueAs: toTitleCase })} />
                    {errors.city ? <p className="text-sm text-destructive">{errors.city.message}</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label>Provincia</Label>
                    <Input placeholder="Provincia" className="h-12 rounded-[14px]" {...register("province", { setValueAs: toTitleCase })} />
                    {errors.province ? <p className="text-sm text-destructive">{errors.province.message}</p> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[#DCE6F7] bg-[#F8FBFF] p-5 text-sm text-[#52607A]">
                Estos datos quedan guardados en tu perfil para no volver a pedirlos en futuras compras.
              </div>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <div className="grid gap-6">
              <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
                <div className="grid gap-3">
                  <div className="text-sm font-semibold text-[#0F172A]">Resumen de compra</div>
                  <div className="grid gap-3 text-sm text-[#475467] md:grid-cols-2">
                    <div><span className="font-semibold text-[#0F172A]">Curso:</span> {job.title}</div>
                    <div><span className="font-semibold text-[#0F172A]">Institución:</span> {job.companyName || "ACAV"}</div>
                    <div><span className="font-semibold text-[#0F172A]">Alumno:</span> {`${firstNameValue} ${lastNameValue}`.trim()}</div>
                    <div><span className="font-semibold text-[#0F172A]">Importe:</span> {requiresPayment ? formatCurrency(amount) : "Gratuito"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
                <div className="text-sm font-semibold text-[#0F172A]">Datos bancarios</div>
                <div className="mt-4 grid gap-3">
                  {[
                    ["Alias", settings.paymentAlias],
                    ["CBU", settings.paymentCbu],
                    ["CVU", settings.paymentCvu],
                    ["Titular", settings.paymentAccountHolder],
                    ["Importe", requiresPayment ? formatCurrency(amount) : "Gratuito"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col gap-3 rounded-[16px] border border-[#E5EAF2] bg-[#FAFBFD] px-4 py-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{label}</div>
                        <div className="mt-1 font-medium text-[#0F172A]">{value}</div>
                      </div>
                      {label !== "Titular" && label !== "Importe" ? (
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => handleCopy(label, value)}>
                          <Copy className="mr-2 h-4 w-4" />
                          {copyState === label ? "Copiado" : `Copiar ${label}`}
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[16px] border border-[#DCE6F7] bg-[#F8FBFF] p-4 text-sm leading-6 text-[#52607A]">
                  {settings.paymentInstructions}
                </div>
                <input type="hidden" {...register("paymentMethod")} value="transferencia" readOnly />
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="grid gap-6">
              {requiresPayment ? (
                <div className="rounded-[20px] border border-[#E5EAF2] bg-white p-5">
                  <div className="rounded-[16px] border border-[#DCE6F7] bg-[#F8FBFF] p-4 text-sm leading-6 text-[#52607A]">
                    No te pediremos el comprobante dentro de este modal. Primero dejamos iniciada tu inscripción y luego podrás seguir el estado del pago desde tu panel.
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Label>Referencia (opcional)</Label>
                    <Input placeholder="Últimos números, banco o aclaración" className="h-12 rounded-[14px]" {...register("paymentReference")} />
                  </div>
                </div>
              ) : (
                <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                  Este curso no requiere pago. Solo confirma tus datos y activaremos tu acceso.
                </div>
              )}

              <div className="rounded-[20px] border border-[#DCE6F7] bg-[#F8FBFF] p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1B2B50]">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">Confirmación final</div>
                    <p className="mt-1 text-xs leading-5 text-[#667085]">
                      {requiresPayment
                        ? "Crearemos tu inscripción con el pago pendiente para que puedas continuar el seguimiento desde tu panel."
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
                        <p className="text-xs leading-5 text-[#667085]">Comprendo que el curso se activará luego de validar los datos y el pago.</p>
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
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span>{draftReady ? "Tu progreso se guarda temporalmente en este dispositivo." : "Preparando borrador temporal..."}</span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={currentStep > 0 ? goBack : onClose || (() => {})}
              className="h-11 rounded-xl border-[#D7DEEA] px-6 text-[#344054]"
            >
              {currentStep > 0 ? "Volver" : "Cerrar"}
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button type="button" onClick={goNext} className="h-11 rounded-xl bg-[#1B2B50] px-6 font-semibold text-white hover:bg-[#133778]">
                Continuar
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" className={`h-11 rounded-xl bg-[#1B2B50] px-6 font-semibold text-white hover:bg-[#133778] ${submitting ? "pointer-events-none" : ""}`}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {submitting ? "Confirmando..." : "Confirmar inscripción"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
