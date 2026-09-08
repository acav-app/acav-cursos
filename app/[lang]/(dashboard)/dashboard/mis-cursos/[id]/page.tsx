// @ts-nocheck
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileArchive,
  FileQuestion,
  FileText,
  Filter,
  FolderKanban,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Info,
  Languages,
  Layers,
  Loader2,
  MessageSquare,
  Paperclip,
  PlayCircle,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress, CircularProgress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { cn, useLocalizedPath } from "@/lib/utils";
import PaymentReceiptUploader from "@/components/courses/dashboard/payment-receipt-uploader";
import { resolveEducationalStatusMeta, resolvePaymentStatusMeta } from "@/lib/courses/status-meta";
import { toEmbedUrl, isYoutubeUrl, isVimeoUrl, isVideoEmbedUrl } from "@/lib/courses/video-url";
import DocumentPreviewCard from "@/components/courses/document-preview";
import EvaluationRenderer from "@/components/courses/evaluation-renderer";
import CourseCertificate from "@/components/courses/course-certificate";
import type { CourseCertificateData } from "@/components/courses/course-certificate";
import { DashboardDetailSkeleton } from "@/components/courses/dashboard/page-skeletons";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";
import { ALLOWED_ACTIVITY_ATTACHMENT_MIME_TYPES, MAX_ACTIVITY_ATTACHMENT_SIZE_BYTES } from "@/lib/courses/constants";
import {
  isFinalEvaluationUnlocked,
  isLessonEvaluationUnlocked,
  readinessProgressText,
  readinessTone,
  summarizeLessonResources,
  summarizeCurriculumResources,
  buildLessonEvaluationStatesFromEnrollment,
  perClassEvaluationProgress,
  finalEvaluationUnlockedReason,
} from "@/lib/courses/resource-readiness";
import type { GradedEvaluation } from "@/lib/courses/evaluation-engine";
import type { Course, Enrollment } from "@/lib/courses/schemas";

type LessonProgressEntry = {
  lessonId?: string | number | null;
  completedAt?: string | null;
  kind?: string | null;
  [key: string]: unknown;
};

type GradebookEntry = {
  sourceType?: string | null;
  sourceId?: string | number | null;
  title?: string | null;
  score?: number | null;
  maxScore?: number | null;
  weight?: number | null;
  status?: string | null;
  reviewedAt?: string | null;
  submittedAt?: string | null;
  feedback?: string | null;
  attempts?: number | null;
  passed?: boolean | null;
  percentage?: number | null;
  submitted?: boolean | null;
  [key: string]: unknown;
};

type FeaturedVideoSource = {
  id?: string | null;
  url: string;
  mimeType?: string | null;
  title?: string | null;
  topic?: string | null;
  durationLabel?: string | null;
  posterUrl?: string | null;
  progress?: number | null;
  summary?: string | null;
  publishedAt?: string | null;
  qualities?: ReadonlyArray<Record<string, unknown>> | null;
  subtitles?: ReadonlyArray<Record<string, unknown>> | null;
};

function titleCase(value, fallback = "-") {
  const normalized = String(value || "").replaceAll("_", " ").trim();
  if (!normalized) return fallback;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDate(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatMinutes(value) {
  const minutes = Number(value || 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return "Sin duración";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatSeconds(value) {
  const seconds = Number(value || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${rest} s`;
}

function progressValue(enrollment, lessonProgress, totalLessons) {
  const explicit = Number(enrollment?.progress || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (!totalLessons) return 0;
  return Math.round((lessonProgress.length / totalLessons) * 100);
}

function getActivityLessons(curriculum) {
  return (Array.isArray(curriculum) ? curriculum : []).flatMap((section) =>
    (Array.isArray(section?.lessons) ? section.lessons : []).filter((lesson) =>
      ["assignment", "quiz"].includes(String(lesson?.lessonType || "").trim())
    )
  );
}

function isDirectVideoUrl(url, mimeType) {
  const normalizedUrl = String(url || "").trim().toLowerCase();
  const normalizedMime = String(mimeType || "").trim().toLowerCase();
  return (
    normalizedMime.startsWith("video/") ||
    /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(normalizedUrl)
  );
}

function isImageReceipt(url) {
  const clean = String(url || "").split("?")[0].split("#")[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$|#)/i.test(clean);
}

function getLessonTypeMeta(type) {
  const normalized = String(type || "").trim();
  const map = {
    video: {
      label: "Video",
      icon: Video,
      badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
      iconClass: "bg-violet-100 text-violet-700",
      description: "Clase grabada para ver cuando quieras, con reproducción propia.",
    },
    text: {
      label: "Lectura",
      icon: FileText,
      badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
      iconClass: "bg-slate-100 text-slate-700",
      description: "Material de lectura, apunte o documento escrito.",
    },
    live: {
      label: "En vivo",
      icon: Radio,
      badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
      iconClass: "bg-sky-100 text-sky-700",
      description: "Encuentro sincrónico en vivo con docentes o compañeros.",
    },
    quiz: {
      label: "Quiz",
      icon: FileQuestion,
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      iconClass: "bg-amber-100 text-amber-700",
      description: "Evaluación breve con preguntas para repasar el contenido.",
    },
    assignment: {
      label: "Tarea",
      icon: ClipboardCheck,
      badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
      iconClass: "bg-orange-100 text-orange-700",
      description: "Trabajo práctico o entrega para enviar al equipo docente.",
    },
    download: {
      label: "Descargable",
      icon: Download,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      iconClass: "bg-emerald-100 text-emerald-700",
      description: "Archivo que podés descargar y utilizar sin conexión.",
    },
    resource: {
      label: "Recurso",
      icon: FolderKanban,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      iconClass: "bg-emerald-100 text-emerald-700",
      description: "Material complementario: plantillas, guías, enlaces o referencias.",
    },
    final_evaluation: {
      label: "Examen final",
      icon: GraduationCap,
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
      iconClass: "bg-rose-100 text-rose-700",
      description: "Evaluación de cierre para acceder al certificado oficial.",
    },
    grade: {
      label: "Calificación",
      icon: Sparkles,
      badgeClass: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
      iconClass: "bg-fuchsia-100 text-fuchsia-700",
      description: "Devolución o nota asignada por el equipo docente.",
    },
  };

  return map[normalized] || {
    label: "Contenido",
    icon: BookOpen,
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
    iconClass: "bg-slate-100 text-slate-700",
    description: "Contenido incluido en el itinerario formativo.",
  };
}

function getStatusMeta(status) {
  const normalized = String(status || "").trim();
  const map = {
    pending: {
      label: "Pendiente",
      badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
      description: "Aún no comenzaste ni presentaste este contenido.",
    },
    in_progress: {
      label: "En progreso",
      badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
      description: "Estás avanzando en este contenido en este momento.",
    },
    completed: {
      label: "Finalizado",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      description: "Ya completaste este contenido o clase.",
    },
    submitted: {
      label: "En revisión",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      description: "Tu entrega fue recibida y está siendo revisada.",
    },
    reviewed: {
      label: "Calificado",
      badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
      description: "El equipo docente ya asignó una nota a esta entrega.",
    },
    graded: {
      label: "Calificado",
      badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
      description: "El equipo docente ya asignó una nota a esta entrega.",
    },
    passed: {
      label: "Aprobado",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      description: "Superaste el mínimo necesario para aprobar esta instancia.",
    },
    failed: {
      label: "Revisar",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
      description: "Todavía no alcanzaste la nota de aprobación — podés volver a intentarlo.",
    },
  };

  return map[normalized] || map.pending;
}

function buildFeaturedVideo(course, curriculum, currentLesson, lessonProgress) {
  const safeCurriculum = Array.isArray(curriculum) ? curriculum : [];
  const currentSection = safeCurriculum.find((section) =>
    (Array.isArray(section?.lessons) ? section.lessons : []).some(
      (lesson) => String(lesson?.id || "") === String(currentLesson?.id || "")
    )
  );

  if (String(course?.videoUrl || "").trim()) {
    return {
      id: "course-promo-video",
      title: currentLesson?.title || course?.title || "Video destacado",
      topic: currentSection?.title || "Presentación de la cursada",
      durationLabel:
        formatSeconds(course?.videoDurationSeconds) ||
        formatMinutes(currentLesson?.durationMinutes) ||
        course?.duration ||
        "Duración a definir",
      publishedAt: course?.publishedAt || course?.createdAt || course?.updatedAt,
      url: course.videoUrl,
      mimeType: course?.videoMimeType,
      posterUrl: course?.thumbnailUrl || course?.imageUrl || "",
      progress:
        currentLesson && lessonProgress.some((item) => String(item?.lessonId || "") === String(currentLesson?.id || ""))
          ? 100
          : 0,
      summary: course?.shortDescription || course?.description || "",
    };
  }

  if (currentLesson && String(currentLesson?.videoUrl || "").trim()) {
    const completed = lessonProgress.some((item) => String(item?.lessonId || "") === String(currentLesson?.id || ""));
    return {
      id: currentLesson.id,
      title: currentLesson.title || course?.title || "Clase actual",
      topic: currentSection?.title || "Clase del programa",
      durationLabel: formatMinutes(currentLesson?.durationMinutes) || course?.duration || "Duración a definir",
      publishedAt: course?.publishedAt || course?.createdAt || course?.updatedAt,
      url: currentLesson.videoUrl,
      mimeType: "",
      posterUrl:
        (currentLesson?.thumbnailUrl && String(currentLesson.thumbnailUrl).trim()) ||
        course?.thumbnailUrl ||
        course?.imageUrl ||
        "",
      progress: completed ? 100 : 0,
      summary: currentLesson?.description || course?.shortDescription || "",
    };
  }

  for (const section of safeCurriculum) {
    const lesson = (Array.isArray(section?.lessons) ? section.lessons : []).find((item) =>
      String(item?.videoUrl || "").trim()
    );
    if (lesson) {
      const completed = lessonProgress.some((item) => String(item?.lessonId || "") === String(lesson?.id || ""));
      return {
        id: lesson.id,
        title: lesson.title || course?.title || "Clase destacada",
        topic: section?.title || "Clase del programa",
        durationLabel: formatMinutes(lesson?.durationMinutes) || course?.duration || "Duración a definir",
        publishedAt: course?.publishedAt || course?.createdAt || course?.updatedAt,
        url: lesson.videoUrl,
        mimeType: "",
        posterUrl:
          (lesson?.thumbnailUrl && String(lesson.thumbnailUrl).trim()) ||
          course?.thumbnailUrl ||
          course?.imageUrl ||
          "",
        progress: completed ? 100 : 0,
        summary: lesson?.description || course?.shortDescription || "",
      };
    }
  }

  return null;
}

function detectVideoKind(url, mimeType) {
  const raw = String(url || "").trim().toLowerCase();
  if (!raw) return "empty";

  const hasEmbedMime =
    mimeType &&
    (String(mimeType).startsWith("video/") || String(mimeType) === "application/octet-stream");
  const endsWithVideoExt = /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|avi)(\?|#|$)/i.test(raw);
  const isR2OrStorage =
    raw.includes("r2.dev") ||
    raw.includes("cloudflare") ||
    raw.includes("/uploads/") ||
    raw.includes("/courses/videos") ||
    raw.includes(".cloudfront.net") ||
    raw.includes("storage.googleapis");
  if (hasEmbedMime || endsWithVideoExt || isR2OrStorage) return "file";

  if (raw.includes("youtube.com") || raw.includes("youtu.be")) return "youtube";
  if (raw.includes("vimeo.com")) return "vimeo";
  return "link";
}

function normalizeEmbedUrl(url, kind) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (kind === "youtube") {
    try {
      const u = new URL(raw);
      let id = "";
      if (u.hostname.replace(/^www\./, "") === "youtu.be") {
        id = u.pathname.replace(/^\//, "");
      } else {
        id = u.searchParams.get("v") || "";
        if (!id) {
          const embedMatch = u.pathname.match(/\/embed\/([^/?#]+)/);
          if (embedMatch) id = embedMatch[1];
        }
      }
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : raw;
    } catch {
      return raw;
    }
  }
  if (kind === "vimeo") {
    try {
      const u = new URL(raw);
      const match = u.pathname.match(/\/(\d+)/);
      if (match) return `https://player.vimeo.com/video/${match[1]}`;
      return raw;
    } catch {
      return raw;
    }
  }
  return raw;
}

function Sparkline({ color = "#7C3AED", points = "2,18 18,12 32,15 48,7 64,9 78,3 94,8" }) {
  return (
    <svg viewBox="0 0 96 22" className="mt-4 h-6 w-24" aria-hidden="true">
      <path
        d={`M ${points
          .split(" ")
          .map((point) => point.replace(",", " "))
          .join(" L ")}`}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyBlock({ title, text }) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-6">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function MetricCard({ label, value, hint, accentClass, sparkColor }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
      <div className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
      <div className={cn("mt-3 text-[11px] font-semibold uppercase tracking-[0.16em]", accentClass)}>{hint}</div>
      <Sparkline color={sparkColor} />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, hint }) {
  type RadixSide = "top" | "right" | "bottom" | "left";
  const inner = (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="inline-flex items-center gap-1.5">
          {label}
          {hint ? <HelpCircle className="h-3.5 w-3.5 text-slate-300" /> : null}
        </span>
      </div>
      <div className="text-right text-sm font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
  if (!hint) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help">{inner}</div>
      </TooltipTrigger>
      <TooltipContent side={"left" as RadixSide}>
        <div className="max-w-[240px] leading-5 text-[11px]">{hint}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function TonePill({ icon: Icon, label, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase",
        className
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

function LessonEvalStatusBadge({ lesson, evalState, evalUnlocked, summary }) {
  if (!lesson?.evaluation?.enabled) return null;
  if (evalState?.passed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="soft" color="success" className="rounded-full cursor-help">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {typeof evalState.percentage === "number"
              ? `Aprobada · ${evalState.percentage}%`
              : "Aprobada"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="max-w-[240px] leading-5 text-[11px]">
            Rendiste esta evaluación y la aprobaste. ¡Buen trabajo!
            {typeof evalState.attempts === "number" && evalState.attempts > 1
              ? ` (${evalState.attempts} intentos realizados)`
              : evalState.attempts === 1
                ? " (1 intento realizado)"
                : ""}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  if (evalState?.submitted && evalState?.passed === false) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="soft" color="destructive" className="rounded-full cursor-help">
            <Circle className="mr-1 h-3 w-3" />
            {typeof evalState.percentage === "number"
              ? `Desaprobada · ${evalState.percentage}%`
              : "Desaprobada"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="max-w-[240px] leading-5 text-[11px]">
            Rendiste esta evaluación pero todavía no la aprobaste.
            {lesson.evaluation.maxAttempts ? (
              evalState.attempts && evalState.attempts >= lesson.evaluation.maxAttempts
                ? ` Usaste tus ${lesson.evaluation.maxAttempts} intentos — consultá a la institución.`
                : ` Tenés más intentos disponibles.`
            ) : " Podés volver a intentarlo."}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  if (evalUnlocked) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="soft" color="default" className="rounded-full cursor-help">
            <ClipboardCheck className="mr-1 h-3 w-3" /> Evaluación habilitada
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="max-w-[240px] leading-5 text-[11px]">
            {lesson.evaluation.requireAllResourcesReady === false
              ? "Evaluación disponible de inmediato. Rendila cuando quieras."
              : "Todos los recursos listos — podés rendir la evaluación de la clase."}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="soft" color="warning" className="rounded-full cursor-help">
          <Clock3 className="mr-1 h-3 w-3" /> Evaluación bloqueada
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="max-w-[240px] leading-5 text-[11px]">
          {summary.hasAny && !summary.allReady
            ? "Esperando a que todos los recursos de esta clase se carguen correctamente."
            : "Evaluación aún no habilitada por la institución."}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function LessonEvaluationCard({
  lesson,
  evalState,
  evalUnlocked,
  openEvaluationId,
  setOpenEvaluationId,
  onSubmit,
}) {
  if (!lesson?.evaluation?.enabled) return null;
  const lessonId = String(lesson?.id || "");
  const isOpen = openEvaluationId === lessonId;
  const questions = Array.isArray(lesson.evaluation.questions) ? lesson.evaluation.questions : [];
  const maxAttempts = lesson.evaluation.maxAttempts;
  const attemptsUsed = evalState?.attempts ?? 0;
  const outOfAttempts = Boolean(maxAttempts && attemptsUsed >= maxAttempts);
  const passed = evalState?.passed === true;

  const buttonLabel = passed
    ? "Ya aprobada"
    : outOfAttempts
      ? "Sin intentos disponibles"
      : evalUnlocked
        ? isOpen
          ? "Ocultar evaluación"
          : "Rendir evaluación"
        : "Esperando recursos";
  const buttonDisabled = !evalUnlocked || passed || outOfAttempts;

  return (
    <div
      id={`clase-${lesson.id || "eval"}`}
      className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-950">
            {lesson.evaluation.title || `Evaluación · ${lesson.title}`}
          </div>
          {lesson.evaluation.description ? (
            <p className="mt-1 text-xs text-slate-500">{lesson.evaluation.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="soft" color="secondary" className="rounded-full">
              {questions.length} preguntas
            </Badge>
            {lesson.evaluation.passingScore ? (
              <Badge variant="soft" color="success" className="rounded-full">
                Mínimo {lesson.evaluation.passingScore}%
              </Badge>
            ) : null}
            {maxAttempts ? (
              <Badge variant="soft" color="warning" className="rounded-full">
                {maxAttempts} intentos
              </Badge>
            ) : null}
            {attemptsUsed ? (
              <Badge variant="soft" color="default" className="rounded-full">
                {attemptsUsed}/{maxAttempts || "∞"} realizados
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant={isOpen ? "outline" : "default"}
          className={cn("rounded-2xl", !isOpen ? "bg-[#1B2B50] hover:bg-[#233A6A]" : "")}
          disabled={isOpen ? false : buttonDisabled}
          onClick={() => setOpenEvaluationId(isOpen ? null : lessonId)}
        >
          <FileQuestion className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
      </div>

      {isOpen && evalUnlocked && questions.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <EvaluationRenderer
            key={lesson.id}
            questions={questions}
            title={lesson.evaluation.title}
            description={lesson.evaluation.description}
            passingScore={lesson.evaluation.passingScore}
            maxAttempts={maxAttempts}
            attemptsUsed={attemptsUsed}
            defaultPoints={lesson.evaluation.defaultPoints}
            previousResult={
              evalState?.submitted
                ? {
                  questions: [],
                  totalScore: Number(evalState.score ?? 0),
                  totalMaxScore: Number(evalState.maxScore ?? 0),
                  percentage: Number.isFinite(Number(evalState.percentage))
                    ? Number(evalState.percentage)
                    : Number(evalState.maxScore) > 0
                      ? Math.round(
                        (Number(evalState.score ?? 0) / Number(evalState.maxScore)) * 100
                      )
                      : 0,
                  passingPercentage: Number(lesson.evaluation.passingScore ?? 60),
                  passed: Boolean(evalState.passed),
                  correctCount: Number.isFinite(Number((evalState.bestEntry || {})?.correctCount))
                    ? Number((evalState.bestEntry || {}).correctCount)
                    : typeof evalState.percentage === "number" &&
                      Number.isFinite(evalState.percentage)
                      ? Math.round((questions.length * evalState.percentage) / 100)
                      : undefined,
                  totalCount: Number.isFinite(Number((evalState.bestEntry || {})?.totalCount))
                    ? Number((evalState.bestEntry || {}).totalCount)
                    : questions.length,
                }
                : undefined
            }
            onSubmit={async (result) => onSubmit(lesson, result)}
          />
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardCursoAlumnoPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { loading: actorLoading } = useCourseActor();
  const hasShownSkeletonRef = useRef<boolean>(false);
  const hasCompletedFirstLoadRef = useRef<boolean>(false);
  const initialLoading = !hasShownSkeletonRef.current || !hasCompletedFirstLoadRef.current;
  const [loading, setLoading] = useState<boolean>(initialLoading);
  const [savingLesson, setSavingLesson] = useState<string>("");
  const [savingActivity, setSavingActivity] = useState<string>("");
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [lessonProgress, setLessonProgress] = useState<LessonProgressEntry[]>([]);
  const [activitySubmissions, setActivitySubmissions] = useState<Record<string, unknown>[]>([]);
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, { note: string; attachment: Record<string, unknown> | null }>>({});
  const [uploadingSubmissionAttachment, setUploadingSubmissionAttachment] = useState<string>("");
  const [locked, setLocked] = useState<boolean>(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [contentStatusFilter, setContentStatusFilter] = useState<string>("all");
  const [contentSort, setContentSort] = useState<string>("default");
  const [activeVideoSource, setActiveVideoSource] = useState<FeaturedVideoSource | null>(null);
  const [openEvaluationId, setOpenEvaluationId] = useState<string | null>(null);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);
  const [showTracking, setShowTracking] = useState<boolean>(false);
  const [forumDrafts, setForumDrafts] = useState<Record<string, string>>({});
  const [savingForumAnswer, setSavingForumAnswer] = useState<string>("");
  const forumSaveCooldownUntilRef = useRef<number>(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!user) return;
      const isFirstLoad = !hasCompletedFirstLoadRef.current;
      if (isFirstLoad) {
        hasShownSkeletonRef.current = true;
        setLoading(true);
      }
      setLocked(false);
      try {
        const data = await authedFetch(user, `/api/student-courses/${id}`, { method: "GET" });
        if (!alive) return;
        const nextEnrollment = data?.enrollment || null;
        const nextCourse = data?.course || null;
        if (isFirstLoad || !(Date.now() < forumSaveCooldownUntilRef.current)) {
          setCourse(nextCourse);
        }
        setEnrollment(nextEnrollment);
        setLessonProgress(Array.isArray(nextEnrollment?.lessonProgress) ? nextEnrollment.lessonProgress : []);
        const nextSubmissions = Array.isArray(nextEnrollment?.activitySubmissions) ? nextEnrollment.activitySubmissions : [];
        setActivitySubmissions(nextSubmissions);
        setSubmissionDrafts(
          Object.fromEntries(
            nextSubmissions.map((item) => [
              String(item?.lessonId || ""),
              { note: String(item?.note || ""), attachment: item?.attachment || null },
            ])
          )
        );
      } catch (error) {
        if (!alive) return;
        if (error?.message === "course_content_locked") {
          setLocked(true);
          try {
            const detail = await authedFetch(user, `/api/enrollments/${id}`, { method: "GET" });
            if (!alive) return;
            setEnrollment(detail?.enrollment || null);
          } catch {
            setEnrollment(null);
          }
        } else if (isFirstLoad) {
          toast.error(error?.message || "No pudimos cargar la cursada.", { position: "top-right" });
        }
      } finally {
        if (!alive) return;
        if (isFirstLoad) {
          hasCompletedFirstLoadRef.current = true;
          setLoading(false);
        }
      }
    }

    const silentRefresh = () => {
      if (!user) return;
      void load();
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      stopPolling();
      intervalId = setInterval(() => {
        if (!user) return;
        void authedFetch(user, `/api/student-courses/${id}`, { method: "GET", silent: true })
          .then((data) => {
            const nextEnrollment = data?.enrollment || null;
            const nextCourse = data?.course || null;
            if (!nextCourse && !nextEnrollment) return;
            if (!(Date.now() < forumSaveCooldownUntilRef.current)) {
              setCourse(nextCourse);
            }
            setEnrollment(nextEnrollment);
            setLessonProgress(Array.isArray(nextEnrollment?.lessonProgress) ? nextEnrollment.lessonProgress : []);
            const nextSubmissions = Array.isArray(nextEnrollment?.activitySubmissions) ? nextEnrollment.activitySubmissions : [];
            setActivitySubmissions(nextSubmissions);
            setSubmissionDrafts((prevDrafts) => {
              const base = typeof prevDrafts === "object" && prevDrafts !== null ? { ...prevDrafts } : {};
              nextSubmissions.forEach((item) => {
                const key = String(item?.lessonId || "");
                if (!key) return;
                base[key] = {
                  note: String(item?.note || ""),
                  attachment: item?.attachment || null,
                };
              });
              return base;
            });
          })
          .catch(() => { });
      }, 30000);
    }

    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    load();
    startPolling();

    return () => {
      alive = false;
      stopPolling();
    };
  }, [id, user?.uid || user?.email || ""]);

  const curriculum = useMemo(
    () => (Array.isArray(course?.curriculum) ? course.curriculum : []),
    [course?.curriculum]
  );
  const totalLessons = useMemo(
    () =>
      curriculum.reduce(
        (total, section) => total + (Array.isArray(section?.lessons) ? section.lessons.length : 0),
        0
      ),
    [curriculum]
  );
  const totalMinutes = useMemo(
    () =>
      curriculum.reduce(
        (total, section) =>
          total +
          (Array.isArray(section?.lessons)
            ? section.lessons.reduce((sum, lesson) => sum + Number(lesson?.durationMinutes || 0), 0)
            : 0),
        0
      ),
    [curriculum]
  );
  const activityLessons = useMemo(() => getActivityLessons(curriculum), [curriculum]);
  const gradebook = useMemo(
    () => (Array.isArray(enrollment?.gradebook) ? enrollment.gradebook : []),
    [enrollment?.gradebook]
  );
  const perClassStates = useMemo(
    () => buildLessonEvaluationStatesFromEnrollment(curriculum, gradebook),
    [curriculum, gradebook]
  );
  const perClassProgress = useMemo(
    () => perClassEvaluationProgress(curriculum, perClassStates),
    [curriculum, perClassStates]
  );
  const attachments = useMemo(
    () => (Array.isArray(course?.attachments) ? course.attachments : []),
    [course?.attachments]
  );

  const isLessonCompleted = useCallback(
    (lessonId) =>
      lessonProgress.some((item) => String(item?.lessonId || "") === String(lessonId || "")),
    [lessonProgress]
  );

  const currentLesson = useMemo(() => {
    const lessons = curriculum.flatMap((section) => (Array.isArray(section?.lessons) ? section.lessons : []));
    return lessons.find((lesson) => !isLessonCompleted(lesson?.id)) || lessons[0] || null;
  }, [curriculum, isLessonCompleted]);

  const featuredVideo = useMemo(
    () => buildFeaturedVideo(course, curriculum, currentLesson, lessonProgress),
    [course, curriculum, currentLesson, lessonProgress]
  );

  const featuredVideoKind = featuredVideo
    ? detectVideoKind(featuredVideo.url, featuredVideo.mimeType)
    : "empty";
  const featuredVideoEmbed = featuredVideo ? normalizeEmbedUrl(featuredVideo.url, featuredVideoKind) : "";
  const inlineFeaturedVideo =
    featuredVideo && (featuredVideoKind === "file" || featuredVideoKind === "youtube" || featuredVideoKind === "vimeo");

  useEffect(() => {
    if (!curriculum.length) {
      setOpenSections([]);
      return;
    }

    const currentSectionId =
      curriculum.find((section) =>
        (Array.isArray(section?.lessons) ? section.lessons : []).some(
          (lesson) => String(lesson?.id || "") === String(currentLesson?.id || "")
        )
      )?.id || curriculum[0]?.id;

    const initial = Array.from(
      new Set([String(curriculum[0]?.id || ""), String(currentSectionId || "")].filter(Boolean))
    );
    setOpenSections(initial);
  }, [curriculum, currentLesson]);

  const persistEnrollment = async (payload, successMessage) => {
    if (!user) return null;
    const data = await authedFetch(user, `/api/enrollments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const nextEnrollment = data?.enrollment || null;
    setEnrollment(nextEnrollment);
    setLessonProgress(Array.isArray(nextEnrollment?.lessonProgress) ? nextEnrollment.lessonProgress : []);
    setActivitySubmissions(Array.isArray(nextEnrollment?.activitySubmissions) ? nextEnrollment.activitySubmissions : []);
    if (successMessage) {
      toast.success(successMessage, { position: "top-right" });
    }
    return nextEnrollment;
  };

  const toggleLesson = async (lesson) => {
    const lessonId = String(lesson?.id || "").trim();
    if (!lessonId) return;
    const alreadyCompleted = isLessonCompleted(lessonId);
    const prevLessonProgress = lessonProgress;
    const nextLessonProgress = alreadyCompleted
      ? lessonProgress.filter((item) => String(item?.lessonId || "") !== lessonId)
      : [...lessonProgress, { lessonId, completedAt: new Date().toISOString() }];
    const nextProgress = totalLessons ? Math.round((nextLessonProgress.length / totalLessons) * 100) : 0;

    // Optimistic UI instantáneo — no esperamos al backend para reflejar el cambio
    setLessonProgress(nextLessonProgress);
    try {
      setSavingLesson(lessonId);
      const stored = await persistEnrollment(
        {
          lessonProgress: nextLessonProgress,
          progress: nextProgress,
        },
        alreadyCompleted ? "Clase marcada como pendiente." : "Clase completada."
      );
      // Si el backend respondió con enrollment pero sin progress/lessonProgress, aseguramos consistencia final
      if (stored) {
        const finalProgress = Array.isArray(stored.lessonProgress) ? stored.lessonProgress : nextLessonProgress;
        if (finalProgress.length !== nextLessonProgress.length) {
          setLessonProgress(finalProgress);
        }
      }
    } catch (error) {
      // Rollback exacto para no dejar UI desincronizada si falla el backend
      setLessonProgress(prevLessonProgress);
      toast.error(error?.message || "No pudimos actualizar el progreso.", { position: "top-right" });
    } finally {
      setSavingLesson("");
    }
  };

  const handleSubmissionDraft = (lessonId, patch) => {
    setSubmissionDrafts((current) => ({
      ...current,
      [lessonId]: {
        note: "",
        attachment: null,
        ...(current[lessonId] || {}),
        ...patch,
      },
    }));
  };

  const handleSubmissionAttachmentUpload = async (lessonId, file) => {
    if (!file || !user) return;
    if (file.size > MAX_ACTIVITY_ATTACHMENT_SIZE_BYTES) {
      toast.error(
        `El archivo no puede superar los ${Math.round(MAX_ACTIVITY_ATTACHMENT_SIZE_BYTES / (1024 * 1024))}MB.`,
        { position: "top-right" }
      );
      return;
    }
    if (!ALLOWED_ACTIVITY_ATTACHMENT_MIME_TYPES.includes(file.type)) {
      toast.error("Formato de archivo no permitido.", { position: "top-right" });
      return;
    }
    try {
      setUploadingSubmissionAttachment(lessonId);
      const result = await uploadToR2(file, "activity-submissions");
      const url = normalizePublicR2Url(result?.url);
      handleSubmissionDraft(lessonId, {
        attachment: {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url,
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        },
      });
      toast.success("Archivo adjuntado correctamente.", { position: "top-right" });
    } catch (error) {
      toast.error(error?.message || "No pudimos subir el archivo.", { position: "top-right" });
    } finally {
      setUploadingSubmissionAttachment("");
    }
  };

  const submitActivity = async (lesson) => {
    const lessonId = String(lesson?.id || "").trim();
    if (!lessonId) return;
    const draft = submissionDrafts[lessonId] || { note: "", attachment: null };
    const nextSubmission = {
      lessonId,
      title: lesson?.title || "Actividad",
      note: String(draft.note || "").trim() || undefined,
      attachment: draft.attachment || undefined,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
    const prevSubmissions = activitySubmissions;
    const nextSubmissions = [
      ...activitySubmissions.filter((item) => String(item?.lessonId || "") !== lessonId),
      nextSubmission,
    ];

    // Optimistic UI instantáneo
    setActivitySubmissions(nextSubmissions);
    try {
      setSavingActivity(lessonId);
      await persistEnrollment(
        {
          activitySubmissions: nextSubmissions,
        },
        "Entrega guardada correctamente."
      );
    } catch (error) {
      setActivitySubmissions(prevSubmissions);
      toast.error(error?.message || "No pudimos registrar la actividad.", { position: "top-right" });
    } finally {
      setSavingActivity("");
    }
  };

  const pendingActivities = useMemo(
    () =>
      activityLessons.filter((lesson) => {
        const submission = activitySubmissions.find(
          (item) => String(item?.lessonId || "") === String(lesson?.id || "")
        );
        return !submission || ["pending", "submitted"].includes(String(submission?.status || "").trim());
      }),
    [activityLessons, activitySubmissions]
  );

  const averageScore = useMemo(() => {
    const gradedEntries = gradebook.filter(
      (entry) => Number.isFinite(Number(entry?.score)) && Number.isFinite(Number(entry?.maxScore)) && Number(entry?.maxScore) > 0
    );
    if (!gradedEntries.length) return null;

    let weightedSum = 0;
    let explicitWeightsTotal = 0;
    const gradedWithExplicit = gradedEntries.filter((entry) => Number.isFinite(Number(entry?.weight)) && Number(entry?.weight) > 0);

    if (gradedWithExplicit.length) {
      explicitWeightsTotal = gradedWithExplicit.reduce((sum, entry) => sum + Number(entry.weight), 0);
      const normalized = Math.max(explicitWeightsTotal, 0.0001);
      weightedSum = gradedWithExplicit.reduce(
        (sum, entry) => sum + ((Number(entry.weight) / normalized) * (Number(entry.score) / Number(entry.maxScore))) * 100,
        0
      );
      if (gradedWithExplicit.length === gradedEntries.length) return Math.round(weightedSum);
    }

    const unweightedEntries = gradedEntries.filter((entry) => !(Number.isFinite(Number(entry?.weight)) && Number(entry?.weight) > 0));
    const unweightedTotal = unweightedEntries.reduce(
      (sum, entry) => sum + (Number(entry.score) / Number(entry.maxScore)) * 100,
      0
    );
    const unweightedShare = unweightedEntries.length / gradedEntries.length;
    const weightedShare = gradedWithExplicit.length / gradedEntries.length;

    const mixed =
      weightedShare * weightedSum +
      unweightedShare * (unweightedEntries.length ? unweightedTotal / unweightedEntries.length : 0);
    return Number.isFinite(mixed) ? Math.round(mixed) : Math.round(unweightedTotal / gradedEntries.length);
  }, [gradebook]);

  const resourceCards = useMemo(() => {
    const lessonResources = curriculum.flatMap((section) =>
      (Array.isArray(section?.lessons) ? section.lessons : []).flatMap((lesson) =>
        (Array.isArray(lesson?.resources) ? lesson.resources : []).map((resource) => ({
          id: resource.id || resource.url,
          label: resource.label || "Recurso complementario",
          url: resource.url,
          source: lesson.title || "Clase",
        }))
      )
    );

    const archiveCount = attachments.filter((item) => /\.(zip|rar|7z)$/i.test(String(item?.name || ""))).length;
    const pdfCount = attachments.filter((item) => /\.pdf$/i.test(String(item?.name || ""))).length;
    const videoCount =
      (featuredVideo ? 1 : 0) +
      curriculum.flatMap((section) => (Array.isArray(section?.lessons) ? section.lessons : [])).filter((lesson) =>
        String(lesson?.lessonType || "") === "video"
      ).length;
    const extraResourceCount = lessonResources.length + attachments.length - archiveCount - pdfCount;

    return [
      {
        id: "manuales",
        title: "Manual del curso",
        detail: pdfCount ? `${pdfCount} PDF disponibles` : "Sin manuales cargados",
        icon: FileText,
        accent: "bg-violet-100 text-violet-700",
      },
      {
        id: "fuente",
        title: "Archivos fuente",
        detail: archiveCount ? `${archiveCount} paquetes listos para descargar` : "Sin archivos fuente",
        icon: FileArchive,
        accent: "bg-amber-100 text-amber-700",
      },
      {
        id: "grabaciones",
        title: "Grabaciones",
        detail: videoCount ? `${videoCount} piezas audiovisuales` : "Sin grabaciones",
        icon: Video,
        accent: "bg-rose-100 text-rose-700",
      },
      {
        id: "assets",
        title: "Assets y recursos",
        detail: extraResourceCount > 0 ? `${extraResourceCount} recursos complementarios` : "Sin recursos extra",
        icon: FolderKanban,
        accent: "bg-emerald-100 text-emerald-700",
      },
    ];
  }, [attachments, curriculum, featuredVideo]);

  const allContentItems = useMemo(() => {
    const lessonItems = curriculum.flatMap((section, sectionIndex) =>
      (Array.isArray(section?.lessons) ? section.lessons : []).map((lesson, lessonIndex) => {
        const completed = isLessonCompleted(lesson?.id);
        const submission = activitySubmissions.find(
          (item) => String(item?.lessonId || "") === String(lesson?.id || "")
        );
        const type = String(lesson?.lessonType || "text").trim() || "text";
        const status =
          type === "assignment" || type === "quiz"
            ? submission?.status
              ? String(submission.status)
              : completed
                ? "completed"
                : String(currentLesson?.id || "") === String(lesson?.id || "")
                  ? "in_progress"
                  : "pending"
            : completed
              ? "completed"
              : String(currentLesson?.id || "") === String(lesson?.id || "")
                ? "in_progress"
                : "pending";

        return {
          id: String(lesson?.id || `${sectionIndex}-${lessonIndex}`),
          title: lesson?.title || `Clase ${lessonIndex + 1}`,
          description: lesson?.description || lesson?.content || section?.description || "",
          type,
          status,
          sectionTitle: section?.title || `Módulo ${sectionIndex + 1}`,
          durationMinutes: Number(lesson?.durationMinutes || 0),
          dateValue: submission?.submittedAt || course?.publishedAt || course?.createdAt || "",
          ctaHref: lesson?.videoUrl || "",
          ctaLabel:
            type === "video" || type === "live"
              ? "Abrir clase"
              : type === "download"
                ? "Descargar"
                : (Array.isArray(lesson?.resources) ? lesson.resources : []).length
                  ? "Ver recursos"
                  : "",
          isCurrent: String(currentLesson?.id || "") === String(lesson?.id || ""),
        };
      })
    );

    const attachmentItems = attachments.map((attachment) => ({
      id: `attachment-${attachment.id || attachment.url}`,
      title: attachment?.name || "Archivo complementario",
      description: "Material complementario del curso",
      type: "resource",
      status: "pending",
      sectionTitle: "Materiales del curso",
      durationMinutes: 0,
      dateValue: course?.updatedAt || course?.createdAt || "",
      ctaHref: attachment?.url || "",
      ctaLabel: "Abrir recurso",
      isCurrent: false,
    }));

    const gradeItems = gradebook.map((entry) => ({
      id: `grade-${entry.sourceType}-${entry.sourceId}`,
      title: entry?.title || "Calificación",
      description:
        entry?.score !== undefined && entry?.maxScore !== undefined
          ? `${entry.score} / ${entry.maxScore}`
          : "Sin nota cargada",
      type: "grade",
      status: String(entry?.status || "pending").trim() || "pending",
      sectionTitle: titleCase(entry?.sourceType, "Calificaciones"),
      durationMinutes: 0,
      dateValue: entry?.reviewedAt || "",
      ctaHref: "",
      ctaLabel: "",
      isCurrent: false,
    }));

    const evaluationItems = course?.finalEvaluation?.enabled
      ? [
        {
          id: "final-evaluation",
          title: course?.finalEvaluation?.title || "Evaluación final",
          description:
            course?.finalEvaluation?.description ||
            `${Array.isArray(course?.finalEvaluation?.questions) ? course.finalEvaluation.questions.length : 0} preguntas`,
          type: "final_evaluation",
          status:
            gradebook.some((entry) => String(entry?.sourceType || "") === "final_evaluation")
              ? String(
                gradebook.find((entry) => String(entry?.sourceType || "") === "final_evaluation")?.status || "pending"
              )
              : "pending",
          sectionTitle: "Cierre académico",
          durationMinutes: 0,
          dateValue: course?.expiresAt || course?.publishedAt || "",
          ctaHref: "",
          ctaLabel: "",
          isCurrent: false,
        },
      ]
      : [];

    return [...lessonItems, ...attachmentItems, ...gradeItems, ...evaluationItems];
  }, [attachments, course, curriculum, activitySubmissions, gradebook, currentLesson, isLessonCompleted]);

  const filteredContentItems = useMemo(() => {
    const typeFiltered =
      contentTypeFilter === "all"
        ? allContentItems
        : allContentItems.filter((item) => item.type === contentTypeFilter);

    const statusFiltered =
      contentStatusFilter === "all"
        ? typeFiltered
        : typeFiltered.filter((item) => item.status === contentStatusFilter);

    const items = [...statusFiltered];

    switch (contentSort) {
      case "date":
        items.sort((a, b) => {
          const aTime = new Date(String(a.dateValue || "")).getTime();
          const bTime = new Date(String(b.dateValue || "")).getTime();
          return (Number.isNaN(aTime) ? Number.MAX_SAFE_INTEGER : aTime) - (Number.isNaN(bTime) ? Number.MAX_SAFE_INTEGER : bTime);
        });
        break;
      case "type":
        items.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case "status":
        items.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case "duration":
        items.sort((a, b) => Number(b.durationMinutes || 0) - Number(a.durationMinutes || 0));
        break;
      default:
        break;
    }

    return items;
  }, [allContentItems, contentTypeFilter, contentStatusFilter, contentSort]);

  const upcomingActivities = useMemo(
    () =>
      allContentItems
        .filter((item) => ["assignment", "quiz", "final_evaluation"].includes(item.type))
        .filter((item) => ["pending", "in_progress", "submitted"].includes(item.status))
        .slice(0, 4),
    [allContentItems]
  );

  const effectiveVideo = useMemo(() => {
    if (activeVideoSource) return activeVideoSource;
    return featuredVideo;
  }, [activeVideoSource, featuredVideo]);

  const effectiveVideoKind = effectiveVideo
    ? detectVideoKind(effectiveVideo.url, effectiveVideo.mimeType)
    : "empty";
  const effectiveVideoEmbed = effectiveVideo
    ? normalizeEmbedUrl(effectiveVideo.url, effectiveVideoKind)
    : "";
  const effectiveInlineVideo =
    effectiveVideo &&
    (effectiveVideoKind === "file" ||
      effectiveVideoKind === "youtube" ||
      effectiveVideoKind === "vimeo");
  const effectivePlayerSrc = effectiveVideo
    ? effectiveVideoKind === "file"
      ? effectiveVideo.url
      : effectiveVideoEmbed || effectiveVideo.url
    : "";
  const effectivePlayerKey = useMemo(() => {
    const rawId = String(effectiveVideo?.id || "").trim() || "main";
    const srcHash = String(effectivePlayerSrc || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    return `vp-${rawId}-${effectiveVideoKind || "x"}-${srcHash}`;
  }, [effectiveVideo?.id, effectivePlayerSrc, effectiveVideoKind]);

  function playSourceFromLesson(lessonOrSource, fallbackSectionTitle) {
    if (!lessonOrSource) return;
    if (typeof lessonOrSource === "string") {
      const raw = String(lessonOrSource || "").trim();
      if (!raw) return;
      const kind = detectVideoKind(raw, "");
      const source = {
        id: `inline-${Date.now()}`,
        url: raw,
        mimeType: "",
        title: "Clase",
        topic: fallbackSectionTitle || "Contenido del curso",
        durationLabel: "Ver ahora",
        posterUrl:
          (course?.thumbnailUrl && String(course.thumbnailUrl).trim()) ||
          course?.imageUrl ||
          "",
        progress: 0,
        summary: "",
        publishedAt: course?.publishedAt || course?.createdAt || new Date().toISOString(),
      };
      if (kind === "youtube" || kind === "vimeo") {
        source.url = normalizeEmbedUrl(raw, kind) || raw;
      }
      setActiveVideoSource(source);
      const target = document?.querySelector?.("#video-destacado");
      if (target) {
        try {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          /* noop */
        }
      }
      return;
    }
    const lesson = lessonOrSource;
    const lessonId = String(lesson?.id || "").trim();
    const url = String(lesson?.videoUrl || "").trim();
    if (!url) return;
    const sectionTitle =
      (curriculum.find((section) =>
        (Array.isArray(section?.lessons) ? section.lessons : []).some(
          (l) => String(l?.id || "") === lessonId
        )
      )?.title as string) ||
      fallbackSectionTitle ||
      "Clase del programa";
    const completed = lessonProgress.some(
      (item) => String(item?.lessonId || "") === lessonId
    );
    const kind = detectVideoKind(url, lesson?.videoAsset?.mimeType || "");
    const finalUrl =
      kind === "youtube" || kind === "vimeo"
        ? normalizeEmbedUrl(url, kind) || url
        : url;
    setActiveVideoSource({
      id: lessonId || `inline-${Date.now()}`,
      url: finalUrl,
      mimeType: lesson?.videoAsset?.mimeType || "",
      title: lesson?.title || "Clase del curso",
      topic: sectionTitle,
      durationLabel:
        formatMinutes(lesson?.durationMinutes) || course?.duration || "Reproducción disponible",
      posterUrl:
        (lesson?.thumbnailUrl && String(lesson.thumbnailUrl).trim()) ||
        (course?.thumbnailUrl && String(course.thumbnailUrl).trim()) ||
        course?.imageUrl ||
        "",
      progress: completed ? 100 : 0,
      summary: lesson?.description || course?.shortDescription || "",
      publishedAt:
        lesson?.videoAsset?.uploadedAt ||
        course?.publishedAt ||
        course?.createdAt ||
        new Date().toISOString(),
      qualities: lesson?.videoAsset?.qualities || [],
      subtitles: lesson?.videoAsset?.subtitles || [],
    });
    const target = document?.querySelector?.("#video-destacado");
    if (target) {
      try {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        /* noop */
      }
    }
  }

  async function persistEvaluationGradebook({
    sourceId,
    sourceType,
    title,
    result,
    successMessage,
  }) {
    if (!user || !result) return null;
    const reviewedAt = new Date().toISOString();
    const prevEnrollment = enrollment;
    const prevGradebook = Array.isArray(enrollment?.gradebook) ? [...enrollment.gradebook] : [];
    const prevAttempts = prevGradebook.filter(
      (entry) =>
        String(entry?.sourceId || "") === String(sourceId) &&
        String(entry?.sourceType || "") === String(sourceType)
    ).length;
    const attemptsUsed = Number.isFinite(Number(prevAttempts)) ? Number(prevAttempts) : 0;
    const attempts = attemptsUsed + 1;
    const submittedAt = reviewedAt;
    const nextEntry = {
      sourceType,
      sourceId,
      title,
      score: result.totalScore,
      maxScore: result.totalMaxScore || undefined,
      percentage: Number.isFinite(Number(result.percentage)) ? Number(result.percentage) : undefined,
      status: result.passed ? "passed" : "failed",
      passed: Boolean(result.passed),
      reviewedAt,
      submittedAt,
      attempts,
      attemptsUsed: attempts,
      correctCount: Number.isFinite(Number(result.correctCount)) ? Number(result.correctCount) : undefined,
      totalCount: Number.isFinite(Number(result.totalCount)) ? Number(result.totalCount) : undefined,
      feedback:
        result.passed
          ? `Aprobaste con ${result.percentage}% (${result.correctCount ?? "—"}/${result.totalCount ?? "—"} correctas). ¡Buen trabajo!`
          : `Obtuviste ${result.percentage}% (${result.correctCount ?? "—"}/${result.totalCount ?? "—"} correctas). Podés volver a intentarlo si tenés intentos disponibles.`,
    };
    const filtered = prevGradebook.filter(
      (entry) =>
        !(
          String(entry?.sourceId || "") === String(sourceId) &&
          String(entry?.sourceType || "") === String(sourceType)
        )
    );
    const nextGradebook = [...filtered, nextEntry];

    // Optimistic UI instantáneo: aplicar cambios al gradebook ANTES de que termine el fetch
    // para que badges + porcentajes se actualicen sin recarga de página.
    const optimisticEnrollment = {
      ...(prevEnrollment || {}),
      gradebook: nextGradebook,
    };
    setEnrollment(optimisticEnrollment);
    if (successMessage) {
      toast.success(successMessage, { position: "top-right" });
    }

    try {
      const data = await authedFetch(user, `/api/enrollments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ gradebook: nextGradebook }),
      });
      const storedEnrollment = data?.enrollment || optimisticEnrollment;
      const finalGradebook = Array.isArray(storedEnrollment?.gradebook)
        ? storedEnrollment.gradebook
        : nextGradebook;
      // Merge final: evitar rollback espurio si el backend no devolvió gradebook modificado
      const nextFinalEnrollment = {
        ...(storedEnrollment || optimisticEnrollment),
        gradebook: finalGradebook,
      };
      setEnrollment(nextFinalEnrollment);
      return nextFinalEnrollment;
    } catch (error) {
      // Rollback exacto al estado anterior si falla el backend
      setEnrollment(prevEnrollment);
      toast.error(
        error?.message || "No pudimos guardar la evaluación. Revisá la conexión y volvé a intentarlo.",
        { position: "top-right" }
      );
      return prevEnrollment;
    }
  }

  async function submitLessonEvaluation(lesson, result: GradedEvaluation) {
    const title =
      lesson?.evaluation?.title ||
      lesson?.title ||
      "Evaluación de la clase";
    const lessonId = String(lesson?.id || "");
    const passAndUpdateProgress =
      result.passed &&
      lessonId &&
      !lessonProgress.some((p) => String(p?.lessonId || "") === lessonId);
    const prevLessonProgress = lessonProgress;
    const gradebookResp = await persistEvaluationGradebook({
      sourceId: lessonId,
      sourceType: "lesson",
      title,
      result,
      successMessage: result.passed
        ? "¡Evaluación aprobada! Tu nota fue guardada correctamente."
        : "Evaluación enviada — podés volver a intentarlo si tenés más intentos.",
    });
    let mergedEnrollment = gradebookResp || enrollment;
    if (passAndUpdateProgress && user) {
      const nextLessonProgress = [
        ...lessonProgress,
        { lessonId, completedAt: new Date().toISOString(), kind: "lesson" },
      ];
      // Optimistic progress update: marcar la clase como completada instantáneamente
      // (sin esperar el PATCH del backend) para que el badge de progreso actualice al instante.
      setLessonProgress(nextLessonProgress);
      try {
        const patchResp = await authedFetch(user, `/api/enrollments/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            lessonProgress: nextLessonProgress,
            progress: totalLessons ? Math.round((nextLessonProgress.length / totalLessons) * 100) : 0,
          }),
        });
        const patchedEnrollment = patchResp?.enrollment || {
          ...(mergedEnrollment || {}),
          lessonProgress: nextLessonProgress,
        };
        mergedEnrollment = patchedEnrollment;
        setEnrollment(patchedEnrollment);
        const finalProgress = Array.isArray(patchedEnrollment.lessonProgress)
          ? patchedEnrollment.lessonProgress
          : nextLessonProgress;
        setLessonProgress(finalProgress);
      } catch (error) {
        // Rollback progress al estado previo, gradebook ya está persistido (no lo volvemos atrás)
        setLessonProgress(prevLessonProgress);
        toast.error(error?.message || "No pudimos actualizar el progreso de la clase.", {
          position: "top-right",
        });
      }
    }
    return mergedEnrollment;
  }

  async function submitFinalEvaluation(result: GradedEvaluation) {
    const title =
      course?.finalEvaluation?.title || "Evaluación final";
    const prevLessonProgress = lessonProgress;
    const resp = await persistEvaluationGradebook({
      sourceId: "final_evaluation",
      sourceType: "final_evaluation",
      title,
      result,
      successMessage: result.passed
        ? "¡Aprobaste la evaluación final! Revisá tu certificado."
        : "Evaluación final enviada. Si no la aprobaste, podés reintentarlo.",
    });
    let mergedEnrollment = resp || enrollment;
    let updatedProgressTo100 = false;

    if (result.passed && user) {
      const allLessonIds = new Set<string>();
      curriculum.forEach((section) => {
        (Array.isArray(section?.lessons) ? section.lessons : []).forEach((lesson) => {
          const lId = String(lesson?.id || "").trim();
          if (lId) allLessonIds.add(lId);
        });
      });
      if (allLessonIds.size > 0) {
        const existing = new Set(
          lessonProgress
            .map((p) => String(p?.lessonId || "").trim())
            .filter(Boolean)
        );
        const newEntries = Array.from(allLessonIds.values())
          .filter((lId) => !existing.has(lId))
          .map((lId) => ({
            lessonId: lId,
            completedAt: new Date().toISOString(),
            kind: "lesson" as const,
          }));
        if (newEntries.length > 0) {
          const mergedProgress = [...lessonProgress, ...newEntries];
          // Optimistic: marcar todas las clases restantes como completadas al aprobar el final
          setLessonProgress(mergedProgress);
          updatedProgressTo100 = true;
          try {
            const patchResp = await authedFetch(user, `/api/enrollments/${id}`, {
              method: "PATCH",
              body: JSON.stringify({
                lessonProgress: mergedProgress,
                progress: 100,
              }),
            });
            const patched = patchResp?.enrollment || {
              ...(mergedEnrollment || {}),
              lessonProgress: mergedProgress,
              progress: 100,
            };
            mergedEnrollment = patched;
            setEnrollment(patched);
            const finalProgress = Array.isArray(patched.lessonProgress) ? patched.lessonProgress : mergedProgress;
            setLessonProgress(finalProgress);
          } catch (error) {
            setLessonProgress(prevLessonProgress);
            toast.error(error?.message || "No pudimos actualizar el progreso general.", {
              position: "top-right",
            });
          }
        } else {
          // Ya estaban todas las clases completadas → solo aseguramos progress = 100
          try {
            const patchResp = await authedFetch(user, `/api/enrollments/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ progress: 100 }),
            });
            const patched = patchResp?.enrollment || {
              ...(mergedEnrollment || {}),
              progress: 100,
            };
            mergedEnrollment = patched;
            setEnrollment(patched);
          } catch (error) {
            toast.error(error?.message || "No pudimos finalizar el progreso del curso.", {
              position: "top-right",
            });
          }
        }
      }
    }

    if (result.passed) {
      // Calcular elegibilidad certificado con los estados EN MEMORIA (optimistic)
      // sin esperar una recarga de la página.
      setTimeout(() => {
        if (!course?.includesCertificate) return;
        const gradebookSnapshot = Array.isArray((mergedEnrollment as any)?.gradebook)
          ? (mergedEnrollment as any).gradebook
          : Array.isArray(enrollment?.gradebook)
            ? enrollment.gradebook
            : [];
        const lessonStatesSnapshot = buildLessonEvaluationStatesFromEnrollment(
          curriculum,
          gradebookSnapshot
        );
        const perClassSnapshot = perClassEvaluationProgress(curriculum, lessonStatesSnapshot);
        const progressSnapshot = updatedProgressTo100
          ? totalLessons
          : Array.isArray((mergedEnrollment as any)?.lessonProgress)
            ? (mergedEnrollment as any).lessonProgress.length
            : lessonProgress.length;
        const allLessonsFinished = totalLessons === 0 || progressSnapshot >= totalLessons;
        if (allLessonsFinished && perClassSnapshot.allPassed) {
          setShowCertificate(true);
          return;
        }
        if (courseEligibleForCertificate) {
          setShowCertificate(true);
        }
      }, 450);
    }
    return mergedEnrollment;
  }

  async function submitForumAnswer(questionId: string) {
    if (!user || !course || !enrollment) return;
    const qId = String(questionId || "").trim();
    if (!qId) return;
    const rawAnswer = String(forumDrafts[qId] || "").trim();
    if (!rawAnswer) {
      toast.error("Escribí una respuesta antes de enviar.", { position: "top-right" });
      return;
    }
    const candidateEmail =
      String(user?.email || "").trim() ||
      String((enrollment as any)?.email || "").trim() ||
      String((enrollment as any)?.candidateEmail || "").trim() ||
      String((enrollment as any)?.studentEmail || "").trim() ||
      String((enrollment as any)?.contactEmail || "").trim() ||
      String((enrollment as any)?.alumnoEmail || "").trim();
    const candidateUid =
      String(user?.uid || "").trim() ||
      String((enrollment as any)?.userId || "").trim() ||
      String((enrollment as any)?.uid || "").trim() ||
      String((enrollment as any)?.user || "").trim() ||
      candidateEmail;
    const userFullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.displayName ||
      String((enrollment as any)?.fullName || "").trim() ||
      String((enrollment as any)?.full_name || "").trim() ||
      String((enrollment as any)?.name || "").trim() ||
      "";
    const existingQuestions = Array.isArray((course as any)?.forumQuestions)
      ? (course as any).forumQuestions
      : [];
    const newAnswer = {
      id: `forum-a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: candidateUid,
      userEmail: candidateEmail,
      userFullName: userFullName || undefined,
      enrollmentId: String(enrollment?.id || id || ""),
      answer: rawAnswer,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updatedQuestions = existingQuestions.map((q) => {
      if (String(q?.id) !== qId) return q;
      const existingAnswers = Array.isArray(q?.answers) ? q.answers : [];
      return {
        ...q,
        answers: [...existingAnswers, newAnswer],
      };
    });
    const optimisticCourse = {
      ...(course || {}),
      forumQuestions: updatedQuestions,
    };
    setCourse(optimisticCourse as Course);
    setSavingForumAnswer(qId);
    forumSaveCooldownUntilRef.current = Date.now() + 8000;
    try {
      const resolvedCourseId =
        String((course as any)?.id || "").trim() ||
        String((course as any)?.courseId || "").trim() ||
        String((course as any)?.jobId || "").trim() ||
        String(enrollment?.courseId || "").trim() ||
        String(enrollment?.jobId || "").trim();
      if (!resolvedCourseId) {
        throw new Error("No se pudo identificar el curso para publicar tu respuesta.");
      }
      const data = await authedFetch(user, `/api/courses/${resolvedCourseId}`, {
        method: "PATCH",
        body: JSON.stringify({ forumQuestions: updatedQuestions }),
      });
      if (data?.course) {
        setCourse({ ...(optimisticCourse as Course), ...(data.course as Course) } as Course);
      }
      setForumDrafts((current) => ({ ...current, [qId]: "" }));
      toast.success("Respuesta publicada correctamente.", { position: "top-right" });
    } catch (error) {
      setCourse(course);
      toast.error(error?.message || "No pudimos publicar tu respuesta.", { position: "top-right" });
    } finally {
      setSavingForumAnswer("");
    }
  }

  function lessonEvaluationUsedAttempts(lessonId: unknown): number {
    const lid = String(lessonId || "").trim();
    if (!lid) return 0;
    const entries = Array.isArray(gradebook) ? gradebook : [];
    return entries.filter(
      (entry) =>
        String(entry?.sourceId || "") === lid &&
        (String(entry?.sourceType || "") === "lesson" ||
          String(entry?.sourceType || "").toLowerCase().includes("lesson"))
    ).length;
  }

  function finalEvaluationUsedAttempts(): number {
    const entries = Array.isArray(gradebook) ? gradebook : [];
    return entries.filter(
      (entry) =>
        String(entry?.sourceId || "") === "final_evaluation" ||
        String(entry?.sourceType || "") === "final_evaluation"
    ).length;
  }

  const finalEvalEntry = useMemo(() => {
    const list = Array.isArray(enrollment?.gradebook) ? enrollment.gradebook : [];
    const matches = list.filter(
      (entry) =>
        String(entry?.sourceType || "") === "final_evaluation" ||
        String(entry?.sourceId || "") === "final_evaluation"
    );
    if (!matches.length) return null;
    return matches.reduce((carry, entry) => {
      if (!carry) return entry;
      const pctA = Number.isFinite(Number((carry as any).percentage)) ? Number((carry as any).percentage) : -Infinity;
      const pctB = Number.isFinite(Number((entry as any).percentage)) ? Number((entry as any).percentage) : -Infinity;
      if (pctB > pctA) return entry;
      return carry;
    }, null);
  }, [enrollment?.gradebook]);

  const completion = useMemo(() => {
    const lessonsScore =
      totalLessons === 0 ? 100 : Math.round((lessonProgress.length / totalLessons) * 100);
    const lessonEvalCount =
      perClassProgress.totalEvaluations === 0 ? 100 : Math.round(
        ((perClassProgress.passed + (course?.finalEvaluation?.enabled ? 0 : perClassProgress.failed)) /
          perClassProgress.totalEvaluations) *
        100
      );
    const finalEvalScore = (() => {
      if (!course?.finalEvaluation?.enabled) return 100;
      const status = String(finalEvalEntry?.status || "").trim().toLowerCase();
      if (status === "passed") return 100;
      const pct = Number.isFinite(Number(finalEvalEntry?.percentage)) ? Number(finalEvalEntry.percentage) : 0;
      return pct;
    })();
    const activityScore =
      activityLessons.length === 0 ? 100 : Math.round((activitySubmissions.length / activityLessons.length) * 100);
    const weights = { lessons: 0.5, activities: 0.1, lessonEvaluations: 0.2, final: 0.2 };
    const weighted =
      lessonsScore * weights.lessons +
      activityScore * weights.activities +
      lessonEvalCount * weights.lessonEvaluations +
      finalEvalScore * weights.final;
    return Math.max(0, Math.min(100, Math.round(weighted)));
  }, [
    totalLessons,
    lessonProgress.length,
    perClassProgress,
    course?.finalEvaluation?.enabled,
    finalEvalEntry,
    activityLessons.length,
    activitySubmissions.length,
  ]);

  const courseEligibleForCertificate = useMemo(() => {
    if (!course?.includesCertificate) return false;
    if (totalLessons === 0) return false;
    if (!lessonProgress.length || lessonProgress.length < totalLessons) return false;
    if (!perClassProgress.allPassed) return false;
    const fe = course?.finalEvaluation;
    if (!fe?.enabled) return true;
    const raw = finalEvalEntry?.status;
    return String(raw || "").trim().toLowerCase() === "passed";
  }, [
    course?.includesCertificate,
    course?.finalEvaluation,
    totalLessons,
    lessonProgress.length,
    perClassProgress.allPassed,
    finalEvalEntry,
  ]);

  const certificateData: CourseCertificateData | null = useMemo(() => {
    if (!courseEligibleForCertificate) return null;
    const displayName =
      String(enrollment?.studentName || "").trim() ||
      [
        String(enrollment?.firstName || user?.displayName || user?.firstName || "").trim(),
        String(enrollment?.lastName || user?.lastName || "").trim(),
      ]
        .filter(Boolean)
        .join(" ") ||
      user?.email ||
      "Alumno / Alumna";
    const score = Number.isFinite(Number(averageScore)) ? Number(averageScore) : undefined;
    return {
      studentName: displayName,
      studentEmail: String(enrollment?.email || user?.email || "").trim() || undefined,
      courseTitle: String(course?.title || "Curso").trim(),
      institutionName:
        String(course?.institutionName || course?.companyName || "ACAV Cursos").trim(),
      courseDuration:
        String(course?.duration || "").trim() ||
        (totalMinutes ? formatMinutes(totalMinutes) : undefined) ||
        undefined,
      completionDate:
        String(
          finalEvalEntry?.reviewedAt ||
          enrollment?.approvedAt ||
          enrollment?.updatedAt ||
          new Date().toISOString()
        ),
      certificateId: `ACAV-CERT-${String(id || "").toUpperCase().slice(0, 8)}-${String(
        enrollment?.id || user?.uid || ""
      )
        .toUpperCase()
        .slice(0, 8)}`,
      averageScore: score,
      logoUrl:
        String(course?.institutionLogoUrl || course?.companyLogoUrl || "").trim() ||
        undefined,
    };
  }, [
    courseEligibleForCertificate,
    course,
    enrollment,
    user,
    id,
    averageScore,
    totalMinutes,
    finalEvalEntry,
  ]);

  const courseInfo = [
    { icon: CalendarDays, label: "Inscripción", value: formatDate(enrollment?.approvedAt || enrollment?.createdAt) || "-", hint: "Fecha en la que tu inscripción quedó formalizada o fue presentada." },
    { icon: BookOpen, label: "Institución", value: course?.institutionName || course?.companyName || "ACAV Cursos", hint: "Organismo que dicta y valida este curso." },
    {
      icon: Clock3,
      label: "Duración total",
      value: course?.duration || formatMinutes(totalMinutes) || "A definir",
      hint: "Tiempo estimado para completar todo el itinerario formativo.",
    },
    { icon: Layers, label: "Nivel", value: course?.level || "General", hint: "Perfil de conocimientos sugerido para cursar esta formación." },
    { icon: Languages, label: "Idioma", value: course?.language || "Español", hint: "Idioma principal en el que se dictan las clases y materiales." },
    {
      icon: ShieldCheck,
      label: "Certificado",
      value: course?.includesCertificate ? "Disponible al completar" : "No incluido",
      hint: "Si completás la cursada y la evaluación, podés descargar tu certificado oficial.",
    },
  ];

  if (loading || actorLoading) {
    return (
      <div className="bg-[#F6F7FB]">
        <DashboardDetailSkeleton />
      </div>
    );
  }

  if (locked && enrollment) {
    const educationalMeta = resolveEducationalStatusMeta(enrollment?.status);
    const paymentMeta = resolvePaymentStatusMeta(enrollment?.paymentStatus || enrollment?.payment?.status);
    const StatusIcon = educationalMeta.Icon || Circle;
    return (
      <div className="mx-auto max-w-5xl px-3 py-8 md:px-4">
        <Link
          href={buildLocalizedPath("/dashboard/mis-cursos")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5B5BD6]"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis cursos
        </Link>
        <div className="mt-6 rounded-[30px] border border-slate-200 bg-white p-8 shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Contenido bloqueado</div>
          <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.03em] text-slate-950">
            La cursada todavía no está habilitada
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Solo los alumnos con inscripción activa pueden ver el contenido completo del curso. Tu estado actual es
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge variant="soft" color={educationalMeta.tone} className="rounded-full cursor-help">
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {educationalMeta.title}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="max-w-xs leading-5">
                  <div className="font-semibold">{educationalMeta.title}</div>
                  <div className="mt-1 text-[11px] text-slate-100/90">{educationalMeta.description}</div>
                </div>
              </TooltipContent>
            </Tooltip>
            {enrollment?.paymentStatus || enrollment?.payment?.status ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge variant="soft" color={paymentMeta.tone} className="rounded-full cursor-help">
                      Pago · {paymentMeta.title}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="max-w-xs leading-5">
                    <div className="font-semibold">Estado del pago</div>
                    <div className="mt-1 text-[11px] text-slate-100/90">{paymentMeta.description}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>

          <div className="mt-7">
            <PaymentReceiptUploader
              enrollmentId={id}
              initialReceiptUrl={String(enrollment?.paymentReceiptUrl || enrollment?.payment?.receiptUrl || "").trim()}
              initialReference={String(enrollment?.paymentReference || enrollment?.payment?.reference || "").trim()}
              enrollmentStatus={String(enrollment?.status || "").trim()}
              paymentStatus={String(enrollment?.paymentStatus || enrollment?.payment?.status || "").trim()}
              onUpdated={(updated) => {
                if (!updated) return;
                setEnrollment(updated);
                if (String(updated.status || "").trim().toLowerCase() === "active") {
                  setLocked(false);
                  toast.success("Tu acceso fue aprobado. Cargando la cursada...", { position: "top-right" });
                  setTimeout(() => window.location.reload(), 900);
                }
              }}
            />
          </div>

          {/* <div className="mt-6 flex flex-wrap gap-3">
            <Dialog open={showTracking} onOpenChange={setShowTracking}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button className="rounded-2xl bg-[#6D4CFF] hover:bg-[#5E3EF0]">
                      Ver seguimiento de la inscripción
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="max-w-xs text-[11px] leading-5">
                    Historial de pagos, estado académico y novedades de tu inscripción.
                  </div>
                </TooltipContent>
              </Tooltip>
              <DialogContent size="4xl" className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-slate-950">
                    <FolderKanban className="h-5 w-5 shrink-0 text-[#6D4CFF]" />
                    Seguimiento de tu inscripción
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    Resumen en tiempo real del estado del pago, tu progreso y las evaluaciones del curso.
                  </DialogDescription>
                </DialogHeader>
                {enrollment ? (() => {
                  const eduMeta = resolveEducationalStatusMeta(enrollment?.status);
                  const payMeta = resolvePaymentStatusMeta(enrollment?.paymentStatus || enrollment?.payment?.status);
                  const EduIcon = eduMeta.Icon || Circle;
                  const PayIcon = payMeta.Icon || Circle;
                  const createdAtRaw = (enrollment as any)?.createdAt || (enrollment as any)?.created_at || (enrollment as any)?.submittedAt;
                  const approvedAtRaw = (enrollment as any)?.approvedAt || (enrollment as any)?.activatedAt;
                  const paymentNotes = (enrollment as any)?.paymentNotes || (enrollment as any)?.payment?.notes;
                  const adminMessage = (enrollment as any)?.adminMessage || (enrollment as any)?.notes;
                  return (
                    <div className="mt-2 grid w-full gap-4 sm:grid-cols-2">
                      <div className="w-full rounded-2xl border border-slate-200 bg-[#FCFCFF] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Estado académico</div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", eduMeta.badgeClass)}>
                            <EduIcon className="h-3.5 w-3.5 shrink-0" />
                            {eduMeta.label}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Progreso cursada</div>
                            <div className="mt-1 flex items-center gap-2">
                              <CircularProgress size="sm" value={completion} className="shrink-0" />
                              <span className="text-sm font-semibold text-slate-900">{completion}%</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Clases completadas</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{lessonProgress.length} / {totalLessons}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Evaluaciones clase</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{perClassProgress.passed} / {perClassProgress.totalEvaluations} aprobadas</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Evaluación final</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {!course?.finalEvaluation?.enabled
                                ? "No requiere"
                                : finalEvalEntry
                                ? (String(finalEvalEntry.status || "").trim().toLowerCase() === "passed" ? `Aprobada · ${finalEvalEntry.percentage ?? 0}%` : `En curso · ${finalEvalEntry.percentage ?? 0}%`)
                                : "Pendiente"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="w-full rounded-2xl border border-slate-200 bg-[#FCFCFF] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Estado del pago</div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", payMeta.badgeClass)}>
                            <PayIcon className="h-3.5 w-3.5 shrink-0" />
                            {payMeta.label}
                          </span>
                          {(enrollment as any)?.paymentReference ? (
                            <Badge variant="soft" color="default" className="rounded-full shrink-0">
                              <FileText className="mr-1 h-3 w-3" />
                              Ref. {(enrollment as any).paymentReference}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-3 text-[11px] leading-5 text-slate-500">{payMeta.description}</p>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Inscripción</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900 break-all">#{String(id || "").slice(0, 12)}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Fecha inicio</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{createdAtRaw ? new Date(String(createdAtRaw)).toLocaleDateString() : "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Aprobada en</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">{approvedAtRaw ? new Date(String(approvedAtRaw)).toLocaleDateString() : "—"}</div>
                          </div>
                          <div>
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Intentos final</div>
                            <div className="mt-1 text-sm font-semibold text-slate-900">
                              {course?.finalEvaluation?.enabled ? `${finalEvaluationUsedAttempts()}${typeof course.finalEvaluation.maxAttempts === "number" ? ` / ${course.finalEvaluation.maxAttempts}` : ""}` : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                      {(adminMessage || paymentNotes || (enrollment as any)?.paymentReceiptUrl) ? (
                        <div className="w-full sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Novedades y comprobantes</div>
                          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                            {adminMessage ? (
                              <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">Mensaje de coordinación</div>
                                <div className="mt-1 break-words">{String(adminMessage)}</div>
                              </div>
                            ) : null}
                            {paymentNotes ? (
                              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Notas de pago</div>
                                <div className="mt-1 break-words">{String(paymentNotes)}</div>
                              </div>
                            ) : null}
                            {(enrollment as any)?.paymentReceiptUrl ? (
                              <div className="flex items-center gap-3">
                                {isImageReceipt(String((enrollment as any).paymentReceiptUrl)) ? (
                                  <img src={String((enrollment as any).paymentReceiptUrl)} alt="" className="h-10 w-10 rounded-lg object-cover border border-slate-200" />
                                ) : (
                                  <FileText className="h-10 w-10 text-slate-400" />
                                )}
                                <a
                                  href={String((enrollment as any).paymentReceiptUrl)}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#5B5BD6] hover:underline"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Descargar comprobante de pago
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })() : null}
              </DialogContent>
            </Dialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button asChild variant="outline" className="rounded-2xl border-slate-200">
                    <Link href={buildLocalizedPath("/dashboard/pagos")}>Ir a pagos</Link>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-[11px]">Panel consolidado de todas tus inscripciones y pagos.</div>
              </TooltipContent>
            </Tooltip>
          </div> */}
        </div>
      </div>
    );
  }

  if (!course || !enrollment) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-8 md:px-4">
        <div className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
          <h1 className="text-2xl font-semibold text-slate-950">No pudimos abrir la cursada</h1>
          <p className="mt-3 text-sm text-slate-500">
            Verifica que la inscripción exista y que tu acceso esté habilitado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F6F7FB]">
      <div className="mx-auto px-3 py-6 md:px-4 md:py-8">
        <div className="mb-5">
          <Link
            href={buildLocalizedPath("/dashboard/mis-cursos")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Mis Cursos
          </Link>
        </div>

        <div className="grid gap-5 md:gap-6 xl:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5 md:space-y-6">
            <section id="video-destacado" className="rounded-[24px] md:rounded-[28px] border border-slate-200 bg-white p-2.5 shadow-[0_22px_70px_rgba(15,23,42,0.06)] md:p-3 lg:p-4">
              <div
                className="flex flex-col overflow-hidden rounded-[18px] md:rounded-[22px] border border-slate-200 bg-white transition duration-500 md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-0 md:items-stretch"
              >
                <div className="relative flex items-center justify-start w-full md:p-7 lg:p-8 bg-white md:border-r md:border-slate-200">
                  <div className="relative w-full aspect-video overflow-hidden rounded-[18px] md:rounded-[20px] border border-slate-200 bg-slate-900/95 shadow-[0_16px_44px_rgba(15,23,42,0.14)]">
                    {effectiveVideo ? (
                      <>
                        {effectiveInlineVideo ? (
                          isYoutubeUrl(effectiveVideo.url) || isVimeoUrl(effectiveVideo.url) || isVideoEmbedUrl(effectiveVideo.url) ? (
                            <iframe
                              key={effectivePlayerKey}
                              src={toEmbedUrl(effectiveVideo.url)}
                              title={effectiveVideo.title || "Video"}
                              className="absolute inset-0 h-full w-full border-0 rounded-[17px] md:rounded-[19px]"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          ) : (
                            <video
                              key={effectivePlayerKey}
                              controls
                              preload="metadata"
                              playsInline
                              src={effectivePlayerSrc}
                              poster={effectiveVideo.posterUrl || undefined}
                              className="absolute inset-0 h-full w-full object-contain bg-black rounded-[17px] md:rounded-[19px]"
                            />
                          )
                        ) : effectiveVideo.posterUrl ? (
                          <div
                            className="absolute inset-0 transition duration-500 rounded-[17px] md:rounded-[19px]"
                            style={{
                              backgroundImage: `url(${effectiveVideo.posterUrl})`,
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                              backgroundSize: "cover",
                            }}
                            aria-label={effectiveVideo.title}
                            role="img"
                          />
                        ) : null}

                        {activeVideoSource ? (
                          <div className="absolute inset-x-3 top-3 flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-full border-slate-700/40 bg-slate-950/60 text-white hover:bg-slate-950/70 h-8 backdrop-blur-sm"
                              onClick={() => setActiveVideoSource(null)}
                            >
                              Volver al video principal
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="absolute inset-0 rounded-[17px] md:rounded-[19px]">
                        {String(course?.imageUrl || course?.thumbnailUrl || "").trim() ? (
                          <div
                            className="h-full w-full transition duration-500"
                            style={{
                              backgroundImage: `url(${String(course.imageUrl || course.thumbnailUrl || "").trim()})`,
                              backgroundPosition: "center",
                              backgroundRepeat: "no-repeat",
                              backgroundSize: "cover",
                            }}
                            aria-label={`Portada de ${String(course?.title || "Curso").trim()}`}
                            role="img"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <TonePill
                              icon={PlayCircle}
                              label="Sin video principal"
                              className="border-slate-300 bg-white text-slate-700"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col min-h-[260px] px-4 py-5 md:px-7 md:py-8 lg:px-8 lg:py-10 text-slate-900">
                  <div className="flex flex-wrap items-center gap-2">
                    <TonePill
                      icon={Sparkles}
                      label={effectiveVideo?.topic || "Cursada actual"}
                      className="border-slate-200 bg-slate-50 text-slate-700"
                    />
                    {effectiveVideo?.progress === 100 ? (
                      <Badge variant="soft" color="success" className="rounded-full border-emerald-100 bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Completado
                      </Badge>
                    ) : completion > 0 ? (
                      <Badge variant="soft" color="info" className="rounded-full border-sky-100 bg-sky-50 text-sky-700">
                        <CircleDot className="mr-1 h-3 w-3" />
                        {completion}% avanzado
                      </Badge>
                    ) : null}
                  </div>

                  <h1 className="mt-4 text-[26px] md:text-[30px] lg:text-[34px] font-semibold tracking-[-0.03em] leading-[1.08] text-slate-950">
                    {String(course?.title || effectiveVideo?.title || "Curso").trim()}
                  </h1>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs md:text-[13px] text-slate-600">
                    {String(course?.companyName || course?.company?.name || "").trim() ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-slate-400" />
                        {String(course.companyName || course.company?.name).trim()}
                      </span>
                    ) : null}
                    {String(course?.modality || "").trim() ? (
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                        {titleCase(String(course.modality))}
                      </span>
                    ) : null}
                    {String(effectiveVideo?.durationLabel || course?.duration || "").trim() ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                        {String(effectiveVideo?.durationLabel || course?.duration).trim()}
                      </span>
                    ) : null}
                    {String(course?.level || "").trim() ? (
                      <span className="inline-flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                        {titleCase(String(course.level))}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-5 text-sm md:text-[15px] leading-7 text-slate-700 line-clamp-none">
                    {String(
                      course?.description?.trim() ||
                      course?.shortDescription?.trim() ||
                      effectiveVideo?.summary?.trim() ||
                      ""
                    ) || "Contenido disponible dentro de la ruta de aprendizaje, sección por sección."}
                  </p>

                  <div className="mt-auto pt-7">
                    <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                      <span>Tu progreso</span>
                      <span>{completion}%</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-sky-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, Number(completion) || 0))}%` }}
                      />
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500">
                      {lessonProgress.length} / {totalLessons || 0} clases completadas
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Completado"
                value={`${completion}%`}
                hint="Cursada activa"
                accentClass="text-violet-600"
                sparkColor="#6D4CFF"
              />
              <MetricCard
                label="Clases completadas"
                value={`${lessonProgress.length} / ${totalLessons || 0}`}
                hint="Ritmo actual"
                accentClass="text-sky-600"
                sparkColor="#3B82F6"
              />
              <MetricCard
                label="Actividades pendientes"
                value={`${pendingActivities.length}`}
                hint="Requieren atención"
                accentClass="text-amber-600"
                sparkColor="#F59E0B"
              />
              <MetricCard
                label="Promedio general"
                value={averageScore !== null ? `${averageScore}%` : "--"}
                hint="Calificaciones"
                accentClass="text-emerald-600"
                sparkColor="#22C55E"
              />
            </section>

            <section id="ruta-del-curso" className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">Ruta del curso</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Toda la cursada, clase por clase: videos, materiales, descripción completa y evaluaciones, todo listo para avanzar a tu ritmo.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {curriculum.length ? (
                  curriculum.map((section, sectionIndex) => {
                    const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
                    const completedLessons = lessons.filter((lesson) => isLessonCompleted(lesson?.id)).length;
                    const isOpen = openSections.includes(String(section?.id || ""));
                    const safeSectionId = String(section?.id || `section-${sectionIndex}`);

                    return (
                      <div key={safeSectionId} className="overflow-hidden rounded-[24px] border border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSections((current) =>
                              current.includes(safeSectionId)
                                ? current.filter((item) => item !== safeSectionId)
                                : [...current, safeSectionId]
                            )
                          }
                          className="flex w-full items-center justify-between gap-4 bg-white px-4 py-4 text-left transition hover:bg-slate-50"
                          aria-expanded={isOpen}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#6D4CFF]">
                              <Layers className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-950">
                                  Módulo {sectionIndex + 1}
                                </span>
                                <span className="text-sm text-slate-500">· {section?.title || "Sin título"}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {completedLessons}/{lessons.length} · {formatMinutes(
                                  lessons.reduce((sum, lesson) => sum + Number(lesson?.durationMinutes || 0), 0)
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-500">
                              {completedLessons}/{lessons.length}
                            </span>
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {isOpen ? (
<div className="space-y-2">
                              {lessons.map((lesson, lessonIndex) => {
                                const completed = isLessonCompleted(lesson?.id);
                                const isCurrent = String(currentLesson?.id || "") === String(lesson?.id || "");
                                const typeMeta = getLessonTypeMeta(lesson?.lessonType);
                                const stateMeta = getStatusMeta(
                                  completed ? "completed" : isCurrent ? "in_progress" : "pending"
                                );
                                const Icon = typeMeta.icon;
                                const lessonVideoUrl = String(lesson?.videoUrl || lesson?.video?.url || "").trim();
                                const lessonVideoPoster = String(lesson?.video?.posterUrl || "").trim();
                                const lessonVideoTitle = String(lesson?.title || `Clase ${lessonIndex + 1}`);
                                const hasLessonVideo = Boolean(lessonVideoUrl);
                                const resources = Array.isArray(lesson?.resources) ? lesson.resources : [];
                                const summary = summarizeLessonResources(lesson);
                                const hasEval = lesson?.evaluation?.enabled;
                                const evalUnlocked = isLessonEvaluationUnlocked(lesson);
                                const lessonId = String(lesson?.id || "");
                                const evalState = lessonId ? perClassStates[lessonId] : undefined;
                                const canShowReadiness = resources.length || hasEval;
                                const isActivityLesson = activityLessons.some(
                                  (activity) => String(activity?.id || "") === lessonId
                                );
                                const currentSubmission = isActivityLesson
                                  ? activitySubmissions.find(
                                      (item) => String(item?.lessonId || "") === lessonId
                                    ) || null
                                  : null;
                                const submissionDraft = submissionDrafts[lessonId] || {
                                  note: String(currentSubmission?.note || ""),
                                  attachment: currentSubmission?.attachment || null,
                                };

                                return (
                                  <div
                                    key={lesson.id || `${safeSectionId}-${lessonIndex}`}
                                    className={cn(
                                      "group rounded-[24px] border bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)] transition hover:shadow-[0_18px_44px_rgba(15,23,42,0.06)]",
                                      isCurrent
                                        ? "border-violet-200 ring-1 ring-violet-200/70 bg-gradient-to-b from-violet-50/70 to-white"
                                        : "border-slate-200"
                                    )}
                                  >
                                    <div className="flex flex-col gap-3 px-4 py-4 md:px-5 md:py-5">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                          <span className={cn("mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", typeMeta.iconClass)}>
                                            <Icon className="h-4 w-4" />
                                          </span>
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                                {sectionIndex + 1}.{lessonIndex + 1}
                                              </span>
                                              <h3 className="line-clamp-1 text-[15px] font-semibold text-slate-950">
                                                {lesson?.title || `Clase ${lessonIndex + 1}`}
                                              </h3>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", typeMeta.badgeClass)}>
                                                {typeMeta.label}
                                              </span>
                                              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", stateMeta.badgeClass)}>
                                                {stateMeta.label}
                                              </span>
                                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                                                {lesson?.durationMinutes ? `${lesson.durationMinutes} min` : "Duración flexible"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {completed ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                          ) : (
                                            <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                                          )}
                                          <Button
                                            type="button"
                                            variant={completed ? "outline" : "default"}
                                            size="sm"
                                            className={cn(
                                              "h-9 rounded-2xl",
                                              completed
                                                ? "border-slate-200 text-slate-600 hover:text-slate-900"
                                                : "bg-[#6D4CFF] hover:bg-[#5E3EF0] text-white"
                                            )}
                                            onClick={() => toggleLesson(lesson)}
                                            disabled={savingLesson === lesson.id}
                                          >
                                            {savingLesson === lesson.id ? (
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : completed ? (
                                              <CheckCircle2 className="mr-2 h-4 w-4" />
                                            ) : (
                                              <Circle className="mr-2 h-4 w-4" />
                                            )}
                                            {completed ? "Completada" : "Marcar completa"}
                                          </Button>
                                        </div>
                                      </div>

                                      {lesson?.description ? (
                                        <div className="pl-0 md:pl-[3.25rem]">
                                          <p className="text-[14px] leading-7 text-slate-600 whitespace-pre-line">
                                            {lesson.description}
                                          </p>
                                        </div>
                                      ) : null}

                                      {hasLessonVideo ? (
                                        <div className="pl-0 md:pl-[3.25rem]">
                                          <div className="overflow-hidden rounded-[20px] md:rounded-[22px] border border-slate-200 bg-slate-950/95 shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
                                            <div className="relative aspect-video w-full max-w-2xl mx-auto bg-black">
                                              {isYoutubeUrl(lessonVideoUrl) || isVimeoUrl(lessonVideoUrl) || isVideoEmbedUrl(lessonVideoUrl) ? (
                                                <iframe
                                                  key={`lesson-video-${lesson.id || lessonIndex}`}
                                                  src={toEmbedUrl(lessonVideoUrl)}
                                                  title={lessonVideoTitle}
                                                  className="absolute inset-0 h-full w-full border-0"
                                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                  allowFullScreen
                                                />
                                              ) : (
                                                <video
                                                  key={`lesson-video-${lesson.id || lessonIndex}`}
                                                  controls
                                                  preload="metadata"
                                                  playsInline
                                                  src={lessonVideoUrl}
                                                  poster={lessonVideoPoster || undefined}
                                                  className="absolute inset-0 h-full w-full object-contain bg-black"
                                                />
                                              )}
                                            </div>
                                          </div>
                                          {hasLessonVideo && canShowReadiness ? (
                                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                              <Badge
                                                variant="soft"
                                                color={readinessTone(summary)}
                                                className="rounded-full"
                                              >
                                                <FolderKanban className="mr-1 h-3 w-3" />
                                                {readinessProgressText(summary)}
                                              </Badge>
                                              <LessonEvalStatusBadge
                                                lesson={lesson}
                                                evalState={evalState}
                                                evalUnlocked={evalUnlocked}
                                                summary={summary}
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : canShowReadiness ? (
                                        <div className="pl-0 md:pl-[3.25rem] flex flex-wrap items-center gap-2">
                                          <Badge
                                            variant="soft"
                                            color={readinessTone(summary)}
                                            className="rounded-full"
                                          >
                                            <FolderKanban className="mr-1 h-3 w-3" />
                                            {readinessProgressText(summary)}
                                          </Badge>
                                          <LessonEvalStatusBadge
                                            lesson={lesson}
                                            evalState={evalState}
                                            evalUnlocked={evalUnlocked}
                                            summary={summary}
                                          />
                                        </div>
                                      ) : null}

                                      {resources.length ? (
                                        <div className="pl-0 md:pl-[3.25rem]">
                                          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
                                            {resources.map((r, idx) => (
                                              <DocumentPreviewCard
                                                key={r.id || `${lesson.id}_${idx}`}
                                                resource={r}
                                                compact
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}

                                      {hasEval ? (
                                        <div className="pl-0 md:pl-[3.25rem]">
                                          <LessonEvaluationCard
                                            lesson={lesson}
                                            evalState={evalState}
                                            evalUnlocked={evalUnlocked}
                                            openEvaluationId={openEvaluationId}
                                            setOpenEvaluationId={setOpenEvaluationId}
                                            onSubmit={submitLessonEvaluation}
                                          />
                                        </div>
                                      ) : null}

                                      {isActivityLesson ? (
                                        <div className="pl-0 md:pl-[3.25rem]">
                                          <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="text-sm font-semibold text-slate-900">
                                                Entrega de la clase
                                              </span>
                                              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", getStatusMeta(currentSubmission?.status || "pending").badgeClass)}>
                                                {getStatusMeta(currentSubmission?.status || "pending").label}
                                              </span>
                                              {currentSubmission?.submittedAt ? (
                                                <span className="text-xs text-slate-400">
                                                  Enviado {formatDateTime(currentSubmission.submittedAt)}
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="mt-3 grid gap-3">
                                              <Textarea
                                                rows={3}
                                                value={submissionDraft.note}
                                                onChange={(event) => handleSubmissionDraft(lessonId, { note: event.target.value })}
                                                placeholder="Dejá una nota sobre tu entrega o avance."
                                                className="rounded-[16px] border-slate-200 bg-white"
                                                aria-label={`Nota para ${lesson.title}`}
                                              />
                                              {submissionDraft.attachment ? (
                                                <div className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-3 py-2.5">
                                                  <div className="flex min-w-0 items-center gap-2">
                                                    <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
                                                    <a
                                                      href={submissionDraft.attachment.url}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                      className="truncate text-sm font-medium text-[#6D4CFF] hover:underline"
                                                    >
                                                      {submissionDraft.attachment.name}
                                                    </a>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleSubmissionDraft(lessonId, { attachment: null })}
                                                    className="shrink-0 text-slate-400 transition hover:text-destructive"
                                                    aria-label={`Quitar archivo de ${lesson.title}`}
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </button>
                                                </div>
                                              ) : (
                                                <label
                                                  className={cn(
                                                    "flex cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-dashed border-slate-300 bg-white px-3 py-3 text-sm font-medium text-slate-600 transition hover:border-[#6D4CFF]/50 hover:text-[#6D4CFF]",
                                                    uploadingSubmissionAttachment === lessonId && "pointer-events-none opacity-70"
                                                  )}
                                                >
                                                  {uploadingSubmissionAttachment === lessonId ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                  ) : (
                                                    <Upload className="h-4 w-4" />
                                                  )}
                                                  {uploadingSubmissionAttachment === lessonId ? "Subiendo archivo..." : "Adjuntar archivo"}
                                                  <input
                                                    type="file"
                                                    className="hidden"
                                                    accept={ALLOWED_ACTIVITY_ATTACHMENT_MIME_TYPES.join(",")}
                                                    disabled={uploadingSubmissionAttachment === lessonId}
                                                    onChange={(event) => {
                                                      const file = event.target.files?.[0] || null;
                                                      event.target.value = "";
                                                      if (file) handleSubmissionAttachmentUpload(lessonId, file);
                                                    }}
                                                    aria-label={`Archivo de entrega para ${lesson.title}`}
                                                  />
                                                </label>
                                              )}
                                              <Button
                                                type="button"
                                                size="sm"
                                                className="w-full rounded-2xl bg-[#6D4CFF] hover:bg-[#5E3EF0] md:w-auto md:justify-self-end"
                                                onClick={() => submitActivity(lesson)}
                                                disabled={savingActivity === lesson.id || uploadingSubmissionAttachment === lessonId}
                                              >
                                                {savingActivity === lesson.id ? (
                                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                  <Upload className="mr-2 h-4 w-4" />
                                                )}
                                                Guardar entrega
                                              </Button>
                                              {currentSubmission?.feedback ? (
                                                <div className="rounded-[16px] border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-800">
                                                  <span className="font-semibold">Feedback docente:</span> {currentSubmission.feedback}
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <EmptyBlock title="Sin contenido cargado" text="El curso todavía no tiene módulos visibles para la cursada." />
                )}
              </div>
            </section>
{/* 
            <section id="contenidos-academicos" className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    Contenidos académicos
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Filtra por tipo, estado o criterio de orden para encontrar rápido clases, evaluaciones, tareas y materiales.
                  </p>
                </div>

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  <div className="grid gap-2">
                    <label className="sr-only" htmlFor="tipo-contenido">
                      Filtrar por tipo
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                            <SelectTrigger id="tipo-contenido" className="rounded-2xl border-slate-200 bg-white cursor-help">
                              <Filter className="mr-2 h-4 w-4 text-slate-400" />
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos los tipos</SelectItem>
                              <SelectItem value="video">Videos</SelectItem>
                              <SelectItem value="text">Lecturas</SelectItem>
                              <SelectItem value="live">En vivo</SelectItem>
                              <SelectItem value="assignment">Tareas</SelectItem>
                              <SelectItem value="quiz">Quizzes</SelectItem>
                              <SelectItem value="resource">Recursos</SelectItem>
                              <SelectItem value="final_evaluation">Examen final</SelectItem>
                              <SelectItem value="grade">Calificaciones</SelectItem>
                            </SelectContent>
                          </Select>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <div className="max-w-xs text-[11px] leading-5">
                          <div className="font-semibold">Filtrar por tipo</div>
                          <div className="mt-1 text-slate-100/90">Encuentra rápido solo el formato que necesitas repasar.</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="grid gap-2">
                    <label className="sr-only" htmlFor="estado-contenido">
                      Filtrar por estado
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Select value={contentStatusFilter} onValueChange={setContentStatusFilter}>
                            <SelectTrigger id="estado-contenido" className="rounded-2xl border-slate-200 bg-white cursor-help">
                              <CheckCircle2 className="mr-2 h-4 w-4 text-slate-400" />
                              <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos los estados</SelectItem>
                              <SelectItem value="pending">Pendiente</SelectItem>
                              <SelectItem value="in_progress">En progreso</SelectItem>
                              <SelectItem value="completed">Finalizado</SelectItem>
                              <SelectItem value="submitted">En revisión</SelectItem>
                              <SelectItem value="reviewed">Calificado</SelectItem>
                              <SelectItem value="passed">Aprobado</SelectItem>
                            </SelectContent>
                          </Select>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <div className="max-w-xs text-[11px] leading-5">
                          <div className="font-semibold">Filtrar por estado</div>
                          <div className="mt-1 text-slate-100/90">Aísla lo que te falta, lo que estás haciendo o lo ya aprobado.</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div className="grid gap-2">
                    <label className="sr-only" htmlFor="orden-contenido">
                      Ordenar contenido
                    </label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Select value={contentSort} onValueChange={setContentSort}>
                            <SelectTrigger id="orden-contenido" className="rounded-2xl border-slate-200 bg-white cursor-help">
                              <SlidersHorizontal className="mr-2 h-4 w-4 text-slate-400" />
                              <SelectValue placeholder="Orden" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Orden original</SelectItem>
                              <SelectItem value="date">Fecha</SelectItem>
                              <SelectItem value="type">Tipo</SelectItem>
                              <SelectItem value="status">Estado</SelectItem>
                              <SelectItem value="duration">Duración</SelectItem>
                            </SelectContent>
                          </Select>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <div className="max-w-xs text-[11px] leading-5">
                          <div className="font-semibold">Orden de visualización</div>
                          <div className="mt-1 text-slate-100/90">Reordena la lista según lo que te resulte más útil.</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  "video",
                  "text",
                  "live",
                  "quiz",
                  "assignment",
                  "resource",
                  "final_evaluation",
                  "grade",
                ].map((key) => {
                  const meta = getLessonTypeMeta(key);
                  const Icon = meta.icon;
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] cursor-help",
                            meta.badgeClass
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {meta.label}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <div className="max-w-xs leading-5 text-[11px]">
                          <div className="font-semibold">{meta.label}</div>
                          <div className="mt-1 text-slate-100/90">
                            {meta.description || "Tipo de recurso incluido en el itinerario formativo."}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-3">
                {filteredContentItems.length ? (
                  filteredContentItems.map((item) => {
                    const typeMeta = getLessonTypeMeta(item.type);
                    const statusMeta = getStatusMeta(item.status);
                    const Icon = typeMeta.icon;

                    return (
                      <article
                        key={item.id}
                        className={cn(
                          "rounded-[24px] border p-4 transition md:p-5",
                          item.isCurrent
                            ? "border-violet-200 bg-violet-50/70 shadow-[0_14px_36px_rgba(109,76,255,0.08)]"
                            : "border-slate-200 bg-white"
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 gap-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl cursor-help", typeMeta.iconClass)}>
                                  <Icon className="h-5 w-5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <div className="max-w-xs leading-5 text-[11px]">
                                  <div className="font-semibold">{typeMeta.label}</div>
                                  <div className="mt-1 text-slate-100/90">
                                    {typeMeta.description || "Tipo de contenido académico."}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-help", typeMeta.badgeClass)}>
                                        {typeMeta.label}
                                      </span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <div className="max-w-xs text-[11px]">
                                      <div className="font-semibold">{typeMeta.label}</div>
                                      <div className="mt-1 text-slate-100/90">
                                        {typeMeta.description || "Categoría del contenido."}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-help", statusMeta.badgeClass)}>
                                        {statusMeta.label}
                                      </span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <div className="max-w-xs text-[11px]">
                                      <div className="font-semibold">{statusMeta.label}</div>
                                      <div className="mt-1 text-slate-100/90">
                                        {statusMeta.description || "Tu estado actual en este contenido."}
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-slate-400 cursor-help">{item.sectionTitle}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom">
                                    <div className="text-[11px]">Módulo / sección a la que pertenece este contenido.</div>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                              <h3 className="mt-3 text-base font-semibold text-slate-950">{item.title}</h3>
                              {item.description ? (
                                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.description}</p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                {item.durationMinutes ? <span>{formatMinutes(item.durationMinutes)}</span> : null}
                                <span>
                                  {formatDate(item.dateValue) || "Sin fecha de vencimiento"}
                                </span>
                                {item.isCurrent ? <span className="font-semibold text-violet-600">Elemento actual</span> : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {["video", "text", "live", "download"].includes(item.type) && item.id ? (
                              <Button
                                type="button"
                                variant={String(item.status) === "completed" ? "outline" : "default"}
                                className={cn(
                                  "rounded-2xl",
                                  String(item.status) === "completed"
                                    ? "border-slate-200"
                                    : "bg-[#6D4CFF] hover:bg-[#5E3EF0]"
                                )}
                                onClick={() =>
                                  toggleLesson(
                                    curriculum
                                      .flatMap((section) => (Array.isArray(section?.lessons) ? section.lessons : []))
                                      .find((lesson) => String(lesson?.id || "") === String(item.id))
                                  )
                                }
                                disabled={savingLesson === item.id}
                              >
                                {savingLesson === item.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : String(item.status) === "completed" ? (
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                ) : (
                                  <Circle className="mr-2 h-4 w-4" />
                                )}
                                {String(item.status) === "completed" ? "Finalizada" : "Marcar completa"}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <EmptyBlock
                    title="No encontramos resultados"
                    text="Ajusta los filtros para volver a ver el contenido académico disponible."
                  />
                )}
              </div>
            </section> */}

            <section className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    Materiales y recursos del curso
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Accesos rápidos a documentos, fuentes, grabaciones y recursos complementarios.
                  </p>
                </div>
                {attachments.length ? (
                  <Button asChild variant="outline" className="rounded-2xl border-slate-200">
                    <a href={attachments[0]?.url} target="_blank" rel="noreferrer">
                      Ver todos
                    </a>
                  </Button>
                ) : null}
              </div>

              <div className="mt-5">
                {attachments.length ? (
                  <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
                    {attachments.slice(0, 9).map((resource, idx) => (
                      <DocumentPreviewCard key={resource.id || `${resource.url}_${idx}`} resource={resource} />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {resourceCards.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Tooltip key={item.id}>
                          <TooltipTrigger asChild>
                            <div
                              key={item.id}
                              className="rounded-[24px] border border-slate-200 bg-[#FCFCFF] p-4 cursor-help transition hover:border-violet-200 hover:bg-violet-50/40"
                            >
                              <span
                                className={cn(
                                  "inline-flex h-11 w-11 items-center justify-center rounded-2xl",
                                  item.accent
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </span>
                              <div className="mt-4 text-sm font-semibold text-slate-950">
                                {item.title}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <div className="max-w-[240px] leading-5 text-[11px]">
                              <div className="font-semibold">{item.title}</div>
                              <div className="mt-1 text-slate-100/90">{item.detail}</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div >

          <aside className="space-y-5 md:space-y-6">
            <section className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 md:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-slate-950">Información del curso</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <Info className="h-4 w-4 text-slate-300" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="max-w-[240px] leading-5 text-[11px]">
                      Resumen rápido de tu inscripción y de las características del curso.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-4">
                {courseInfo.map((item) => (
                  <InfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} hint={item.hint} />
                ))}
              </div>
            </section>

            <section className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 md:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-slate-950">Tu progreso</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <Sparkles className="h-4 w-4 text-[#6D4CFF]" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="max-w-[240px] leading-5 text-[11px]">
                      Cálculo combinado sobre clases marcadas, actividades entregadas y evaluación final.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-5 flex justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative cursor-help">
                      <CircularProgress
                        value={completion}
                        size="xl"
                        className="[&_[bar-color]]:text-[#7C3AED] [&_[path-color]]:text-[#E7E1FB]"
                        aria-label="Progreso circular del curso"
                      />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-[19px] font-semibold tracking-[-0.04em] text-slate-950">{completion}%</div>
                        <div className="text-xs font-medium text-slate-500">Completado</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <div className="max-w-xs leading-5 text-[11px]">
                      Porcentaje general de la cursada considerando clases, actividades y evaluación final.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="mt-6 space-y-4">
                <InfoRow icon={BookOpen} label="Clases" value={`${lessonProgress.length} / ${totalLessons || 0}`} hint="Cantidad de clases marcadas como completadas sobre el total disponible." />
                <InfoRow icon={ClipboardCheck} label="Actividades" value={`${activitySubmissions.length} / ${activityLessons.length || 0}`} hint="Tareas, prácticos o quizzes que ya fueron presentados." />
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button asChild variant="outline" className="mt-5 w-full rounded-2xl border-slate-200">
                      <a href="#contenidos-academicos">Ver detalle completo</a>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-[11px]">Salta a la sección con filtros y el listado completo de contenidos.</div>
                </TooltipContent>
              </Tooltip>
            </section>

            <section className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 md:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-slate-950">Próximas actividades</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <CalendarDays className="h-4 w-4 text-slate-300" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="max-w-[230px] leading-5 text-[11px]">
                      Entregas, exámenes y encuentros en vivo que tenés próximos dentro del curso.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-4 grid gap-3">
                {upcomingActivities.length ? (
                  upcomingActivities.map((item) => {
                    const typeMeta = getLessonTypeMeta(item.type);
                    const statusMeta = getStatusMeta(item.status);
                    const Icon = typeMeta.icon;
                    return (
                      <div key={item.id} className="rounded-[22px] border border-slate-200 bg-[#FCFCFF] p-4">
                        <div className="flex items-start gap-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl cursor-help", typeMeta.iconClass)}>
                                <Icon className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <div className="max-w-xs text-[11px]">
                                <div className="font-semibold">{typeMeta.label}</div>
                                <div className="mt-1 text-slate-100/90">{typeMeta.description || "Tipo de actividad."}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-950">{item.title}</div>
                            <div className="mt-1 text-xs text-slate-400">{item.sectionTitle}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-help", statusMeta.badgeClass)}>
                                  {statusMeta.label}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <div className="max-w-xs text-[11px]">
                                <div className="font-semibold">{statusMeta.label}</div>
                                <div className="mt-1 text-slate-100/90">{statusMeta.description || "Estado actual de la actividad."}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-slate-400 cursor-help">
                                {formatDate(item.dateValue) || "Sin fecha"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <div className="text-[11px]">Fecha límite o programada para esta actividad.</div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyBlock
                    title="Todo en orden"
                    text="No hay actividades próximas pendientes en este momento."
                  />
                )}
              </div>
            </section>

            <section className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 md:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-[#6D4CFF]" />
                  <div className="text-lg font-semibold text-slate-950">Calificaciones</div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <Info className="h-4 w-4 text-slate-300" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="max-w-[230px] leading-5 text-[11px]">
                      Notas y devoluciones cargadas por el equipo docente sobre tus entregas.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-4 grid gap-3">
                {gradebook.length ? (
                  gradebook.map((entry) => {
                    const statusMeta = getStatusMeta(entry?.status || "pending");
                    return (
                      <div key={`${entry.sourceType}-${entry.sourceId}`} className="rounded-[22px] border border-slate-200 bg-[#FCFCFF] p-4">
                        <div className="text-sm font-semibold text-slate-950">{entry.title}</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-help", statusMeta.badgeClass)}>
                                  {statusMeta.label}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <div className="max-w-xs text-[11px]">
                                <div className="font-semibold">{statusMeta.label}</div>
                                <div className="mt-1 text-slate-100/90">{statusMeta.description || "Situación de la calificación."}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-slate-500 cursor-help">
                                {entry.score !== undefined && entry.maxScore !== undefined
                                  ? `${entry.score} / ${entry.maxScore}`
                                  : "Sin nota"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <div className="text-[11px]">
                                {entry.score !== undefined && entry.maxScore !== undefined
                                  ? `Puntuación obtenida sobre el máximo posible.`
                                  : `Todavía no hay una nota cargada para este item.`}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {entry.feedback ? (
                          <p className="mt-3 text-sm leading-6 text-slate-500">{entry.feedback}</p>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <EmptyBlock
                    title="Sin calificaciones aún"
                    text="Las notas aparecerán aquí a medida que el equipo docente las cargue."
                  />
                )}
              </div>
            </section>

            <section className="w-full min-w-0 rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 md:p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 shrink-0 rounded-2xl bg-violet-100 p-2 text-violet-700">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold leading-snug tracking-tight text-slate-950">Evaluación final</div>
                    {course?.finalEvaluation?.enabled && course.finalEvaluation.title ? (
                      <div className="mt-0.5 truncate text-xs font-medium text-slate-500">{course.finalEvaluation.title}</div>
                    ) : null}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <ClipboardCheck className="h-4 w-4 text-slate-300" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <div className="max-w-[230px] leading-5 text-[11px]">
                      Examen de cierre para acceder al certificado oficial de ACAV. Se habilita cuando todos los recursos del curso están listos y todas las evaluaciones por clase están aprobadas.
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-4 w-full min-w-0">
                {course?.finalEvaluation?.enabled ? (
                  (() => {
                    const unlocked = isFinalEvaluationUnlocked(course, perClassStates);
                    const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
                    const evaluatedLessons = curriculum.flatMap((s) =>
                      Array.isArray(s?.lessons) ? s.lessons.filter((l) => l?.evaluation?.enabled) : []
                    );
                    const progress = perClassProgress;
                    const summary = summarizeCurriculumResources(curriculum);
                    const requireResources = course.finalEvaluation.requireAllResourcesReady !== false;
                    const requireEvaluations = course.finalEvaluation.requireAllLessonsEvaluationsCompleted !== false;
                    const reason = finalEvaluationUnlockedReason(course, perClassStates);
                    const totalQuestions = Array.isArray(course.finalEvaluation.questions) ? course.finalEvaluation.questions.length : 0;
                    return (
                      <div className="w-full min-w-0">
                        <div
                          className={cn(
                            "w-full min-w-0 rounded-[22px] border p-4",
                            unlocked ? "border-slate-200 bg-[#FCFCFF]" : "border-amber-200 bg-amber-50/60"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-950 break-words">
                              {course.finalEvaluation.title || "Evaluación de cierre"}
                            </div>
                            {unlocked ? (
                              <Badge variant="soft" color="success" className="rounded-full shrink-0">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Habilitada
                              </Badge>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="soft" color="warning" className="rounded-full cursor-help shrink-0">
                                    <Clock3 className="mr-1 h-3 w-3" /> Bloqueada
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <div className="max-w-[240px] leading-5 text-[11px]">
                                    {reason || "Completá todas las clases y evaluaciones para habilitar el examen final."}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {course.finalEvaluation.description ? (
                            <p className="mt-2 text-sm leading-6 text-slate-500 break-words line-clamp-4">
                              {course.finalEvaluation.description}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Badge
                                    variant="soft"
                                    color="default"
                                    className="bg-violet-100 text-violet-700 hover:text-violet-700 cursor-help break-words"
                                  >
                                    {totalQuestions} preguntas
                                  </Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                <div className="text-[11px]">Cantidad de preguntas que incluye el examen final.</div>
                              </TooltipContent>
                            </Tooltip>
                            {course.finalEvaluation.passingScore ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Badge
                                      variant="soft"
                                      color="success"
                                      className="bg-emerald-100 text-emerald-700 hover:text-emerald-700 cursor-help break-words"
                                    >
                                      Mínimo {course.finalEvaluation.passingScore}%
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <div className="text-[11px]">Porcentaje mínimo necesario para aprobar el examen.</div>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                            {course.finalEvaluation.maxAttempts ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Badge
                                      variant="soft"
                                      color="warning"
                                      className="bg-amber-100 text-amber-700 hover:text-amber-700 cursor-help break-words"
                                    >
                                      {course.finalEvaluation.maxAttempts} intentos
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <div className="text-[11px]">Cantidad de oportunidades para rendir el examen.</div>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                          {(requireEvaluations || requireResources) && (evaluatedLessons.length + summary.total) > 0 ? (
                            <div className="mt-4 grid w-full gap-2 grid-cols-1">
                              {requireEvaluations && evaluatedLessons.length > 0 ? (
                                <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
                                      <GraduationCap className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                                      <span className="break-words">Evaluaciones por clase</span>
                                    </div>
                                    <Badge
                                      variant="soft"
                                      color={progress.allPassed ? "success" : progress.passed > 0 ? "warning" : "default"}
                                      className="rounded-full text-[10px] shrink-0"
                                    >
                                      {progress.allPassed
                                        ? `${progress.passed}/${progress.totalEvaluations} · Todas aprobadas`
                                        : `${progress.passed}/${progress.totalEvaluations}${progress.pending > 0 ? ` · ${progress.pending} sin rendir` : ""}${progress.failed > 0 ? `${progress.pending > 0 || progress.passed > 0 ? " · " : ""}${progress.failed} desaprobadas` : ""}`}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        progress.allPassed
                                          ? "bg-emerald-500"
                                          : progress.passed > 0
                                            ? "bg-amber-500"
                                            : "bg-slate-300"
                                      )}
                                      style={{
                                        width: `${progress.totalEvaluations > 0 ? Math.round((progress.passed / progress.totalEvaluations) * 100) : 0}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : null}
                              {requireResources ? (
                                <div className="w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
                                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                                      <span className="break-words">Recursos de cursada</span>
                                    </div>
                                    <Badge
                                      variant="soft"
                                      color={readinessTone(summary)}
                                      className="rounded-full text-[10px] shrink-0"
                                    >
                                      {readinessProgressText(summary)}
                                    </Badge>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
                            {openEvaluationId !== "final_evaluation" ? (
                              <Button
                                type="button"
                                disabled={
                                  !unlocked ||
                                  finalEvalEntry?.status === "passed" ||
                                  (course.finalEvaluation.maxAttempts &&
                                    finalEvalEntry &&
                                    Number.isFinite(Number(finalEvalEntry.reviewedAt)) &&
                                    false)
                                }
                                className="w-full rounded-2xl bg-[#1B2B50] hover:bg-[#233A6A] sm:w-auto"
                                onClick={() => setOpenEvaluationId("final_evaluation")}
                              >
                                <ClipboardCheck className="mr-2 h-4 w-4 shrink-0" />
                                <span className="truncate">
                                  {finalEvalEntry?.status === "passed"
                                    ? "Examen final aprobado"
                                    : unlocked
                                      ? "Rendir evaluación final"
                                      : "Próximamente"}
                                </span>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full rounded-2xl sm:w-auto"
                                onClick={() => setOpenEvaluationId(null)}
                              >
                                Ocultar examen final
                              </Button>
                            )}
                            {courseEligibleForCertificate && certificateData ? (
                              <>
                                <Button
                                  type="button"
                                  className="w-full rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#5B5BD6] text-white shadow-[0_10px_30px_rgba(109,76,255,0.28)] hover:brightness-105 sm:w-auto"
                                  onClick={() => setShowCertificate(true)}
                                >
                                  <Award className="mr-2 h-4 w-4 shrink-0" />
                                  <span className="truncate">Ver mi certificado</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full rounded-2xl sm:w-auto"
                                  onClick={() => setShowCertificate(true)}
                                >
                                  <Download className="mr-2 h-4 w-4 shrink-0" />
                                  <span className="truncate">Descargar / imprimir</span>
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {openEvaluationId === "final_evaluation" &&
                          unlocked &&
                          Array.isArray(course.finalEvaluation.questions) &&
                          course.finalEvaluation.questions.length ? (
                          <div className="mt-4 w-full min-w-0">
                            <EvaluationRenderer
                              key="final-evaluation"
                              compact={true}
                              questions={course.finalEvaluation.questions}
                              title={course.finalEvaluation.title}
                              description={course.finalEvaluation.description}
                              passingScore={course.finalEvaluation.passingScore}
                              maxAttempts={course.finalEvaluation.maxAttempts}
                              attemptsUsed={finalEvaluationUsedAttempts()}
                              defaultPoints={(course.finalEvaluation as any).defaultPoints}
                              previousResult={
                                finalEvalEntry?.reviewedAt ||
                                  (finalEvalEntry && typeof (finalEvalEntry as any).score !== "undefined")
                                  ? {
                                    questions: [],
                                    totalScore: Number((finalEvalEntry as any).score ?? 0),
                                    totalMaxScore: Number((finalEvalEntry as any).maxScore ?? 0),
                                    percentage: Number.isFinite(Number((finalEvalEntry as any).percentage))
                                      ? Number((finalEvalEntry as any).percentage)
                                      : Number((finalEvalEntry as any).maxScore) > 0
                                        ? Math.round(
                                          (Number((finalEvalEntry as any).score ?? 0) /
                                            Number((finalEvalEntry as any).maxScore)) *
                                          100
                                        )
                                        : 0,
                                    passingPercentage: Number(
                                      course.finalEvaluation.passingScore ?? 60
                                    ),
                                    correctCount: Number.isFinite(Number((finalEvalEntry as any).correctCount))
                                      ? Number((finalEvalEntry as any).correctCount)
                                      : Number.isFinite(Number((finalEvalEntry as any).percentage)) &&
                                        Array.isArray(course.finalEvaluation.questions)
                                        ? Math.round(
                                          ((course.finalEvaluation.questions || []).length *
                                            Number((finalEvalEntry as any).percentage)) /
                                          100
                                        )
                                        : undefined,
                                    totalCount: Number.isFinite(Number((finalEvalEntry as any).totalCount))
                                      ? Number((finalEvalEntry as any).totalCount)
                                      : Array.isArray(course.finalEvaluation.questions)
                                        ? (course.finalEvaluation.questions || []).length
                                        : undefined,
                                    passed: String((finalEvalEntry as any).status || "")
                                      .trim()
                                      .toLowerCase()
                                      .includes("pass"),
                                  }
                                  : undefined
                              }
                              onSubmit={submitFinalEvaluation}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })()
                ) : (
                  <EmptyBlock
                    title="Sin evaluación final"
                    text="Este curso no requiere examen final para completar la cursada."
                  />
                )}
              </div>
            </section>

            {(() => {
              const forumQuestions = Array.isArray((course as any)?.forumQuestions)
                ? (course as any).forumQuestions
                : [];
              if (!forumQuestions.length) return null;
              const myUid = String(user?.uid || user?.email || "");
              const myEmail = String(user?.email || "").toLowerCase();
              return (
                <section
                  id="foro"
                  className="rounded-[24px] md:rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#2356B8]">
                        <HelpCircle className="h-3 w-3" />
                        Foro
                      </div>
                      <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                        Preguntas de la cursada
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Respondé estas preguntas para compartir tu experiencia y aprendizajes.
                      </p>
                    </div>
                    <Badge variant="soft" color="info" className="rounded-full shrink-0">
                      {forumQuestions.length} pregunta{forumQuestions.length === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="mt-6 space-y-4">
                    {forumQuestions
                      .sort((a: any, b: any) => {
                        const oa = Number.isFinite(Number(a?.order)) ? Number(a.order) : 0;
                        const ob = Number.isFinite(Number(b?.order)) ? Number(b.order) : 0;
                        return oa - ob;
                      })
                      .map((question: any, idx: number) => {
                        const qId = String(question?.id || `q-${idx}`);
                        const myAnswers = (Array.isArray(question?.answers) ? question.answers : []).filter(
                          (a: any) =>
                            String(a?.userId || "") === myUid ||
                            String(a?.userEmail || "").toLowerCase() === myEmail
                        );
                        const draft = String(forumDrafts[qId] || "");
                        const saving = savingForumAnswer === qId;
                        return (
                          <article
                            key={qId}
                            className="rounded-[22px] border border-slate-200 bg-[#FCFDFF] p-4 md:p-5"
                          >
                            <header>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                  Pregunta {idx + 1}
                                </span>
                                {Array.isArray(question?.answers) && question.answers.length > 0 ? (
                                  <Badge variant="soft" color="success" className="rounded-full">
                                    {question.answers.length} respuesta
                                    {question.answers.length === 1 ? "" : "s"}
                                  </Badge>
                                ) : (
                                  <Badge variant="soft" color="secondary" className="rounded-full">
                                    Sin respuestas
                                  </Badge>
                                )}
                              </div>
                              <h3 className="mt-2 text-[15px] font-semibold text-slate-950">
                                {question?.title || "Pregunta sin título"}
                              </h3>
                              {question?.description ? (
                                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                                  {question.description}
                                </p>
                              ) : null}
                            </header>

                            {myAnswers.length > 0 ? (
                              <div className="mt-4 space-y-2">
                                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                                  Mis respuestas
                                </div>
                                {myAnswers.map((a: any) => (
                                  <div
                                    key={a.id}
                                    className="rounded-[18px] border border-emerald-200 bg-emerald-50/60 p-4"
                                  >
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                      <span className="font-semibold text-emerald-700">
                                        {a.userFullName || a.userEmail || "Yo"}
                                      </span>
                                      <span>·</span>
                                      <span>{formatDateTime(a.createdAt)}</span>
                                    </div>
                                    <p className="mt-1.5 text-sm leading-7 text-slate-800 whitespace-pre-wrap">
                                      {a.answer}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-5 space-y-3">
                              <Textarea
                                value={draft}
                                rows={4}
                                placeholder="Escribí tu respuesta aquí..."
                                onChange={(e) =>
                                  setForumDrafts((current) => ({
                                    ...current,
                                    [qId]: e.target.value,
                                  }))
                                }
                                className="rounded-[18px] border-slate-300 bg-white"
                              />
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={saving || !draft.trim()}
                                  onClick={() => submitForumAnswer(qId)}
                                  className="rounded-2xl bg-[#1B2B50] hover:bg-[#233A6A]"
                                >
                                  {saving ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Publicando...
                                    </>
                                  ) : (
                                    <>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Publicar respuesta
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                </section>
              );
            })()}
          </aside>
        </div >
      </div >
      {
        certificateData ? (
          <CourseCertificate
            open={showCertificate}
            onClose={() => setShowCertificate(false)}
            data={certificateData}
          />
        ) : null}
    </div >
  );
}
