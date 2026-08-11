"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Eye,
  ExternalLink,
  FileArchive,
  FileQuestion,
  FileText,
  FileVideo,
  Film,
  FolderKanban,
  GripVertical,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  Plus,
  Rocket,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FilePreview from "@/components/courses/file-preview";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { cn, useLocalizedPath } from "@/lib/utils";
import {
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  COURSE_PUBLICATION_VISIBILITY,
  COURSE_SALES_MODALITIES,
  COURSE_VIDEO_ALLOWED_TYPES,
  COURSE_VIDEO_MAX_SIZE_BYTES,
} from "@/lib/courses/constants";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import LessonVideoUploader from "@/components/courses/dashboard/lesson-video-uploader";
import ResourceUploader, {
  fileIconFor as resourceFileIconFor,
  formatSize as resourceFormatSize,
} from "@/components/courses/dashboard/resource-uploader";
import MediaUploader from "@/components/courses/dashboard/media-uploader";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import {
  readinessProgressText,
  readinessTone,
  summarizeLessonResources,
} from "@/lib/courses/resource-readiness";
import { CourseEvaluationSchema } from "@/lib/courses/schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


const COURSE_DRAFT_STORAGE_KEY = "acav:courses:wizard-draft-v2";
const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

const TAB_ITEMS = [
  { id: "general", label: "Información", description: "Base del curso", icon: BookOpen },
  { id: "content", label: "Contenido", description: "Estructura y clases", icon: Layers },
  { id: "resources", label: "Recursos", description: "Portada y adjuntos", icon: Film },
  { id: "pricing", label: "Ventas", description: "Precio y beneficios", icon: Settings2 },
  { id: "publish", label: "Publicación", description: "Estado y visibilidad", icon: Rocket },
];

const PUBLICATION_STATUS_OPTIONS = [
  { value: "borrador", label: "Borrador", tone: "secondary", description: "Solo visible para administradores. Ideal para editar sin que nadie lo vea." },
  { value: "pendiente_revision", label: "En revisión", tone: "info", description: "Curso enviado a validación. El equipo admin aprueba antes de publicarlo." },
  { value: "activa", label: "Publicado", tone: "success", description: "Visible en el catálogo. Los alumnos pueden inscribirse." },
  { value: "pausada", label: "Oculto", tone: "warning", description: "Quitado del catálogo público. Las inscripciones ya confirmadas siguen activas." },
  { value: "cerrada", label: "Finalizado", tone: "destructive", description: "Cerrado definitivamente. No admite nuevas inscripciones." },
];

const TAB_FIELD_MAP = {
  general: ["title", "slug", "category", "level", "modality", "language"],
  content: ["shortDescription", "description", "learningObjectives", "requirements", "targetAudience", "curriculum", "finalEvaluation", "duration"],
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
        .default([])
    ),
    curriculum: z.preprocess(
      (value) => sanitizeCurriculum(value),
      z
        .array(
          z.object({
            id: z.string().min(1),
            title: z.string().min(1, "El título de la sección es obligatorio"),
            description: z.string().optional(),
            lessons: z
              .array(
                z.object({
                  id: z.string().min(1),
                  title: z.string().min(1, "El título de la clase es obligatorio"),
                  description: z.string().optional(),
                  lessonType: z.enum(["video", "text", "live", "quiz", "assignment", "download"]),
                  durationMinutes: z.number().min(0).optional(),
                  videoUrl: z.string().url().optional().or(z.literal("")),
                  thumbnailUrl: z.string().url().optional().or(z.literal("")),
                  content: z.string().optional(),
                  isPreview: z.boolean(),
                  resources: z.array(
                    z.object({
                      id: z.string().min(1),
                      label: z.string().min(1, "El nombre del recurso es obligatorio"),
                      url: z.string().url("La URL del recurso no es válida"),
                      kind: z.enum(["video", "document", "image", "archive", "link", "file"]).optional(),
                      mimeType: z.string().optional(),
                      fileSize: z.number().min(0).optional(),
                    })
                  ),
                  videoAsset: z
                    .object({
                      url: z.string().url().optional().or(z.literal("")),
                      storageKey: z.string().optional(),
                      mimeType: z.string().optional(),
                      fileSize: z.number().min(0).optional(),
                      durationSeconds: z.number().min(0).optional(),
                      status: z.enum(["pending", "uploading", "ready", "corrupt"]).optional(),
                      checksum: z.string().optional(),
                      uploadedAt: z.string().optional(),
                      qualities: z
                        .array(
                          z.object({
                            label: z.string().min(1),
                            url: z.string().url(),
                            width: z.number().int().min(0).optional(),
                            height: z.number().int().min(0).optional(),
                          })
                        )
                        .optional(),
                      subtitles: z
                        .array(
                          z.object({
                            src: z.string().url(),
                            label: z.string().min(1),
                            srclang: z.string().min(2),
                            default: z.boolean().optional(),
                          })
                        )
                        .optional(),
                    })
                    .optional()
                    .nullable(),
                  evaluation: CourseEvaluationSchema.optional(),
                })
              )
              .min(1, "Cada sección debe tener al menos una clase"),
          })
        )
        .min(1, "Agrega al menos una sección con contenido")
    ),
    finalEvaluation: z.preprocess(
      (value) => sanitizeFinalEvaluation(value),
      z.object({
        enabled: z.boolean(),
        title: z.string().optional(),
        description: z.string().optional(),
        passingScore: z.number().min(0).max(100).optional(),
        maxAttempts: z.number().int().min(1).optional(),
        questions: z.array(
          z.object({
            id: z.string().min(1),
            prompt: z.string().min(1, "La pregunta es obligatoria"),
            type: z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]),
            options: z.array(z.string().min(1)).default([]),
            correctAnswers: z.array(z.string().min(1)).default([]),
            explanation: z.string().optional(),
          })
        ),
      })
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
    promoVideoAsset: z
      .object({
        url: z.string().url().optional().or(z.literal("")),
        storageKey: z.string().optional(),
        mimeType: z.string().optional(),
        fileSize: z.number().min(0).optional(),
        durationSeconds: z.number().min(0).optional(),
        status: z.enum(["pending", "uploading", "ready", "corrupt"]).optional(),
        checksum: z.string().optional(),
        uploadedAt: z.string().optional(),
        qualities: z
          .array(
            z.object({
              label: z.string().min(1),
              url: z.string().url(),
              width: z.number().int().min(0).optional(),
              height: z.number().int().min(0).optional(),
            })
          )
          .optional(),
        subtitles: z
          .array(
            z.object({
              src: z.string().url(),
              label: z.string().min(1),
              srclang: z.string().min(2),
              default: z.boolean().optional(),
            })
          )
          .optional(),
      })
      .optional()
      .nullable(),
    attachments: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        url: z.string().url().or(z.literal("")).optional(),
        sizeBytes: z.number().optional(),
        fileSize: z.number().min(0).optional(),
        kind: z.enum(["video", "document", "image", "archive", "file", "link"]).optional(),
        subKind: z.string().optional(),
        status: z.enum(["pending", "uploading", "ready", "corrupt"]).optional(),
        mimeType: z.string().optional(),
        storageKey: z.string().optional(),
        checksum: z.string().optional(),
        uploadedAt: z.string().optional(),
        previewUrl: z.string().url().optional().or(z.literal("")),
      })
    ),
    price: z.number().min(0, "El precio no puede ser negativo"),
    oldPrice: z.number().min(0, "El precio no socios no puede ser negativo").optional(),
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
    const validSections = sanitizeCurriculum(values.curriculum);
    if (validSections.length === 0) {
      ctx.addIssue({ code: "custom", message: "Agrega al menos una sección con clases.", path: ["curriculum"] });
    }
    const lessonsCount = countCurriculumLessons(validSections);
    if (lessonsCount <= 0) {
      ctx.addIssue({ code: "custom", message: "El curso necesita al menos una clase cargada.", path: ["curriculum"] });
    }

    const finalEvaluation = sanitizeFinalEvaluation(values.finalEvaluation);
    if (finalEvaluation.enabled) {
      if (!String(finalEvaluation.title || "").trim()) {
        ctx.addIssue({ code: "custom", message: "Define un título para la evaluación final.", path: ["finalEvaluation", "title"] });
      }
      if ((Array.isArray(finalEvaluation.questions) ? finalEvaluation.questions : []).length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Agrega al menos una pregunta en la evaluación final.",
          path: ["finalEvaluation", "questions"],
        });
      }

      (Array.isArray(finalEvaluation.questions) ? finalEvaluation.questions : []).forEach((question, index) => {
        const optionsCount = Array.isArray(question.options) ? question.options.length : 0;
        const answersCount = Array.isArray(question.correctAnswers) ? question.correctAnswers.length : 0;
        if (["single_choice", "multiple_choice"].includes(question.type) && optionsCount < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Las preguntas de opción deben tener al menos dos respuestas posibles.",
            path: ["finalEvaluation", "questions", index, "options"],
          });
        }
        if (["single_choice", "multiple_choice", "true_false"].includes(question.type) && answersCount === 0) {
          ctx.addIssue({
            code: "custom",
            message: "Define al menos una respuesta correcta.",
            path: ["finalEvaluation", "questions", index, "correctAnswers"],
          });
        }
      });
    }
    if (!values.freeCourse && Number(values.price || 0) <= 0) {
      ctx.addIssue({ code: "custom", message: "Indica un precio o marca el curso como gratuito", path: ["price"] });
    }
    if (Number.isFinite(Number(values.oldPrice || 0)) && Number(values.oldPrice || 0) < Number(values.price || 0)) {
      ctx.addIssue({ code: "custom", message: "El precio no socios debe ser mayor o igual al precio socios", path: ["oldPrice"] });
    }
    if (values.promoVideo) {
      const external = isExternalVideoOnly({ url: String(values.promoVideo || ""), mimeType: undefined });
      if (!external) {
        const hasAsset =
          values.promoVideoAsset &&
          typeof values.promoVideoAsset === "object" &&
          (values.promoVideoAsset.url || values.promoVideoAsset.storageKey);
        const assetOriginal = hasAsset ? values.promoVideoAsset.originalName : undefined;
        const assetStorage = hasAsset ? values.promoVideoAsset.storageKey : undefined;
        const pathForName = hasAsset
          ? values.promoVideoAsset.url || values.promoVideoAsset.storageKey || values.promoVideo
          : values.promoVideo;
        const inferredFromPath =
          String(pathForName || "").split("/").pop()?.split("?")[0] || "";
        const fileName =
          String(values.promoVideoFileName || "").trim() ||
          String(assetOriginal || "").trim() ||
          String(assetStorage || "").trim() ||
          inferredFromPath;
        const mimeType =
          String(values.promoVideoMimeType || "").trim() ||
          String(hasAsset ? values.promoVideoAsset.mimeType || "" : "").trim() ||
          (fileName && ["mp4", "m4v"].includes(fileName.split(".").pop()?.toLowerCase() || "")
            ? "video/mp4"
            : fileName && ["webm"].includes(fileName.split(".").pop()?.toLowerCase() || "")
              ? "video/webm"
              : fileName && ["mov", "qt"].includes(fileName.split(".").pop()?.toLowerCase() || "")
                ? "video/quicktime"
                : fileName && ["mkv"].includes(fileName.split(".").pop()?.toLowerCase() || "")
                  ? "video/x-matroska"
                  : "");
        const sizeBytes = Number(
          values.promoVideoSizeBytes ?? (hasAsset ? values.promoVideoAsset.fileSize : undefined) ?? 0
        );

        if (!fileName) {
          ctx.addIssue({ code: "custom", message: "Falta el nombre del video cargado", path: ["promoVideo"] });
        }
        if (!COURSE_VIDEO_ALLOWED_TYPES.includes(mimeType)) {
          ctx.addIssue({ code: "custom", message: "Formato de video inválido", path: ["promoVideo"] });
        }
        if (sizeBytes > COURSE_VIDEO_MAX_SIZE_BYTES) {
          ctx.addIssue({ code: "custom", message: "El video excede el tamaño permitido", path: ["promoVideo"] });
        }
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
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
}

function datePartsInAppTimeZone(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
}

function dateInputToday() {
  const parts = datePartsInAppTimeZone(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function clampDateInputToTodayOrFuture(value) {
  const input = String(value || "").trim();
  const today = dateInputToday();
  if (!input) return today;
  return input < today ? today : input;
}

function dateInputFromIso(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return "";
  const parts = datePartsInAppTimeZone(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
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
  const curriculum = sanitizeCurriculum(values?.curriculum);
  const baseCurriculum = curriculum.length ? curriculum : sanitizeCurriculum(defaultValues?.curriculum);
  return {
    ...defaultValues,
    ...values,
    modality: resolveSalesModalityForForm(values),
    learningObjectives: sanitizeList(values?.learningObjectives).length ? sanitizeList(values.learningObjectives) : sanitizeList(defaultValues?.learningObjectives),
    requirements: sanitizeList(values?.requirements).length ? sanitizeList(values.requirements) : sanitizeList(defaultValues?.requirements),
    targetAudience: sanitizeList(values?.targetAudience).length ? sanitizeList(values.targetAudience) : sanitizeList(defaultValues?.targetAudience),
    curriculum: baseCurriculum.length ? baseCurriculum : defaultValues.curriculum,
    modules: buildLegacyModulesFromCurriculum(baseCurriculum.length ? baseCurriculum : defaultValues.curriculum),
    finalEvaluation: sanitizeFinalEvaluation(values?.finalEvaluation ?? defaultValues.finalEvaluation),
    attachments: sanitizeAttachments(values?.attachments ?? defaultValues.attachments),
    expiresAtDate: clampDateInputToTodayOrFuture(values?.expiresAtDate ?? defaultValues?.expiresAtDate),
    classesCount: countCurriculumLessons(baseCurriculum) || Number(values?.classesCount ?? values?.classes ?? defaultValues.classesCount ?? 1),
  };
}

function hasMeaningfulDraftContent(values) {
  if (!values || typeof values !== "object") return false;
  const meaningfulCurriculum = sanitizeCurriculum(values.curriculum);
  const meaningfulEvaluation = sanitizeFinalEvaluation(values.finalEvaluation);
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
    meaningfulCurriculum.length ? "curriculum" : "",
    meaningfulEvaluation.enabled && meaningfulEvaluation.questions.length ? "evaluation" : "",
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

function findFirstErrorMessage(formErrors) {
  if (!formErrors || typeof formErrors !== "object") return "";
  for (const value of Object.values(formErrors)) {
    if (!value) continue;
    if (typeof value === "object" && "message" in value && typeof value.message === "string" && value.message.trim()) {
      return value.message.trim();
    }
    if (typeof value === "object") {
      const nestedMessage = findFirstErrorMessage(value);
      if (nestedMessage) return nestedMessage;
    }
  }
  return "";
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

function createEntityId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeResourceKind(kind, hint = {}) {
  const valid = ["video", "document", "image", "archive", "link"];
  const raw = String(kind || "").trim().toLowerCase();
  if (valid.includes(raw)) return raw;
  if (raw === "file" || raw === "embed") {
    const url = String(hint?.url || hint?.href || "").toLowerCase();
    const mime = String(hint?.mimeType || hint?.type || "").toLowerCase();
    const name = String(hint?.name || hint?.label || hint?.title || "").toLowerCase();
    if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(url) || /\.(mp4|webm|mov|m4v)$/i.test(name)) return "video";
    if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|svg)$/i.test(url) || /\.(jpe?g|png|webp)$/i.test(name)) return "image";
    if (/\.(zip|rar|7z|tar|gz)$/i.test(url) || /\.(zip|rar|7z|tar|gz)$/i.test(name) || mime.includes("zip") || mime.includes("rar") || mime.includes("compressed") || mime.includes("archive")) return "archive";
    return "document";
  }
  if (valid.length === 0) return undefined;
  return undefined;
}

function sanitizeLessonResources(resources) {
  return (Array.isArray(resources) ? resources : [])
    .map((resource, index) => {
      const label = String(resource?.label || resource?.name || resource?.title || "").trim();
      const url = String(resource?.url || resource?.href || resource?.link || "").trim();
      if (!label && !url) return null;
      const kind = normalizeResourceKind(resource?.kind, {
        url,
        mimeType: resource?.mimeType || resource?.type,
        name: resource?.name || resource?.label || resource?.title,
      });
      const mimeTypeRaw = String(resource?.mimeType || resource?.type || "").trim() || undefined;
      const fileSizeRaw = Number(resource?.fileSize || resource?.size);
      const fileSize = Number.isFinite(fileSizeRaw) && fileSizeRaw > 0 ? fileSizeRaw : undefined;
      const statusRaw = String(resource?.status || "");
      const hasExplicitStatus = ["pending", "uploading", "ready", "corrupt"].includes(statusRaw);
      const status = hasExplicitStatus
        ? (statusRaw === "pending" && url ? "ready" : statusRaw)
        : url
          ? "ready"
          : undefined;
      const subKindRaw = String(resource?.subKind || "").trim();
      const subKind = subKindRaw ? subKindRaw : undefined;
      return {
        id: String(resource?.id || createEntityId(`resource-${index}`)),
        label,
        url,
        ...(kind ? { kind } : {}),
        ...(mimeTypeRaw ? { mimeType: mimeTypeRaw } : {}),
        ...(fileSize ? { fileSize } : {}),
        ...(status ? { status } : {}),
        ...(subKind ? { subKind } : {}),
        ...(resource?.checksum ? { checksum: String(resource.checksum) } : {}),
        ...(resource?.storageKey ? { storageKey: String(resource.storageKey) } : {}),
        ...(resource?.uploadedAt ? { uploadedAt: String(resource.uploadedAt) } : {}),
        ...(resource?.previewUrl ? { previewUrl: String(resource.previewUrl) } : {}),
      };
    })
    .filter((resource) => resource?.label && resource?.url);
}

function sanitizeLessonEvaluationQuestions(questions) {
  return (Array.isArray(questions) ? questions : [])
    .map((question, index) => {
      const type = String(question?.type || "single_choice").trim() || "single_choice";
      const prompt = String(question?.prompt || question?.enunciado || "").trim();
      const optionsRaw = Array.isArray(question?.options) ? question.options : [];
      const options = optionsRaw.map((option) => String(option || "").trim());
      if (options.length < 2) options.push("", "");
      const nonEmptyOptions = options.filter((option) => Boolean(option));
      const correctAnswersRaw =
        question?.correctAnswer !== undefined && question?.correctAnswers === undefined
          ? question.correctAnswer
          : question?.correctAnswers;
      const correctAnswers = sanitizeCorrectAnswers(correctAnswersRaw);
      const hasCorrect = Array.isArray(correctAnswers) && correctAnswers.length > 0 && correctAnswers.some((c) => String(c || "").trim());
      const points = Number(question?.points || 0);
      const isEffectivelyConfigured =
        Boolean(prompt) &&
        (nonEmptyOptions.length >= 2 ||
          type === "short_answer" ||
          type === "true_false");
      return {
        id: String(question?.id || createEntityId(`q-${index}`)),
        type,
        prompt,
        options,
        correctAnswers,
        hasCorrect: Boolean(hasCorrect),
        isEffectivelyConfigured: Boolean(isEffectivelyConfigured),
        explanation: question?.explanation ? String(question.explanation) : undefined,
        points: Number.isFinite(points) && points > 0 ? points : undefined,
      };
    })
    .filter((question) => question?.prompt || (Array.isArray(question?.options) && question.options.some((option) => option)));
}

function sanitizeCurriculum(curriculum) {
  return (Array.isArray(curriculum) ? curriculum : [])
    .map((section, sectionIndex) => {
      const title = String(section?.title || "").trim();
      const description = String(section?.description || "").trim();
      const rawLessons = Array.isArray(section?.lessons)
        ? section.lessons
        : Array.isArray(section?.classes)
          ? section.classes
          : Array.isArray(section?.items)
            ? section.items
            : [];
      const lessons = rawLessons
        .map((lesson, lessonIndex) => {
          if (typeof lesson === "string") {
            const lessonTitle = String(lesson || "").trim();
            if (!lessonTitle) return null;
            return {
              id: createEntityId(`lesson-${sectionIndex}-${lessonIndex}`),
              title: lessonTitle,
              description: undefined,
              lessonType: "video",
              durationMinutes: undefined,
              videoUrl: undefined,
              videoAsset: undefined,
              thumbnailUrl: undefined,
              content: undefined,
              isPreview: false,
              resources: [],
            };
          }
          const lessonTitle = String(lesson?.title || "").trim();
          const lessonDescription = String(lesson?.description || "").trim();
          const lessonType = String(lesson?.lessonType || lesson?.type || "video").trim() || "video";
          const durationMinutes = Number(lesson?.durationMinutes || 0);
          const videoAssetRaw = lesson?.videoAsset;
          const hasVideoAssetShape = videoAssetRaw && typeof videoAssetRaw === "object" && (videoAssetRaw.url || videoAssetRaw.storageKey);
          const videoAssetPurged = hasVideoAssetShape && videoAssetRaw.__purged === true;
          const videoAsset = hasVideoAssetShape && !videoAssetPurged
            ? {
                url: String(videoAssetRaw.url || "").trim() || undefined,
                storageKey: videoAssetRaw.storageKey ? String(videoAssetRaw.storageKey) : undefined,
                mimeType: videoAssetRaw.mimeType ? String(videoAssetRaw.mimeType) : undefined,
                fileSize: Number.isFinite(Number(videoAssetRaw.fileSize)) ? Number(videoAssetRaw.fileSize) : undefined,
                durationSeconds: Number.isFinite(Number(videoAssetRaw.durationSeconds)) ? Number(videoAssetRaw.durationSeconds) : undefined,
                status: ["pending", "uploading", "ready", "corrupt"].includes(String(videoAssetRaw.status || "")) ? videoAssetRaw.status : undefined,
                checksum: videoAssetRaw.checksum ? String(videoAssetRaw.checksum) : undefined,
                uploadedAt: videoAssetRaw.uploadedAt ? String(videoAssetRaw.uploadedAt) : undefined,
                qualities: Array.isArray(videoAssetRaw.qualities)
                  ? videoAssetRaw.qualities.map((quality) => ({
                      label: String(quality?.label || ""),
                      url: String(quality?.url || ""),
                      width: Number.isFinite(Number(quality?.width)) ? Number(quality?.width) : undefined,
                      height: Number.isFinite(Number(quality?.height)) ? Number(quality?.height) : undefined,
                    }))
                  : undefined,
                subtitles: Array.isArray(videoAssetRaw.subtitles)
                  ? videoAssetRaw.subtitles.map((subtitle) => ({
                      src: String(subtitle?.src || ""),
                      label: String(subtitle?.label || ""),
                      srclang: String(subtitle?.srclang || ""),
                      default: typeof subtitle?.default === "boolean" ? subtitle.default : undefined,
                    }))
                  : undefined,
              }
            : undefined;
          const videoUrlCandidate = String(lesson?.videoUrl || lesson?.url || "").trim();
          const videoAssetUrl = videoAsset?.url ? String(videoAsset.url).trim() : "";
          const videoUrl = videoUrlCandidate || videoAssetUrl;
          const thumbnailUrl = String(lesson?.thumbnailUrl || lesson?.thumbnail || "").trim();
          const content = String(lesson?.content || lesson?.body || "").trim();
          const resources = sanitizeLessonResources(lesson?.resources || lesson?.attachments);
          const evaluationRaw = lesson?.evaluation;
          const evaluation =
            evaluationRaw && typeof evaluationRaw === "object" && (evaluationRaw.enabled || Array.isArray(evaluationRaw.questions))
              ? {
                  enabled: Boolean(evaluationRaw.enabled),
                  title: evaluationRaw.title ? String(evaluationRaw.title) : undefined,
                  description: evaluationRaw.description ? String(evaluationRaw.description) : undefined,
                  passingScore: Number.isFinite(Number(evaluationRaw.passingScore)) ? Number(evaluationRaw.passingScore) : undefined,
                  maxAttempts: Number.isFinite(Number(evaluationRaw.maxAttempts)) ? Number(evaluationRaw.maxAttempts) : undefined,
                  durationMinutes: Number.isFinite(Number(evaluationRaw.durationMinutes)) ? Number(evaluationRaw.durationMinutes) : undefined,
                  locked: typeof evaluationRaw.locked === "boolean" ? evaluationRaw.locked : undefined,
                  questions: Array.isArray(evaluationRaw.questions) ? sanitizeLessonEvaluationQuestions(evaluationRaw.questions) : [],
                }
              : undefined;
          const hasAnyValue = Boolean(
            lessonTitle || lessonDescription || content || videoUrl || (resources && resources.length) || evaluation
          );
          if (!hasAnyValue) {
            const id = lesson?.id ? String(lesson.id || "") : createEntityId(`lesson-${sectionIndex}-${lessonIndex}`);
            if (lesson?.id) {
              return {
                id,
                title: "",
                description: undefined,
                lessonType: "video",
                durationMinutes: undefined,
                videoUrl: undefined,
                videoAsset: undefined,
                thumbnailUrl: undefined,
                content: undefined,
                isPreview: Boolean(lesson?.isPreview || lesson?.preview),
                resources: Array.isArray(resources) ? resources : [],
              };
            }
            return null;
          }
          return {
            id: String(lesson?.id || createEntityId(`lesson-${sectionIndex}-${lessonIndex}`)),
            title: lessonTitle,
            description: lessonDescription || undefined,
            lessonType,
            durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : undefined,
            videoUrl: videoUrl || undefined,
            videoAsset,
            thumbnailUrl: thumbnailUrl || undefined,
            content: content || undefined,
            isPreview: Boolean(lesson?.isPreview || lesson?.preview),
            resources,
            ...(evaluation ? { evaluation } : {}),
          };
        })
        .filter(Boolean);

      if (!title && !description && lessons.length === 0) return null;
      return {
        id: String(section?.id || createEntityId(`section-${sectionIndex}`)),
        title,
        description: description || undefined,
        lessons,
      };
    })
    .filter((section) => section?.title && Array.isArray(section?.lessons) && section.lessons.length > 0);
}

function sanitizeQuestionOptions(options) {
  return (Array.isArray(options) ? options : [])
    .map((option) => String(option || "").trim())
    .filter(Boolean);
}

function sanitizeCorrectAnswers(value) {
  if (Array.isArray(value)) return sanitizeQuestionOptions(value);
  if (!value) return [];
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeFinalEvaluation(finalEvaluation) {
  const source = finalEvaluation && typeof finalEvaluation === "object" ? finalEvaluation : {};
  const enabled = Boolean(source?.enabled);
  const questions = (Array.isArray(source?.questions) ? source.questions : [])
    .map((question, index) => {
      const prompt = String(question?.prompt || "").trim();
      const type = String(question?.type || "single_choice").trim() || "single_choice";
      const options = sanitizeQuestionOptions(question?.options);
      const correctAnswers =
        type === "true_false"
          ? sanitizeCorrectAnswers(question?.correctAnswers).slice(0, 1)
          : sanitizeCorrectAnswers(question?.correctAnswers);
      const explanation = String(question?.explanation || "").trim();
      if (!prompt && options.length === 0 && correctAnswers.length === 0 && !explanation) return null;
      return {
        id: String(question?.id || createEntityId(`question-${index}`)),
        prompt,
        type,
        options: type === "short_answer" || type === "true_false" ? options : options,
        correctAnswers,
        explanation: explanation || undefined,
      };
    })
    .filter((question) => question?.prompt);

  return {
    enabled,
    title: String(source?.title || "").trim() || undefined,
    description: String(source?.description || "").trim() || undefined,
    passingScore: Number.isFinite(Number(source?.passingScore)) ? Number(source.passingScore) : undefined,
    maxAttempts: Number.isFinite(Number(source?.maxAttempts)) ? Number(source.maxAttempts) : undefined,
    questions,
  };
}

function countCurriculumLessons(curriculum) {
  return sanitizeCurriculum(curriculum).reduce((total, section) => total + (Array.isArray(section?.lessons) ? section.lessons.length : 0), 0);
}

function buildCurriculumFromModules(modules) {
  return (Array.isArray(modules) ? modules : [])
    .map((module, sectionIndex) => {
      const rawLessons = Array.isArray(module?.lessons) ? module.lessons : [];
      return {
        id: String(module?.id || createEntityId(`section-${sectionIndex}`)),
        title: String(module?.title || "").trim(),
        description: String(module?.description || "").trim() || undefined,
        lessons: rawLessons
          .map((lesson, lessonIndex) => {
            if (typeof lesson === "string") {
              const title = String(lesson || "").trim();
              if (!title) return null;
              return {
                id: createEntityId(`lesson-${sectionIndex}-${lessonIndex}`),
                title,
                description: undefined,
                lessonType: "video",
                durationMinutes: undefined,
                videoUrl: undefined,
                thumbnailUrl: undefined,
                content: undefined,
                isPreview: false,
                resources: [],
              };
            }

            if (!lesson || typeof lesson !== "object") return null;
            const title = String(lesson?.title || lesson?.name || "").trim();
            if (!title) return null;
            return {
              id: String(lesson?.id || createEntityId(`lesson-${sectionIndex}-${lessonIndex}`)),
              title,
              description: String(lesson?.description || "").trim() || undefined,
              lessonType: String(lesson?.lessonType || lesson?.type || "video").trim() || "video",
              durationMinutes: Number.isFinite(Number(lesson?.durationMinutes)) ? Number(lesson.durationMinutes) : undefined,
              videoUrl: String(lesson?.videoUrl || lesson?.url || "").trim() || undefined,
              thumbnailUrl: String(lesson?.thumbnailUrl || lesson?.thumbnail || "").trim() || undefined,
              content: String(lesson?.content || "").trim() || undefined,
              isPreview: Boolean(lesson?.isPreview || lesson?.preview),
              resources: sanitizeLessonResources(lesson?.resources),
            };
          })
          .filter(Boolean),
      };
    })
    .filter((section) => section.title && Array.isArray(section.lessons) && section.lessons.length > 0);
}

function resolveSalesModalityForForm(current) {
  const raw = String(current?.modality || current?.initialModality || current?.workMode || "").trim();
  if (!raw) return "100% Online";
  if (COURSE_SALES_MODALITIES.includes(raw)) return raw;
  if (raw === "Virtual") return "100% Online";
  if (raw === "Remoto") return "En vivo";
  if (raw === "Hibrido") return "Híbrido";
  return raw === "Presencial" ? "Presencial" : "100% Online";
}

function resolveCurriculumForForm(current, defaultValues) {
  const normalizedCurriculum = sanitizeCurriculum(current?.curriculum);
  if (normalizedCurriculum.length) return normalizedCurriculum;

  const normalizedModulesCurriculum = sanitizeCurriculum(buildCurriculumFromModules(current?.modules));
  if (normalizedModulesCurriculum.length) return normalizedModulesCurriculum;

  return defaultValues.curriculum;
}

function buildLegacyModulesFromCurriculum(curriculum) {
  return sanitizeCurriculum(curriculum).map((section, index) => ({
    id: String(section?.id || createEntityId(`module-${index}`)),
    title: String(section?.title || "").trim(),
    description: String(section?.description || "").trim() || undefined,
    lessons: (Array.isArray(section?.lessons) ? section.lessons : []).map((lesson) => String(lesson?.title || "").trim()).filter(Boolean),
  }));
}

function sanitizeAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .map((attachment) => {
      const id = String(attachment?.id || "").trim() || createEntityId("attachment");
      const legacyName = String(attachment?.name || attachment?.label || "").trim();
      const legacyUrl = String(attachment?.url || "").trim();
      const hasLegacy = legacyName && legacyUrl;
      const hasNewShape = ["ready", "uploading", "pending", "corrupt"].includes(String(attachment?.status || "")) || Boolean(attachment?.kind);
      if (!hasLegacy && !hasNewShape) return null;
      const normalizedKind = normalizeResourceKind(attachment?.kind, {
        url: attachment?.url || legacyUrl,
        mimeType: attachment?.mimeType,
        name: attachment?.name || attachment?.label || legacyName,
      });
      const normalizedStatusRaw = String(attachment?.status || "");
      const attachmentHasUrl = Boolean(attachment?.url || legacyUrl);
      let normalizedStatus;
      if (["uploading", "ready", "corrupt"].includes(normalizedStatusRaw)) normalizedStatus = normalizedStatusRaw;
      else if (normalizedStatusRaw === "pending" && attachmentHasUrl) normalizedStatus = "ready";
      else if (!normalizedStatusRaw && attachmentHasUrl) normalizedStatus = "ready";
      else normalizedStatus = normalizedStatusRaw || "pending";
      return {
        id,
        name: attachment?.name || legacyName || undefined,
        label: attachment?.label || legacyName || undefined,
        url: attachment?.url || legacyUrl || "",
        fileSize: Number.isFinite(Number(attachment?.fileSize ?? attachment?.sizeBytes)) ? Number(attachment?.fileSize ?? attachment?.sizeBytes) : undefined,
        sizeBytes: Number.isFinite(Number(attachment?.sizeBytes ?? attachment?.fileSize)) ? Number(attachment?.sizeBytes ?? attachment?.fileSize) : undefined,
        kind: normalizedKind || "document",
        subKind: attachment?.subKind || undefined,
        status: normalizedStatus,
        mimeType: attachment?.mimeType || undefined,
        storageKey: attachment?.storageKey || undefined,
        checksum: attachment?.checksum || undefined,
        uploadedAt: attachment?.uploadedAt || undefined,
        previewUrl: attachment?.previewUrl || undefined,
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
  const resolvedCurriculum = resolveCurriculumForForm(current, defaultValues);
  const resolvedClassesCount =
    countCurriculumLessons(resolvedCurriculum) ||
    Number(current?.classesCount || current?.classes || 1);

  return {
    ...defaultValues,
    title: current.title || "",
    slug: current.slug || "",
    category: current.subRubro || "",
    level: current.level || "Todos los niveles",
    modality: resolveSalesModalityForForm(current),
    language: current.language || "Español",
    shortDescription: current.shortDescription || "",
    description: current.description || "",
    learningObjectives:
      Array.isArray(current.learningObjectives) && current.learningObjectives.length
        ? sanitizeList(current.learningObjectives)
        : typeof current.learningObjectives === "string" && current.learningObjectives.trim()
          ? current.learningObjectives.split("\n").map((item) => item.trim()).filter(Boolean)
          : [],
    requirements:
      Array.isArray(current.requirements) && current.requirements.length
        ? sanitizeList(current.requirements)
        : typeof current.requirements === "string" && current.requirements.trim()
          ? current.requirements.split("\n").filter(Boolean)
          : [],
    targetAudience:
      Array.isArray(current.targetAudience) && current.targetAudience.length
        ? sanitizeList(current.targetAudience)
        : typeof current.targetAudience === "string" && current.targetAudience.trim()
          ? current.targetAudience.split("\n").map((item) => item.trim()).filter(Boolean)
          : [],
    curriculum: resolvedCurriculum,
    modules:
      Array.isArray(current.modules) && current.modules.length
        ? current.modules
        : buildLegacyModulesFromCurriculum(resolvedCurriculum),
    duration: current.duration || "",
    finalEvaluation: sanitizeFinalEvaluation(current.finalEvaluation),
    classesCount: resolvedClassesCount,
    coverImage: current.imageUrl || "",
    thumbnail: current.thumbnailUrl || "",
    promoVideo: current.videoUrl || "",
    promoVideoFileName: current.videoFileName || "",
    promoVideoMimeType: current.videoMimeType || "",
    promoVideoSizeBytes: current.videoSizeBytes || undefined,
    promoVideoDurationSeconds: current.videoDurationSeconds || undefined,
    promoVideoAsset: current.videoAsset || current.promoVideoAsset || null,
    attachments: sanitizeAttachments(current.attachments),
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
    expiresAtDate: clampDateInputToTodayOrFuture(dateInputFromIso(current.expiresAt)),
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

function resolveWorkspaceItemState(error) {
  if (hasNestedFieldError(error)) return "warning";
  return "ready";
}

function WorkspaceSidebar({ activeTab, onSelect, values, errors }) {
  return (
    <aside className="rounded-[28px] border border-border/60 bg-card p-4 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Navegación</div>
      </div>

      <div className="grid gap-2">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const state = resolveWorkspaceItemState(
            item.id === "general"
              ? {
                  title: errors.title,
                  category: errors.category,
                  level: errors.level,
                  modality: errors.modality,
                  language: errors.language,
                }
              : errors[item.id]
          );
          const isActive = activeTab === item.id;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`flex w-full items-center gap-3 rounded-[22px] border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-[#1B2B50]/15 bg-[#1B2B50] text-white shadow-[0_12px_30px_rgba(27,43,80,0.14)]"
                      : "border-border/60 bg-background text-foreground hover:border-[#1B2B50]/20 hover:bg-[#FAFAFC]"
                  }`}
                >
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${
                      isActive ? "bg-white/12 text-white" : "bg-[#F4F6FA] text-[#1B2B50]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{item.label}</span>
                      {state === "warning" ? <AlertCircle className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-amber-500"}`} /> : null}
                      {state === "ready" && !hasNestedFieldError(errors[item.id]) ? (
                        <CheckCircle2 className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-emerald-500"}`} />
                      ) : null}
                    </span>
                    <span className={`mt-0.5 block text-xs ${isActive ? "text-white/70" : "text-muted-foreground"}`}>{item.description}</span>
                  </span>
                  <ChevronRight className={`h-4 w-4 ${isActive ? "text-white" : "text-muted-foreground"}`} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="max-w-[200px] leading-5">
                  <div className="font-semibold">{item.label}</div>
                  <div className="mt-1 text-[11px] text-slate-100/90">{item.description}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
}

function WorkspaceSummary({ values, course, publicHref }) {
  const sectionsCount = Array.isArray(values.curriculum) ? values.curriculum.length : 0;
  const lessonsCount = countCurriculumLessons(values.curriculum);
  const resourcesCount = (Array.isArray(values.attachments) ? values.attachments.length : 0)
    + sanitizeCurriculum(values.curriculum).reduce(
      (total, section) => total + (Array.isArray(section?.lessons) ? section.lessons.reduce((sum, lesson) => sum + (Array.isArray(lesson?.resources) ? lesson.resources.length : 0), 0) : 0),
      0
    );
  const completionItems = [
    { label: "Información", done: Boolean(values.title && values.category && values.level) },
    { label: "Contenido", done: sectionsCount > 0 && lessonsCount > 0 },
    { label: "Examen", done: !values.finalEvaluation?.enabled || Boolean(values.finalEvaluation?.questions?.length) },
    { label: "Precio", done: Boolean(values.freeCourse || Number(values.price || 0) > 0) },
    { label: "Publicación", done: Boolean(values.status && values.expiresAtDate) },
  ];
}

function ChipListField({ label, description, items, onChange, placeholder, error }) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const [draft, setDraft] = useState("");

  const addDraft = () => {
    const next = String(draft || "").trim();
    if (!next) return;
    onChange([...safeItems, next]);
    setDraft("");
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
      <div className="rounded-[22px] border border-border/60 bg-background p-3">
        <div className="flex flex-wrap gap-2">
          {safeItems.map((item, index) => (
            <span key={`${item}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm">
              {item}
              <button type="button" className="text-muted-foreground" onClick={() => removeItem(index)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addDraft();
                }
              }}
              placeholder={placeholder}
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            <Button type="button" variant="ghost" size="sm" onClick={addDraft}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar
            </Button>
          </div>
        </div>
      </div>
      <FieldError error={error} />
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

function resourceKindBadge(kind) {
  switch (kind) {
    case "video":
      return { icon: FileVideo, tone: "bg-[#EEF4FF] text-[#1B2B50]" };
    case "document":
      return { icon: FileText, tone: "bg-emerald-50 text-emerald-700" };
    case "image":
      return { icon: FolderKanban, tone: "bg-purple-50 text-purple-700" };
    case "archive":
      return { icon: FileArchive, tone: "bg-amber-50 text-amber-700" };
    default:
      return { icon: FileQuestion, tone: "bg-slate-100 text-slate-700" };
  }
}

function resourceStatusBadge(status) {
  switch (status) {
    case "ready":
      return { label: "Listo", tone: "bg-emerald-50 text-emerald-700 border border-emerald-100" };
    case "uploading":
      return { label: "Subiendo…", tone: "bg-sky-50 text-sky-700 border border-sky-100" };
    case "corrupt":
      return { label: "Corrupto", tone: "bg-destructive/10 text-destructive border border-destructive/20" };
    case "pending":
    default:
      return { label: "Pendiente", tone: "bg-slate-100 text-slate-600 border border-slate-200" };
  }
}

function LessonResourcesField({ resources, onChange }) {
  const safeResources = Array.isArray(resources) ? resources : [];
  const summary = summarizeLessonResources({ resources: safeResources });

  const removeResource = (index) => {
    onChange(safeResources.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateResource = (index, patch) => {
    onChange(
      safeResources.map((r, currentIndex) =>
        currentIndex === index && r ? { ...r, ...patch } : r
      )
    );
  };

  const tone = readinessTone(summary);
  const toneMap = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    secondary: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="grid gap-4 rounded-[20px] border border-border/60 bg-background p-4">
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-center gap-3">
          <Label className="text-base">Recursos de la clase</Label>
          {summary.hasAny ? (
            <Badge variant="outline" className={cn("gap-1.5", toneMap[tone])}>
              {readinessProgressText(summary)}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          PDF, DOCX, imágenes, videos, links.
        </p>
      </div>

      <MediaUploader
        folderPrefix="courses/lessons/resources"
        value={safeResources}
        onChange={onChange}
        hideExistingItems
        helperText=""
      />

      {safeResources.length ? (
        <div className="grid gap-3">
          {safeResources.map((resource, index) => {
            const { icon: Icon, tone: iconTone } = resourceKindBadge(resource.kind);
            const resourceHasUrl = Boolean(resource.url);
            const statusRaw = ["pending", "uploading", "ready", "corrupt"].includes(resource.status)
              ? resource.status
              : undefined;
            const statusValue = statusRaw === "ready" || statusRaw === "uploading" || statusRaw === "corrupt"
              ? statusRaw
              : resourceHasUrl
                ? "ready"
                : (statusRaw || "pending");
            const statusBadge = resourceStatusBadge(statusValue);
            const sizeLabel = resourceFormatSize(resource.fileSize);
            const subKindOptions = ["Materiales del curso", "Material complementario", "Apunte", "Ejercicio", "Examen"];
            return (
              <div
                key={resource.id || index}
                className="grid items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {resource.label || resource.name || "(Recurso sin nombre)"}
                    </span>
                    <Select
                      value={resource.subKind || "__none__"}
                      onValueChange={(val) => updateResource(index, { subKind: val === "__none__" ? undefined : val })}
                    >
                      <SelectTrigger className="h-5 w-auto min-w-[120px] rounded-full border border-border/70 px-2 py-0 text-[10px] uppercase tracking-wide">
                        <SelectValue placeholder="Tipo de material" />
                      </SelectTrigger>
                      <SelectContent align="start" className="text-[11px]">
                        <SelectItem value="__none__">Sin tipo</SelectItem>
                        {subKindOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={statusValue}
                      onValueChange={(val) => updateResource(index, { status: val })}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-5 w-auto min-w-[92px] rounded-full px-2 py-0 text-[10px] font-medium border",
                          statusBadge.tone
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="text-[11px]">
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="uploading">Subiendo…</SelectItem>
                        <SelectItem value="ready">Listo</SelectItem>
                        <SelectItem value="corrupt">Corrupto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {sizeLabel ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{sizeLabel}</span> : null}
                    {resource.mimeType ? <span className="truncate">{resource.mimeType}</span> : null}
                    {resource.checksum ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                            <ShieldCheck className="h-3 w-3" /> Integridad
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="max-w-[340px] break-all text-[11px] leading-5">
                            Checksum SHA-256 — {resource.checksum}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-2 justify-self-end">
                  {resource.url ? (
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      title="Abrir recurso"
                    >
                      <a href={resource.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeResource(index)}
                    className="shrink-0 self-start h-8 w-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function LessonEditorHeader({ selectedSection, selectedLesson, onRemove, disabled }) {
  const summary = summarizeLessonResources(selectedLesson);
  const tone = readinessTone(summary);
  const toneMap = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    secondary: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="grid gap-4 rounded-[22px] border border-border/60 bg-card p-4 md:grid-cols-[1fr_auto] md:items-start min-w-0 overflow-hidden">
      <div className="grid gap-0.5 min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {selectedSection?.title || "Sección"}
        </div>
        <div className="truncate text-lg font-semibold tracking-[-0.03em] text-foreground">
          {selectedLesson?.title || "Nueva clase"}
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 md:justify-end min-w-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {summary.hasAny ? (
            <Badge variant="outline" className={cn(toneMap[tone])}>
              {readinessProgressText(summary)}
            </Badge>
          ) : null}
          {selectedLesson?.isPreview ? <Badge variant="outline">Clase abierta</Badge> : null}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={disabled} className="shrink-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function toEmbedUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (parsed.pathname.toLowerCase().startsWith("/embed/")) return raw;
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        const clean = new URL(`https://www.youtube.com/embed/${videoId}`);
        for (const [k, v] of parsed.searchParams.entries()) {
          if (k.toLowerCase() === "v") continue;
          if (["t", "start", "end", "rel", "controls", "autoplay", "mute", "loop", "playlist"].includes(k.toLowerCase())) {
            clean.searchParams.set(k, v);
          }
        }
        return clean.toString();
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,})/i);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      const liveMatch = parsed.pathname.match(/^\/live\/([A-Za-z0-9_-]{6,})/i);
      if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}`;
      const embedMatch = parsed.pathname.match(/^\/v\/([A-Za-z0-9_-]{6,})/i);
      if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (id) {
        const clean = new URL(`https://www.youtube.com/embed/${id}`);
        for (const [k, v] of parsed.searchParams.entries()) {
          if (["t", "start", "end", "rel", "controls", "autoplay", "mute", "loop", "playlist"].includes(k.toLowerCase())) {
            clean.searchParams.set(k, v);
          }
        }
        return clean.toString();
      }
    }
    if (host === "vimeo.com") {
      const idMatch = parsed.pathname.match(/^\/(\d{5,})(?:\/|$)/);
      if (idMatch) return `https://player.vimeo.com/video/${idMatch[1]}${parsed.search || ""}`;
    }
    if (host === "player.vimeo.com") return raw;
  } catch {
    return raw;
  }
  return raw;
}

function isEmbedUrl(url) {
  const u = String(url || "").trim().toLowerCase();
  if (!u) return false;
  return u.includes("youtube.com") || u.includes("youtu.be") || u.includes("vimeo.com") || u.includes("dailymotion.com") || u.includes("loom.com") || u.includes("player.") || u.startsWith("https://") || u.startsWith("http://");
}

function isExternalVideoOnly(video) {
  if (!video) return false;
  if (typeof video === "object" && (video.storageKey || video.checksum)) return false;
  const url = typeof video === "string" ? video : video?.url;
  if (!url) return false;
  if (video.mimeType && /^video\//i.test(String(video.mimeType || ""))) return false;
  return isEmbedUrl(url);
}

function LessonVideoSection({ videoUrl, videoAsset, onVideoUrlChange, onVideoAssetChange, onVideoChangeCombined }) {
  const hasAsset = videoAsset && typeof videoAsset === "object" && (videoAsset.url || videoAsset.storageKey);
  const rawUrl = String(videoUrl || "").trim();
  const hasUrl = Boolean(rawUrl);
  const urlSource = rawUrl || (hasAsset ? String(videoAsset?.url || "") : "");
  const displayValueUrl = urlSource ? (isEmbedUrl(urlSource) ? toEmbedUrl(urlSource) : urlSource) : "";
  const isExternalOnly = Boolean(displayValueUrl) && !hasAsset && isExternalVideoOnly({ url: displayValueUrl, mimeType: undefined });
  const state = hasAsset
    ? { tone: resourceStatusBadge(videoAsset.status || "ready").tone, label: "Asset subido" }
    : displayValueUrl
      ? { tone: resourceStatusBadge("pending").tone, label: isExternalOnly ? "URL externa" : "URL activa" }
      : null;

  const applyPatch = (patch) => {
    if (typeof onVideoChangeCombined === "function") {
      onVideoChangeCombined(patch);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "videoUrl")) onVideoUrlChange(patch.videoUrl);
    if (Object.prototype.hasOwnProperty.call(patch, "videoAsset")) onVideoAssetChange(patch.videoAsset);
  };

  const handleCombinedChange = (nextUrl, assetData, extras) => {
    const urlRaw = String(nextUrl || "").trim();
    const url = urlRaw ? toEmbedUrl(urlRaw) : "";
    const clearing = !url;
    const hasAssetParam = Boolean(assetData && typeof assetData === "object" && (assetData.url || assetData.storageKey));
    const externalNoAsset = extras === null && url;

    if (clearing) {
      applyPatch({ videoUrl: "", videoAsset: undefined });
      return;
    }

    if (externalNoAsset) {
      applyPatch({ videoUrl: url, videoAsset: undefined });
      return;
    }

    if (hasAssetParam) {
      applyPatch({
        videoUrl: url,
        videoAsset: {
          url: assetData.url || url || videoAsset?.url || "",
          storageKey: assetData.storageKey || videoAsset?.storageKey || undefined,
          mimeType: assetData.mimeType || videoAsset?.mimeType || undefined,
          fileSize: assetData.fileSize ?? videoAsset?.fileSize ?? undefined,
          status: assetData.status || videoAsset?.status || "ready",
          checksum: assetData.checksum || videoAsset?.checksum || undefined,
          uploadedAt: assetData.uploadedAt || videoAsset?.uploadedAt || new Date().toISOString(),
          originalName: assetData.originalName || videoAsset?.originalName || undefined,
        },
      });
    } else {
      applyPatch({ videoUrl: url, videoAsset: undefined });
    }
  };

  return (
    <div className="grid gap-4 rounded-[20px] border border-border/60 bg-background p-4">
      <div className="grid gap-1 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Label className="flex items-center gap-2 text-base">
            <FileVideo className="h-4 w-4 text-[#1B2B50]" />
            Video de la clase
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">Pegá una URL de YouTube / Vimeo o el enlace directo al video.</p>
        </div>
        {state ? (
          <Badge variant="outline" className={cn(state.tone)}>
            {state.label}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3">
        <LessonVideoUploader
          value={displayValueUrl || ""}
          asset={videoAsset}
          onChange={handleCombinedChange}
          compact
          forceUrlOnly={true}
        />
      </div>
    </div>
  );
}

function PerClassEvaluationField({ value, onChange, resourcesSummary }) {
  const evaluation = value && typeof value === "object" ? value : { enabled: false, questions: [] };
  const questions = Array.isArray(evaluation.questions) ? evaluation.questions : [];
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const allResourcesReady = resourcesSummary?.hasAny ? resourcesSummary.allReady : true;

  useEffect(() => {
    const firstQuestion = questions[0];
    const exists = questions.some((question) => String(question?.id || "") === String(selectedQuestionId || ""));
    if (!exists && firstQuestion?.id) {
      setSelectedQuestionId(String(firstQuestion.id));
    }
  }, [questions, selectedQuestionId]);

  const updateField = (patch) => {
    onChange({ ...evaluation, ...patch });
  };

  const updateQuestion = (index, patch) => {
    const next = [...questions];
    next[index] = { ...next[index], ...patch };
    updateField({ questions: next });
  };

  const addQuestion = () => {
    updateField({
      questions: [
        ...questions,
        {
          id: createEntityId("question"),
          prompt: "",
          type: "single_choice",
          options: ["", ""],
          correctAnswers: [],
          explanation: "",
        },
      ],
    });
  };

  const removeQuestion = (index) => {
    updateField({ questions: questions.filter((_, currentIndex) => currentIndex !== index) });
  };

  const updateQuestionOptions = (index, nextOptions) => {
    updateQuestion(index, { options: nextOptions });
  };

  const selectedQuestion =
    questions.find((question) => String(question?.id || "") === String(selectedQuestionId || "")) || questions[0] || null;
  const selectedQuestionIndex = questions.findIndex((question) => String(question?.id || "") === String(selectedQuestion?.id || ""));

  const totalQuestions = questions.length;
  const configuredQuestions = questions.filter((q) => q?.isEffectivelyConfigured === true).length;
  const withCorrect = questions.filter((q) => q?.hasCorrect === true).length;
  const isFullyConfigured =
    Boolean(evaluation.enabled) &&
    totalQuestions > 0 &&
    configuredQuestions === totalQuestions &&
    withCorrect === totalQuestions;

  let resourceState = null;
  if (evaluation.enabled) {
    if (!isFullyConfigured) {
      const missingReasons = [];
      if (totalQuestions === 0) missingReasons.push("sin preguntas");
      else if (configuredQuestions < totalQuestions) missingReasons.push(`${totalQuestions - configuredQuestions} sin configurar`);
      if (withCorrect < totalQuestions && totalQuestions > 0) missingReasons.push(`${totalQuestions - withCorrect} sin respuesta correcta`);
      resourceState = {
        tone: "bg-amber-50 text-amber-700 border-amber-100",
        label: `Pendiente${missingReasons.length ? ` · ${missingReasons.join(", ")}` : ""}`,
      };
    } else if (!allResourcesReady) {
      resourceState = { tone: "bg-amber-50 text-amber-700 border-amber-100", label: "Bloqueada · recursos pendientes" };
    } else {
      resourceState = { tone: "bg-emerald-50 text-emerald-700 border-emerald-100", label: "Habilitada" };
    }
  } else {
    resourceState = { tone: "bg-slate-100 text-slate-600 border-slate-200", label: "Deshabilitada" };
  }
  const missingQuestionsList = totalQuestions > 0 ? questions
    .map((q, i) => ({ q, i }))
    .filter(({ q }) => !q?.isEffectivelyConfigured || !q?.hasCorrect)
    .map(({ q, i }) => {
      const label = (String(q?.prompt || "").trim().slice(0, 40)) || `Pregunta ${i + 1}`;
      const parts = [];
      if (!q?.isEffectivelyConfigured) parts.push("incompleta");
      if (!q?.hasCorrect) parts.push("sin respuesta correcta");
      return `${i + 1}. ${label} (${parts.join(" + ")})`;
    }) : [];

  return (
    <div className="grid gap-4 rounded-[20px] border border-border/60 bg-background p-4">
      <div className="grid gap-1 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Label className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-purple-600" />
            Evaluación de la clase
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">Preguntas por clase. Requiere recursos listos.</p>
        </div>
        <div className="flex items-center gap-2">
          {resourceState ? (
            <Badge variant="outline" className={resourceState.tone}>{resourceState.label}</Badge>
          ) : null}
          <Switch
            checked={Boolean(evaluation.enabled)}
            onCheckedChange={(checked) => updateField({ enabled: checked })}
          />
        </div>
      </div>

      {evaluation.enabled && missingQuestionsList.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-5 text-amber-800">
          <div className="font-semibold uppercase tracking-wider text-amber-700">
            Falta configurar para habilitar
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px]">
            {missingQuestionsList.slice(0, 5).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
            {missingQuestionsList.length > 5 ? (
              <li>…y {missingQuestionsList.length - 5} más</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-card px-3 py-3">
          <Label className="text-xs">Título</Label>
          <Input
            value={evaluation.title || ""}
            onChange={(event) => updateField({ title: event.target.value })}
            placeholder="Quiz clase 1"
            className="h-9 text-sm"
            disabled={!evaluation.enabled}
          />
        </div>
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-card px-3 py-3">
          <Label className="text-xs">Nota de aprobación (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={evaluation.passingScore ?? 75}
            onChange={(event) => updateField({ passingScore: Number(event.target.value || 0) || undefined })}
            className="h-9 text-sm"
            disabled={!evaluation.enabled}
          />
        </div>
        <div className="grid gap-2 rounded-2xl border border-border/60 bg-card px-3 py-3">
          <Label className="text-xs">Intentos máximos</Label>
          <Input
            type="number"
            min="1"
            value={evaluation.maxAttempts ?? 3}
            onChange={(event) => updateField({ maxAttempts: Number(event.target.value || 0) || undefined })}
            className="h-9 text-sm"
            disabled={!evaluation.enabled}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="sticky top-4 self-start z-20 w-full max-w-[360px] md:max-w-none">
          <div className="rounded-2xl border border-border/60 bg-card p-3 min-w-0 overflow-hidden">
            <div className="mb-2 flex items-center justify-between gap-2 min-w-0">
              <div className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground min-w-0">
                Preguntas
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
                disabled={!evaluation.enabled}
                className="h-8 px-2.5 text-xs shrink-0"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Pregunta
              </Button>
            </div>
            {questions.length ? (
              <div className="grid gap-1.5 min-w-0 max-h-[calc(100vh-230px)] overflow-auto pr-1">
                {questions.map((question, index) => (
                  <button
                    key={question.id || index}
                    type="button"
                    onClick={() => setSelectedQuestionId(String(question.id || ""))}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs min-w-0",
                      String(selectedQuestion?.id || "") === String(question.id || "")
                        ? "border-purple-200 bg-purple-50 text-purple-900"
                        : "border-border/60 bg-background hover:bg-slate-50"
                    )}
                    disabled={!evaluation.enabled}
                  >
                    <span className="truncate min-w-0">
                      {index + 1}. {question.prompt || "(Pregunta sin redactar)"}
                    </span>
                    <Badge variant="outline" className="h-5 px-2 text-[10px] uppercase shrink-0">
                      {question.type === "multiple_choice" ? "Multiple" : question.type === "boolean" ? "V/F" : "Simple"}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                Aún no hay preguntas para esta evaluación.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-3">
          {selectedQuestion ? (
            <div className="grid gap-2.5">
              <div className="grid gap-1.5">
                <Label className="text-xs">Pregunta</Label>
                <Input
                  value={selectedQuestion.prompt || ""}
                  onChange={(event) => updateQuestion(selectedQuestionIndex, { prompt: event.target.value })}
                  placeholder="¿Cuál era el objetivo de esta clase?"
                  className="h-9 text-sm"
                  disabled={!evaluation.enabled}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={selectedQuestion.type || "single_choice"}
                  onValueChange={(value) => {
                    if (value === "boolean") {
                      updateQuestion(selectedQuestionIndex, {
                        type: "boolean",
                        options: ["Verdadero", "Falso"],
                        correctAnswers: Array.isArray(selectedQuestion.correctAnswers) ? selectedQuestion.correctAnswers.slice(0, 1) : [],
                      });
                      return;
                    }
                    updateQuestion(selectedQuestionIndex, { type: value });
                  }}
                  disabled={!evaluation.enabled}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_choice">Opción simple</SelectItem>
                    <SelectItem value="multiple_choice">Múltiple opción</SelectItem>
                    <SelectItem value="boolean">Verdadero / Falso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Opciones</Label>
                <div className="grid gap-1.5">
                  {Array.isArray(selectedQuestion.options) && selectedQuestion.options.length
                    ? selectedQuestion.options.map((opt, optIndex) => {
                        const selectedAnswers = Array.isArray(selectedQuestion.correctAnswers)
                          ? selectedQuestion.correctAnswers
                          : [];
                        const isCorrect =
                          selectedQuestion.type === "boolean" || selectedQuestion.type === "single_choice"
                            ? String(selectedAnswers[0] ?? "") === String(optIndex)
                            : selectedAnswers.includes(String(optIndex));
                        return (
                          <div
                            key={`${selectedQuestion.id || "q"}-opt-${optIndex}`}
                            className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-2.5 py-1.5"
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const nextOptions = [...(selectedQuestion.options || [])];
                                nextOptions.splice(optIndex, 1);
                                updateQuestionOptions(selectedQuestionIndex, nextOptions);
                                const filtered = (selectedAnswers || []).filter((a) => String(a) !== String(optIndex));
                                updateQuestion(selectedQuestionIndex, { correctAnswers: filtered });
                              }}
                              disabled={!evaluation.enabled || selectedQuestion.type === "boolean"}
                              className="h-6 w-6 shrink-0 text-muted-foreground"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              value={opt}
                              onChange={(event) => {
                                const nextOptions = [...(selectedQuestion.options || [])];
                                nextOptions[optIndex] = event.target.value;
                                updateQuestionOptions(selectedQuestionIndex, nextOptions);
                              }}
                              className="h-8 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                              disabled={!evaluation.enabled}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedQuestion.type === "multiple_choice") {
                                      const set = new Set(selectedAnswers.map((a) => String(a)));
                                      if (set.has(String(optIndex))) set.delete(String(optIndex));
                                      else set.add(String(optIndex));
                                      updateQuestion(selectedQuestionIndex, { correctAnswers: [...set.values()] });
                                    } else {
                                      updateQuestion(selectedQuestionIndex, { correctAnswers: [String(optIndex)] });
                                    }
                                  }}
                                  disabled={!evaluation.enabled}
                                  className={cn(
                                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                                    isCorrect
                                      ? "border-emerald-400 bg-emerald-500 text-white"
                                      : "border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600"
                                  )}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="max-w-xs text-[11px] leading-5">
                                  {selectedQuestion.type === "multiple_choice"
                                    ? "Marcar como respuesta correcta (pueden ser varias)."
                                    : "Marcar como respuesta correcta."}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })
                    : null}
                  {selectedQuestion.type !== "boolean" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuestionOptions(selectedQuestionIndex, [...(selectedQuestion.options || []), ""])
                      }
                      disabled={!evaluation.enabled}
                      className="mt-1 h-8 justify-start px-2.5 text-xs"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Agregar opción
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Explicación (opcional)</Label>
                <Textarea
                  rows={2}
                  value={selectedQuestion.explanation || ""}
                  onChange={(event) => updateQuestion(selectedQuestionIndex, { explanation: event.target.value })}
                  placeholder="Mostrar al alumno al finalizar el intento."
                  className="text-xs"
                  disabled={!evaluation.enabled}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuestion(selectedQuestionIndex)}
                  disabled={!evaluation.enabled}
                  className="h-8 px-2.5 text-xs text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Eliminar pregunta
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-background px-3 py-4 text-center text-xs text-muted-foreground">
              Creá una pregunta primero para editarla acá.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoursePromoVideoSection({
  promoVideoAsset,
  promoVideo,
  promoVideoFileName,
  promoVideoSizeBytes,
  onVideoAssetChange,
  onVideoUrlChange,
  validateVideoFile,
  extractVideoMetadata,
  onPromoMetadataChange,
  errors,
}) {
  const hasAsset = promoVideoAsset && typeof promoVideoAsset === "object" && (promoVideoAsset.url || promoVideoAsset.storageKey);
  const rawUrl = String(promoVideo || "").trim();
  const urlSource = rawUrl || (hasAsset ? String(promoVideoAsset?.url || "") : "");
  const displayValueUrl = urlSource ? (isEmbedUrl(urlSource) ? toEmbedUrl(urlSource) : urlSource) : "";
  const onlyExternal = Boolean(displayValueUrl) && !hasAsset && isExternalVideoOnly({ url: displayValueUrl, mimeType: undefined });
  const state = hasAsset
    ? { tone: resourceStatusBadge(promoVideoAsset.status || "ready").tone, label: "Asset subido" }
    : displayValueUrl
      ? { tone: resourceStatusBadge("pending").tone, label: onlyExternal ? "URL externa" : "URL activa" }
      : null;

  const handleCombinedChange = async (nextUrl, assetData, extras) => {
    const urlRaw = String(nextUrl || "").trim();
    const url = urlRaw ? toEmbedUrl(urlRaw) : "";
    const clearing = !url;
    const file = extras && extras.file ? extras.file : null;
    const isReplacingWithExternalOnly = Boolean(url) && !assetData && isExternalVideoOnly({ url, mimeType: undefined });
    const externalNoAsset = extras === null && url;
    const forcedClearingAsset = clearing || (extras === null && !url);

    if (clearing) {
      onVideoAssetChange(undefined);
      onVideoUrlChange("");
      onPromoMetadataChange?.({
        promoVideoFileName: undefined,
        promoVideoMimeType: undefined,
        promoVideoSizeBytes: undefined,
        promoVideoDurationSeconds: undefined,
        sourceFile: null,
      });
      return;
    }

    if (externalNoAsset) {
      onVideoAssetChange(undefined);
      onVideoUrlChange(url);
      onPromoMetadataChange?.({
        promoVideoFileName: promoVideoFileName || undefined,
        promoVideoMimeType: undefined,
        promoVideoSizeBytes: undefined,
        promoVideoDurationSeconds: undefined,
        sourceFile: null,
      });
      return;
    }

    if (file && typeof validateVideoFile === "function") {
      const validationMessage = validateVideoFile(file);
      if (validationMessage) {
        onPromoMetadataChange?.({
          validationError: validationMessage,
          sourceFile: null,
        });
        return;
      }
    }

    let durationSeconds = undefined;
    if (file && typeof extractVideoMetadata === "function") {
      try {
        const info = await extractVideoMetadata(file).catch(() => null);
        durationSeconds = info && Number.isFinite(Number(info.durationSeconds)) ? Number(info.durationSeconds) : undefined;
      } catch {
        durationSeconds = undefined;
      }
    }

    if (assetData && !forcedClearingAsset && typeof assetData === "object") {
      const nextAsset = {
        url: assetData.url || url || promoVideoAsset?.url || "",
        storageKey: assetData.storageKey || promoVideoAsset?.storageKey || undefined,
        mimeType: assetData.mimeType || promoVideoAsset?.mimeType || undefined,
        fileSize: assetData.fileSize ?? promoVideoAsset?.fileSize ?? undefined,
        status: assetData.status || promoVideoAsset?.status || "ready",
        checksum: assetData.checksum || promoVideoAsset?.checksum || undefined,
        uploadedAt: assetData.uploadedAt || promoVideoAsset?.uploadedAt || new Date().toISOString(),
        originalName: assetData.originalName || promoVideoAsset?.originalName || undefined,
        qualities: promoVideoAsset?.qualities || [],
        subtitles: promoVideoAsset?.subtitles || [],
      };
      const finalUrl = nextAsset.url || url || "";
      const inferredFileName =
        nextAsset.originalName ||
        promoVideoFileName ||
        (finalUrl ? String(finalUrl).split("/").pop()?.split("?")[0] || "" : "");
      onVideoAssetChange(nextAsset);
      onVideoUrlChange(finalUrl);
      onPromoMetadataChange?.({
        promoVideoFileName: inferredFileName || undefined,
        promoVideoMimeType: nextAsset.mimeType || undefined,
        promoVideoSizeBytes: Number.isFinite(Number(nextAsset.fileSize)) ? nextAsset.fileSize : undefined,
        promoVideoDurationSeconds: durationSeconds,
        sourceFile: file,
      });
    } else if (isExternalVideoOnly({ url, mimeType: undefined })) {
      onVideoAssetChange(undefined);
      onVideoUrlChange(url);
      onPromoMetadataChange?.({
        promoVideoFileName: promoVideoFileName || undefined,
        promoVideoMimeType: undefined,
        promoVideoSizeBytes: undefined,
        promoVideoDurationSeconds: undefined,
        sourceFile: null,
      });
    } else {
      onVideoUrlChange(url);
      onPromoMetadataChange?.({
        sourceFile: null,
      });
    }
  };

  const handleBeforeUpload = async (file) => {
    if (typeof validateVideoFile !== "function") return true;
    const validationMessage = validateVideoFile(file);
    if (validationMessage) {
      onPromoMetadataChange?.({
        validationError: validationMessage,
        sourceFile: null,
      });
      return false;
    }
    onPromoMetadataChange?.({
      validationError: undefined,
      sourceFile: file,
    });
    return true;
  };

  return (
    <div className="grid gap-4 rounded-[20px] border border-border/60 bg-background p-4">
      <div className="grid gap-1 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <Label className="flex items-center gap-2 text-base">
            <FileVideo className="h-4 w-4 text-[#1B2B50]" />
            Video promocional
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">Pegá una URL de YouTube / Vimeo o el enlace directo al video.</p>
        </div>
        {state ? (
          <Badge variant="outline" className={cn(state.tone)}>
            {state.label}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3">
        <LessonVideoUploader
          value={promoVideo || ""}
          asset={promoVideoAsset}
          onChange={handleCombinedChange}
          folderPrefix="courses/promo-videos"
          onBeforeUpload={handleBeforeUpload}
          forceUrlOnly={true}
        />
        <FieldError error={errors?.promoVideo} />
      </div>
    </div>
  );
}

function CourseAttachmentsField({ attachments, onChange, error }) {
  const safeAttachments = Array.isArray(attachments) ? attachments : [];
  const summary = summarizeLessonResources({ resources: safeAttachments });
  const tone = readinessTone(summary);
  const toneMap = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    secondary: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const removeAttachment = (index) => {
    onChange(safeAttachments.filter((_, i) => i !== index));
  };

  const updateAttachment = (index, patch) => {
    onChange(
      safeAttachments.map((a, i) => (i === index && a ? { ...a, ...patch } : a))
    );
  };

  return (
    <div className="grid gap-4 rounded-[20px] border border-border/60 bg-background p-4">
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-center gap-3">
          <Label className="text-base">Archivos y guías del curso</Label>
          {summary.hasAny ? (
            <Badge variant="outline" className={cn("gap-1.5", toneMap[tone])}>
              {readinessProgressText(summary)}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Drag & drop. PDF, DOCX, imágenes, ZIP, videos.
        </p>
      </div>

      <MediaUploader
        folderPrefix="courses/attachments"
        value={safeAttachments}
        onChange={onChange}
        hideExistingItems
        helperText=""
      />

      {safeAttachments.length ? (
        <div className="grid gap-3">
          {safeAttachments.map((attachment, index) => {
            const { icon: Icon, tone: iconTone } = resourceKindBadge(attachment.kind);
            const attachmentHasUrl = Boolean(attachment.url);
            const attachStatusRaw = ["pending", "uploading", "ready", "corrupt"].includes(attachment.status)
              ? attachment.status
              : undefined;
            const statusValue = attachStatusRaw === "ready" || attachStatusRaw === "uploading" || attachStatusRaw === "corrupt"
              ? attachStatusRaw
              : attachmentHasUrl
                ? "ready"
                : (attachStatusRaw || "pending");
            const statusBadge = resourceStatusBadge(statusValue);
            const sizeLabel = resourceFormatSize(attachment.fileSize ?? attachment.sizeBytes);
            const url = attachment.url || "";
            const subKindOptions = ["Materiales del curso", "Material complementario", "Apunte", "Ejercicio", "Examen"];
            return (
              <div
                key={attachment.id || index}
                className="grid items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {attachment.label || attachment.name || "(Archivo sin nombre)"}
                    </span>
                    <Select
                      value={attachment.subKind || "__none__"}
                      onValueChange={(val) => updateAttachment(index, { subKind: val === "__none__" ? undefined : val })}
                    >
                      <SelectTrigger className="h-5 w-auto min-w-[120px] rounded-full border border-border/70 px-2 py-0 text-[10px] uppercase tracking-wide">
                        <SelectValue placeholder="Tipo de material" />
                      </SelectTrigger>
                      <SelectContent align="start" className="text-[11px]">
                        <SelectItem value="__none__">Sin tipo</SelectItem>
                        {subKindOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={statusValue}
                      onValueChange={(val) => updateAttachment(index, { status: val })}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-5 w-auto min-w-[92px] rounded-full px-2 py-0 text-[10px] font-medium border",
                          statusBadge.tone
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start" className="text-[11px]">
                        <SelectItem value="pending">Pendiente</SelectItem>
                        <SelectItem value="uploading">Subiendo…</SelectItem>
                        <SelectItem value="ready">Listo</SelectItem>
                        <SelectItem value="corrupt">Corrupto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {sizeLabel ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{sizeLabel}</span> : null}
                    {attachment.mimeType ? <span className="truncate">{attachment.mimeType}</span> : null}
                    {attachment.checksum ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                            <ShieldCheck className="h-3 w-3" /> Integridad
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <div className="max-w-[340px] break-all text-[11px] leading-5">
                            Checksum SHA-256 — {attachment.checksum}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-2 justify-self-end">
                  {url ? (
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      title="Abrir recurso"
                    >
                      <a href={url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <FilePreview
                    url={url}
                    label={attachment.label || attachment.name || "Adjunto"}
                    kind={attachment.kind || "file"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttachment(index)}
                    className="shrink-0 self-start h-8 w-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <FieldError error={error} />
    </div>
  );
}

function CurriculumField({ curriculum, onChange, error }) {
  const safeCurriculum = Array.isArray(curriculum) ? curriculum : [];
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");

  useEffect(() => {
    const firstSection = safeCurriculum[0];
    const firstLesson = Array.isArray(firstSection?.lessons) ? firstSection.lessons[0] : null;
    const sectionExists = safeCurriculum.some((section) => String(section?.id || "") === String(selectedSectionId || ""));
    if (!sectionExists && firstSection?.id) {
      setSelectedSectionId(String(firstSection.id));
    }
    const currentSection = safeCurriculum.find((section) => String(section?.id || "") === String(selectedSectionId || "")) || firstSection;
    const lessonExists = Array.isArray(currentSection?.lessons)
      ? currentSection.lessons.some((lesson) => String(lesson?.id || "") === String(selectedLessonId || ""))
      : false;
    if (!lessonExists && firstLesson?.id) {
      setSelectedLessonId(String((Array.isArray(currentSection?.lessons) ? currentSection.lessons[0] : firstLesson)?.id || ""));
    }
  }, [safeCurriculum, selectedLessonId, selectedSectionId]);

  const updateSection = (sectionIndex, patch) => {
    const next = [...safeCurriculum];
    next[sectionIndex] = { ...next[sectionIndex], ...patch };
    onChange(next);
  };

  const addSection = () => {
    onChange([
      ...safeCurriculum,
      {
        id: createEntityId("section"),
        title: "",
        description: "",
        lessons: [
          {
            id: createEntityId("lesson"),
            title: "",
            description: "",
            lessonType: "video",
            durationMinutes: undefined,
            videoUrl: "",
            thumbnailUrl: "",
            content: "",
            isPreview: false,
            resources: [],
          },
        ],
      },
    ]);
  };

  const removeSection = (sectionIndex) => {
    onChange(safeCurriculum.filter((_, currentIndex) => currentIndex !== sectionIndex));
  };

  const updateLesson = (sectionIndex, lessonIndex, patch) => {
    const section = safeCurriculum[sectionIndex] || {};
    const lessons = Array.isArray(section.lessons) ? [...section.lessons] : [];
    const prev = lessons[lessonIndex] || { id: createEntityId("lesson") };
    const isNew = !lessons[lessonIndex];

    const nextAssetRaw = Object.prototype.hasOwnProperty.call(patch, "videoAsset") ? patch.videoAsset : prev.videoAsset;
    const incomingAssetObject =
      nextAssetRaw && typeof nextAssetRaw === "object" && (nextAssetRaw.url || nextAssetRaw.storageKey);
    const clearingAsset =
      Object.prototype.hasOwnProperty.call(patch, "videoAsset") &&
      (patch.videoAsset === undefined || patch.videoAsset === null);
    const nextUrlRaw = Object.prototype.hasOwnProperty.call(patch, "videoUrl") ? String(patch.videoUrl || "").trim() : String(prev.videoUrl || "").trim();
    const clearingVideoUrl =
      Object.prototype.hasOwnProperty.call(patch, "videoUrl") && !nextUrlRaw;

    const defaults = {
      id: prev.id || createEntityId("lesson"),
      title: "",
      description: "",
      lessonType: "video",
      durationMinutes: undefined,
      videoUrl: "",
      thumbnailUrl: "",
      content: "",
      isPreview: false,
      resources: [],
    };
    const baseNext = { ...defaults, ...prev, ...patch };
    const finalAssetIncoming = incomingAssetObject && !clearingAsset ? { ...(prev.videoAsset || {}), ...nextAssetRaw } : undefined;
    baseNext.videoAsset = finalAssetIncoming;
    baseNext.videoUrl = String(baseNext.videoUrl || "").trim();

    if (clearingAsset && baseNext.videoAsset) {
      baseNext.videoAsset = undefined;
    }
    if (clearingVideoUrl) {
      baseNext.videoUrl = "";
      baseNext.videoAsset = undefined;
    }
    if (baseNext.videoUrl && !baseNext.videoAsset) {
      baseNext.videoAsset = undefined;
    }

    const safeNext = baseNext;
    safeNext.title = String(safeNext.title || "").trim() || prev.title || "";
    safeNext.description = safeNext.description ? String(safeNext.description || "").trim() : undefined;
    safeNext.lessonType = String(safeNext.lessonType || "video").trim() || "video";
    safeNext.thumbnailUrl = safeNext.thumbnailUrl ? String(safeNext.thumbnailUrl || "").trim() : undefined;
    safeNext.content = safeNext.content ? String(safeNext.content || "").trim() : undefined;
    safeNext.isPreview = Boolean(safeNext.isPreview);
    safeNext.resources = Array.isArray(safeNext.resources) ? safeNext.resources : [];
    if (!Number.isFinite(Number(safeNext.durationMinutes)) || Number(safeNext.durationMinutes) <= 0) {
      safeNext.durationMinutes = undefined;
    }

    if (isNew) {
      lessons.push(safeNext);
    } else {
      lessons[lessonIndex] = safeNext;
    }
    updateSection(sectionIndex, { lessons });
  };

  const addLesson = (sectionIndex) => {
    const section = safeCurriculum[sectionIndex] || {};
    const lessons = Array.isArray(section.lessons) ? [...section.lessons] : [];
    const id = createEntityId("lesson");
    lessons.push({
      id,
      title: "",
      description: undefined,
      lessonType: "video",
      durationMinutes: undefined,
      videoUrl: "",
      thumbnailUrl: undefined,
      content: undefined,
      isPreview: false,
      resources: [],
    });
    updateSection(sectionIndex, { lessons });
    setSelectedLessonId(String(id));
  };

  const removeLesson = (sectionIndex, lessonIndex) => {
    const section = safeCurriculum[sectionIndex] || {};
    const lessons = Array.isArray(section.lessons) ? [...section.lessons] : [];
    updateSection(
      sectionIndex,
      { lessons: lessons.filter((_, currentIndex) => currentIndex !== lessonIndex) }
    );
  };

  const selectedSection =
    safeCurriculum.find((section) => String(section?.id || "") === String(selectedSectionId || "")) || safeCurriculum[0] || null;
  const selectedSectionIndex = safeCurriculum.findIndex((section) => String(section?.id || "") === String(selectedSection?.id || ""));
  const selectedLesson =
    (Array.isArray(selectedSection?.lessons) ? selectedSection.lessons : []).find(
      (lesson) => String(lesson?.id || "") === String(selectedLessonId || "")
    ) ||
    (Array.isArray(selectedSection?.lessons) ? selectedSection.lessons[0] : null) ||
    null;
  const selectedLessonIndex = Array.isArray(selectedSection?.lessons)
    ? selectedSection.lessons.findIndex((lesson) => String(lesson?.id || "") === String(selectedLesson?.id || ""))
    : -1;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="sticky top-4 self-start z-20 w-full max-w-[340px]">
          <div className="rounded-[24px] border border-border/60 bg-background p-4 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Estructura del curso</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Selecciona una clase para editarla.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSection} className="shrink-0">
                <Plus className="mr-2 h-4 w-4" />
                Sección
              </Button>
            </div>

            <div className="mt-4 grid gap-3 max-h-[calc(100vh-170px)] overflow-auto pr-1 min-w-0">
              {safeCurriculum.map((section, sectionIndex) => {
                const lessonCount = Array.isArray(section.lessons) ? section.lessons.length : 0;
                const durationCount = Array.isArray(section.lessons)
                  ? section.lessons.reduce((sum, lesson) => sum + Number(lesson?.durationMinutes || 0), 0)
                  : 0;
                const isSelectedSection = String(section?.id || "") === String(selectedSection?.id || "");

                return (
                  <div key={section.id || sectionIndex} className="rounded-[22px] border border-border/60 bg-card p-3 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSectionId(String(section.id || ""));
                          setSelectedLessonId(String((section.lessons?.[0] || {}).id || ""));
                        }}
                        className={`min-w-0 flex-1 rounded-2xl px-3 py-2 text-left transition overflow-hidden ${
                          isSelectedSection ? "bg-[#1B2B50] text-white" : "hover:bg-[#F6F8FC]"
                        }`}
                      >
                        <div className="truncate text-sm font-semibold">{section.title || `Sección ${sectionIndex + 1}`}</div>
                        <div className={`mt-1 text-xs ${isSelectedSection ? "text-white/70" : "text-muted-foreground"}`}>
                          {lessonCount} clases · {durationCount || 0} min
                        </div>
                      </button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(sectionIndex)} className="shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-2 min-w-0">
                      {(Array.isArray(section.lessons) ? section.lessons : []).map((lesson, lessonIndex) => {
                        const isSelectedLesson = String(lesson?.id || "") === String(selectedLesson?.id || "");
                        return (
                          <button
                            key={lesson.id || lessonIndex}
                            type="button"
                            onClick={() => {
                              setSelectedSectionId(String(section.id || ""));
                              setSelectedLessonId(String(lesson.id || ""));
                            }}
                            className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left transition min-w-0 overflow-hidden ${
                              isSelectedLesson
                                ? "border-[#1B2B50]/15 bg-[#EEF4FF]"
                                : "border-border/60 bg-background hover:bg-[#FAFAFC]"
                            }`}
                          >
                            <span className="min-w-0 overflow-hidden">
                              <span className="block truncate text-sm font-medium text-foreground">{lesson.title || `Clase ${lessonIndex + 1}`}</span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {lesson.lessonType || "video"} · {lesson.durationMinutes || 0} min
                              </span>
                            </span>
                            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>

                    <Button type="button" variant="ghost" size="sm" onClick={() => addLesson(sectionIndex)} className="mt-3 w-full justify-start">
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar clase
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border/60 bg-background p-4 md:p-5 min-w-0 overflow-hidden">
          {selectedSection && selectedLesson ? (
            <div className="grid gap-5 min-w-0">
              <LessonEditorHeader
                selectedSection={selectedSection}
                selectedLesson={selectedLesson}
                onRemove={() => removeLesson(selectedSectionIndex, selectedLessonIndex)}
                disabled={selectedSectionIndex < 0 || selectedLessonIndex < 0}
              />

              <div className="grid gap-4 md:grid-cols-2 min-w-0">
                  <div className="grid gap-2 min-w-0">
                    <Label>Título de la sección</Label>
                    <Input
                      value={selectedSection.title || ""}
                      onChange={(event) => updateSection(selectedSectionIndex, { title: event.target.value })}
                      placeholder="Ej: Módulo 1 · Fundamentos"
                    />
                  </div>
                  <div className="grid gap-2 min-w-0">
                    <Label>Descripción de la sección</Label>
                    <Input
                      value={selectedSection.description || ""}
                      onChange={(event) => updateSection(selectedSectionIndex, { description: event.target.value })}
                      placeholder="Qué objetivo cubre este bloque"
                    />
                  </div>
                </div>

              <div className="grid gap-4 rounded-[22px] border border-border/60 bg-card p-4 min-w-0 overflow-hidden">
                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.5fr] min-w-0">
                  <div className="grid gap-2 min-w-0">
                    <Label>Título de la clase</Label>
                    <Input
                      value={selectedLesson.title || ""}
                      onChange={(event) => updateLesson(selectedSectionIndex, selectedLessonIndex, { title: event.target.value })}
                      placeholder="Ej: Primer proyecto"
                    />
                  </div>
                  <div className="grid gap-2 min-w-0">
                    <Label>Tipo</Label>
                    <Select
                      value={selectedLesson.lessonType || "video"}
                      onValueChange={(value) => updateLesson(selectedSectionIndex, selectedLessonIndex, { lessonType: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Tipo de clase" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="live">En vivo</SelectItem>
                        <SelectItem value="quiz">Quiz</SelectItem>
                        <SelectItem value="assignment">Actividad</SelectItem>
                        <SelectItem value="download">Descargable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 min-w-0">
                    <Label>Minutos</Label>
                    <Input
                      type="number"
                      min="0"
                      value={selectedLesson.durationMinutes ?? ""}
                      onChange={(event) =>
                        updateLesson(selectedSectionIndex, selectedLessonIndex, {
                          durationMinutes: Number(event.target.value || 0) || undefined,
                        })
                      }
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="grid gap-2 min-w-0">
                  <Label>Descripción</Label>
                  <Textarea
                    rows={3}
                    value={selectedLesson.description || ""}
                    onChange={(event) => updateLesson(selectedSectionIndex, selectedLessonIndex, { description: event.target.value })}
                    placeholder="Resume la clase y su objetivo."
                  />
                </div>

                <div className="grid gap-2 min-w-0">
                  <Label>Contenido o guía</Label>
                  <Textarea
                    rows={5}
                    value={selectedLesson.content || ""}
                    onChange={(event) => updateLesson(selectedSectionIndex, selectedLessonIndex, { content: event.target.value })}
                    placeholder="Describe la clase, instrucciones, actividades o teoría."
                  />
                </div>

                <LessonVideoSection
                  videoUrl={selectedLesson.videoUrl || ""}
                  videoAsset={selectedLesson.videoAsset}
                  onVideoUrlChange={(nextVideoUrl) =>
                    updateLesson(selectedSectionIndex, selectedLessonIndex, { videoUrl: nextVideoUrl || "" })
                  }
                  onVideoAssetChange={(nextVideoAsset) =>
                    updateLesson(selectedSectionIndex, selectedLessonIndex, {
                      videoAsset: nextVideoAsset || undefined,
                    })
                  }
                  onVideoChangeCombined={(patch) =>
                    updateLesson(selectedSectionIndex, selectedLessonIndex, {
                      ...(Object.prototype.hasOwnProperty.call(patch, "videoUrl") ? { videoUrl: patch.videoUrl || "" } : {}),
                      ...(Object.prototype.hasOwnProperty.call(patch, "videoAsset") ? { videoAsset: patch.videoAsset || undefined } : {}),
                    })
                  }
                />

                <div className="rounded-[18px] border border-border/60 bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">Clase abierta</div>
                    <Switch
                      checked={Boolean(selectedLesson.isPreview)}
                      onCheckedChange={(checked) => updateLesson(selectedSectionIndex, selectedLessonIndex, { isPreview: checked })}
                    />
                  </div>
                </div>

                <LessonResourcesField
                  resources={selectedLesson.resources || []}
                  onChange={(resources) => updateLesson(selectedSectionIndex, selectedLessonIndex, { resources })}
                />

                <PerClassEvaluationField
                  value={selectedLesson.evaluation}
                  onChange={(evaluation) => updateLesson(selectedSectionIndex, selectedLessonIndex, { evaluation })}
                  resourcesSummary={summarizeLessonResources(selectedLesson)}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] border border-dashed border-border/60 bg-card px-5 py-8 text-sm text-muted-foreground">
              Selecciona una clase del árbol lateral para empezar a editar.
            </div>
          )}
        </div>
      </div>
      <FieldError error={error} />
      {!error?.message && hasNestedFieldError(error) ? (
        <p className="text-sm text-destructive">Revisa los campos incompletos dentro del currículum.</p>
      ) : null}
    </div>
  );
}

function FinalEvaluationField({ value, onChange, error }) {
  const evaluation = value && typeof value === "object" ? value : { enabled: false, questions: [] };
  const questions = Array.isArray(evaluation.questions) ? evaluation.questions : [];
  const [selectedQuestionId, setSelectedQuestionId] = useState("");

  useEffect(() => {
    const firstQuestion = questions[0];
    const exists = questions.some((question) => String(question?.id || "") === String(selectedQuestionId || ""));
    if (!exists && firstQuestion?.id) {
      setSelectedQuestionId(String(firstQuestion.id));
    }
  }, [questions, selectedQuestionId]);

  const updateField = (patch) => {
    onChange({ ...evaluation, ...patch });
  };

  const updateQuestion = (index, patch) => {
    const next = [...questions];
    next[index] = { ...next[index], ...patch };
    updateField({ questions: next });
  };

  const addQuestion = () => {
    updateField({
      questions: [
        ...questions,
        {
          id: createEntityId("question"),
          prompt: "",
          type: "single_choice",
          options: ["", ""],
          correctAnswers: [],
          explanation: "",
          points: undefined,
        },
      ],
    });
  };

  const removeQuestion = (index) => {
    updateField({ questions: questions.filter((_, currentIndex) => currentIndex !== index) });
  };

  const updateQuestionOptions = (index, nextOptions) => {
    updateQuestion(index, { options: nextOptions });
  };

  const selectedQuestion =
    questions.find((question) => String(question?.id || "") === String(selectedQuestionId || "")) || questions[0] || null;
  const selectedQuestionIndex = questions.findIndex((question) => String(question?.id || "") === String(selectedQuestion?.id || ""));

  const mapQuestionTypeForPerClassUi = (type) => {
    if (type === "true_false") return "boolean";
    return type || "single_choice";
  };

  const mapQuestionTypeForSchema = (perClassType) => {
    if (perClassType === "boolean") return "true_false";
    return perClassType || "single_choice";
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 rounded-[22px] border border-border/60 bg-background px-4 py-4">
        <div>
          <Label className="flex items-center gap-1.5">
            Evaluación final
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="max-w-xs text-[11px] leading-5">
                  Actívala para agregar un examen, quiz o validación al final del curso. El alumno deberá aprobarlo para completar la cursada.
                </div>
              </TooltipContent>
            </Tooltip>
          </Label>
        </div>
        <Switch checked={Boolean(evaluation.enabled)} onCheckedChange={(checked) => updateField({ enabled: checked })} />
      </div>

      {evaluation.enabled ? (
        <div className="grid gap-4 rounded-[24px] border border-border/60 bg-background p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2 rounded-2xl border border-border/60 bg-card px-3 py-3">
              <Label className="text-xs">Título</Label>
              <Input
                value={evaluation.title || ""}
                onChange={(event) => updateField({ title: event.target.value })}
                placeholder="Examen final"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-2 rounded-2xl border border-border/60 bg-card px-3 py-3">
              <Label className="text-xs">Nota de aprobación (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={evaluation.passingScore ?? 60}
                onChange={(event) => updateField({ passingScore: Number(event.target.value || 0) || undefined })}
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-2 rounded-2xl border border-border/60 bg-card px-3 py-3">
              <Label className="text-xs">Intentos máximos</Label>
              <Input
                type="number"
                min="1"
                value={evaluation.maxAttempts ?? 3}
                onChange={(event) => updateField({ maxAttempts: Number(event.target.value || 0) || undefined })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Descripción</Label>
            <Textarea
              rows={3}
              value={evaluation.description || ""}
              onChange={(event) => updateField({ description: event.target.value })}
              placeholder="Explica qué valida esta evaluación y cómo se aprueba."
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="sticky top-4 self-start z-20 w-full max-w-[340px]">
              <div className="rounded-[22px] border border-border/60 bg-card p-4 min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">Preguntas</div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">Selecciona una para editarla.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="shrink-0">
                    <Plus className="mr-2 h-4 w-4" />
                    Pregunta
                  </Button>
                </div>

                <div className="mt-4 grid gap-2 max-h-[calc(100vh-210px)] overflow-auto pr-1">
                  {questions.map((question, index) => {
                    const isSelected = String(question?.id || "") === String(selectedQuestion?.id || "");
                    return (
                      <button
                        key={question.id || index}
                        type="button"
                        onClick={() => setSelectedQuestionId(String(question.id || ""))}
                        className={`rounded-2xl border px-3 py-3 text-left transition min-w-0 ${
                          isSelected ? "border-[#1B2B50]/15 bg-[#EEF4FF]" : "border-border/60 bg-background hover:bg-[#FAFAFC]"
                        }`}
                      >
                        <div className="truncate text-sm font-medium text-foreground">Pregunta {index + 1}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{question.prompt || "Sin enunciado"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-3 min-w-0 overflow-hidden">
              {selectedQuestion ? (
                <div className="grid gap-2.5">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Pregunta</Label>
                    <Input
                      value={selectedQuestion.prompt || ""}
                      onChange={(event) => updateQuestion(selectedQuestionIndex, { prompt: event.target.value })}
                      placeholder="¿Qué objetivo cierra esta evaluación?"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={mapQuestionTypeForPerClassUi(selectedQuestion.type)}
                      onValueChange={(value) => {
                        const schemaType = mapQuestionTypeForSchema(value);
                        if (value === "boolean") {
                          updateQuestion(selectedQuestionIndex, {
                            type: schemaType,
                            options: ["Verdadero", "Falso"],
                            correctAnswers: Array.isArray(selectedQuestion.correctAnswers) ? selectedQuestion.correctAnswers.slice(0, 1) : [],
                          });
                          return;
                        }
                        updateQuestion(selectedQuestionIndex, {
                          type: schemaType,
                          options: selectedQuestion.options && selectedQuestion.options.length ? selectedQuestion.options : ["", ""],
                        });
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_choice">Opción simple</SelectItem>
                        <SelectItem value="multiple_choice">Múltiple opción</SelectItem>
                        <SelectItem value="boolean">Verdadero / Falso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Opciones</Label>
                    <div className="grid gap-1.5">
                      {Array.isArray(selectedQuestion.options) && selectedQuestion.options.length
                        ? selectedQuestion.options.map((opt, optIndex) => {
                            const selectedAnswers = Array.isArray(selectedQuestion.correctAnswers)
                              ? selectedQuestion.correctAnswers
                              : [];
                            const perClassUiType = mapQuestionTypeForPerClassUi(selectedQuestion.type);
                            const isCorrect =
                              perClassUiType === "boolean" || perClassUiType === "single_choice"
                                ? String(selectedAnswers[0] ?? "") === String(optIndex)
                                : selectedAnswers.includes(String(optIndex));
                            return (
                              <div
                                key={`${selectedQuestion.id || "q"}-opt-${optIndex}`}
                                className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-2.5 py-1.5"
                              >
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const nextOptions = [...(selectedQuestion.options || [])];
                                    nextOptions.splice(optIndex, 1);
                                    updateQuestionOptions(selectedQuestionIndex, nextOptions);
                                    const filtered = (selectedAnswers || []).filter((a) => String(a) !== String(optIndex));
                                    updateQuestion(selectedQuestionIndex, { correctAnswers: filtered });
                                  }}
                                  disabled={perClassUiType === "boolean"}
                                  className="h-6 w-6 shrink-0 text-muted-foreground"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                <Input
                                  value={opt}
                                  onChange={(event) => {
                                    const nextOptions = [...(selectedQuestion.options || [])];
                                    nextOptions[optIndex] = event.target.value;
                                    updateQuestionOptions(selectedQuestionIndex, nextOptions);
                                  }}
                                  className="h-8 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (perClassUiType === "multiple_choice") {
                                          const set = new Set(selectedAnswers.map((a) => String(a)));
                                          if (set.has(String(optIndex))) set.delete(String(optIndex));
                                          else set.add(String(optIndex));
                                          updateQuestion(selectedQuestionIndex, { correctAnswers: [...set.values()] });
                                        } else {
                                          updateQuestion(selectedQuestionIndex, { correctAnswers: [String(optIndex)] });
                                        }
                                      }}
                                      className={cn(
                                        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                                        isCorrect
                                          ? "border-emerald-400 bg-emerald-500 text-white"
                                          : "border-slate-200 bg-white text-slate-400 hover:border-emerald-300 hover:text-emerald-600"
                                      )}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <div className="max-w-xs text-[11px] leading-5">
                                      {perClassUiType === "multiple_choice"
                                        ? "Marcar como respuesta correcta (pueden ser varias)."
                                        : "Marcar como respuesta correcta."}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            );
                          })
                        : null}
                      {mapQuestionTypeForPerClassUi(selectedQuestion.type) !== "boolean" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateQuestionOptions(selectedQuestionIndex, [...(selectedQuestion.options || []), ""])
                          }
                          className="mt-1 h-8 justify-start px-2.5 text-xs"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Agregar opción
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Explicación (opcional)</Label>
                    <Textarea
                      rows={2}
                      value={selectedQuestion.explanation || ""}
                      onChange={(event) => updateQuestion(selectedQuestionIndex, { explanation: event.target.value })}
                      placeholder="Mostrar al alumno al finalizar el intento."
                      className="text-xs"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(selectedQuestionIndex)}
                      className="h-8 px-2.5 text-xs text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Eliminar pregunta
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-background px-3 py-4 text-center text-xs text-muted-foreground">
                  Creá una pregunta primero para editarla acá.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <FieldError error={error} />
      {!error?.message && hasNestedFieldError(error) ? (
        <p className="text-sm text-destructive">Revisa las preguntas y respuestas de la evaluación final.</p>
      ) : null}
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
  const [courseLoadAttempt, setCourseLoadAttempt] = useState(0);
  const [slugTouchedManually, setSlugTouchedManually] = useState(Boolean(jobId));
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");

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
      curriculum: [
        {
          id: createEntityId("section"),
          title: "",
          description: "",
          lessons: [
            {
              id: createEntityId("lesson"),
              title: "",
              description: "",
              lessonType: "video",
              durationMinutes: undefined,
              videoUrl: "",
              content: "",
              isPreview: false,
              resources: [],
            },
          ],
        },
      ],
      finalEvaluation: {
        enabled: false,
        title: "",
        description: "",
        passingScore: undefined,
        maxAttempts: undefined,
        questions: [],
      },
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
      promoVideoAsset: null,
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
      expiresAtDate: dateInputToday(),
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
    toast.error(findFirstErrorMessage(formErrors) || "Revisá los campos pendientes antes de guardar.", { position: "top-right" });
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
    try {
      const prefix = `${COURSE_DRAFT_STORAGE_KEY}:`;
      for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
        const key = window.localStorage.key(i);
        if (!key) continue;
        if (key.startsWith(prefix)) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const nextClassesCount = countCurriculumLessons(values.curriculum);
    const currentClassesCount = Number(values.classesCount || 0);
    if (!nextClassesCount || nextClassesCount === currentClassesCount) return;
    setValue("classesCount", nextClassesCount, { shouldValidate: true, shouldDirty: true });
  }, [setValue, values.classesCount, values.curriculum]);

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
      let curriculumSnapshot = null;
      try {
        if (typeof window !== "undefined") {
          const rawSnapshot = window.sessionStorage.getItem(`acav:courses:curriculum:${String(jobId).trim()}`);
          if (rawSnapshot) {
            curriculumSnapshot = JSON.parse(rawSnapshot);
          }
        }
      } catch {
        curriculumSnapshot = null;
      }
      try {
        const data = await authedFetch(user, `/api/courses/${jobId}`, { method: "GET" });
        if (!alive) return;
        const current = data?.course || {};
        setCourse(current);
        const baseFormValues = mapCourseToFormValues(current, defaultValues);
        if (curriculumSnapshot && Array.isArray(curriculumSnapshot) && curriculumSnapshot.length) {
          baseFormValues.curriculum = sanitizeCurriculum(curriculumSnapshot);
          baseFormValues.modules = buildLegacyModulesFromCurriculum(baseFormValues.curriculum);
          baseFormValues.classesCount = countCurriculumLessons(baseFormValues.curriculum) || baseFormValues.classesCount;
        }
        reset(baseFormValues);
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

  const updateCurriculum = (nextCurriculum) => {
    const next = Array.isArray(nextCurriculum) ? nextCurriculum : [];
    setValue("curriculum", next, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    const nextClassesCount = countCurriculumLessons(next);
    setValue("classesCount", nextClassesCount || 1, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    try {
      const id = jobId && String(jobId).trim();
      if (!id || typeof window === "undefined") return;
      const key = `acav:courses:curriculum:${id}`;
      const snapshot = JSON.stringify(next);
      if (snapshot.length < 400_000) {
        window.sessionStorage.setItem(key, snapshot);
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  };

  const updateFinalEvaluation = (nextEvaluation) => {
    setValue(
      "finalEvaluation",
      nextEvaluation && typeof nextEvaluation === "object" ? nextEvaluation : { enabled: false, questions: [] },
      { shouldValidate: true, shouldDirty: true }
    );
  };

  const handleImageUploadField = async (field, nextItems, folder, successMessage, storageKey) => {
    const first = Array.isArray(nextItems) ? nextItems[0] : undefined;
    const clearIt = !first || !first?.url;
    if (clearIt) {
      setValue(field, "", { shouldValidate: false, shouldDirty: true });
      if (storageKey) setValue(storageKey, undefined, { shouldValidate: false, shouldDirty: true });
      clearErrors(field);
      return;
    }
    try {
      setValue(field, String(first.url || ""), { shouldValidate: true, shouldDirty: true });
      if (storageKey && first.storageKey) {
        setValue(storageKey, String(first.storageKey), { shouldValidate: false, shouldDirty: true });
      }
      clearErrors(field);
      toast.success(successMessage, { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No se pudo actualizar la imagen.", { position: "top-right" });
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

  const clearForm = ({ resetForm = true, showToast = true } = {}) => {
    if (resetForm) {
      const baseValues = jobId && course ? mapCourseToFormValues(course, defaultValues) : defaultValues;
      reset(baseValues);
      setSlugTouchedManually(Boolean(jobId && isCustomSlugForTitle(baseValues?.title, baseValues?.slug)));
      clearErrors();
      setActiveTab("general");
    }
    if (showToast) {
      toast.success("Formulario reiniciado", { position: "top-right" });
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
    const curriculumRaw = sanitizeCurriculum(formValues.curriculum);
    const curriculum = curriculumRaw.map((section) => ({
      ...section,
      lessons: (Array.isArray(section?.lessons) ? section.lessons : []).map((lesson) => {
        const lessonVideoAsset = lesson?.videoAsset;
        const hasAsset = Boolean(lessonVideoAsset && typeof lessonVideoAsset === "object" && (lessonVideoAsset.url || lessonVideoAsset.storageKey));
        const baseVideoUrl = String(lesson?.videoUrl || "").trim();
        const videoUrl = hasAsset ? String(lessonVideoAsset.url || baseVideoUrl) : baseVideoUrl;
        return {
          ...lesson,
          videoUrl: videoUrl || undefined,
          videoAsset: hasAsset ? lessonVideoAsset : undefined,
        };
      }),
    }));
    const modules = buildLegacyModulesFromCurriculum(curriculum);
    const finalEvaluation = sanitizeFinalEvaluation(formValues.finalEvaluation);
    const classesCount = countCurriculumLessons(curriculum) || Number(formValues.classesCount || 0);
    const attachments = sanitizeAttachments(formValues.attachments);
    const shortDescription = String(formValues.shortDescription || "").trim();
    const description = String(formValues.description || "").trim();
    const duration = String(formValues.duration || "").trim();
    const safeExpiresAtDate = clampDateInputToTodayOrFuture(formValues.expiresAtDate);
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
      curriculum,
      finalEvaluation,
      duration,
      classes: classesCount,
      classesCount: classesCount,
      benefits: [
        formValues.certificate ? "Incluye certificado" : "",
        formValues.downloadableResources ? "Material descargable" : "",
        formValues.recordedClasses ? "Clases grabadas" : "",
        formValues.support ? "Tutorías" : "",
        formValues.lifetimeAccess ? "Acceso de por vida" : "",
        finalEvaluation.enabled ? "Evaluación final" : "",
      ]
        .filter(Boolean)
        .join("\n"),
      imageUrl: formValues.coverImage ? String(formValues.coverImage).trim() : undefined,
      thumbnailUrl: formValues.thumbnail ? String(formValues.thumbnail).trim() : undefined,
      videoUrl:
        formValues.promoVideoAsset?.url || formValues.promoVideo
          ? String(formValues.promoVideoAsset?.url || formValues.promoVideo || "").trim() || undefined
          : undefined,
      videoAsset: formValues.promoVideoAsset || undefined,
      videoFileName:
        formValues.promoVideoAsset?.url
          ? formValues.promoVideoAsset?.name || formValues.promoVideoFileName || undefined
          : formValues.promoVideo
            ? undefined
            : undefined,
      videoMimeType:
        formValues.promoVideoAsset?.url
          ? formValues.promoVideoAsset?.mimeType || formValues.promoVideoMimeType || undefined
          : formValues.promoVideo
            ? undefined
            : undefined,
      videoSizeBytes:
        formValues.promoVideoAsset?.url
          ? formValues.promoVideoAsset?.fileSize || formValues.promoVideoSizeBytes || undefined
          : formValues.promoVideo
            ? undefined
            : undefined,
      videoDurationSeconds:
        formValues.promoVideoAsset?.url
          ? formValues.promoVideoAsset?.durationSeconds || formValues.promoVideoDurationSeconds || undefined
          : formValues.promoVideo
            ? undefined
            : undefined,
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
      expiresAt: isoFromDateInput(safeExpiresAtDate),
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
      clearForm({ resetForm: false, showToast: false });
      router.push(buildLocalizedPath("/dashboard/cursos"));
    } catch (error) {
      toast.error(error?.message || "No se pudo guardar el curso.", { position: "top-right" });
    }
  };

  const publicCourseHref = course?.slug ? buildLocalizedPath(`/cursos/${course.slug}`) : "";

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
    <div className="grid gap-6 text-[0.625em] leading-tight [&_*]:!leading-tight [&_*]:!tracking-normal">
      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="grid gap-6 [line-height:1.35]">
        <div className="rounded-[30px] border border-border/60 bg-card/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button type="button" variant="ghost" size="icon" asChild className="shrink-0 h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground">
              <Link href={buildLocalizedPath("/dashboard/cursos")} aria-label="Volver al listado de cursos">
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <Link href={buildLocalizedPath("/dashboard/cursos")} className="hover:text-foreground transition-colors">
                  Cursos
                </Link>
                <span className="text-slate-300">/</span>
                <span className="font-medium text-foreground truncate">{jobId ? "Editar curso" : "Crear curso"}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 min-w-0">
                <h1 className="text-[15px] font-semibold tracking-[-0.03em] text-foreground truncate">
                  {values.title || (jobId ? "Curso" : "Nuevo curso")}
                </h1>
                {(() => {
                  const statusMeta = PUBLICATION_STATUS_OPTIONS.find((item) => item.value === (values.status || "borrador"));
                  const tone = statusMeta?.tone || "secondary";
                  return statusMeta ? (
                    <Badge variant="soft" color={tone} className="h-5 px-2 text-[10px] rounded-full shrink-0">
                      {statusMeta.label}
                    </Badge>
                  ) : null;
                })()}
                <span className="inline-flex h-5 items-center gap-1 rounded-full border border-border/60 bg-background px-2 text-[10px] font-medium text-muted-foreground shrink-0">
                  {values.classesCount || 0} clases · {Array.isArray(values.curriculum) ? values.curriculum.length : 0} secciones
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {publicCourseHref ? (
              <Button type="button" variant="ghost" size="sm" asChild className="h-8 text-[11px]">
                <Link href={publicCourseHref} className="gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  Vista previa
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => clearForm()}
              disabled={busy}
              className="h-8 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Reiniciar formulario
            </Button>
            {!isLastTab ? (
              <Button type="button" size="sm" onClick={goToNextTab} disabled={busy} className="h-8 text-[11px]">
                Siguiente
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button type="submit" size="sm" disabled={busy} className="h-8 text-[11px] min-w-[160px]">
                {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                {submitting ? savingSubmitLabel : primarySubmitLabel}
              </Button>
            )}
          </div>
        </div>
      </div>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="sticky top-4 self-start z-20 w-full max-w-[320px]">
            <WorkspaceSidebar activeTab={activeTab} onSelect={handleTabChange} values={values} errors={errors} />
          </div>

          <div className="grid gap-6">
            {activeTab === "general" ? (
              <SectionCard title="Información base">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      Título del curso
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Título orientado a alumnos. Buscá que sea claro, accionable y resalte el resultado final.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input placeholder="Ej: Diseño UX para e-learning" {...register("title")} />
                    <FieldError error={errors.title} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      URL del curso
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Se genera automáticamente desde el título. Es el link que usarán los alumnos para ver el curso.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <input type="hidden" {...register("slug")} />
                    <div className="flex min-h-10 items-center rounded-md border border-border/60 bg-muted/40 px-3 text-sm text-muted-foreground">
                      {values.slug || "Se generará automáticamente desde el título"}
                    </div>
                    <FieldError error={errors.slug} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      Categoría
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Agrupa cursos similares en el catálogo. Podés crear nuevas categorías con el botón +.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
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
                    <Label className="flex items-center gap-1.5">
                      Nivel
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Ayuda a los alumnos a entender si el curso es para su perfil.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
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
                    <Label className="flex items-center gap-1.5">
                      Modalidad
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Cómo se cursa: 100% Online, en vivo, híbrido o presencial.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
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
                    <Label className="flex items-center gap-1.5">
                      Idioma
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Idioma principal de las clases y el material.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
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
                    <FieldError error={errors.language} />
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "content" ? (
              <>
                <SectionCard title="Narrativa del curso">
                  <div className="grid gap-4">
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
                      <Textarea rows={6} placeholder="Desarrolla la propuesta, metodología, beneficios y resultados." {...register("description")} />
                      <FieldError error={errors.description} />
                    </div>
                    <div className="grid gap-4 xl:grid-cols-3">
                      <ChipListField label="¿Qué aprenderás?" description="Resultados concretos que el alumno obtendrá." items={values.learningObjectives || []} onChange={(next) => updateArrayField("learningObjectives", next)} placeholder="Ej: Diseñar landing pages con foco en conversión" error={errors.learningObjectives} />
                      <ChipListField label="Requisitos previos" description="Conocimientos previos o herramientas necesarias." items={values.requirements || []} onChange={(next) => updateArrayField("requirements", next)} placeholder="Ej: Manejo básico de Figma" error={errors.requirements} />
                      <ChipListField label="Audiencia objetivo" items={values.targetAudience || []} onChange={(next) => updateArrayField("targetAudience", next)} placeholder="Ej: Diseñadores UX que venden formación online" error={errors.targetAudience} />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  <CurriculumField curriculum={values.curriculum || []} onChange={updateCurriculum} error={errors.curriculum} />
                </SectionCard>

                <SectionCard title="Cierre pedagógico">
                  <FinalEvaluationField value={values.finalEvaluation || { enabled: false, questions: [] }} onChange={updateFinalEvaluation} error={errors.finalEvaluation} />
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label>Duración estimada</Label>
                      <Input placeholder="Ej: 12 horas / 6 semanas" {...register("duration")} />
                      <FieldError error={errors.duration} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Cantidad total de clases</Label>
                      <Input type="number" min="1" value={values.classesCount ?? 1} readOnly className="bg-muted/40" />
                      <FieldError error={errors.classesCount} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Secciones cargadas</Label>
                      <Input value={Array.isArray(values.curriculum) ? values.curriculum.length : 0} readOnly className="bg-muted/40" />
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {activeTab === "resources" ? (
              <SectionCard title="Multimedia y recursos">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="grid gap-3">
                    <Label>Portada del curso</Label>
                    <MediaUploader
                      mode="image"
                      accept={{
                        "image/jpeg": [".jpg", ".jpeg"],
                        "image/png": [".png"],
                        "image/webp": [".webp"],
                      }}
                      multiple={false}
                      maxFiles={1}
                      hideExistingItems
                      folderPrefix="courses/covers"
                      helperText="PNG · JPG · WebP · hasta 20 MB. Se recomienda 1920 x 1080 px (16:9)."
                      value={values.coverImage ? [{ id: "cover-fixed", url: values.coverImage, kind: "image", label: "Portada", status: "ready" }] : []}
                      onChange={(next) => handleImageUploadField("coverImage", next, "courses/covers", "Portada cargada")}
                    />
                    {values.coverImage ? <FilePreview url={values.coverImage} title="Portada del curso" variant="compact" /> : null}
                  </div>

                  <div className="grid gap-3">
                    <Label>Miniatura</Label>
                    <MediaUploader
                      mode="image"
                      accept={{
                        "image/jpeg": [".jpg", ".jpeg"],
                        "image/png": [".png"],
                        "image/webp": [".webp"],
                      }}
                      multiple={false}
                      maxFiles={1}
                      hideExistingItems
                      folderPrefix="courses/thumbnails"
                      helperText="PNG · JPG · WebP · hasta 20 MB. Se recomienda 640 x 360 px (16:9) para listados."
                      value={values.thumbnail ? [{ id: "thumb-fixed", url: values.thumbnail, kind: "image", label: "Miniatura", status: "ready" }] : []}
                      onChange={(next) => handleImageUploadField("thumbnail", next, "courses/thumbnails", "Miniatura cargada")}
                    />
                    {values.thumbnail ? <FilePreview url={values.thumbnail} title="Miniatura del curso" variant="compact" /> : null}
                  </div>
                </div>

                <CoursePromoVideoSection
                  promoVideoAsset={values.promoVideoAsset}
                  promoVideo={values.promoVideo || ""}
                  promoVideoFileName={values.promoVideoFileName || ""}
                  promoVideoSizeBytes={values.promoVideoSizeBytes}
                  onVideoAssetChange={(next) => setValue("promoVideoAsset", next || undefined, { shouldValidate: true, shouldDirty: true })}
                  onVideoUrlChange={(next) => setValue("promoVideo", next || "", { shouldValidate: true, shouldDirty: true })}
                  validateVideoFile={validateVideoFile}
                  extractVideoMetadata={extractVideoMetadata}
                  onPromoMetadataChange={(patch) => {
                    if (!patch) return;
                    if (Object.prototype.hasOwnProperty.call(patch, "promoVideoFileName")) {
                      setValue("promoVideoFileName", patch.promoVideoFileName || "", { shouldValidate: false, shouldDirty: true });
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, "promoVideoMimeType")) {
                      setValue("promoVideoMimeType", patch.promoVideoMimeType || "", { shouldValidate: false, shouldDirty: true });
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, "promoVideoSizeBytes")) {
                      setValue("promoVideoSizeBytes", patch.promoVideoSizeBytes ?? undefined, { shouldValidate: false, shouldDirty: true });
                    }
                    if (Object.prototype.hasOwnProperty.call(patch, "promoVideoDurationSeconds")) {
                      setValue("promoVideoDurationSeconds", patch.promoVideoDurationSeconds ?? 0, { shouldValidate: false, shouldDirty: true });
                    }
                    if (patch.validationError) {
                      setError("promoVideo", { type: "manual", message: String(patch.validationError) });
                      toast.error(String(patch.validationError), { position: "top-right" });
                    } else {
                      clearErrors("promoVideo");
                    }
                    if (patch.sourceFile && typeof patch.sourceFile === "object" && patch.sourceFile instanceof window?.File) {
                      extractVideoMetadata(patch.sourceFile)
                        .then((meta) => {
                          if (meta && Number.isFinite(Number(meta.durationSeconds))) {
                            setValue("promoVideoDurationSeconds", Number(meta.durationSeconds) || 0, { shouldValidate: false, shouldDirty: true });
                          }
                        })
                        .catch(() => {});
                    }
                  }}
                  errors={errors}
                />
                <CourseAttachmentsField
                  attachments={values.attachments || []}
                  onChange={(next) => setValue("attachments", next, { shouldValidate: true, shouldDirty: true })}
                />
              </SectionCard>
            ) : null}

            {activeTab === "pricing" ? (
              <SectionCard title="Comercialización">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      Precio socios
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Valor en pesos argentinos (ARS) para socios de la institución. Es el precio vigente que se muestra al alumno.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input type="number" min="0" step="0.01" value={values.price ?? 0} onChange={(event) => setValue("price", Number(event.target.value || 0), { shouldValidate: true, shouldDirty: true })} />
                    <FieldError error={errors.price} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      Precio no socios
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Valor de lista para personas que no son socios. Se muestra tachado como oferta cuando coincida con el precio socios.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input type="number" min="0" step="0.01" value={values.oldPrice ?? ""} onChange={(event) => setValue("oldPrice", event.target.value ? Number(event.target.value) : undefined, { shouldValidate: true, shouldDirty: true })} />
                    <FieldError error={errors.oldPrice} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      Curso gratuito
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Actívalo para publicar el curso sin precio visible. El acceso se habilita automáticamente al inscribirse.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="rounded-2xl border border-border/60 bg-background px-4 py-3">
                      <div className="flex items-center justify-end gap-4">
                        <Switch checked={Boolean(values.freeCourse)} onCheckedChange={(checked) => setValue("freeCourse", checked, { shouldValidate: true, shouldDirty: true })} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {[
                    ["certificate", "Incluye certificado", <Award key="cert-icon" className="h-4 w-4" />, "El alumno recibe un certificado oficial de ACAV al finalizar la cursada."],
                    ["lifetimeAccess", "Acceso de por vida", <CheckCircle2 key="life-icon" className="h-4 w-4" />, "No hay fecha de caducidad. El contenido queda disponible para siempre."],
                    ["downloadableResources", "Material descargable", <UploadCloud key="down-icon" className="h-4 w-4" />, "PDFs, plantillas o recursos que el alumno puede guardar."],
                    ["recordedClasses", "Clases grabadas", <Film key="rec-icon" className="h-4 w-4" />, "Las sesiones en vivo se graban y quedan disponibles."],
                    ["support", "Tutorías / Soporte", <Info key="sup-icon" className="h-4 w-4" />, "El alumno tiene contacto con el docente o equipo de soporte."],
                  ].map(([field, label, icon, description]) => (
                    <div key={field} className="rounded-[22px] border border-border/60 bg-background px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            {icon}
                            {label}
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                                <HelpCircle className="h-3.5 w-3.5" />
                              </button>
                              <Switch checked={Boolean(values[field])} onCheckedChange={(checked) => setValue(field, checked, { shouldValidate: true, shouldDirty: true })} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <div className="max-w-[180px] leading-5 text-[11px]">{description}</div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeTab === "publish" ? (
              <>
                <SectionCard title="Publicación">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["featured", "Destacar en la portada", "Curso top. Se muestra primero en la home con badge Destacado."],
                      ["allowEnrollment", "Permitir inscripciones abiertas", "Los alumnos pueden inscribirse. Desactívalo para pausar nuevas inscripciones."],
                      ["showOnHome", "Mostrar en catálogo principal", "Aparece en la lista pública de cursos."],
                    ].map(([field, label, description]) => (
                      <div key={field} className="rounded-[22px] border border-border/60 bg-background px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground">{label}</div>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                                  <HelpCircle className="h-3.5 w-3.5" />
                                </button>
                                <Switch checked={Boolean(values[field])} onCheckedChange={(checked) => setValue(field, checked, { shouldValidate: true, shouldDirty: true })} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <div className="max-w-[180px] leading-5 text-[11px]">{description}</div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-6 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-1.5">
                        Estado
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <div className="max-w-xs text-[11px] leading-5">
                              Controla el ciclo de vida del curso: borrador, publicado, oculto o finalizado.
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
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
                      <Label className="flex items-center gap-1.5">
                        Fecha de publicación / vigencia
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <div className="max-w-xs text-[11px] leading-5">
                              Fecha de referencia de la publicación o hasta cuando el curso mantiene vigencia.
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input type="date" {...register("expiresAtDate")} />
                      <FieldError error={errors.expiresAtDate} />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Vista previa ejecutiva">
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
                        {values.promoVideoAsset?.url || values.promoVideo ? <div>Video: Cargado</div> : null}
                        <div>Secciones: {Array.isArray(values.curriculum) ? values.curriculum.length : 0}</div>
                        <div>Clases: {values.classesCount || 0}</div>
                        <div>Evaluación final: {values.finalEvaluation?.enabled ? `${values.finalEvaluation?.questions?.length || 0} preguntas` : "No incluida"}</div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            <div className="sticky bottom-2 z-30 rounded-[20px] border border-border/60 bg-card/95 px-3 py-2.5 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="min-w-0 shrink-0">
                  {uploading ? (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 text-[11px] font-medium text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Subiendo
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  {!isFirstTab ? (
                    <Button type="button" variant="ghost" size="sm" onClick={goToPreviousTab} disabled={busy} className="h-8 text-[11px]">
                      Anterior
                    </Button>
                  ) : null}
                  {!isLastTab ? (
                    <Button type="button" size="sm" onClick={goToNextTab} disabled={busy} className="h-8 text-[11px]">
                      Siguiente
                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button type="submit" size="sm" disabled={busy} className="h-8 text-[11px] min-w-[160px]">
                      {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                      {submitting ? savingSubmitLabel : primarySubmitLabel}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <WorkspaceSummary values={values} course={course} publicHref={publicCourseHref} />
        </div>
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
