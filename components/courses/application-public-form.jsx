"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronRight,
  CheckCircle2,
  FileUp,
  FileText,
  Loader2,
  Link2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import FilePreview from "@/components/courses/file-preview";
import { APPLICATION_CREATED_EVENT } from "@/components/courses/course-enroll-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

const schema = z.object({
  firstName: z.string().min(2, "Nombre es obligatorio"),
  lastName: z.string().min(2, "Apellido es obligatorio"),
  email: z
    .string()
    .email("Email inválido")
    .refine((value) => !/\s/.test(value), { message: "Email inválido" })
    .refine((value) => !/\.\./.test(value), { message: "Email inválido" }),
  phone: z
    .string()
    .min(6, "Teléfono es obligatorio")
    .refine((value) => {
      const digits = String(value || "").replace(/\D/g, "");
      return digits.length >= 6 && digits.length <= 15;
    }, { message: "Teléfono inválido" }),
  city: z.string().min(2, "Ciudad es obligatoria"),
  province: z.string().min(2, "Provincia es obligatoria"),
  cvFile: z
    .any()
    .refine((fileList) => fileList && fileList.length === 1, "La documentacion adjunta es obligatoria"),
  linkedinUrl: z.string().url("LinkedIn inválido").optional().or(z.literal("")),
  portfolioUrl: z.string().url("Portfolio inválido").optional().or(z.literal("")),
  message: z.string().optional(),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: "Debes aceptar términos y condiciones",
  }),
  acceptedSecurity: z.boolean().refine((value) => value === true, {
    message: "Debes aceptar protocolos de seguridad",
  }),
});

function uploadFileWithProgress(file, folder, onProgress) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onProgress?.(percent);
    };

    xhr.onerror = () => reject(new Error("upload_failed"));
    xhr.onabort = () => reject(new Error("upload_aborted"));
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "null");
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(data?.url);
        return;
      }
      reject(new Error(data?.error || "upload_failed"));
    };

    xhr.send(formData);
  });
}

const steps = [
  {
    id: "perfil",
    title: "Tu perfil",
    description: "Datos de contacto y ubicación",
    icon: User,
    fields: ["firstName", "lastName", "email", "phone", "city", "province"],
  },
  {
    id: "cv",
    title: "Documentacion",
    description: "Adjunta documentacion y suma enlaces",
    icon: Briefcase,
    fields: ["cvFile", "linkedinUrl", "portfolioUrl", "message"],
  },
  {
    id: "confirmacion",
    title: "Confirmación",
    description: "Revisión final y consentimiento",
    icon: ShieldCheck,
    fields: ["acceptedTerms", "acceptedSecurity"],
  },
];

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const provinceSuggestions = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

function stripDiacritics(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeWhitespace(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function toTitleCase(value) {
  const input = normalizeWhitespace(value);
  if (!input) return "";
  return input
    .split(" ")
    .map((word) => {
      const w = word.trim();
      if (!w) return "";
      const lower = w.toLocaleLowerCase("es");
      return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
    })
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

  if (digits.startsWith("0054")) {
    return `+54${digits.slice(4)}`;
  }
  if (digits.startsWith("54") && digits.length >= 11) {
    return `+54${digits.slice(2)}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return `+54${digits.slice(1)}`;
  }
  return hasPlus ? `+${digits}` : digits;
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

function normalizeLocation(value, canonicalList = []) {
  const raw = toTitleCase(value);
  if (!raw) return "";
  const key = stripDiacritics(raw).toLowerCase();
  const match = (Array.isArray(canonicalList) ? canonicalList : []).find((item) => {
    const normalized = stripDiacritics(item).toLowerCase();
    return normalized === key;
  });
  return match || raw;
}

const cityToProvince = {
  "cordoba": "Córdoba",
  "cordoba capital": "Córdoba",
  "villa carlos paz": "Córdoba",
  "rio cuarto": "Córdoba",
  "río cuarto": "Córdoba",
  "alta gracia": "Córdoba",
  "villa maria": "Córdoba",
  "villa maría": "Córdoba",
  "mendoza": "Mendoza",
  "rosario": "Santa Fe",
  "santa fe": "Santa Fe",
  "san miguel de tucuman": "Tucumán",
  "san miguel de tucumán": "Tucumán",
  "la plata": "Buenos Aires",
  "mar del plata": "Buenos Aires",
  "buenos aires": "Buenos Aires",
  "ciudad autonoma de buenos aires": "Buenos Aires",
  "caba": "Buenos Aires",
};

function uniqueSorted(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es"));
}

export default function ApplicationPublicForm({ lang, job, variant = "page", onClose = null, onSubmittedChange = null }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [cvRestorationNeeded, setCvRestorationNeeded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("idle");
  const [citySuggestions, setCitySuggestions] = useState(() => uniqueSorted([job?.city]));
  const provinceManualRef = useRef(false);
  const isModal = variant === "modal";
  const fileInputRef = useRef(null);
  const draftKey = useMemo(() => `course-enrollment-draft:${job?.id || "global"}`, [job?.id]);
  const cityListId = useMemo(() => `city-suggestions-${job?.id || "global"}`, [job?.id]);
  const provinceListId = useMemo(() => `province-suggestions-${job?.id || "global"}`, [job?.id]);

  const defaultValues = useMemo(
    () => ({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      city: "",
      province: "",
      cvFile: null,
      linkedinUrl: "",
      portfolioUrl: "",
      message: "",
      acceptedTerms: false,
      acceptedSecurity: false,
    }),
    []
  );

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    trigger,
    clearErrors,
    watch,
    formState: { errors, dirtyFields, touchedFields },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const cvFileList = watch("cvFile");
  const cvFile = cvFileList?.[0] || null;
  const watchedDraftValues = watch(["firstName", "lastName", "email", "phone", "city", "province", "linkedinUrl", "portfolioUrl", "message", "acceptedTerms", "acceptedSecurity"]);
  const [firstNameValue, lastNameValue, emailValue, phoneValue, cityValue, provinceValue, linkedinValue, portfolioValue, messageValue, acceptedTermsValue, acceptedSecurityValue] =
    watchedDraftValues;
  const progressValue = ((currentStep + 1) / steps.length) * 100;
  const currentStepMeta = steps[currentStep];
  const ActiveStepIcon = currentStepMeta.icon;
  const candidateDisplayName = [firstNameValue, lastNameValue].filter(Boolean).join(" ").trim() || "Tu nombre completo";
  const locationDisplay = [cityValue, provinceValue].filter(Boolean).join(", ") || "Ciudad y provincia";
  const profileReady = Boolean(firstNameValue && lastNameValue && emailValue && phoneValue && cityValue && provinceValue);
  const cvReady = Boolean(cvFile);
  const confirmationReady = Boolean(acceptedTermsValue && acceptedSecurityValue);
  const statusCards = [
    { label: "Perfil", ready: profileReady, helper: profileReady ? candidateDisplayName : "Completá tus datos" },
    { label: "Archivo", ready: cvReady, helper: cvReady ? cvFile?.name : "Adjunta tu documentacion" },
    { label: "Confirmación", ready: confirmationReady, helper: confirmationReady ? "Consentimiento listo para enviar" : "Aceptá ambos checks obligatorios" },
  ];
  const showUploadProgress = submitting || uploadProgress > 0;
  const uploadStageLabel =
    uploadStage === "uploading"
      ? `Subiendo archivo... ${uploadProgress}%`
      : uploadStage === "processing"
        ? "Registrando inscripcion..."
        : uploadStage === "done"
          ? "Archivo listo"
          : "";
  const modalLogoUrl = useMemo(() => normalizePublicR2Url(job?.companyLogoUrl || ""), [job?.companyLogoUrl]);
  const modalCompanyInitials = String(job?.companyName || "AC")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0))
    .join("")
    .toUpperCase() || "AC";
  const modalMetaItems = [
    job?.companyName ? { icon: Building2, label: job.companyName } : null,
    job?.city ? { icon: MapPin, label: job.city } : null,
    job?.modalidad ? { icon: Briefcase, label: job.modalidad } : null,
    job?.contractType ? { icon: Briefcase, label: job.contractType } : null,
  ].filter(Boolean);

  useEffect(() => {
    onSubmittedChange?.(submitted);
  }, [onSubmittedChange, submitted]);

  const getFieldMeta = (name, value) => {
    const hasInteracted = Boolean(dirtyFields?.[name] || touchedFields?.[name] || String(value || "").trim());
    if (errors?.[name]) {
      return {
        color: "destructive",
        icon: AlertCircle,
        helper: errors[name]?.message,
        helperClassName: "text-destructive",
      };
    }
    if (hasInteracted && String(value || "").trim()) {
      return {
        color: "success",
        icon: CheckCircle2,
        helper: "Dato correcto",
        helperClassName: "text-emerald-700",
      };
    }
    return {
      color: "default",
      icon: null,
      helper: "",
      helperClassName: "text-slate-400",
    };
  };

  const firstNameMeta = getFieldMeta("firstName", firstNameValue);
  const lastNameMeta = getFieldMeta("lastName", lastNameValue);
  const emailMeta = getFieldMeta("email", emailValue);
  const phoneMeta = getFieldMeta("phone", phoneValue);
  const cityMeta = getFieldMeta("city", cityValue);
  const provinceMeta = getFieldMeta("province", provinceValue);
  const linkedinMeta = getFieldMeta("linkedinUrl", linkedinValue);
  const portfolioMeta = getFieldMeta("portfolioUrl", portfolioValue);

  const normalizedProvinceValue = normalizeLocation(provinceValue, provinceSuggestions);
  const filteredCitySuggestions = useMemo(() => {
    const provinceKey = stripDiacritics(normalizeWhitespace(provinceValue)).toLowerCase();
    if (!provinceKey) return citySuggestions;

    return (Array.isArray(citySuggestions) ? citySuggestions : []).filter((city) => {
      const cityKey = stripDiacritics(normalizeWhitespace(city)).toLowerCase();
      const inferredProvince = cityToProvince[cityKey];
      if (!inferredProvince) return true;
      const inferredKey = stripDiacritics(inferredProvince).toLowerCase();
      return inferredKey === provinceKey;
    });
  }, [citySuggestions, provinceValue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        reset({
          ...defaultValues,
          ...parsed,
          cvFile: null,
        });
        if (parsed?.hadCv) {
          setCvRestorationNeeded(true);
        }
      }
    } catch {
      // Ignore malformed drafts silently.
    } finally {
      setDraftReady(true);
    }
  }, [defaultValues, draftKey, reset]);

  useEffect(() => {
    if (typeof window === "undefined" || !draftReady || submitted) return;
    const [firstName, lastName, email, phone, city, province, linkedinUrl, portfolioUrl, message, acceptedTerms, acceptedSecurity] = watchedDraftValues;
    const payload = {
      firstName,
      lastName,
      email,
      phone,
      city,
      province,
      linkedinUrl,
      portfolioUrl,
      message,
      acceptedTerms,
      acceptedSecurity,
      hadCv: Boolean(cvFile),
    };
    window.localStorage.setItem(draftKey, JSON.stringify(payload));
  }, [cvFile, draftKey, draftReady, submitted, watchedDraftValues]);

  useEffect(() => {
    let ignore = false;

    async function loadSuggestions() {
      try {
        const [companiesRes, jobsRes] = await Promise.all([
          fetch("/api/institutions", { cache: "no-store" }),
          fetch("/api/courses", { cache: "no-store" }),
        ]);
        const [companiesData, jobsData] = await Promise.all([
          companiesRes.json().catch(() => null),
          jobsRes.json().catch(() => null),
        ]);
        if (ignore) return;

        const companies = Array.isArray(companiesData?.institutions) ? companiesData.institutions : [];
        const jobs = Array.isArray(jobsData?.courses) ? jobsData.courses : [];
        setCitySuggestions(
          uniqueSorted([
            normalizeLocation(job?.city),
            ...companies.map((company) => normalizeLocation(company?.city)),
            ...jobs.map((jobItem) => normalizeLocation(jobItem?.city)),
          ])
        );
      } catch {
        if (!ignore) {
          setCitySuggestions(uniqueSorted([normalizeLocation(job?.city)]));
        }
      }
    }

    loadSuggestions();

    return () => {
      ignore = true;
    };
  }, [job?.city]);

  useEffect(() => {
    const cityKey = stripDiacritics(normalizeWhitespace(cityValue)).toLowerCase();
    if (!cityKey) return;
    const inferred = cityToProvince[cityKey];
    if (!inferred) return;

    if (!provinceManualRef.current || !String(provinceValue || "").trim()) {
      setValue("province", inferred, { shouldDirty: true, shouldValidate: true });
    }
  }, [cityValue, provinceValue, setValue]);

  const assignCvFile = (file) => {
    if (!file) return;
    setValue("cvFile", [file], { shouldDirty: true, shouldValidate: true });
    clearErrors("cvFile");
    setCvRestorationNeeded(false);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    assignCvFile(file);
  };

  const goNext = async () => {
    const valid = await trigger(steps[currentStep].fields);
    if (!valid) return;
    setCurrentStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const goBack = () => {
    setCurrentStep((value) => Math.max(value - 1, 0));
  };

  const executeSubmission = async (values) => {
    try {
      setSubmitting(true);
      setUploadProgress(0);
      setUploadStage("uploading");
      const cvUrl = await uploadFileWithProgress(values.cvFile[0], "courses/enrollments", setUploadProgress);
      setUploadStage("processing");

      const payload = {
        jobId: job.id,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        city: values.city,
        province: values.province,
        cvUrl,
        linkedinUrl: values.linkedinUrl || undefined,
        portfolioUrl: values.portfolioUrl || undefined,
        message: values.message || undefined,
        acceptedPrivacy: true,
      };

      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "request_failed");
      }

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftKey);
      }
      notifyApplicationCreated(job.id);
      setUploadProgress(100);
      setUploadStage("done");
      setSubmitted(true);
      toast.success("Inscripcion enviada", { position: "top-right" });
    } catch (e) {
      if (e?.message === "application_already_exists") {
        notifyApplicationCreated(job.id);
        toast("Ya te inscribiste a este curso", {
          icon: "i",
          position: "top-right",
        });
        return;
      }
      setUploadStage("idle");
      setUploadProgress(0);
      toast.error(e?.message || "Error al enviar inscripcion", { position: "top-right" });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (values) => {
    await executeSubmission(values);
  };

  if (submitted) {
    if (isModal) {
      return (
        <div className="relative flex h-full items-center justify-center px-6 py-8 md:px-10">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E6EBF4] text-[#64748B] transition hover:bg-slate-50"
              aria-label="Cerrar inscripcion"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          <div className="mx-auto flex w-full max-w-[620px] flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF3] px-3 py-1 text-[11px] font-bold text-[#127A45]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Inscripcion enviada
            </div>

            <h2 className="mt-4 text-[34px] font-extrabold tracking-tight leading-tight text-[#0F172A]">
              Tu inscripcion quedo enviada
            </h2>

            <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#667085]">
              Compartimos tu informacion con {job.companyName || "la institucion"} y te avisaran si necesitan avanzar con la inscripcion.
            </p>

            <div className="mt-8 grid w-full gap-3 rounded-[22px] border border-[#E6EBF4] bg-[#FAFBFD] p-5 text-left text-sm md:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Curso</div>
                <div className="mt-1 font-semibold text-[#0F172A]">{job.title}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Alumno</div>
                <div className="mt-1 font-semibold text-[#0F172A]">{candidateDisplayName}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Canal</div>
                <div className="mt-1 font-semibold text-[#0F172A]">ACAV Cursos</div>
              </div>
            </div>

            <div className="mt-6 text-sm text-[#667085]">
              Podes cerrar este modal o seguir explorando otros cursos.
            </div>

            <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:flex-row">
              {onClose ? (
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-[#D7DEEA] text-[#0F172A]">
                  Cerrar
                </Button>
              ) : null}
              <Link
                href={`/${lang}/cursos`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
              >
                Ver mas cursos
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="relative w-full overflow-hidden rounded-[30px] border border-[#CFE0FF] bg-white p-10 shadow-[0_24px_80px_rgba(27,43,80,0.12)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(221,73,19,0.18),transparent_60%)]" />
          <div className="pointer-events-none absolute -right-6 top-8 h-24 w-24 rounded-full bg-[#DD4913]/10 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-8 h-28 w-28 rounded-full bg-[#31456F]/10 blur-2xl" />

          <div className="relative inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Inscripcion enviada
          </div>

          <h1 className="relative mt-6 text-3xl font-extrabold tracking-tight text-[#1B2B50] md:text-4xl">
            Tu perfil ya quedo enviado a {job.companyName || "la institucion"}.
          </h1>
          <p className="relative mt-5 max-w-2xl text-sm leading-7 text-slate-600">
            Gracias por inscribirte. Si la institucion necesita informacion adicional, se contactara por email o telefono.
          </p>

          <div className="relative mt-8 grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Curso</div>
              <div className="mt-2 text-sm font-semibold text-[#1B2B50]">{job.title}</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Alumno</div>
              <div className="mt-2 text-sm font-semibold text-[#1B2B50]">{candidateDisplayName}</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Canal</div>
              <div className="mt-2 text-sm font-semibold text-[#1B2B50]">ACAV Cursos</div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {isModal ? (
              <Button type="button" variant="outline" onClick={onClose}>
                Cerrar
              </Button>
            ) : null}
            <Link
              href={`/${lang}/cursos`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#31456F] transition hover:text-[#1B2B50]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a cursos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isModal) {
    return (
      <div className="h-full">
        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col overflow-hidden bg-white">
          <div className="border-b border-[#EEF2F7] px-5 py-5 md:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-[58px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[#E5EAF2] bg-[#F8FAFC]">
                  {modalLogoUrl ? (
                    <img src={modalLogoUrl} alt={job?.companyName || "Institucion"} className="h-full w-full object-contain bg-white p-1.5" />
                  ) : (
                    <span className="text-sm font-extrabold tracking-tight text-[#2563EB]">{modalCompanyInitials}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-bold text-[#EA580C]">
                    <Sparkles className="h-3 w-3" />
                    Inscripcion express
                  </div>
                  <h2 className="mt-2 truncate text-[32px] font-extrabold tracking-tight leading-none text-[#0F172A]">
                    {job?.title || "Inscripcion"}
                  </h2>
                  <p className="mt-1 text-sm text-[#667085]">Completa tu inscripcion en pocos minutos.</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-[#667085]">
                    {modalMetaItems.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <span key={`${item.label}`} className="inline-flex items-center gap-1.5">
                          <ItemIcon className="h-3.5 w-3.5 text-[#94A3B8]" />
                          {item.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E6EBF4] text-[#64748B] transition hover:bg-slate-50"
                  aria-label="Cerrar inscripcion"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="border-b border-[#EEF2F7] px-5 py-4 md:px-7">
            <div className="grid grid-cols-3 gap-3">
              {steps.map((step, index) => {
                const active = index === currentStep;
                const completed = index < currentStep;
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
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                        completed
                          ? "bg-[#DBEAFE] text-[#2563EB]"
                          : active
                            ? "bg-[#2563EB] text-white"
                            : "bg-[#F1F5F9] text-[#94A3B8]",
                      ].join(" ")}
                    >
                      {completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={[
                          "block h-px w-full",
                          index === steps.length - 1 ? "hidden" : completed || active ? "bg-[#CBD5E1]" : "bg-[#E2E8F0]",
                        ].join(" ")}
                      />
                      <span
                        className={[
                          "mt-2 block text-[13px] font-semibold",
                          active ? "text-[#2563EB]" : completed ? "text-[#0F172A]" : "text-[#94A3B8]",
                        ].join(" ")}
                      >
                        {step.title}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 md:px-7 md:py-7">
            <div className="mb-5">
              <h3 className="text-[28px] font-bold tracking-tight text-[#0F172A]">{currentStepMeta.title}</h3>
              <p className="mt-1 text-sm text-[#667085]">
                {currentStep === 0
                  ? "Completá tus datos personales y de contacto."
                  : currentStep === 1
                    ? "Adjunta tu documentacion y suma contexto para tu inscripcion."
                    : "Revisa tu informacion antes de enviar la inscripcion."}
              </p>
            </div>

            {currentStep === 0 ? (
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">Nombre</Label>
                    <Input
                      placeholder="Tu nombre"
                      className="h-12 rounded-[14px] border-[#D7DEEA] bg-white"
                      {...register("firstName", { setValueAs: (v) => toTitleCase(v) })}
                    />
                    {errors.firstName ? <p className="text-sm text-destructive">{errors.firstName.message}</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">Apellido</Label>
                    <Input
                      placeholder="Tu apellido"
                      className="h-12 rounded-[14px] border-[#D7DEEA] bg-white"
                      {...register("lastName", { setValueAs: (v) => toTitleCase(v) })}
                    />
                    {errors.lastName ? <p className="text-sm text-destructive">{errors.lastName.message}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">Email</Label>
                    <Input
                      placeholder="tu@email.com"
                      className="h-12 rounded-[14px] border-[#D7DEEA] bg-white"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      {...register("email", { setValueAs: normalizeEmail })}
                    />
                    {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">Teléfono</Label>
                    <Input
                      placeholder="+54 9 351..."
                      className="h-12 rounded-[14px] border-[#D7DEEA] bg-white"
                      inputMode="tel"
                      autoCorrect="off"
                      {...register("phone", { setValueAs: normalizePhone })}
                    />
                    {errors.phone ? <p className="text-sm text-destructive">{errors.phone.message}</p> : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">Ciudad</Label>
                    <Input
                      placeholder="Ciudad"
                      list={cityListId}
                      className="h-12 rounded-[14px] border-[#D7DEEA] bg-white"
                      {...register("city", {
                        setValueAs: (v) => normalizeLocation(v, citySuggestions),
                      })}
                    />
                    <datalist id={cityListId}>
                      {filteredCitySuggestions.map((city) => (
                        <option key={city} value={city} />
                      ))}
                    </datalist>
                    {errors.city ? <p className="text-sm text-destructive">{errors.city.message}</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">Provincia</Label>
                    <Input
                      placeholder="Provincia"
                      list={provinceListId}
                      className="h-12 rounded-[14px] border-[#D7DEEA] bg-white"
                      {...register("province", {
                        setValueAs: (v) => normalizeLocation(v, provinceSuggestions),
                        onChange: () => {
                          provinceManualRef.current = true;
                        },
                      })}
                    />
                    <datalist id={provinceListId}>
                      {provinceSuggestions.map((province) => (
                        <option key={province} value={province} />
                      ))}
                    </datalist>
                    {errors.province ? <p className="text-sm text-destructive">{errors.province.message}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="grid gap-5">
                <div className="rounded-[18px] border border-dashed border-[#D6DEEA] bg-[#FCFDFE] p-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />

                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#2563EB]">
                        <FileUp className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#0F172A]">Subi tu documentacion</div>
                        <div className="mt-1 text-xs text-[#667085]">PDF, DOC, DOCX o TXT. Máximo 10MB.</div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={openFilePicker}
                      className="h-11 rounded-xl bg-[#2563EB] px-5 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
                    >
                      Seleccionar archivo
                    </Button>
                  </div>

                  {cvRestorationNeeded && !cvFile ? (
                    <p className="mt-3 text-sm text-amber-700">
                      Recuperamos tu borrador, pero por seguridad tenes que volver a adjuntar la documentacion.
                    </p>
                  ) : null}

                  {cvFile ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-[#E5EAF2] bg-white px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF1F2] text-[#E11D48]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#344054]">{cvFile.name}</div>
                          <div className="text-xs text-[#98A2B3]">{formatBytes(cvFile.size) || "Archivo listo"}</div>
                        </div>
                      </div>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#16A34A]" />
                    </div>
                  ) : null}

                  {errors.cvFile ? <p className="mt-3 text-sm text-destructive">{errors.cvFile.message}</p> : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">LinkedIn (opcional)</Label>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                      <Input
                        placeholder="https://linkedin.com/in/tu-perfil"
                        className="h-12 rounded-[14px] border-[#D7DEEA] bg-white pl-11"
                        {...register("linkedinUrl")}
                      />
                    </div>
                    {errors.linkedinUrl ? <p className="text-sm text-destructive">{errors.linkedinUrl.message}</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[13px] font-semibold text-[#344054]">Portfolio (opcional)</Label>
                    <div className="relative">
                      <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                      <Input
                        placeholder="https://tusitio.com o tu portfolio online"
                        className="h-12 rounded-[14px] border-[#D7DEEA] bg-white pl-11"
                        {...register("portfolioUrl")}
                      />
                    </div>
                    {errors.portfolioUrl ? <p className="text-sm text-destructive">{errors.portfolioUrl.message}</p> : null}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-[13px] font-semibold text-[#344054]">Mensaje para la institucion (opcional)</Label>
                  <div className="rounded-[16px] border border-[#D7DEEA] bg-white">
                    <Textarea
                      rows={5}
                      maxLength={500}
                      placeholder="Contanos brevemente tu interes, experiencia o expectativa..."
                      className="min-h-[120px] resize-none border-0 px-4 py-3 shadow-none focus-visible:ring-0"
                      {...register("message")}
                    />
                    <div className="px-4 pb-3 text-right text-[11px] text-[#98A2B3]">{String(messageValue || "").trim().length}/500</div>
                  </div>
                </div>

                {showUploadProgress ? (
                  <div className="rounded-[16px] border border-[#E5EAF2] bg-[#FAFBFD] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-[#0F172A]">{uploadStageLabel || "Preparando archivo..."}</span>
                      <span className="text-[#667085]">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} size="sm" color="primary" className="bg-slate-100 [&>div]:bg-[#2563EB]" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="grid gap-5">
                <div className="rounded-[18px] border border-[#E5EAF2] bg-[#FAFBFD] p-5">
                  <div className="text-sm font-bold text-[#0F172A]">Revisión de tu perfil</div>
                  <div className="mt-4 grid gap-3 text-sm text-[#475467] md:grid-cols-2">
                    <div><span className="font-semibold text-[#0F172A]">Nombre:</span> {getValues("firstName")} {getValues("lastName")}</div>
                    <div><span className="font-semibold text-[#0F172A]">Email:</span> {getValues("email")}</div>
                    <div><span className="font-semibold text-[#0F172A]">Teléfono:</span> {getValues("phone")}</div>
                    <div><span className="font-semibold text-[#0F172A]">Ubicación:</span> {getValues("city")}, {getValues("province")}</div>
                    <div className="md:col-span-2">
                      <span className="font-semibold text-[#0F172A]">Documentacion adjunta:</span> {cvFile ? `${cvFile.name}${formatBytes(cvFile.size) ? ` · ${formatBytes(cvFile.size)}` : ""}` : "Pendiente"}
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-[#DCE6F7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-5 shadow-[0_10px_30px_rgba(37,99,235,.06)]">
                  <div className="flex items-start gap-3">
                    <div className="grid gap-1">
                      <div className="text-sm font-semibold text-[#0F172A]">Confirmación y seguridad</div>
                      <p className="text-xs leading-5 text-[#667085]">
                        Antes de enviar, confirma tu consentimiento para completar una inscripcion clara, segura y protegida.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                          <ShieldCheck className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-[#0F172A]">Datos protegidos</div>
                          <p className="mt-1 text-xs leading-5 text-[#667085]">Tu informacion se comparte solo con la institucion para evaluar esta inscripcion.</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F08A00]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-[#0F172A]">Proceso validado</div>
                          <p className="mt-1 text-xs leading-5 text-[#667085]">Tus datos y tu documentacion quedan listos para enviarse en un solo paso final.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="acceptedTerms-modal"
                          checked={Boolean(acceptedTermsValue)}
                          onCheckedChange={(value) => setValue("acceptedTerms", Boolean(value), { shouldValidate: true, shouldDirty: true })}
                          className="mt-0.5"
                        />
                        <div className="grid gap-1">
                          <Label htmlFor="acceptedTerms-modal" className="text-sm font-semibold text-[#0F172A]">
                            Acepto términos y condiciones
                          </Label>
                          <p className="text-xs leading-5 text-[#667085]">Autorizo el uso de la plataforma y el envio de mis datos para esta inscripcion.</p>
                          {errors.acceptedTerms ? <p className="text-sm text-destructive">{errors.acceptedTerms.message}</p> : null}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="acceptedSecurity-modal"
                          checked={Boolean(acceptedSecurityValue)}
                          onCheckedChange={(value) => setValue("acceptedSecurity", Boolean(value), { shouldValidate: true, shouldDirty: true })}
                          className="mt-0.5"
                        />
                        <div className="grid gap-1">
                          <Label htmlFor="acceptedSecurity-modal" className="text-sm font-semibold text-[#0F172A]">
                            Acepto protocolos de seguridad
                          </Label>
                          <p className="text-xs leading-5 text-[#667085]">Confirmo que la información cargada es real y comprendo las pautas de protección de datos.</p>
                          {errors.acceptedSecurity ? <p className="text-sm text-destructive">{errors.acceptedSecurity.message}</p> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center rounded-full border border-[#DCE6F7] bg-[#F8FBFF] px-3 py-1.5 text-[11px] font-semibold text-[#4B5B7A]">
                        Términos de uso
                      </span>
                      <span className="inline-flex items-center rounded-full border border-[#DCE6F7] bg-[#F8FBFF] px-3 py-1.5 text-[11px] font-semibold text-[#4B5B7A]">
                        Política de privacidad
                      </span>
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
              <span>{draftReady ? "Tus datos se guardan temporalmente en este dispositivo." : "Preparando borrador temporal..."}</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep > 0 ? goBack : onClose || (() => { })}
                className="h-11 rounded-xl border-[#D7DEEA] px-6 text-[#344054]"
              >
                {currentStep > 0 ? "Volver" : "Cerrar"}
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button type="button" onClick={goNext} className="h-11 rounded-xl bg-[#2563EB] px-6 font-semibold text-white hover:bg-[#1D4ED8]">
                  Continuar
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" className={`h-11 rounded-xl bg-[#2563EB] px-6 font-semibold text-white hover:bg-[#1D4ED8] ${submitting ? "pointer-events-none" : ""}`}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Enviando..." : "Enviar inscripcion"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="rounded-[22px] border border-slate-200 bg-white p-10 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
            <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
            Inscripción
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#1B2B50]">{job.title}</h2>
              <p className="text-sm text-slate-500">
                {job.companyName} · {job.city} · {job.modalidad} · {job.contractType}
              </p>
            </div>
            <div className="w-full max-w-[240px]">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span>Paso {currentStep + 1} de {steps.length}</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} size="sm" color="primary" className="bg-slate-100 [&>div]:bg-[#31456F]" />
            </div>
          </div>
        </div>

        {job.mustSendCvByEmail ? (
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold text-amber-800">Este curso solicita envio de documentacion por email</p>
            <p className="mt-2 text-sm leading-7 text-amber-700">
              Email: <span className="font-semibold">{job.contactEmail}</span>
              {job.emailSubject ? (
                <>
                  {" "}
                  · Asunto sugerido: <span className="font-semibold">{job.emailSubject}</span>
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const active = index === currentStep;
            const completed = index < currentStep;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (index <= currentStep) setCurrentStep(index);
                }}
                className={[
                  "flex items-start gap-3 rounded-3xl border p-4 text-left transition",
                  active ? "border-[#31456F] bg-[#EEF5FF] shadow-sm" : "border-slate-200 bg-white",
                  completed ? "border-emerald-200 bg-emerald-50" : "",
                  index > currentStep ? "cursor-default opacity-80" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    completed ? "bg-emerald-600 text-white" : active ? "bg-[#31456F] text-white" : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {completed ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#1B2B50]">{step.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{step.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0">
              <div className="mb-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1B2B50] text-white shadow-sm">
                    <ActiveStepIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Paso activo</div>
                    <h3 className="mt-2 text-xl font-extrabold tracking-tight text-[#1B2B50]">{currentStepMeta.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{currentStepMeta.description}</p>
                  </div>
                </div>
              </div>

              <div
                key={currentStepMeta.id}
                className="grid gap-6 animate-in fade-in-0 slide-in-from-bottom-3 duration-300"
              >
                {currentStep === 0 ? (
                  <div className="grid gap-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Nombre</Label>
                        <div className="relative">
                          <Input
                            placeholder="Tu nombre"
                            color={firstNameMeta.color}
                            className="pr-10"
                            {...register("firstName", { setValueAs: (v) => toTitleCase(v) })}
                          />
                          {firstNameMeta.icon ? <firstNameMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.firstName ? "text-destructive" : "text-emerald-600"}`} /> : null}
                        </div>
                        {firstNameMeta.helper ? <p className={`text-sm ${firstNameMeta.helperClassName}`}>{firstNameMeta.helper}</p> : null}
                      </div>
                      <div className="grid gap-2">
                        <Label>Apellido</Label>
                        <div className="relative">
                          <Input
                            placeholder="Tu apellido"
                            color={lastNameMeta.color}
                            className="pr-10"
                            {...register("lastName", { setValueAs: (v) => toTitleCase(v) })}
                          />
                          {lastNameMeta.icon ? <lastNameMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.lastName ? "text-destructive" : "text-emerald-600"}`} /> : null}
                        </div>
                        {lastNameMeta.helper ? <p className={`text-sm ${lastNameMeta.helperClassName}`}>{lastNameMeta.helper}</p> : null}
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Email</Label>
                        <div className="relative">
                          <Input
                            placeholder="tu@email.com"
                            inputMode="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                            color={emailMeta.color}
                            className="pr-10"
                            {...register("email", { setValueAs: normalizeEmail })}
                          />
                          {emailMeta.icon ? <emailMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.email ? "text-destructive" : "text-emerald-600"}`} /> : null}
                        </div>
                        {emailMeta.helper ? <p className={`text-sm ${emailMeta.helperClassName}`}>{emailMeta.helper}</p> : null}
                      </div>
                      <div className="grid gap-2">
                        <Label>Teléfono</Label>
                        <div className="relative">
                          <Input
                            placeholder="+54 9 351 ..."
                            inputMode="tel"
                            autoCorrect="off"
                            color={phoneMeta.color}
                            className="pr-10"
                            {...register("phone", { setValueAs: normalizePhone })}
                          />
                          {phoneMeta.icon ? <phoneMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.phone ? "text-destructive" : "text-emerald-600"}`} /> : null}
                        </div>
                        {phoneMeta.helper ? <p className={`text-sm ${phoneMeta.helperClassName}`}>{phoneMeta.helper}</p> : null}
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Ciudad</Label>
                        <div className="relative">
                          <Input
                            placeholder="Ciudad"
                            list={cityListId}
                            color={cityMeta.color}
                            className="pr-10"
                            {...register("city", {
                              setValueAs: (v) => normalizeLocation(v, citySuggestions),
                            })}
                          />
                          {cityMeta.icon ? <cityMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.city ? "text-destructive" : "text-emerald-600"}`} /> : null}
                          <datalist id={cityListId}>
                            {filteredCitySuggestions.map((city) => (
                              <option key={city} value={city} />
                            ))}
                          </datalist>
                        </div>
                        {cityMeta.helper ? <p className={`text-sm ${cityMeta.helperClassName}`}>{cityMeta.helper}</p> : null}
                        {job?.city ? (
                          <button
                            type="button"
                            onClick={() => setValue("city", job.city, { shouldDirty: true, shouldValidate: true })}
                            className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                          >
                            Usar ciudad del curso: {job.city}
                          </button>
                        ) : null}
                        {filteredCitySuggestions.length ? (
                          <div className="flex flex-wrap gap-2">
                            {filteredCitySuggestions.slice(0, 5).map((city) => (
                              <button
                                key={city}
                                type="button"
                                onClick={() => setValue("city", city, { shouldDirty: true, shouldValidate: true })}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                              >
                                {city}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        <Label>Provincia</Label>
                        <div className="relative">
                          <Input
                            placeholder="Provincia"
                            list={provinceListId}
                            color={provinceMeta.color}
                            className="pr-10"
                            {...register("province", {
                              setValueAs: (v) => normalizeLocation(v, provinceSuggestions),
                              onChange: () => {
                                provinceManualRef.current = true;
                              },
                            })}
                          />
                          {provinceMeta.icon ? <provinceMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.province ? "text-destructive" : "text-emerald-600"}`} /> : null}
                          <datalist id={provinceListId}>
                            {provinceSuggestions.map((province) => (
                              <option key={province} value={province} />
                            ))}
                          </datalist>
                        </div>
                        {provinceMeta.helper ? <p className={`text-sm ${provinceMeta.helperClassName}`}>{provinceMeta.helper}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          {provinceSuggestions.slice(0, 5).map((province) => (
                            <button
                              key={province}
                              type="button"
                              onClick={() => setValue("province", province, { shouldDirty: true, shouldValidate: true })}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
                            >
                              {province}
                            </button>
                          ))}
                        </div>
                        {normalizedProvinceValue && stripDiacritics(normalizeWhitespace(provinceValue)).toLowerCase() !== stripDiacritics(normalizeWhitespace(normalizedProvinceValue)).toLowerCase() ? (
                          <button
                            type="button"
                            onClick={() => setValue("province", normalizedProvinceValue, { shouldDirty: true, shouldValidate: true })}
                            className="inline-flex w-fit items-center rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-semibold text-[#31456F] transition hover:bg-[#DCEBFF]"
                          >
                            Normalizar a: {normalizedProvinceValue}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {currentStep === 1 ? (
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <Label>Documentacion adjunta</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                      <button
                        type="button"
                        onClick={openFilePicker}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDragActive(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragActive(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          handleFiles(e.dataTransfer.files);
                        }}
                        className={[
                          "group flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed px-6 py-8 text-center transition",
                          dragActive ? "border-[#31456F] bg-[#EEF5FF]" : "border-slate-200 bg-slate-50 hover:border-[#31456F] hover:bg-[#F7FBFF]",
                        ].join(" ")}
                      >
                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#31456F] shadow-sm">
                          <FileUp className="h-6 w-6" />
                        </span>
                        <div>
                          <div className="text-base font-bold text-[#1B2B50]">
                            {cvFile ? "Documentacion lista para enviar" : "Arrastra tu archivo o toca para subirlo"}
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-500">
                            PDF, DOC, DOCX o TXT. Máximo 10MB.
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-[#1B2B50] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-white transition group-hover:bg-[#31456F]">
                          Seleccionar archivo
                        </span>
                      </button>
                      {cvRestorationNeeded && !cvFile ? (
                        <p className="text-sm text-amber-700">
                          Recuperamos tu borrador, pero por seguridad tenes que volver a adjuntar la documentacion antes de enviarla.
                        </p>
                      ) : null}
                      {cvFile ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-emerald-800">{cvFile.name}</div>
                            <div className="text-emerald-700">{formatBytes(cvFile.size)}</div>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={openFilePicker}>
                            Cambiar archivo
                          </Button>
                        </div>
                      ) : null}
                      {errors.cvFile ? <p className="text-sm text-destructive">{errors.cvFile.message}</p> : null}
                      {showUploadProgress ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold text-[#1B2B50]">{uploadStageLabel || "Preparando archivo..."}</span>
                            <span className="text-slate-400">{uploadProgress}%</span>
                          </div>
                          <Progress value={uploadProgress} size="sm" color="primary" className="bg-slate-100 [&>div]:bg-[#31456F]" />
                        </div>
                      ) : null}
                      {cvFile ? (
                        <FilePreview
                          file={cvFile}
                          title="Vista previa del archivo"
                          description="Se muestra una vista previa cuando el navegador puede renderizar el archivo. Para documentos Office, la vista completa queda disponible luego de subirlo."
                        />
                      ) : null}
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>LinkedIn (opcional)</Label>
                        <div className="relative">
                          <Input placeholder="https://linkedin.com/in/..." color={linkedinMeta.color} className="pr-10" {...register("linkedinUrl")} />
                          {linkedinMeta.icon ? <linkedinMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.linkedinUrl ? "text-destructive" : "text-emerald-600"}`} /> : null}
                        </div>
                        {linkedinMeta.helper ? <p className={`text-sm ${linkedinMeta.helperClassName}`}>{linkedinMeta.helper}</p> : null}
                      </div>
                      <div className="grid gap-2">
                        <Label>Portfolio (opcional)</Label>
                        <div className="relative">
                          <Input placeholder="https://..." color={portfolioMeta.color} className="pr-10" {...register("portfolioUrl")} />
                          {portfolioMeta.icon ? <portfolioMeta.icon className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${errors.portfolioUrl ? "text-destructive" : "text-emerald-600"}`} /> : null}
                        </div>
                        {portfolioMeta.helper ? <p className={`text-sm ${portfolioMeta.helperClassName}`}>{portfolioMeta.helper}</p> : null}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Mensaje para la institucion (opcional)</Label>
                      <Textarea rows={5} placeholder="Contanos brevemente tu interes, experiencia o motivacion" {...register("message")} />
                      <div className="text-xs text-slate-400">Mensaje cargado: {String(messageValue || "").trim().length} caracteres</div>
                    </div>
                  </div>
                ) : null}

                {currentStep === 2 ? (
                  <div className="grid gap-6">
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
                      <div className="text-base font-bold text-[#1B2B50]">Resumen antes de enviar</div>
                      <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                        <div>
                          <span className="font-semibold text-slate-900">Nombre:</span> {getValues("firstName")} {getValues("lastName")}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Email:</span> {getValues("email")}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Teléfono:</span> {getValues("phone")}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">Ubicación:</span> {getValues("city")}, {getValues("province")}
                        </div>
                        <div className="md:col-span-2">
                          <span className="font-semibold text-slate-900">Documentacion:</span> {cvFile ? `${cvFile.name}${formatBytes(cvFile.size) ? ` · ${formatBytes(cvFile.size)}` : ""}` : "No adjuntada"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-[#DCE6F7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-6 shadow-[0_10px_30px_rgba(37,99,235,.06)]">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#31456F] shadow-[0_10px_24px_rgba(37,99,235,.14)] ring-4 ring-[#EEF4FF]/80">
                          <ShieldCheck className="h-5 w-5" />
                        </span>
                        <div className="grid gap-1">
                          <div className="text-base font-bold text-[#1B2B50]">Confirmación y seguridad</div>
                          <p className="text-sm leading-6 text-slate-500">
                            Revisa el consentimiento final antes de enviar. Buscamos una experiencia clara, breve y confiable.
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF5FF] text-[#31456F]">
                              <ShieldCheck className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="text-sm font-bold text-slate-900">Seguridad de datos</div>
                              <p className="mt-2 text-xs leading-6 text-slate-500">Tu informacion se comparte solo con la institucion para evaluar esta inscripcion.</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-[22px] border border-slate-200 bg-white p-5">
                          <div className="flex items-start gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F08A00]">
                              <FileText className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="text-sm font-bold text-slate-900">Proceso validado</div>
                              <p className="mt-2 text-xs leading-6 text-slate-500">Tu documentacion, tus datos y tus enlaces se enviaran en una unica confirmacion final.</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3">
                        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="acceptedTerms"
                              checked={Boolean(acceptedTermsValue)}
                              onCheckedChange={(value) => setValue("acceptedTerms", Boolean(value), { shouldValidate: true, shouldDirty: true })}
                              className="mt-0.5"
                            />
                            <div className="grid gap-1">
                              <Label htmlFor="acceptedTerms" className="text-sm font-semibold text-slate-900">
                                Acepto términos y condiciones
                              </Label>
                              <p className="text-xs leading-6 text-slate-500">Autorizo el uso de la plataforma y el envio de mis datos para esta inscripcion.</p>
                              {errors.acceptedTerms ? <p className="text-sm text-destructive">{errors.acceptedTerms.message}</p> : null}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="acceptedSecurity"
                              checked={Boolean(acceptedSecurityValue)}
                              onCheckedChange={(value) => setValue("acceptedSecurity", Boolean(value), { shouldValidate: true, shouldDirty: true })}
                              className="mt-0.5"
                            />
                            <div className="grid gap-1">
                              <Label htmlFor="acceptedSecurity" className="text-sm font-semibold text-slate-900">
                                Acepto protocolos de seguridad
                              </Label>
                              <p className="text-xs leading-6 text-slate-500">Confirmo que la información cargada es real y comprendo las pautas básicas de protección de datos.</p>
                              {errors.acceptedSecurity ? <p className="text-sm text-destructive">{errors.acceptedSecurity.message}</p> : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            Términos de uso
                          </span>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                            Política de privacidad
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {currentStep > 0 ? (
                    <Button type="button" variant="outline" onClick={goBack}>
                      Volver
                    </Button>
                  ) : isModal ? (
                    <Button type="button" variant="ghost" onClick={onClose} className="justify-start px-0 text-[#31456F] hover:text-[#1B2B50]">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Seguir explorando
                    </Button>
                  ) : (
                    <Link
                      href={`/${lang}/cursos/${job.slug}`}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#31456F] transition hover:text-[#1B2B50]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Volver al curso
                    </Link>
                  )}
                  <div className="text-xs leading-5 text-slate-500">
                    {draftReady ? "Tus datos quedan guardados temporalmente en este dispositivo." : "Preparando borrador temporal..."}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {currentStep < steps.length - 1 ? (
                    <Button type="button" onClick={goNext}>
                      Continuar
                    </Button>
                  ) : (
                    <Button type="submit" className={submitting ? "pointer-events-none" : ""}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {submitting ? "Enviando..." : "Enviar inscripcion"}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <aside className="hidden lg:block lg:sticky lg:top-4">
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#15203B_0%,#1B2B50_100%)] p-5 text-white shadow-[0_20px_60px_rgba(27,43,80,0.18)]">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#DD4913]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Resumen en vivo
                </div>

                <div className="mt-5 rounded-[22px] border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Curso</div>
                  <div className="mt-2 text-lg font-bold leading-6 text-white">{job.title}</div>
                  <div className="mt-4 grid gap-3 text-sm text-white/75">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#DD4913]" />
                      <span>{job.companyName || "Empresa"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#DD4913]" />
                      <span>{job.city || "Sin ciudad"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[#DD4913]" />
                      <span>{job.modalidad || job.contractType || "Modalidad a definir"}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  {statusCards.map((card) => (
                    <div
                      key={card.label}
                      className={[
                        "rounded-[20px] border px-4 py-3",
                        card.ready ? "border-emerald-300/40 bg-emerald-400/10" : "border-white/10 bg-white/5",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-white">{card.label}</span>
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em]",
                            card.ready ? "bg-emerald-300/20 text-emerald-100" : "bg-white/10 text-white/55",
                          ].join(" ")}
                        >
                          {card.ready ? "Listo" : "Pendiente"}
                        </span>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-white/65">{card.helper}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Perfil detectado</div>
                  <div className="mt-3 grid gap-3 text-sm text-white/80">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-[#DD4913]" />
                      <span>{candidateDisplayName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-[#DD4913]" />
                      <span className="truncate">{emailValue || "Email pendiente"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-[#DD4913]" />
                      <span>{phoneValue || "Teléfono pendiente"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#DD4913]" />
                      <span>{locationDisplay}</span>
                    </div>
                  </div>
                </div>

                {showUploadProgress ? (
                  <div className="mt-5 rounded-[20px] border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Carga del archivo</div>
                      <div className="text-xs font-semibold text-white/70">{uploadProgress}%</div>
                    </div>
                    <Progress value={uploadProgress} size="sm" color="primary" className="mt-3 bg-white/10 [&>div]:bg-[#DD4913]" />
                    <div className="mt-2 text-xs leading-5 text-white/60">{uploadStageLabel || "Esperando envío"}</div>
                  </div>
                ) : null}

                <div className="mt-5 text-xs leading-5 text-white/55">
                  {draftReady ? "Borrador activo en este dispositivo." : "Preparando borrador temporal..."}
                  {linkedinValue || portfolioValue ? " También detectamos enlaces profesionales listos para enviar." : ""}
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
