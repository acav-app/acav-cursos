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
  Film,
  GripVertical,
  HelpCircle,
  Info,
  Layers,
  Loader2,
  Plus,
  Rocket,
  Save,
  Settings2,
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
import LessonVideoUploader from "@/components/courses/dashboard/lesson-video-uploader";
import ResourceUploader, {
  fileIconFor as resourceFileIconFor,
  formatSize as resourceFormatSize,
} from "@/components/courses/dashboard/resource-uploader";
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
                      kind: z.enum(["file", "link"]).optional(),
                      mimeType: z.string().optional(),
                      fileSize: z.number().min(0).optional(),
                    })
                  ),
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

function sanitizeLessonResources(resources) {
  return (Array.isArray(resources) ? resources : [])
    .map((resource, index) => {
      const label = String(resource?.label || resource?.name || resource?.title || "").trim();
      const url = String(resource?.url || resource?.href || resource?.link || "").trim();
      if (!label && !url) return null;
      const kindRaw = String(resource?.kind || "").trim();
      const kind = kindRaw === "file" || kindRaw === "link" ? kindRaw : undefined;
      const mimeTypeRaw = String(resource?.mimeType || resource?.type || "").trim() || undefined;
      const fileSizeRaw = Number(resource?.fileSize || resource?.size);
      const fileSize = Number.isFinite(fileSizeRaw) && fileSizeRaw > 0 ? fileSizeRaw : undefined;
      return {
        id: String(resource?.id || createEntityId(`resource-${index}`)),
        label,
        url,
        ...(kind ? { kind } : {}),
        ...(mimeTypeRaw ? { mimeType: mimeTypeRaw } : {}),
        ...(fileSize ? { fileSize } : {}),
      };
    })
    .filter((resource) => resource?.label && resource?.url);
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
          const videoUrl = String(lesson?.videoUrl || lesson?.url || "").trim();
          const thumbnailUrl = String(lesson?.thumbnailUrl || lesson?.thumbnail || "").trim();
          const content = String(lesson?.content || lesson?.body || "").trim();
          const resources = sanitizeLessonResources(lesson?.resources || lesson?.attachments);
          if (!lessonTitle && !lessonDescription && !content && !videoUrl && resources.length === 0) return null;
          return {
            id: String(lesson?.id || createEntityId(`lesson-${sectionIndex}-${lessonIndex}`)),
            title: lessonTitle,
            description: lessonDescription || undefined,
            lessonType,
            durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : undefined,
            videoUrl: videoUrl || undefined,
            thumbnailUrl: thumbnailUrl || undefined,
            content: content || undefined,
            isPreview: Boolean(lesson?.isPreview || lesson?.preview),
            resources,
          };
        })
        .filter((lesson) => lesson?.title);

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

function WorkspaceSidebar({ activeTab, onSelect, values, errors, draftSavedAt }) {
  return (
    <aside className="rounded-[28px] border border-border/60 bg-card p-4 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Navegación</div>
        {draftSavedAt ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help text-[11px] text-muted-foreground">
                {new Date(draftSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="max-w-xs text-[11px] leading-5">Última copia de seguridad local en este dispositivo.</div>
            </TooltipContent>
          </Tooltip>
        ) : null}
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

      {draftSavedAt ? (
        <div className="mt-4 rounded-[22px] border border-border/60 bg-background px-4 py-3 text-xs text-muted-foreground">
          Guardado {new Date(draftSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      ) : null}
    </aside>
  );
}

function WorkspaceSummary({ values, course, draftSavedAt, publicHref }) {
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

function LessonResourcesField({ resources, onChange }) {
  const safeResources = Array.isArray(resources) ? resources : [];

  const updateResource = (index, patch) => {
    const next = [...safeResources];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addResource = (entry) => {
    if (entry && typeof entry === "object" && entry.id && entry.label && entry.url) {
      onChange([...safeResources, entry]);
      return;
    }
    onChange([
      ...safeResources,
      {
        id: createEntityId("resource"),
        label: "",
        url: "",
      },
    ]);
  };

  const removeResource = (index) => {
    onChange(safeResources.filter((_, currentIndex) => currentIndex !== index));
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <Label>Recursos de la clase</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => addResource(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Recurso
        </Button>
      </div>
      <ResourceUploader onFileReady={(entry) => addResource(entry)} />
      {safeResources.length ? (
        <div className="grid gap-3">
          {safeResources.map((resource, index) => {
            const mimeType = String(resource?.mimeType || "");
            const sizeLabel = resourceFormatSize(resource?.fileSize);
            const kindIsFile = String(resource?.kind || "") === "file";
            return (
              <div
                key={resource.id || index}
                className="grid gap-3 rounded-2xl border border-border/60 bg-card px-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)_auto_auto]"
              >
                <div className="flex items-center justify-center">
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      kindIsFile ? "bg-[#EEF4FF] text-[#1B2B50]" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {resourceFileIconFor(mimeType || (kindIsFile ? "application/octet-stream" : ""))}
                  </span>
                </div>
                <div className="grid gap-2">
                  <Input
                    value={resource.label || ""}
                    onChange={(event) => updateResource(index, { label: event.target.value })}
                    placeholder="Guía PDF"
                  />
                  {kindIsFile && sizeLabel ? (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{sizeLabel}</span>
                      {mimeType ? <span className="truncate">{mimeType}</span> : null}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <div className="flex gap-2">
                    <Input
                      value={resource.url || ""}
                      onChange={(event) => updateResource(index, { url: event.target.value })}
                      placeholder="https://..."
                    />
                    {resource.url ? (
                      <Button
                        asChild
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        title="Abrir recurso"
                      >
                        <a href={resource.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeResource(index)}
                  className="shrink-0 self-start"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background px-4 py-4 text-sm text-muted-foreground">
          Puedes sumar PDFs, plantillas, videos o enlaces de apoyo por clase.
        </div>
      )}
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
    lessons[lessonIndex] = { ...lessons[lessonIndex], ...patch };
    updateSection(sectionIndex, { lessons });
  };

  const addLesson = (sectionIndex) => {
    const section = safeCurriculum[sectionIndex] || {};
    const lessons = Array.isArray(section.lessons) ? [...section.lessons] : [];
    lessons.push({
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
    });
    updateSection(sectionIndex, { lessons });
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
      <div>
        <Label>Currículum del curso</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Organiza el programa como un workspace: primero la estructura, después la edición de cada clase.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-border/60 bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Estructura del curso</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Selecciona una clase para editarla.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addSection}>
              <Plus className="mr-2 h-4 w-4" />
              Sección
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {safeCurriculum.map((section, sectionIndex) => {
              const lessonCount = Array.isArray(section.lessons) ? section.lessons.length : 0;
              const durationCount = Array.isArray(section.lessons)
                ? section.lessons.reduce((sum, lesson) => sum + Number(lesson?.durationMinutes || 0), 0)
                : 0;
              const isSelectedSection = String(section?.id || "") === String(selectedSection?.id || "");

              return (
                <div key={section.id || sectionIndex} className="rounded-[22px] border border-border/60 bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSectionId(String(section.id || ""));
                        setSelectedLessonId(String((section.lessons?.[0] || {}).id || ""));
                      }}
                      className={`min-w-0 flex-1 rounded-2xl px-3 py-2 text-left transition ${
                        isSelectedSection ? "bg-[#1B2B50] text-white" : "hover:bg-[#F6F8FC]"
                      }`}
                    >
                      <div className="truncate text-sm font-semibold">{section.title || `Sección ${sectionIndex + 1}`}</div>
                      <div className={`mt-1 text-xs ${isSelectedSection ? "text-white/70" : "text-muted-foreground"}`}>
                        {lessonCount} clases · {durationCount || 0} min
                      </div>
                    </button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeSection(sectionIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2">
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
                          className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
                            isSelectedLesson
                              ? "border-[#1B2B50]/15 bg-[#EEF4FF]"
                              : "border-border/60 bg-background hover:bg-[#FAFAFC]"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{lesson.title || `Clase ${lessonIndex + 1}`}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {lesson.lessonType || "video"} · {lesson.durationMinutes || 0} min
                            </span>
                          </span>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
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

        <div className="rounded-[24px] border border-border/60 bg-background p-4 md:p-5">
          {selectedSection && selectedLesson ? (
            <div className="grid gap-5">
              <div className="grid gap-4 rounded-[22px] border border-border/60 bg-card p-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {selectedSection.title || "Sección"}
                    </div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">
                      {selectedLesson.title || "Nueva clase"}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Edita un solo elemento a la vez para mantener foco y velocidad.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLesson(selectedSectionIndex, selectedLessonIndex)}
                    disabled={selectedSectionIndex < 0 || selectedLessonIndex < 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Título de la sección</Label>
                    <Input
                      value={selectedSection.title || ""}
                      onChange={(event) => updateSection(selectedSectionIndex, { title: event.target.value })}
                      placeholder="Ej: Módulo 1 · Fundamentos"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Descripción de la sección</Label>
                    <Input
                      value={selectedSection.description || ""}
                      onChange={(event) => updateSection(selectedSectionIndex, { description: event.target.value })}
                      placeholder="Qué objetivo cubre este bloque"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 rounded-[22px] border border-border/60 bg-card p-4">
                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.5fr]">
                  <div className="grid gap-2">
                    <Label>Título de la clase</Label>
                    <Input
                      value={selectedLesson.title || ""}
                      onChange={(event) => updateLesson(selectedSectionIndex, selectedLessonIndex, { title: event.target.value })}
                      placeholder="Ej: Primer proyecto"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select
                      value={selectedLesson.lessonType || "video"}
                      onValueChange={(value) => updateLesson(selectedSectionIndex, selectedLessonIndex, { lessonType: value })}
                    >
                      <SelectTrigger>
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
                  <div className="grid gap-2">
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

                <div className="grid gap-2">
                  <Label>Descripción</Label>
                  <Textarea
                    rows={3}
                    value={selectedLesson.description || ""}
                    onChange={(event) => updateLesson(selectedSectionIndex, selectedLessonIndex, { description: event.target.value })}
                    placeholder="Resume la clase y su objetivo."
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Contenido o guía</Label>
                  <Textarea
                    rows={5}
                    value={selectedLesson.content || ""}
                    onChange={(event) => updateLesson(selectedSectionIndex, selectedLessonIndex, { content: event.target.value })}
                    placeholder="Describe la clase, instrucciones, actividades o teoría."
                  />
                </div>

                <LessonVideoUploader
                  value={selectedLesson.videoUrl || ""}
                  onChange={(nextVideoUrl) =>
                    updateLesson(selectedSectionIndex, selectedLessonIndex, { videoUrl: nextVideoUrl || "" })
                  }
                />

                <div className="rounded-[18px] border border-border/60 bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Clase abierta</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Permite ver un preview del contenido antes de la inscripción.
                      </p>
                    </div>
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
          <p className="mt-1 text-sm text-muted-foreground">
            Actívala si el curso cierra con examen, cuestionario o validación final.
          </p>
        </div>
        <Switch checked={Boolean(evaluation.enabled)} onCheckedChange={(checked) => updateField({ enabled: checked })} />
      </div>

      {evaluation.enabled ? (
        <div className="grid gap-4 rounded-[24px] border border-border/60 bg-background p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Título de la evaluación</Label>
              <Input
                value={evaluation.title || ""}
                onChange={(event) => updateField({ title: event.target.value })}
                placeholder="Evaluación final del curso"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  Nota mínima (%)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="max-w-xs text-[11px] leading-5">
                        Porcentaje mínimo de respuestas correctas para aprobar.
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={evaluation.passingScore ?? ""}
                  onChange={(event) => updateField({ passingScore: Number(event.target.value || 0) || undefined })}
                  placeholder="70"
                />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  Intentos máximos
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="max-w-xs text-[11px] leading-5">
                        Cantidad de veces que un alumno puede rendir la evaluación.
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={evaluation.maxAttempts ?? ""}
                  onChange={(event) => updateField({ maxAttempts: Number(event.target.value || 0) || undefined })}
                  placeholder="3"
                />
              </div>
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

          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-[22px] border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Preguntas</div>
                  <p className="mt-1 text-xs text-muted-foreground">Selecciona una para editarla.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="mr-2 h-4 w-4" />
                  Pregunta
                </Button>
              </div>

              <div className="mt-4 grid gap-2">
                {questions.map((question, index) => {
                  const isSelected = String(question?.id || "") === String(selectedQuestion?.id || "");
                  return (
                    <button
                      key={question.id || index}
                      type="button"
                      onClick={() => setSelectedQuestionId(String(question.id || ""))}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected ? "border-[#1B2B50]/15 bg-[#EEF4FF]" : "border-border/60 bg-background hover:bg-[#FAFAFC]"
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">Pregunta {index + 1}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{question.prompt || "Sin enunciado"}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[22px] border border-border/60 bg-card p-4">
              {selectedQuestion ? (
                <div className="grid gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-foreground">Editor de pregunta</div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(selectedQuestionIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <div className="grid gap-2">
                      <Label>Enunciado</Label>
                      <Textarea
                        rows={3}
                        value={selectedQuestion.prompt || ""}
                        onChange={(event) => updateQuestion(selectedQuestionIndex, { prompt: event.target.value })}
                        placeholder="Escribe la pregunta"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Formato</Label>
                      <Select
                        value={selectedQuestion.type || "single_choice"}
                        onValueChange={(value) =>
                          updateQuestion(selectedQuestionIndex, {
                            type: value,
                            options:
                              value === "true_false"
                                ? ["Verdadero", "Falso"]
                                : value === "short_answer"
                                  ? []
                                  : (selectedQuestion.options && selectedQuestion.options.length ? selectedQuestion.options : ["", ""]),
                            correctAnswers: value === "true_false" ? ["Verdadero"] : [],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar formato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_choice">Opción única</SelectItem>
                          <SelectItem value="multiple_choice">Selección múltiple</SelectItem>
                          <SelectItem value="true_false">Verdadero / Falso</SelectItem>
                          <SelectItem value="short_answer">Respuesta corta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedQuestion.type === "single_choice" || selectedQuestion.type === "multiple_choice" ? (
                    <DynamicListField
                      label="Opciones"
                      items={selectedQuestion.options || []}
                      onChange={(next) => updateQuestionOptions(selectedQuestionIndex, next)}
                      placeholder="Ej: Reservas online"
                    />
                  ) : null}

                  <div className="grid gap-2">
                    <Label>
                      {selectedQuestion.type === "multiple_choice"
                        ? "Respuestas correctas (separa con comas)"
                        : selectedQuestion.type === "short_answer"
                          ? "Respuesta esperada"
                          : "Respuesta correcta"}
                    </Label>
                    {selectedQuestion.type === "true_false" ? (
                      <Select
                        value={Array.isArray(selectedQuestion.correctAnswers) ? selectedQuestion.correctAnswers[0] || "" : ""}
                        onValueChange={(value) => updateQuestion(selectedQuestionIndex, { correctAnswers: [value] })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar respuesta correcta" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Verdadero">Verdadero</SelectItem>
                          <SelectItem value="Falso">Falso</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={Array.isArray(selectedQuestion.correctAnswers) ? selectedQuestion.correctAnswers.join(", ") : ""}
                        onChange={(event) => updateQuestion(selectedQuestionIndex, { correctAnswers: sanitizeCorrectAnswers(event.target.value) })}
                        placeholder="Ej: Opción A, Opción C"
                      />
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label>Feedback o explicación</Label>
                    <Textarea
                      rows={3}
                      value={selectedQuestion.explanation || ""}
                      onChange={(event) => updateQuestion(selectedQuestionIndex, { explanation: event.target.value })}
                      placeholder="Explica por qué esa respuesta es correcta o qué se espera del alumno."
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-border/60 bg-background px-4 py-8 text-sm text-muted-foreground">
                  Crea una pregunta para abrir su editor.
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
    if (actorLoading || !actor || loadingCourse) return;
    if (jobId && !course) return;
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.values || !hasMeaningfulDraftContent(parsed.values)) return;
      const baseValues = jobId && course ? mapCourseToFormValues(course, defaultValues) : defaultValues;
      reset(normalizeFormValues(parsed.values, baseValues));
      setActiveTab(parsed.activeTab || "general");
      setDraftSavedAt(String(parsed.updatedAt || ""));
      setDraftRestored(true);
      setSlugTouchedManually(isCustomSlugForTitle(parsed?.values?.title || "", parsed?.values?.slug || ""));
      toast.success("Se recuperó un borrador del curso", { position: "top-right" });
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [actor, actorLoading, course, defaultValues, draftStorageKey, jobId, loadingCourse, reset]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (actorLoading || !actor || loadingCourse) return;
    if (jobId && !course) return;
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
  }, [activeTab, actor, actorLoading, course, draftStorageKey, jobId, loadingCourse, values]);

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

  const updateCurriculum = (nextCurriculum) => {
    const next = Array.isArray(nextCurriculum) ? nextCurriculum : [];
    setValue("curriculum", next, { shouldValidate: true, shouldDirty: true });
    const nextClassesCount = countCurriculumLessons(next);
    setValue("classesCount", nextClassesCount || 1, { shouldValidate: true, shouldDirty: true });
  };

  const updateFinalEvaluation = (nextEvaluation) => {
    setValue(
      "finalEvaluation",
      nextEvaluation && typeof nextEvaluation === "object" ? nextEvaluation : { enabled: false, questions: [] },
      { shouldValidate: true, shouldDirty: true }
    );
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
      const baseValues = jobId && course ? mapCourseToFormValues(course, defaultValues) : defaultValues;
      reset(baseValues);
      setSlugTouchedManually(Boolean(jobId && isCustomSlugForTitle(baseValues?.title, baseValues?.slug)));
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
    const curriculum = sanitizeCurriculum(formValues.curriculum);
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
      clearLocalDraft({ resetForm: false, showToast: false });
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
    <div className="grid gap-6">
      <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="grid gap-6">
        <div className="rounded-[30px] border border-border/60 bg-card/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <Button type="button" variant="outline" size="icon" asChild>
                <Link href={buildLocalizedPath("/dashboard/cursos")} aria-label="Volver al listado de cursos">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Link>
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[20px] font-semibold tracking-[-0.04em] text-foreground">
                    {jobId ? "Editar curso" : "Crear curso"}
                  </h1>
                  {(() => {
                    const statusMeta = PUBLICATION_STATUS_OPTIONS.find((item) => item.value === (values.status || "borrador"));
                    const tone = statusMeta?.tone || "secondary";
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Badge variant="soft" color={tone} className="rounded-full cursor-help">
                              {statusMeta?.label || values.status || "Borrador"}
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs leading-5">
                            <div className="font-semibold">{statusMeta?.label || "Estado"}</div>
                            <div className="mt-1 text-[11px] text-slate-100/90">
                              {statusMeta?.description || "Define la visibilidad del curso dentro del catálogo."}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {[`${values.classesCount || 0} clases`, `${Array.isArray(values.curriculum) ? values.curriculum.length : 0} secciones`].join(" · ")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <div className="min-h-4 text-xs text-muted-foreground">
                {draftSavedAt ? `Guardado ${new Date(draftSavedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </div>
              <div className="flex flex-wrap gap-2">
                {publicCourseHref ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="button" variant="outline" asChild>
                          <Link href={publicCourseHref}>
                            <Eye className="mr-2 h-4 w-4" />
                            Vista previa
                          </Link>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="text-[11px]">Abre el curso en la vista pública para validar cómo lo verán los alumnos.</div>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {draftSavedAt ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="button" variant="ghost" onClick={() => clearLocalDraft()} disabled={busy} className="text-muted-foreground">
                          Limpiar borrador
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="max-w-xs text-[11px] leading-5">Borra el borrador local guardado en este navegador. No afecta el curso publicado.</div>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {!isLastTab ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="button" onClick={goToNextTab} disabled={busy}>
                          Siguiente
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="text-[11px]">Valida los campos actuales y pasa a la siguiente sección.</div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="submit" disabled={busy} className="min-w-[190px]">
                          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          {submitting ? savingSubmitLabel : primarySubmitLabel}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <div className="max-w-xs text-[11px] leading-5">
                        {actor?.role === "empresa"
                          ? "Envía el curso para que el equipo admin lo revise y publique."
                          : "Guarda y publica el curso con la configuración actual."}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <WorkspaceSidebar activeTab={activeTab} onSelect={handleTabChange} values={values} errors={errors} draftSavedAt={draftSavedAt} />

          <div className="grid gap-6">
            {activeTab === "general" ? (
              <SectionCard title="Información base" description="Solo quedan los datos imprescindibles para vender el curso.">
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
                <SectionCard title="Narrativa del curso" description="Primero define qué resuelve el curso y a quién está dirigido.">
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

                <SectionCard title="Editor curricular" description="Construye secciones y clases como un árbol navegable con edición enfocada.">
                  <CurriculumField curriculum={values.curriculum || []} onChange={updateCurriculum} error={errors.curriculum} />
                </SectionCard>

                <SectionCard title="Cierre pedagógico" description="Configura la evaluación final y las métricas básicas del recorrido.">
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
            ) : null}

            {activeTab === "pricing" ? (
              <SectionCard title="Comercialización" description="Configura el posicionamiento comercial del curso con la menor fricción posible.">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      Precio
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Valor en pesos argentinos (ARS). El precio se muestra al alumno en la ficha del curso.
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <Input type="number" min="0" step="0.01" value={values.price ?? 0} onChange={(event) => setValue("price", Number(event.target.value || 0), { shouldValidate: true, shouldDirty: true })} />
                    <FieldError error={errors.price} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="flex items-center gap-1.5">
                      Precio anterior
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <div className="max-w-xs text-[11px] leading-5">
                            Mostrar precio tachado con una oferta. Debe ser mayor o igual al precio actual.
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
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-muted-foreground">Actívalo para publicar sin precio visible.</div>
                        <Switch checked={Boolean(values.freeCourse)} onCheckedChange={(checked) => setValue("freeCourse", checked, { shouldValidate: true, shouldDirty: true })} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="soft" color="info" className="rounded-full">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Beneficios destacados
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Activá los beneficios que se mostrarán en la ficha pública del curso.
                  </span>
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
                <SectionCard title="Publicación" description="Define cómo se publica el curso y qué tan visible será dentro del ecosistema ACAV.">
                  <div className="mt-2 mb-4 flex flex-wrap items-center gap-2">
                    <Badge variant="soft" color="info" className="rounded-full">
                      <Eye className="mr-1 h-3 w-3" />
                      Opciones de visibilidad
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Controla dónde y cómo aparece el curso para los alumnos.
                    </span>
                  </div>
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
                        <div>Secciones: {Array.isArray(values.curriculum) ? values.curriculum.length : 0}</div>
                        <div>Clases: {values.classesCount || 0}</div>
                        <div>Evaluación final: {values.finalEvaluation?.enabled ? `${values.finalEvaluation?.questions?.length || 0} preguntas` : "No incluida"}</div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="button" variant="outline" onClick={goToPreviousTab} disabled={busy}>
                          Anterior
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-[11px]">Vuelve a la sección anterior sin perder el progreso.</div>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                {!isLastTab ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="button" variant="outline" onClick={goToNextTab} disabled={busy}>
                          Siguiente
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="text-[11px]">Valida los campos actuales y avanza a la siguiente sección.</div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button type="submit" disabled={busy} className="min-w-[190px]">
                          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          {submitting ? savingSubmitLabel : primarySubmitLabel}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="max-w-xs text-[11px] leading-5">
                        {actor?.role === "empresa"
                          ? "Envía el curso para aprobación administrativa y queda en revisión."
                          : "Guarda definitivamente el curso con toda la configuración actual."}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          <WorkspaceSummary values={values} course={course} draftSavedAt={draftSavedAt} publicHref={publicCourseHref} />
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
