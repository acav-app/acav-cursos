"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Film, GripVertical, Loader2, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import FilePreview from "@/components/courses/file-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
import {
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  COURSE_PUBLICATION_VISIBILITY,
  COURSE_SALES_MODALITIES,
  COURSE_VIDEO_ALLOWED_TYPES,
  COURSE_VIDEO_MAX_SIZE_BYTES,
} from "@/lib/courses/constants";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COURSE_DRAFT_STORAGE_KEY = "acav:courses:wizard-draft-v2";

const TAB_ITEMS = [
  { id: "general", label: "Información Base" },
  { id: "content", label: "Contenido Educativo" },
  { id: "resources", label: "Multimedia y Recursos" },
  { id: "pricing", label: "Comercialización" },
  { id: "publish", label: "Publicación" },
];

const PUBLICATION_STATUS_OPTIONS = [
  { value: "borrador", label: "Borrador" },
  { value: "pendiente_revision", label: "En revisión" },
  { value: "activa", label: "Publicado" },
  { value: "pausada", label: "Oculto" },
  { value: "cerrada", label: "Finalizado" },
];

const TAB_FIELD_MAP = {
  general: ["title", "slug", "category", "level", "modality", "language"],
  content: ["shortDescription", "description", "learningObjectives", "requirements", "targetAudience", "modules", "duration", "classesCount"],
  resources: ["coverImage", "thumbnail", "promoVideo", "attachments"],
  pricing: [
    "price",
    "oldPrice",
    "freeCourse",
    "certificate",
    "lifetimeAccess",
    "downloadableResources",
    "recordedClasses",
    "support",
  ],
  publish: ["featured", "allowEnrollment", "showOnHome", "status", "expiresAtDate"],
};

const schema = z
  .object({
    academyId: z.string().optional(),
    title: z.string().min(4, "El título del curso es obligatorio"),
    slug: z.string().min(3, "La URL del curso es obligatoria"),
    category: z.string().min(1, "La categoría es obligatoria"),
    level: z.string().min(1, "El nivel es obligatorio"),
    modality: z.string().min(1, "La modalidad es obligatoria"),
    language: z.string().min(1, "El idioma es obligatorio"),
    shortDescription: z.string().max(180, "La descripción corta admite hasta 180 caracteres").optional(),
    description: z.string().min(20, "La descripción completa debe tener al menos 20 caracteres"),
    learningObjectives: z.preprocess(
      (value) => sanitizeList(value),
      z.array(z.string().min(1)).min(1, "Agrega al menos un aprendizaje")
    ),
    requirements: z.preprocess((value) => sanitizeList(value), z.array(z.string().min(1)).default([])),
    targetAudience: z.preprocess((value) => sanitizeList(value), z.array(z.string().min(1)).default([])),
    modules: z.preprocess(
      (value) =>
        (Array.isArray(value) ? value : [])
          .map((module, index) => ({
            id: String(module?.id || `module-${index}`).trim(),
            title: String(module?.title || "").trim(),
            description: String(module?.description || "").trim(),
            lessons: sanitizeList(module?.lessons),
          }))
          .filter((module) => module.title || module.description || module.lessons.length > 0),
      z
        .array(
          z.object({
            id: z.string().min(1),
            title: z.string().min(1, "El título del módulo es obligatorio"),
            description: z.string().optional(),
            lessons: z.array(z.string().min(1)).default([]),
          })
        )
        .min(1, "Agrega al menos un módulo")
    ),
    duration: z.string().min(1, "La duración es obligatoria"),
    classesCount: z.number().int().min(1, "La cantidad de clases debe ser mayor a 0"),
    coverImage: z.string().url("La portada debe ser una URL válida").optional().or(z.literal("")),
    thumbnail: z.string().url("La miniatura debe ser una URL válida").optional().or(z.literal("")),
    promoVideo: z.string().url("El video debe ser una URL válida").optional().or(z.literal("")),
    promoVideoFileName: z.string().optional(),
    promoVideoMimeType: z.string().optional(),
    promoVideoSizeBytes: z.number().optional(),
    promoVideoDurationSeconds: z.number().optional(),
    attachments: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.string().url(),
        sizeBytes: z.number().optional(),
      })
    ),
    price: z.number().min(0, "El precio no puede ser negativo"),
    oldPrice: z.number().min(0, "El precio anterior no puede ser negativo").optional(),
    freeCourse: z.boolean(),
    certificate: z.boolean(),
    lifetimeAccess: z.boolean(),
    downloadableResources: z.boolean(),
    recordedClasses: z.boolean(),
    support: z.boolean(),
    featured: z.boolean(),
    allowEnrollment: z.boolean(),
    showOnHome: z.boolean(),
    status: z.string().min(1, "El estado es obligatorio"),
    expiresAtDate: z.string().min(1, "La fecha de publicación es obligatoria"),
  })
  .superRefine((values, ctx) => {
    const validModules = (Array.isArray(values.modules) ? values.modules : []).filter((module) => {
      const title = String(module?.title || "").trim();
      const lessons = Array.isArray(module?.lessons)
        ? module.lessons.map((lesson) => String(lesson || "").trim()).filter(Boolean)
        : [];
      return title && lessons.length > 0;
    });
    if (validModules.length === 0) {
      ctx.addIssue({ code: "custom", message: "Agrega al menos un módulo con lecciones.", path: ["modules"] });
    }
    if (!values.freeCourse && Number(values.price || 0) <= 0) {
      ctx.addIssue({ code: "custom", message: "Indica un precio o marca el curso como gratuito", path: ["price"] });
    }
    if (Number.isFinite(Number(values.oldPrice || 0)) && Number(values.oldPrice || 0) < Number(values.price || 0)) {
      ctx.addIssue({ code: "custom", message: "El precio anterior debe ser mayor o igual al precio actual", path: ["oldPrice"] });
    }
    if (values.promoVideo) {
      if (!String(values.promoVideoFileName || "").trim()) {
        ctx.addIssue({ code: "custom", message: "Falta el nombre del video cargado", path: ["promoVideo"] });
      }
      if (!COURSE_VIDEO_ALLOWED_TYPES.includes(String(values.promoVideoMimeType || "").trim())) {
        ctx.addIssue({ code: "custom", message: "Formato de video inválido", path: ["promoVideo"] });
      }
      if (Number(values.promoVideoSizeBytes || 0) > COURSE_VIDEO_MAX_SIZE_BYTES) {
        ctx.addIssue({ code: "custom", message: "El video excede el tamaño permitido", path: ["promoVideo"] });
      }
    }
  });

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "0 MB";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds) {
  const value = Number(seconds || 0);
  if (!Number.isFinite(value) || value <= 0) return "Duración no disponible";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainingSeconds = Math.floor(value % 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
}

function isoFromDateInput(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const [y, m, d] = s.split("-").map((part) => Number(part));
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
}

function dateInputFromIso(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function validateVideoFile(file) {
  if (!file) return "Selecciona un archivo de video.";
  if (!COURSE_VIDEO_ALLOWED_TYPES.includes(String(file.type || "").trim())) {
    return "Formato de video no permitido. Usa MP4, WebM, OGG o MOV.";
  }
  if (Number(file.size || 0) > COURSE_VIDEO_MAX_SIZE_BYTES) {
    return `El video supera el máximo permitido de ${Math.round(COURSE_VIDEO_MAX_SIZE_BYTES / (1024 * 1024))}MB.`;
  }
  return "";
}

function extractVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve({ durationSeconds: 0 });
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const media = document.createElement("video");
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      const durationSeconds = Number.isFinite(media.duration) ? Math.round(media.duration) : 0;
      URL.revokeObjectURL(objectUrl);
      resolve({ durationSeconds });
    };
    media.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer el video seleccionado."));
    };
    media.src = objectUrl;
  });
}

function buildDraftStorageKey(actor, jobId) {
  const scope = String(jobId || "new").trim() || "new";
  const userId = String(actor?.uid || actor?.email || actor?.companyId || "anonymous").trim() || "anonymous";
  return `${COURSE_DRAFT_STORAGE_KEY}:${userId}:${scope}`;
}

function isCustomSlugForTitle(title, slug) {
  const normalizedTitleSlug = slugify(title);
  const normalizedSlug = String(slug || "").trim();
  return Boolean(normalizedSlug) && normalizedSlug !== normalizedTitleSlug;
}

function normalizeFormValues(values = {}, defaultValues) {
  return {
    ...defaultValues,
    ...values,
    classesCount: Number(values?.classesCount ?? values?.classes ?? defaultValues.classesCount ?? 1),
  };
}

function hasMeaningfulDraftContent(values) {
  if (!values || typeof values !== "object") return false;
  return [
    values.title,
    values.slug,
    values.category,
    values.level,
    values.modality,
    values.shortDescription,
    values.description,
    values.duration,
    values.promoVideo,
  ].some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(String(value || "").trim());
  });
}

function hasNestedFieldError(value) {
  if (!value) return false;
  if (typeof value === "object" && "message" in value && value.message) return true;
  if (Array.isArray(value)) return value.some((item) => hasNestedFieldError(item));
  if (typeof value === "object") return Object.values(value).some((item) => hasNestedFieldError(item));
  return false;
}

function findFirstTabWithErrors(formErrors) {
  return (
    TAB_ITEMS.find((tab) => (TAB_FIELD_MAP[tab.id] || []).some((field) => hasNestedFieldError(formErrors?.[field])))?.id ||
    "general"
  );
}

function sanitizeList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function sanitizeModules(modules) {
  return (Array.isArray(modules) ? modules : [])
    .map((module, index) => {
      const title = String(module?.title || "").trim();
      const description = String(module?.description || "").trim();
      const lessons = sanitizeList(module?.lessons);
      if (!title && !description && lessons.length === 0) return null;
      return {
        id: String(module?.id || `module-${Date.now()}-${index}`),
        title,
        description: description || undefined,
        lessons,
      };
    })
    .filter(Boolean);
}

function sanitizeAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => {
      const id = String(attachment?.id || "").trim();
      const name = String(attachment?.name || "").trim();
      const url = String(attachment?.url || "").trim();
      if (!id || !name || !url) return null;
      return {
        id,
        name,
        url,
        sizeBytes: Number.isFinite(Number(attachment?.sizeBytes)) ? Number(attachment.sizeBytes) : undefined,
      };
    })
    .filter(Boolean);
}

function getCourseLoadErrorMessage(error) {
  const code = String(error?.message || "").trim();
  if (!code) return "No se pudo cargar el curso. Revisa tu conexión e intenta nuevamente.";
  if (code === "course_not_found") return "No encontramos el curso solicitado o ya no está disponible para edición.";
  if (code === "forbidden") return "No tienes permisos para editar este curso con la cuenta actual.";
  if (code === "unauthorized" || code === "auth_required") return "Tu sesión venció. Vuelve a iniciar sesión para continuar.";
  if (code === "request_failed") return "La solicitud no pudo completarse. Intenta nuevamente en unos segundos.";
  return code;
}

function normalizeCategoryOptions(items = []) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es"));
}

function mapCourseToFormValues(current, defaultValues) {
  return {
    ...defaultValues,
    title: current.title || "",
    slug: current.slug || "",
    category: current.subRubro || "",
    level: current.level || "Todos los niveles",
    modality: current.modality || "100% Online",
    language: current.language || "Español",
    shortDescription: current.shortDescription || "",
    description: current.description || "",
    learningObjectives:
      Array.isArray(current.learningObjectives) && current.learningObjectives.length ? current.learningObjectives : [""],
    requirements:
      Array.isArray(current.requirements) && current.requirements.length
        ? sanitizeList(current.requirements)
        : typeof current.requirements === "string" && current.requirements.trim()
          ? current.requirements.split("\n").filter(Boolean)
          : [],
    targetAudience:
      Array.isArray(current.targetAudience) && current.targetAudience.length ? sanitizeList(current.targetAudience) : [],
    modules:
      Array.isArray(current.modules) && current.modules.length
        ? current.modules
        : [
            {
              id: `module-${Date.now()}`,
              title: "",
              description: "",
              lessons: [""],
            },
          ],
    duration: current.duration || "",
    classesCount: Number(current.classesCount || current.classes || 1),
    coverImage: current.imageUrl || "",
    thumbnail: current.thumbnailUrl || "",
    promoVideo: current.videoUrl || "",
    promoVideoFileName: current.videoFileName || "",
    promoVideoMimeType: current.videoMimeType || "",
    promoVideoSizeBytes: current.videoSizeBytes || undefined,
    promoVideoDurationSeconds: current.videoDurationSeconds || undefined,
    attachments: Array.isArray(current.attachments) ? current.attachments : [],
    price: Number(current.price || 0),
    oldPrice: Number.isFinite(Number(current.oldPrice)) ? Number(current.oldPrice) : undefined,
    freeCourse: Boolean(current.freeCourse),
    certificate: Boolean(current.includesCertificate),
    lifetimeAccess: Boolean(current.lifetimeAccess),
    downloadableResources: Boolean(current.downloadableResources),
    recordedClasses: Boolean(current.recordedClasses),
    support: Boolean(current.support),
    featured: Boolean(current.featured),
    allowEnrollment: current.allowEnrollment !== false,
    showOnHome: Boolean(current.showOnHome),
    status: current.publicationStatus || current.status || "borrador",
    expiresAtDate: dateInputFromIso(current.expiresAt),
  };
}

function FieldError({ error }) {
  if (!error?.message) return null;
  return <p className="text-sm text-destructive">{String(error.message)}</p>;
}

function SectionCard({ title, description, children }) {
  return (
    <div className="rounded-[28px] border border-border/60 bg-card p-5 md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-5">{children}</div>
    </div>
  );
}

function DynamicListField({ label, description, items, onChange, placeholder, error }) {
  const safeItems = Array.isArray(items) ? items : [];

  const updateItem = (index, value) => {
    const next = [...safeItems];
    next[index] = value;
    onChange(next);
  };

  const addItem = () => {
    onChange([...safeItems, ""]);
  };

  const removeItem = (index) => {
    onChange(safeItems.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="grid gap-3">
      <div>
        <Label>{label}</Label>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="grid gap-3">
        {safeItems.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3">
            <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
            <Input value={item} onChange={(event) => updateItem(index, event.target.value)} placeholder={placeholder} />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={addItem} className="justify-start">
        <Plus className="mr-2 h-4 w-4" />
        Agregar ítem
      </Button>
      <FieldError error={error} />
    </div>
  );
}

function ModulesField({ modules, onChange, error }) {
  const safeModules = Array.isArray(modules) ? modules : [];

  const updateModule = (index, patch) => {
    const next = [...safeModules];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addModule = () => {
    onChange([
      ...safeModules,
      {
        id: `module-${Date.now()}`,
        title: "",
        description: "",
        lessons: [""],
      },
    ]);
  };

  const removeModule = (index) => {
    onChange(safeModules.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="grid gap-4">
      <div>
        <Label>Programa del curso</Label>
        <p className="mt-1 text-sm text-muted-foreground">Ordena el temario en módulos y clases para que se entienda rápido.</p>
      </div>
      {safeModules.map((module, index) => (
        <div key={module.id || index} className="rounded-[24px] border border-border/60 bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">Módulo {index + 1}</div>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeModule(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label>Título del módulo</Label>
              <Input
                value={module.title || ""}
                onChange={(event) => updateModule(index, { title: event.target.value })}
                placeholder="Ej: Fundamentos"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción breve</Label>
              <Textarea
                rows={3}
                value={module.description || ""}
                onChange={(event) => updateModule(index, { description: event.target.value })}
                placeholder="Explica qué cubre este módulo."
              />
            </div>
            <DynamicListField
              label="Clases del módulo"
              items={module.lessons || []}
              onChange={(lessons) => updateModule(index, { lessons })}
              placeholder="Ej: Clase 1 · Introducción"
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={addModule} className="justify-start">
        <Plus className="mr-2 h-4 w-4" />
        Agregar módulo
      </Button>
      <FieldError error={error} />
    </div>
  );
}

export default function CourseWizard({ jobId }) {
  const buildLocalizedPath = useLocalizedPath();
  const router = useRouter();
  const { user } = useAuth();
  const { actor, loading: actorLoading, error: actorError } = useCourseActor();
  const [course, setCourse] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(Boolean(jobId));
  const [courseLoadError, setCourseLoadError] = useState("");
  const [courseLoadedAt, setCourseLoadedAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [courseLoadAttempt, setCourseLoadAttempt] = useState(0);
  const [slugTouchedManually, setSlugTouchedManually] = useState(Boolean(jobId));
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");

  const draftStorageKey = useMemo(() => buildDraftStorageKey(actor, jobId), [actor, jobId]);
  const activeTabIndex = TAB_ITEMS.findIndex((tab) => tab.id === activeTab);
  const isLastTab = activeTabIndex === TAB_ITEMS.length - 1;
  const isFirstTab = activeTabIndex <= 0;
  const busy = submitting || uploading;
  const primarySubmitLabel = actor?.role === "empresa" ? "Enviar a revisión" : "Guardar curso";
  const savingSubmitLabel = actor?.role === "empresa" ? "Enviando curso..." : "Guardando curso...";

  const defaultValues = useMemo(
    () => ({
      title: "",
      slug: "",
      category: "",
      level: "Todos los niveles",
      modality: "100% Online",
      language: "Español",
      shortDescription: "",
      description: "",
      learningObjectives: [""],
      requirements: [],
      targetAudience: [],
      modules: [
        {
          id: `module-${Date.now()}`,
          title: "",
          description: "",
          lessons: [""],
        },
      ],
      duration: "",
      classesCount: 1,
      coverImage: "",
      thumbnail: "",
      promoVideo: "",
      promoVideoFileName: "",
      promoVideoMimeType: "",
      promoVideoSizeBytes: undefined,
      promoVideoDurationSeconds: undefined,
      attachments: [],
      price: 0,
      oldPrice: undefined,
      freeCourse: false,
      certificate: false,
      lifetimeAccess: false,
      downloadableResources: false,
      recordedClasses: false,
      support: false,
      featured: false,
      allowEnrollment: true,
      showOnHome: false,
      status: "borrador",
      expiresAtDate: new Date().toISOString().slice(0, 10),
    }),
    []
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const values = watch();

  const onInvalidSubmit = (formErrors) => {
    const nextTab = findFirstTabWithErrors(formErrors);
    setActiveTab(nextTab);
    toast.error("Revisá los campos pendientes antes de guardar.", { position: "top-right" });
  };

  useEffect(() => {
    if (!values.title) return;
    if (slugTouchedManually) return;
    const generatedSlug = slugify(values.title);
    if (values.slug === generatedSlug) return;
    setValue("slug", generatedSlug, { shouldValidate: true, shouldDirty: true });
  }, [setValue, slugTouchedManually, values.slug, values.title]);

  useEffect(() => {
    setCategoryOptions((current) =>
      normalizeCategoryOptions([
        ...current,
        values.category,
        course?.subRubro,
      ])
    );
  }, [course?.subRubro, values.category]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (jobId || actorLoading || !actor) return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.values || !hasMeaningfulDraftContent(parsed.values)) return;
      reset(normalizeFormValues(parsed.values, defaultValues));
      setActiveTab(parsed.activeTab || "general");
      setDraftSavedAt(String(parsed.updatedAt || ""));
      setDraftRestored(true);
      setSlugTouchedManually(false);
      toast.success("Se recuperó un borrador del curso", { position: "top-right" });
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [actor, actorLoading, defaultValues, draftStorageKey, jobId, reset]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (jobId || actorLoading || !actor) return;
    if (!hasMeaningfulDraftContent(values)) {
      window.localStorage.removeItem(draftStorageKey);
      setDraftSavedAt("");
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const payload = { values, activeTab, updatedAt: new Date().toISOString() };
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      setDraftSavedAt(payload.updatedAt);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, actor, actorLoading, draftStorageKey, jobId, values]);

  useEffect(() => {
    let alive = true;
    async function loadCourse() {
      if (!jobId) {
        setLoadingCourse(false);
        setCourseLoadError("");
        setCourseLoadedAt("");
        return;
      }
      if (!user) return;
      setLoadingCourse(true);
      setCourseLoadError("");
      setCourseLoadedAt("");
      try {
        const data = await authedFetch(user, `/api/courses/${jobId}`, { method: "GET" });
        if (!alive) return;
        const current = data?.course || {};
        setCourse(current);
        reset(mapCourseToFormValues(current, defaultValues));
        setSlugTouchedManually(isCustomSlugForTitle(current?.title, current?.slug));
        setCourseLoadError("");
        setCourseLoadedAt(new Date().toISOString());
        toast.success("Curso cargado correctamente", { position: "top-right" });
      } catch (error) {
        if (!alive) return;
        setCourse(null);
        const nextError = getCourseLoadErrorMessage(error);
        setCourseLoadError(nextError);
        toast.error(nextError, { position: "top-right" });
      } finally {
        if (alive) setLoadingCourse(false);
      }
    }
    loadCourse();
    return () => {
      alive = false;
    };
  }, [courseLoadAttempt, defaultValues, jobId, reset, user]);

  const updateArrayField = (field, next) => {
    setValue(
      field,
      next.map((item) => String(item || "")),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  const updateModules = (nextModules) => {
    const next = nextModules.map((module, index) => ({
      id: String(module?.id || `module-${Date.now()}-${index}`),
      title: String(module?.title || ""),
      description: String(module?.description || ""),
      lessons: Array.isArray(module?.lessons) ? module.lessons.map((lesson) => String(lesson || "")) : [""],
    }));
    setValue("modules", next, { shouldValidate: true, shouldDirty: true });
  };

  const handleUpload = async (field, file, folder, successMessage) => {
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadToR2(file, folder);
      setValue(field, url, { shouldValidate: true, shouldDirty: true });
      clearErrors(field);
      toast.success(successMessage, { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No se pudo subir el archivo.", { position: "top-right" });
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentUpload = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const url = await uploadToR2(file, "courses/resources");
      const next = [
        ...(Array.isArray(values.attachments) ? values.attachments : []),
        {
          id: `attachment-${Date.now()}`,
          name: file.name,
          url,
          sizeBytes: file.size,
        },
      ];
      setValue("attachments", next, { shouldValidate: true, shouldDirty: true });
      toast.success("Archivo adicional cargado", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar el adjunto.", { position: "top-right" });
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (file) => {
    if (!file) return;
    const validationMessage = validateVideoFile(file);
    if (validationMessage) {
      setError("promoVideo", { type: "manual", message: validationMessage });
      toast.error(validationMessage, { position: "top-right" });
      return;
    }
    try {
      setUploading(true);
      const metadata = await extractVideoMetadata(file);
      const url = await uploadToR2(file, "courses/videos");
      setValue("promoVideo", url, { shouldValidate: true, shouldDirty: true });
      setValue("promoVideoFileName", file.name, { shouldValidate: false, shouldDirty: true });
      setValue("promoVideoMimeType", file.type, { shouldValidate: false, shouldDirty: true });
      setValue("promoVideoSizeBytes", file.size, { shouldValidate: false, shouldDirty: true });
      setValue("promoVideoDurationSeconds", metadata.durationSeconds || 0, { shouldValidate: false, shouldDirty: true });
      clearErrors("promoVideo");
      toast.success("Video de presentación cargado", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No se pudo cargar el video.", { position: "top-right" });
    } finally {
      setUploading(false);
    }
  };

  const clearLocalDraft = ({ resetForm = true, showToast = true } = {}) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(draftStorageKey);
    if (resetForm) {
      reset(defaultValues);
      setSlugTouchedManually(false);
      clearErrors();
      setActiveTab("general");
    }
    setDraftSavedAt("");
    setDraftRestored(false);
    if (showToast) {
      toast.success("Borrador limpiado", { position: "top-right" });
    }
  };

  const removeAttachment = (attachmentId) => {
    setValue(
      "attachments",
      (values.attachments || []).filter((item) => item.id !== attachmentId),
      { shouldValidate: true, shouldDirty: true }
    );
  };

  const handleTabChange = async (nextTab) => {
    const currentIndex = TAB_ITEMS.findIndex((tab) => tab.id === activeTab);
    const nextIndex = TAB_ITEMS.findIndex((tab) => tab.id === nextTab);
    if (nextIndex <= currentIndex) {
      setActiveTab(nextTab);
      return;
    }
    const valid = await trigger(TAB_FIELD_MAP[activeTab] || []);
    if (!valid) return;
    setActiveTab(nextTab);
  };

  const goToPreviousTab = () => {
    if (isFirstTab) return;
    setActiveTab(TAB_ITEMS[activeTabIndex - 1].id);
  };

  const goToNextTab = async () => {
    if (isLastTab) return;
    const valid = await trigger(TAB_FIELD_MAP[activeTab] || []);
    if (!valid) return;
    setActiveTab(TAB_ITEMS[activeTabIndex + 1].id);
  };

  const handleCreateCategory = async () => {
    const nextCategory = String(newCategoryTitle || "").trim();
    if (!nextCategory) {
      toast.error("Ingresá un título para la categoría.", { position: "top-right" });
      return;
    }
    const nextOptions = normalizeCategoryOptions([...categoryOptions, nextCategory]);
    setCategoryOptions(nextOptions);
    clearErrors("category");
    setValue("category", nextCategory, {
      shouldValidate: false,
      shouldDirty: true,
      shouldTouch: true,
    });
    await Promise.resolve();
    await trigger("category");
    setNewCategoryTitle("");
    setCategoryDialogOpen(false);
    toast.success("Categoría creada correctamente", { position: "top-right" });
  };

  const buildPayload = (formValues, mode) => {
    const isFree = Boolean(formValues.freeCourse);
    const resolvedInstitutionId = String(actor?.companyId || actor?.institutionId || course?.institutionId || course?.companyId || "").trim();
    const resolvedInstitutionName = String(
      actor?.companyName || actor?.institutionName || course?.institutionName || course?.companyName || ""
    ).trim();
    const learningObjectives = sanitizeList(formValues.learningObjectives);
    const requirementsList = sanitizeList(formValues.requirements);
    const targetAudience = sanitizeList(formValues.targetAudience);
    const modules = sanitizeModules(formValues.modules);
    const attachments = sanitizeAttachments(formValues.attachments);
    const shortDescription = String(formValues.shortDescription || "").trim();
    const description = String(formValues.description || "").trim();
    const duration = String(formValues.duration || "").trim();
    const modalityMap = {
      "100% Online": "Virtual",
      "En vivo": "Remoto",
      Híbrido: "Hibrido",
      Presencial: "Presencial",
    };

    return {
      academyId: resolvedInstitutionId || undefined,
      institutionId: resolvedInstitutionId || undefined,
      companyId: resolvedInstitutionId || undefined,
      title: formValues.title,
      slug: formValues.slug,
      institutionName: resolvedInstitutionName || undefined,
      companyName: resolvedInstitutionName || undefined,
      subRubro: formValues.category,
      area: undefined,
      modality: formValues.modality,
      level: formValues.level,
      language: formValues.language,
      shortDescription: shortDescription || undefined,
      description,
      requirements: requirementsList.join("\n"),
      learningObjectives,
      targetAudience,
      modules,
      duration,
      classes: Number(formValues.classesCount || 0),
      classesCount: Number(formValues.classesCount || 0),
      benefits: [
        formValues.certificate ? "Incluye certificado" : "",
        formValues.downloadableResources ? "Material descargable" : "",
        formValues.recordedClasses ? "Clases grabadas" : "",
        formValues.support ? "Tutorías" : "",
        formValues.lifetimeAccess ? "Acceso de por vida" : "",
      ]
        .filter(Boolean)
        .join("\n"),
      imageUrl: formValues.coverImage || undefined,
      thumbnailUrl: formValues.thumbnail || undefined,
      videoUrl: formValues.promoVideo || undefined,
      videoFileName: formValues.promoVideo ? formValues.promoVideoFileName || undefined : undefined,
      videoMimeType: formValues.promoVideo ? formValues.promoVideoMimeType || undefined : undefined,
      videoSizeBytes: formValues.promoVideo ? formValues.promoVideoSizeBytes || undefined : undefined,
      videoDurationSeconds: formValues.promoVideo ? formValues.promoVideoDurationSeconds || undefined : undefined,
      attachments,
      price: isFree ? 0 : Number(formValues.price || 0),
      oldPrice: formValues.oldPrice || undefined,
      freeCourse: isFree,
      includesCertificate: Boolean(formValues.certificate),
      lifetimeAccess: Boolean(formValues.lifetimeAccess),
      downloadableResources: Boolean(formValues.downloadableResources),
      recordedClasses: Boolean(formValues.recordedClasses),
      support: Boolean(formValues.support),
      featured: Boolean(formValues.featured),
      allowEnrollment: Boolean(formValues.allowEnrollment),
      showOnHome: Boolean(formValues.showOnHome),
      publicationStatus: formValues.status,
      status: mode === "publish" ? "activa" : mode === "review" ? "pendiente_revision" : formValues.status,
      expiresAt: isoFromDateInput(formValues.expiresAtDate),
      initialModality: modalityMap[formValues.modality] || "Virtual",
      workMode: modalityMap[formValues.modality] || "Virtual",
      city: String(course?.city || "").trim() || undefined,
      contractType: undefined,
      scheduleAvailability: [],
      contactEmail: actor?.email || undefined,
    };
  };

  const submit = async (formValues, mode) => {
    if (!user || submitting) return;
    const payload = buildPayload(formValues, mode);
    setSubmitting(true);
    try {
      if (jobId) {
        const data = await authedFetch(user, `/api/courses/${jobId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setCourse(data?.course || null);
        toast.success("Curso actualizado correctamente", { position: "top-right" });
        return data?.course;
      }
      const data = await authedFetch(user, "/api/courses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCourse(data?.course || null);
      toast.success(actor?.role === "empresa" ? "Curso enviado a revisión" : "Curso creado correctamente", { position: "top-right" });
      return data?.course;
    } catch (error) {
      console.error("Error guardando curso", {
        error,
        payload,
        mode,
        jobId: jobId || null,
      });
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (formValues) => {
    try {
      const mode = actor?.role === "admin" && formValues.status === "activa" ? "publish" : actor?.role === "admin" ? "draft" : "review";
      await submit(formValues, mode);
      clearLocalDraft({ resetForm: false, showToast: false });
      router.push(buildLocalizedPath("/dashboard/cursos"));
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el curso.", { position: "top-right" });
    }
  };

  if (actorLoading || loadingCourse) {
    return (
      <div className="rounded-[28px] border border-border/60 bg-card p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full border border-primary/15 bg-primary/5 p-2 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">
                {jobId ? "Cargando curso existente..." : "Cargando configurador de cursos..."}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {jobId
                  ? "Estamos trayendo la información del curso y preparando el formulario para edición."
                  : "Estamos preparando el formulario y las configuraciones necesarias."}
              </p>
            </div>
          </div>
          {jobId ? (
            <div className="rounded-full border border-border/60 bg-background px-4 py-2 text-xs font-medium text-muted-foreground">
              Esto puede tardar unos segundos en conexiones lentas
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (actorError) {
    return (
      <div className="rounded-[28px] border border-border/60 bg-card p-8">
        <h2 className="text-xl font-semibold text-foreground">No se pudo cargar el perfil del editor</h2>
        <p className="mt-2 text-sm text-muted-foreground">{actorError}</p>
      </div>
    );
  }

  if (jobId && courseLoadError) {
    return (
      <div className="rounded-[28px] border border-destructive/20 bg-card p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">No pudimos cargar el curso</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{courseLoadError}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setCourseLoadAttempt((value) => value + 1)}>
              Reintentar carga
            </Button>
            <Button type="button" asChild>
              <Link href={buildLocalizedPath("/dashboard/cursos")}>Volver al listado</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="grid gap-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="grid gap-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[24px] border border-border/60 bg-card p-2">
            {TAB_ITEMS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="rounded-[18px] px-4 py-2.5 data-[state=active]:bg-[#1B2B50] data-[state=active]:text-white"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="general" className="mt-0 grid gap-6">
            <SectionCard title="Información base" description="Solo quedan los datos imprescindibles para vender el curso.">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Título del curso</Label>
                  <Input placeholder="Ej: Diseño UX para e-learning" {...register("title")} />
                  <FieldError error={errors.title} />
                </div>
                <div className="grid gap-2">
                  <Label>URL del curso</Label>
                  <input type="hidden" {...register("slug")} />
                  <div className="flex min-h-10 items-center rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground">
                    {values.slug || "Se generará automáticamente desde el título"}
                  </div>
                  <FieldError error={errors.slug} />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Categoría</Label>
                  <div className="flex gap-2">
                    <Select
                      value={values.category || ""}
                      onValueChange={(value) => {
                        clearErrors("category");
                        setValue("category", value, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setCategoryDialogOpen(true)} aria-label="Crear categoría">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <FieldError error={errors.category} />
                </div>
                <div className="grid gap-2">
                  <Label>Nivel</Label>
                  <Select value={values.level || ""} onValueChange={(value) => setValue("level", value, { shouldValidate: true, shouldDirty: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar nivel" />
                    </SelectTrigger>
                    <SelectContent>
                      {COURSE_LEVELS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.level} />
                </div>
                <div className="grid gap-2">
                  <Label>Modalidad</Label>
                  <Select value={values.modality || ""} onValueChange={(value) => setValue("modality", value, { shouldValidate: true, shouldDirty: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar modalidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {COURSE_SALES_MODALITIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.modality} />
                </div>
                <div className="grid gap-2">
                  <Label>Idioma</Label>
                  <Select value={values.language || ""} onValueChange={(value) => setValue("language", value, { shouldValidate: true, shouldDirty: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      {COURSE_LANGUAGES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="content" className="mt-0 grid gap-6">
            <SectionCard title="Contenido educativo" description="Cuenta qué resuelve el curso y organiza su propuesta de aprendizaje.">
              <div className="grid gap-2">
                <Label>Descripción corta</Label>
                <Textarea rows={3} maxLength={180} placeholder="Resumen breve orientado a venta y conversión." {...register("shortDescription")} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Máximo 180 caracteres</span>
                  <span>{String(values.shortDescription || "").length}/180</span>
                </div>
                <FieldError error={errors.shortDescription} />
              </div>
              <div className="grid gap-2">
                <Label>Descripción completa</Label>
                <Textarea rows={8} placeholder="Desarrolla la propuesta, metodología, beneficios y resultados." {...register("description")} />
                <FieldError error={errors.description} />
              </div>
            </SectionCard>

            <SectionCard title="Aprendizaje y estructura" description="Organiza el contenido con listas y módulos editables.">
              <DynamicListField
                label="¿Qué aprenderás?"
                description="Resultados concretos que el alumno obtendrá."
                items={values.learningObjectives || []}
                onChange={(next) => updateArrayField("learningObjectives", next)}
                placeholder="Ej: Diseñar landing pages con foco en conversión"
                error={errors.learningObjectives}
              />
              <DynamicListField
                label="Requisitos previos"
                description="Conocimientos previos o herramientas necesarias."
                items={values.requirements || []}
                onChange={(next) => updateArrayField("requirements", next)}
                placeholder="Ej: Manejo básico de Figma"
                error={errors.requirements}
              />
              <DynamicListField
                label="Audiencia objetivo"
                items={values.targetAudience || []}
                onChange={(next) => updateArrayField("targetAudience", next)}
                placeholder="Ej: Diseñadores UX que venden formación online"
                error={errors.targetAudience}
              />
              <ModulesField modules={values.modules || []} onChange={updateModules} error={errors.modules} />
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Duración estimada (horas/semanas)</Label>
                  <Input placeholder="Ej: 12 horas / 6 semanas" {...register("duration")} />
                  <FieldError error={errors.duration} />
                </div>
                <div className="grid gap-2">
                  <Label>Cantidad de clases</Label>
                  <Input
                    type="number"
                    min="1"
                    value={values.classesCount ?? 1}
                    onChange={(event) => setValue("classesCount", Number(event.target.value || 0), { shouldValidate: true, shouldDirty: true })}
                  />
                  <FieldError error={errors.classesCount} />
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="resources" className="mt-0 grid gap-6">
            <SectionCard title="Multimedia y recursos" description="Sube solo lo necesario para mostrar y vender mejor el curso.">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="grid gap-3">
                  <Label>Portada del curso</Label>
                  <div className="rounded-[24px] border border-border/60 bg-background p-4">
                    <Input type="file" accept="image/*" onChange={(e) => handleUpload("coverImage", e.target.files?.[0], "courses/covers", "Portada cargada")} disabled={busy} />
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <UploadCloud className="h-4 w-4" />
                      Optimizada para catálogo y detalle.
                    </div>
                  </div>
                  {values.coverImage ? <FilePreview url={values.coverImage} title="Portada del curso" variant="compact" /> : null}
                </div>

                <div className="grid gap-3">
                  <Label>Miniatura</Label>
                  <div className="rounded-[24px] border border-border/60 bg-background p-4">
                    <Input type="file" accept="image/*" onChange={(e) => handleUpload("thumbnail", e.target.files?.[0], "courses/thumbnails", "Miniatura cargada")} disabled={busy} />
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <UploadCloud className="h-4 w-4" />
                      Ideal para cards pequeñas y carruseles.
                    </div>
                  </div>
                  {values.thumbnail ? <FilePreview url={values.thumbnail} title="Miniatura del curso" variant="compact" /> : null}
                </div>
              </div>

              <div className="grid gap-3">
                <Label>Video promocional</Label>
                <div className="rounded-[24px] border border-border/60 bg-background p-4">
                  <Input type="file" accept={COURSE_VIDEO_ALLOWED_TYPES.join(",")} onChange={(e) => handleVideoUpload(e.target.files?.[0])} disabled={busy} />
                  <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                    <Film className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Usa MP4, WebM, OGG o MOV. Máximo {Math.round(COURSE_VIDEO_MAX_SIZE_BYTES / (1024 * 1024))}MB.</span>
                  </div>
                  {values.promoVideo ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full border border-border/60 bg-card px-3 py-1">{values.promoVideoFileName || "Video cargado"}</span>
                      <span className="rounded-full border border-border/60 bg-card px-3 py-1">{formatBytes(values.promoVideoSizeBytes)}</span>
                      <span className="rounded-full border border-border/60 bg-card px-3 py-1">{formatDuration(values.promoVideoDurationSeconds)}</span>
                    </div>
                  ) : null}
                </div>
                <FieldError error={errors.promoVideo} />
                {values.promoVideo ? <FilePreview url={values.promoVideo} title="Video de presentación" variant="compact" /> : null}
              </div>

              <div className="grid gap-3">
                  <Label>Archivos o guías complementarias</Label>
                <div className="rounded-[24px] border border-border/60 bg-background p-4">
                  <Input type="file" onChange={(e) => handleAttachmentUpload(e.target.files?.[0])} disabled={busy} />
                  <div className="mt-3 text-sm text-muted-foreground">Sube PDFs, plantillas o recursos complementarios.</div>
                </div>
                {(values.attachments || []).length ? (
                  <div className="grid gap-3">
                    {values.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">{attachment.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatBytes(attachment.sizeBytes)}</div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeAttachment(attachment.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="pricing" className="mt-0 grid gap-6">
            <SectionCard title="Comercialización" description="Configura el posicionamiento comercial del curso con la menor fricción posible.">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Precio</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.price ?? 0}
                    onChange={(event) => setValue("price", Number(event.target.value || 0), { shouldValidate: true, shouldDirty: true })}
                  />
                  <FieldError error={errors.price} />
                </div>
                <div className="grid gap-2">
                  <Label>Precio anterior</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.oldPrice ?? ""}
                    onChange={(event) =>
                      setValue("oldPrice", event.target.value ? Number(event.target.value) : undefined, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                  <FieldError error={errors.oldPrice} />
                </div>
                <div className="grid gap-2">
                  <Label>Curso gratuito</Label>
                  <div className="rounded-2xl border border-border/60 bg-background px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm text-muted-foreground">Actívalo para publicar sin precio visible.</div>
                      <Switch checked={Boolean(values.freeCourse)} onCheckedChange={(checked) => setValue("freeCourse", checked, { shouldValidate: true, shouldDirty: true })} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["certificate", "Incluye certificado oficial ACAV"],
                  ["lifetimeAccess", "Acceso de por vida"],
                  ["downloadableResources", "Material descargable"],
                  ["recordedClasses", "Clases grabadas"],
                  ["support", "Tutorías / Soporte"],
                ].map(([field, label]) => (
                  <div key={field} className="rounded-[22px] border border-border/60 bg-background px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">{label}</div>
                      <Switch
                        checked={Boolean(values[field])}
                        onCheckedChange={(checked) => setValue(field, checked, { shouldValidate: true, shouldDirty: true })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="publish" className="mt-0 grid gap-6">
            <SectionCard title="Publicación" description="Define cómo se publica el curso y qué tan visible será dentro del ecosistema ACAV.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["featured", "Destacar en la portada"],
                  ["allowEnrollment", "Permitir inscripciones abiertas"],
                  ["showOnHome", "Mostrar en catálogo principal"],
                ].map(([field, label]) => (
                  <div key={field} className="rounded-[22px] border border-border/60 bg-background px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">{label}</div>
                      <Switch
                        checked={Boolean(values[field])}
                        onCheckedChange={(checked) => setValue(field, checked, { shouldValidate: true, shouldDirty: true })}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Estado</Label>
                  <Select value={values.status || ""} onValueChange={(value) => setValue("status", value, { shouldValidate: true, shouldDirty: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLICATION_STATUS_OPTIONS.filter((option) => COURSE_PUBLICATION_VISIBILITY.includes(option.value)).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError error={errors.status} />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha de publicación / vigencia</Label>
                  <Input type="date" {...register("expiresAtDate")} />
                  <FieldError error={errors.expiresAtDate} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Vista previa ejecutiva" description="Resumen rápido para validar la propuesta antes de guardar.">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[24px] border border-border/60 bg-background p-5">
                  <div className="inline-flex rounded-full border border-[#DD4913]/20 bg-[#DD4913]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#DD4913]">
                    {values.category || "Categoría"}
                  </div>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#1B2B50]">{values.title || "Nuevo curso"}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{values.shortDescription || "La descripción corta aparecerá aquí."}</p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-[#DCE6F4] bg-white px-3 py-1">{values.modality || "Modalidad"}</span>
                    <span className="rounded-full border border-[#DCE6F4] bg-white px-3 py-1">{values.level || "Nivel"}</span>
                    <span className="rounded-full border border-[#DCE6F4] bg-white px-3 py-1">{values.duration || "Duración"}</span>
                  </div>
                </div>
                <div className="rounded-[24px] border border-border/60 bg-background p-5">
                  <div className="text-sm font-semibold text-foreground">Resumen comercial</div>
                  <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                    <div>Precio: {values.freeCourse ? "Gratuito" : values.price ? `$ ${values.price}` : "Sin definir"}</div>
                    <div>Inscripciones: {values.allowEnrollment ? "Abiertas" : "Cerradas"}</div>
                    <div>Certificado: {values.certificate ? "Incluido" : "No incluido"}</div>
                    <div>Video: {values.promoVideo ? "Cargado" : "Pendiente"}</div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {uploading ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Subiendo archivos...
            </div>
          ) : (
            <div />
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {!isFirstTab ? (
              <Button type="button" variant="outline" onClick={goToPreviousTab} disabled={busy}>
                Anterior
              </Button>
            ) : null}
            {!isLastTab ? (
              <Button type="button" variant="outline" onClick={goToNextTab} disabled={busy}>
                Siguiente
              </Button>
            ) : null}
            {isLastTab ? (
              <Button type="submit" disabled={busy} className="min-w-[190px]">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {submitting ? savingSubmitLabel : primarySubmitLabel}
              </Button>
            ) : null}
          </div>
        </div>

        {course?.slug ? (
          <div className="text-sm text-muted-foreground">
            <Link href={buildLocalizedPath(`/cursos/${course.slug}`)} className="font-semibold text-primary">
              Ver curso en la web pública
            </Link>
          </div>
        ) : null}
      </form>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent size="sm" className="max-w-lg rounded-[28px] border border-border/60 p-0">
          <DialogHeader className="border-b border-border/60 px-6 py-5">
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>Creá una categoría nueva para este curso.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 px-6 py-5">
            <Label htmlFor="new-course-category">Título</Label>
            <Input
              id="new-course-category"
              value={newCategoryTitle}
              onChange={(event) => setNewCategoryTitle(event.target.value)}
              placeholder="Ej: Revenue Management"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateCategory();
                }
              }}
            />
          </div>
          <DialogFooter className="border-t border-border/60 px-6 py-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCategoryDialogOpen(false);
                setNewCategoryTitle("");
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateCategory}>
              Crear categoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
