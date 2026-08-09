"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileArchive,
  FileQuestion,
  FileText,
  Filter,
  FolderKanban,
  GraduationCap,
  HelpCircle,
  Info,
  Languages,
  Layers,
  Link2,
  Loader2,
  PlayCircle,
  Radio,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress, CircularProgress } from "@/components/ui/progress";
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
import VideoPlayer from "@/components/courses/video-player";
import DocumentPreviewCard from "@/components/courses/document-preview";
import {
  isFinalEvaluationUnlocked,
  isLessonEvaluationUnlocked,
  readinessProgressText,
  readinessTone,
  summarizeLessonResources,
} from "@/lib/courses/resource-readiness";

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
  return date.toLocaleString("es-AR");
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
      <TooltipContent side="left">
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

export default function DashboardCursoAlumnoPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { loading: actorLoading } = useCourseActor();
  const [loading, setLoading] = useState(true);
  const [savingLesson, setSavingLesson] = useState("");
  const [savingActivity, setSavingActivity] = useState("");
  const [course, setCourse] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [lessonProgress, setLessonProgress] = useState([]);
  const [activitySubmissions, setActivitySubmissions] = useState([]);
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [locked, setLocked] = useState(false);
  const [openSections, setOpenSections] = useState([]);
  const [contentTypeFilter, setContentTypeFilter] = useState("all");
  const [contentStatusFilter, setContentStatusFilter] = useState("all");
  const [contentSort, setContentSort] = useState("default");

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      setLocked(false);
      try {
        const data = await authedFetch(user, `/api/student-courses/${id}`, { method: "GET" });
        if (!alive) return;
        const nextEnrollment = data?.enrollment || null;
        const nextCourse = data?.course || null;
        setCourse(nextCourse);
        setEnrollment(nextEnrollment);
        setLessonProgress(Array.isArray(nextEnrollment?.lessonProgress) ? nextEnrollment.lessonProgress : []);
        const nextSubmissions = Array.isArray(nextEnrollment?.activitySubmissions) ? nextEnrollment.activitySubmissions : [];
        setActivitySubmissions(nextSubmissions);
        setSubmissionDrafts(
          Object.fromEntries(
            nextSubmissions.map((item) => [
              String(item?.lessonId || ""),
              { note: String(item?.note || ""), linkUrl: String(item?.linkUrl || "") },
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
        } else {
          toast.error(error?.message || "No pudimos cargar la cursada.", { position: "top-right" });
        }
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
  const completion = progressValue(enrollment, lessonProgress, totalLessons);
  const activityLessons = useMemo(() => getActivityLessons(curriculum), [curriculum]);
  const gradebook = useMemo(
    () => (Array.isArray(enrollment?.gradebook) ? enrollment.gradebook : []),
    [enrollment?.gradebook]
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
    const nextLessonProgress = alreadyCompleted
      ? lessonProgress.filter((item) => String(item?.lessonId || "") !== lessonId)
      : [...lessonProgress, { lessonId, completedAt: new Date().toISOString() }];
    const nextProgress = totalLessons ? Math.round((nextLessonProgress.length / totalLessons) * 100) : 0;

    try {
      setSavingLesson(lessonId);
      await persistEnrollment(
        {
          lessonProgress: nextLessonProgress,
          progress: nextProgress,
        },
        alreadyCompleted ? "Clase marcada como pendiente." : "Clase completada."
      );
    } catch (error) {
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
        linkUrl: "",
        ...(current[lessonId] || {}),
        ...patch,
      },
    }));
  };

  const submitActivity = async (lesson) => {
    const lessonId = String(lesson?.id || "").trim();
    if (!lessonId) return;
    const draft = submissionDrafts[lessonId] || { note: "", linkUrl: "" };
    const nextSubmission = {
      lessonId,
      title: lesson?.title || "Actividad",
      note: String(draft.note || "").trim() || undefined,
      linkUrl: String(draft.linkUrl || "").trim() || undefined,
      status: "submitted",
      submittedAt: new Date().toISOString(),
    };
    const nextSubmissions = [
      ...activitySubmissions.filter((item) => String(item?.lessonId || "") !== lessonId),
      nextSubmission,
    ];

    try {
      setSavingActivity(lessonId);
      await persistEnrollment(
        {
          activitySubmissions: nextSubmissions,
        },
        "Entrega guardada correctamente."
      );
    } catch (error) {
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
      <div className="mx-auto max-w-7xl px-3 py-8 md:px-4">
        <div className="rounded-[30px] border border-slate-200 bg-white p-8 shadow-[0_20px_55px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando cursada...
          </div>
        </div>
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

          <div className="mt-6 flex flex-wrap gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button asChild className="rounded-2xl bg-[#6D4CFF] hover:bg-[#5E3EF0]">
                    <Link href={buildLocalizedPath(`/dashboard/inscripciones/${id}`)}>Ver seguimiento de la inscripción</Link>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="max-w-xs text-[11px] leading-5">
                  Abre la ficha completa con el historial de pagos, mensajes y novedades de tu inscripción.
                </div>
              </TooltipContent>
            </Tooltip>
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
          </div>
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
      <div className="mx-auto max-w-[1380px] px-3 py-6 md:px-4 md:py-8">
        <div className="mb-5">
          <Link
            href={buildLocalizedPath("/dashboard/mis-cursos")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Mis Cursos
          </Link>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-6">
            <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_22px_70px_rgba(15,23,42,0.06)] md:p-5 lg:p-6">
              <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div
                  className={cn(
                    "group relative min-h-[320px] overflow-hidden rounded-[28px] border border-[#D9D5FF] bg-[radial-gradient(circle_at_top,#9B8BFF_0%,#5F43FF_42%,#24104D_100%)] shadow-[0_30px_80px_rgba(76,29,149,0.28)] transition duration-500 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_34px_90px_rgba(76,29,149,0.34)] focus-within:ring-2 focus-within:ring-[#8B5CF6] focus-within:ring-offset-2",
                    featuredVideo ? "border-[#C9BFFF]" : "border-slate-200"
                  )}
                >
                  {featuredVideo ? (
                    <>
                      {inlineFeaturedVideo ? (
                        <VideoPlayer
                          src={featuredVideoKind === "file" ? featuredVideo.url : featuredVideoEmbed || featuredVideo.url}
                          kind={featuredVideoKind === "file" ? "file" : "embed"}
                          title={featuredVideo.title}
                          poster={featuredVideo.posterUrl || undefined}
                          qualities={featuredVideo.qualities || undefined}
                          subtitles={featuredVideo.subtitles || undefined}
                          className="absolute inset-0 h-full w-full !rounded-none border-0 shadow-none"
                          fallbackLabel="Contenido no disponible temporalmente"
                        />
                      ) : featuredVideo.posterUrl ? (
                        <div
                          className="absolute inset-0 transition duration-500 group-hover:scale-[1.04] group-hover:opacity-90"
                          style={{
                            backgroundImage: `url(${featuredVideo.posterUrl})`,
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            backgroundSize: "cover",
                          }}
                          aria-label={featuredVideo.title}
                          role="img"
                        />
                      ) : null}

                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.05)_0%,rgba(15,23,42,0.24)_40%,rgba(15,23,42,0.82)_100%)]" />
                      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.42),transparent_66%)] opacity-80" />

                      <div className="absolute inset-x-4 top-4 flex flex-wrap gap-2">
                        <TonePill
                          icon={Video}
                          label={featuredVideo.durationLabel || "Video"}
                          className="border-white/30 bg-white/16 text-white backdrop-blur-sm"
                        />
                        <TonePill
                          icon={CalendarDays}
                          label={formatDate(featuredVideo.publishedAt) || "Disponible ahora"}
                          className="border-white/30 bg-white/16 text-white backdrop-blur-sm"
                        />
                      </div>

                      <div className="absolute inset-x-4 bottom-4 space-y-4">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                            {featuredVideo.topic}
                          </div>
                          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">
                            {featuredVideo.title}
                          </h2>
                          {featuredVideo.summary ? (
                            <p className="mt-2 line-clamp-2 max-w-[26rem] text-sm leading-6 text-white/78">
                              {featuredVideo.summary}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <Button
                            asChild
                            className="rounded-2xl bg-white text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.18)] hover:bg-white/95"
                          >
                            <a
                              href={featuredVideo.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Reproducir ${featuredVideo.title}`}
                            >
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Reproducir
                            </a>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            className="rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/16 hover:text-white"
                          >
                            <a
                              href={featuredVideo.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Abrir ${featuredVideo.title} en una pestaña nueva`}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Abrir recurso
                            </a>
                          </Button>
                        </div>

                        <div className="rounded-[18px] border border-white/15 bg-white/10 p-3 backdrop-blur-md">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold text-white">Progreso de visualización estimado</div>
                              <div className="mt-1 text-[11px] text-white/72">
                                {featuredVideo.progress > 0 ? "Contenido retomable" : "Aún no comenzado"}
                              </div>
                            </div>
                            <div className="text-lg font-semibold tracking-[-0.03em] text-white">
                              {featuredVideo.progress}%
                            </div>
                          </div>
                          <Progress
                            value={featuredVideo.progress}
                            size="sm"
                            className="mt-3 bg-white/15 [&>div]:bg-[linear-gradient(90deg,#7C3AED_0%,#A78BFA_100%)]"
                            aria-label="Progreso de visualización"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full min-h-[320px] flex-col justify-between p-6 text-white">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                        Vista principal
                      </div>
                      <div>
                        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                          <BookOpen className="h-8 w-8" />
                        </div>
                        <h2 className="text-[24px] font-semibold tracking-[-0.03em]">
                          {course.title}
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-white/78">
                          Esta cursada no tiene un video principal cargado, pero el temario y los recursos ya están organizados para continuar.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between rounded-[28px] border border-slate-100 bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFAFF_100%)] p-5 md:p-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <TonePill
                        icon={CheckCircle2}
                        label="Activo"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      />
                      {course?.lifetimeAccess ? (
                        <TonePill
                          icon={Sparkles}
                          label="Acceso de por vida"
                          className="border-violet-200 bg-violet-50 text-violet-700"
                        />
                      ) : null}
                      {course?.includesCertificate ? (
                        <TonePill
                          icon={ShieldCheck}
                          label="Certificado"
                          className="border-sky-200 bg-sky-50 text-sky-700"
                        />
                      ) : null}
                    </div>

                    <h1 className="mt-4 text-[32px] font-semibold tracking-[-0.04em] text-slate-950 md:text-[36px]">
                      {course.title}
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                      {course.institutionName || course.companyName || "ACAV Cursos"}
                    </p>

                    <div className="mt-7">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Tu progreso general</div>
                          <p className="mt-1 text-xs text-slate-500">
                            {lessonProgress.length} de {totalLessons} clases completadas
                          </p>
                        </div>
                        <div className="text-[24px] font-semibold tracking-[-0.03em] text-[#6D4CFF]">
                          {completion}%
                        </div>
                      </div>
                      <Progress
                        value={completion}
                        size="sm"
                        className="mt-4 bg-[#ECE9F8] [&>div]:bg-[linear-gradient(90deg,#6D4CFF_0%,#8B5CF6_100%)]"
                        aria-label="Progreso general del curso"
                      />
                    </div>

                    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[linear-gradient(145deg,#7C3AED_0%,#5B5BD6_100%)] text-white shadow-[0_12px_28px_rgba(109,76,255,0.28)]">
                            <PlayCircle className="h-8 w-8" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Continúa donde dejaste
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                              {(curriculum.findIndex((section) =>
                                (Array.isArray(section?.lessons) ? section.lessons : []).some(
                                  (lesson) => String(lesson?.id || "") === String(currentLesson?.id || "")
                                )
                              ) || 0) + 1 > 0
                                ? `Clase ${currentLesson ? titleCase(currentLesson?.lessonType, "Clase") : "Clase"} · ${
                                    curriculum.find((section) =>
                                      (Array.isArray(section?.lessons) ? section.lessons : []).some(
                                        (lesson) => String(lesson?.id || "") === String(currentLesson?.id || "")
                                      )
                                    )?.title || "Módulo actual"
                                  }`
                                : "Ruta del curso"}
                            </div>
                            <div className="line-clamp-2 text-base font-semibold text-slate-950">
                              {currentLesson?.title || "No hay clase destacada disponible"}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium text-slate-500">
                            {currentLesson?.durationMinutes ? `${currentLesson.durationMinutes} min` : "Duración flexible"}
                          </span>
                          <Button asChild className="rounded-2xl bg-[#6D4CFF] px-5 hover:bg-[#5E3EF0]">
                            <a href="#ruta-del-curso">
                              Continuar clase
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

            <section id="ruta-del-curso" className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">Ruta del curso</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Recorrido completo del contenido con estados visuales y acceso rápido a cada recurso.
                  </p>
                </div>
                <a
                  href="#contenidos-academicos"
                  className="text-sm font-semibold text-[#6D4CFF] transition hover:text-[#5E3EF0]"
                >
                  Ver todo el temario
                </a>
              </div>

              <div className="mt-6 space-y-3">
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
                          <div className="border-t border-slate-100 bg-[#FCFCFF] px-3 py-3 md:px-4">
                            <div className="space-y-2">
                              {lessons.map((lesson, lessonIndex) => {
                                const completed = isLessonCompleted(lesson?.id);
                                const isCurrent = String(currentLesson?.id || "") === String(lesson?.id || "");
                                const typeMeta = getLessonTypeMeta(lesson?.lessonType);
                                const stateMeta = getStatusMeta(
                                  completed ? "completed" : isCurrent ? "in_progress" : "pending"
                                );
                                const Icon = typeMeta.icon;

                                return (
                                  <div
                                    key={lesson.id || `${safeSectionId}-${lessonIndex}`}
                                    className={cn(
                                      "grid gap-3 rounded-[20px] border px-3 py-3 transition md:grid-cols-[minmax(0,1fr)_auto_auto]",
                                      isCurrent
                                        ? "border-violet-200 bg-violet-50/80 shadow-[0_10px_30px_rgba(109,76,255,0.10)]"
                                        : "border-slate-200 bg-white"
                                    )}
                                  >
                                    <div className="flex min-w-0 items-start gap-3">
                                      <span className={cn("mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", typeMeta.iconClass)}>
                                        <Icon className="h-4 w-4" />
                                      </span>
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-medium text-slate-500">
                                            {sectionIndex + 1}.{lessonIndex + 1}
                                          </span>
                                          <span className="line-clamp-1 text-sm font-semibold text-slate-950">
                                            {lesson?.title || `Clase ${lessonIndex + 1}`}
                                          </span>
                                        </div>
                                        {lesson?.description ? (
                                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{lesson.description}</p>
                                        ) : null}
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span>
                                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-help", typeMeta.badgeClass)}>
                                                  {typeMeta.label}
                                                </span>
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                              <div className="max-w-xs leading-5 text-[11px]">
                                                <div className="font-semibold">{typeMeta.label}</div>
                                                <div className="mt-1 text-slate-100/90">{typeMeta.description || "Tipo de recurso dentro del itinerario formativo."}</div>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span>
                                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-help", stateMeta.badgeClass)}>
                                                  {stateMeta.label}
                                                </span>
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                              <div className="max-w-xs leading-5 text-[11px]">
                                                <div className="font-semibold">{stateMeta.label}</div>
                                                <div className="mt-1 text-slate-100/90">{stateMeta.description || "Tu estado actual dentro del recurso."}</div>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-sm text-slate-500 md:justify-end">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help">
                                            {lesson?.durationMinutes ? `${lesson.durationMinutes} min` : "Flexible"}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                          <div className="text-[11px]">
                                            {lesson?.durationMinutes
                                              ? `Duración estimada para completar esta clase.`
                                              : "Duración sugerida — definida por la institución."}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                      {completed ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <CheckCircle2 className="h-4 w-4 text-emerald-500 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent side="left">
                                            <div className="text-[11px]">Marcada como completada en tu progreso.</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Circle className="h-4 w-4 text-slate-300 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent side="left">
                                            <div className="text-[11px]">Clase aún no completada.</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-start gap-2 md:justify-end">
                                      {lesson?.videoUrl ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span>
                                              <Button asChild variant="outline" className="rounded-2xl border-slate-200">
                                                <a
                                                  href={lesson.videoUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  aria-label={`Abrir ${lesson.title || "clase"}`}
                                                >
                                                  <PlayCircle className="mr-2 h-4 w-4" />
                                                  Abrir
                                                </a>
                                              </Button>
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            <div className="text-[11px]">Abre el video o enlace de la clase en una pestaña nueva.</div>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : null}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span>
                                            <Button
                                              type="button"
                                              variant={completed ? "outline" : "default"}
                                              className={cn(
                                                "rounded-2xl",
                                                completed
                                                  ? "border-slate-200"
                                                  : "bg-[#6D4CFF] hover:bg-[#5E3EF0]"
                                              )}
                                              onClick={() => toggleLesson(lesson)}
                                              disabled={savingLesson === lesson.id}
                                              aria-label={completed ? "Marcar clase como pendiente" : "Marcar clase como completada"}
                                            >
                                              {savingLesson === lesson.id ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              ) : completed ? (
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                              ) : (
                                                <Circle className="mr-2 h-4 w-4" />
                                              )}
                                              {completed ? "Pendiente" : "Completar"}
                                            </Button>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                          <div className="max-w-[220px] leading-5 text-[11px]">
                                            {completed
                                              ? "Desmarca la clase y la devuelve al estado pendiente en tu progreso."
                                              : "Marca la clase como completada y actualiza tu avance del curso."}
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>

                                    {(() => {
                                      const resources = Array.isArray(lesson?.resources) ? lesson.resources : [];
                                      const summary = summarizeLessonResources(lesson);
                                      const hasEval = lesson?.evaluation?.enabled;
                                      const evalUnlocked = isLessonEvaluationUnlocked(lesson);
                                      if (!resources.length && !hasEval) return null;
                                      return (
                                        <div className="w-full md:col-span-3 space-y-3 border-t border-dashed border-slate-200 pt-3">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge
                                                  variant="soft"
                                                  color={readinessTone(summary)}
                                                  className="rounded-full cursor-help"
                                                >
                                                  <FolderKanban className="mr-1 h-3 w-3" />
                                                  {readinessProgressText(summary)}
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent side="bottom">
                                                <div className="max-w-[240px] leading-5 text-[11px]">
                                                  Estado de integridad de recursos para esta clase (videos, documentos, imágenes).
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                            {hasEval ? (
                                              evalUnlocked ? (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Badge
                                                      variant="soft"
                                                      color="success"
                                                      className="rounded-full cursor-help"
                                                    >
                                                      <ClipboardCheck className="mr-1 h-3 w-3" /> Evaluación habilitada
                                                    </Badge>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="bottom">
                                                    <div className="max-w-[240px] leading-5 text-[11px]">
                                                      {lesson.evaluation.requireAllResourcesReady === false
                                                        ? "Evaluación disponible de inmediato."
                                                        : "Todos los recursos listos — podés rendir la evaluación de la clase."}
                                                    </div>
                                                  </TooltipContent>
                                                </Tooltip>
                                              ) : (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Badge
                                                      variant="soft"
                                                      color="warning"
                                                      className="rounded-full cursor-help"
                                                    >
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
                                              )
                                            ) : null}
                                          </div>

                                          {resources.length ? (
                                            <div className="grid gap-3 md:grid-cols-2">
                                              {resources.map((r, idx) => (
                                                <DocumentPreviewCard
                                                  key={r.id || `${lesson.id}_${idx}`}
                                                  resource={r}
                                                  compact
                                                />
                                              ))}
                                            </div>
                                          ) : null}

                                          {hasEval ? (
                                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                              <div>
                                                <div className="text-sm font-semibold text-slate-950">
                                                  {lesson.evaluation.title || `Evaluación · ${lesson.title}`}
                                                </div>
                                                {lesson.evaluation.description ? (
                                                  <p className="mt-1 text-xs text-slate-500">
                                                    {lesson.evaluation.description}
                                                  </p>
                                                ) : null}
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                  <Badge variant="soft" color="secondary" className="rounded-full">
                                                    {(lesson.evaluation.questions || []).length} preguntas
                                                  </Badge>
                                                  {lesson.evaluation.passingScore ? (
                                                    <Badge variant="soft" color="success" className="rounded-full">
                                                      Mínimo {lesson.evaluation.passingScore}%
                                                    </Badge>
                                                  ) : null}
                                                  {lesson.evaluation.maxAttempts ? (
                                                    <Badge variant="soft" color="warning" className="rounded-full">
                                                      {lesson.evaluation.maxAttempts} intentos
                                                    </Badge>
                                                  ) : null}
                                                </div>
                                              </div>
                                              <Button
                                                asChild
                                                disabled={!evalUnlocked}
                                                className="rounded-2xl bg-[#1B2B50] hover:bg-[#233A6A]"
                                              >
                                                <a
                                                  href={evalUnlocked ? `#clase-${lesson.id || "eval"}` : undefined}
                                                  onClick={(e) => !evalUnlocked && e.preventDefault()}
                                                  aria-disabled={!evalUnlocked}
                                                >
                                                  <FileQuestion className="mr-2 h-4 w-4" />
                                                  {evalUnlocked ? "Rendir evaluación" : "Esperando recursos"}
                                                </a>
                                              </Button>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                            </div>
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

            <section id="contenidos-academicos" className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    Contenidos académicos
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Filtra por tipo, estado o criterio de orden para encontrar rápido clases, evaluaciones, tareas y materiales.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
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
                            {item.ctaHref ? (
                              <Button asChild variant="outline" className="rounded-2xl border-slate-200">
                                <a href={item.ctaHref} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  {item.ctaLabel || "Abrir"}
                                </a>
                              </Button>
                            ) : null}
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
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-[#6D4CFF]" />
                <div>
                  <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-slate-950">
                    Entregas y seguimiento
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Deja notas, links y revisa feedback desde una vista compacta y clara.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                {activityLessons.length ? (
                  activityLessons.map((lesson) => {
                    const currentSubmission =
                      activitySubmissions.find((item) => String(item?.lessonId || "") === String(lesson?.id || "")) || null;
                    const draft = submissionDrafts[String(lesson?.id || "")] || {
                      note: String(currentSubmission?.note || ""),
                      linkUrl: String(currentSubmission?.linkUrl || ""),
                    };
                    const typeMeta = getLessonTypeMeta(lesson?.lessonType);
                    const statusMeta = getStatusMeta(currentSubmission?.status || "pending");
                    const Icon = typeMeta.icon;

                    return (
                      <div key={lesson.id} className="rounded-[24px] border border-slate-200 bg-[#FCFCFF] p-4 md:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex gap-4">
                            <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", typeMeta.iconClass)}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", typeMeta.badgeClass)}>
                                  {typeMeta.label}
                                </span>
                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold", statusMeta.badgeClass)}>
                                  {statusMeta.label}
                                </span>
                                {currentSubmission?.submittedAt ? (
                                  <span className="text-xs text-slate-400">
                                    Enviado {formatDateTime(currentSubmission.submittedAt)}
                                  </span>
                                ) : null}
                              </div>
                              <h3 className="mt-3 text-base font-semibold text-slate-950">{lesson.title}</h3>
                              {lesson.description ? (
                                <p className="mt-2 text-sm leading-6 text-slate-500">{lesson.description}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3">
                          <Textarea
                            rows={4}
                            value={draft.note}
                            onChange={(event) => handleSubmissionDraft(String(lesson.id || ""), { note: event.target.value })}
                            placeholder="Describe tu entrega, conclusiones o estado de avance."
                            className="rounded-[20px] border-slate-200 bg-white"
                            aria-label={`Nota para ${lesson.title}`}
                          />
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                            <Input
                              value={draft.linkUrl}
                              onChange={(event) => handleSubmissionDraft(String(lesson.id || ""), { linkUrl: event.target.value })}
                              placeholder="https://link-a-tu-entrega.com"
                              className="rounded-[20px] border-slate-200 bg-white"
                              aria-label={`Link de entrega para ${lesson.title}`}
                            />
                            <Button
                              type="button"
                              className="rounded-2xl bg-[#6D4CFF] hover:bg-[#5E3EF0]"
                              onClick={() => submitActivity(lesson)}
                              disabled={savingActivity === lesson.id}
                            >
                              {savingActivity === lesson.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Link2 className="mr-2 h-4 w-4" />
                              )}
                              Guardar entrega
                            </Button>
                          </div>
                          {currentSubmission?.feedback ? (
                            <div className="rounded-[20px] border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-800">
                              <span className="font-semibold">Feedback docente:</span> {currentSubmission.feedback}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyBlock
                    title="Sin actividades obligatorias"
                    text="Este curso no tiene tareas o quizzes configurados para entrega."
                  />
                )}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)] md:p-6">
              <div className="flex items-center justify-between gap-4">
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
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                    {attachments.slice(0, 8).map((resource, idx) => (
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
          </div>

          <aside className="space-y-6">
            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
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

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
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
                        <div className="text-[34px] font-semibold tracking-[-0.04em] text-slate-950">{completion}%</div>
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
                <InfoRow
                  icon={GraduationCap}
                  label="Examen final"
                  value={course?.finalEvaluation?.enabled ? "Pendiente" : "No aplica"}
                  hint={course?.finalEvaluation?.enabled ? "Evaluación obligatoria para certificar la cursada." : "Este curso no requiere examen final de certificación."}
                />
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

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
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

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
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

            <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-[#6D4CFF]" />
                  <div className="text-lg font-semibold text-slate-950">Evaluación final</div>
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
              <div className="mt-4">
                {course?.finalEvaluation?.enabled ? (
                  (() => {
                    const perClassStates = {};
                    const unlocked = isFinalEvaluationUnlocked(course, perClassStates);
                    const curriculum = Array.isArray(course.curriculum) ? course.curriculum : [];
                    const evaluatedLessons = curriculum.flatMap((s) =>
                      Array.isArray(s?.lessons) ? s.lessons.filter((l) => l?.evaluation?.enabled) : []
                    );
                    const lessonsWithMissingResources = curriculum.flatMap((s) =>
                      Array.isArray(s?.lessons)
                        ? s.lessons.filter((l) => !summarizeLessonResources(l).allReady)
                        : []
                    );
                    let reason = "";
                    if (course.finalEvaluation.requireAllResourcesReady !== false && lessonsWithMissingResources.length) {
                      reason = `Faltan subir ${lessonsWithMissingResources.length} recurso(s) en clases.`;
                    } else if (
                      course.finalEvaluation.requireAllLessonsEvaluationsCompleted !== false &&
                      evaluatedLessons.length &&
                      !evaluatedLessons.every((l) => perClassStates[l.id]?.passed)
                    ) {
                      reason = "Debés aprobar todas las evaluaciones por clase primero.";
                    }
                    return (
                      <div
                        className={cn(
                          "rounded-[22px] border p-4",
                          unlocked ? "border-slate-200 bg-[#FCFCFF]" : "border-amber-200 bg-amber-50/60"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-slate-950">
                            {course.finalEvaluation.title || "Evaluación de cierre"}
                          </div>
                          {unlocked ? (
                            <Badge variant="soft" color="success" className="rounded-full">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Habilitada
                            </Badge>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="soft" color="warning" className="rounded-full cursor-help">
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
                          <p className="mt-2 text-sm leading-6 text-slate-500">
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
                                  className="bg-violet-100 text-violet-700 hover:text-violet-700 cursor-help"
                                >
                                  {Array.isArray(course.finalEvaluation.questions)
                                    ? course.finalEvaluation.questions.length
                                    : 0}{" "}
                                  preguntas
                                </Badge>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <div className="text-[11px]">
                                Cantidad de preguntas que incluye el examen final.
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          {course.finalEvaluation.passingScore ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Badge
                                    variant="soft"
                                    color="success"
                                    className="bg-emerald-100 text-emerald-700 hover:text-emerald-700 cursor-help"
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
                                    className="bg-amber-100 text-amber-700 hover:text-amber-700 cursor-help"
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
                        <div className="mt-4">
                          <Button
                            asChild
                            disabled={!unlocked}
                            className="w-full rounded-2xl bg-[#1B2B50] hover:bg-[#233A6A]"
                          >
                            <a
                              href={unlocked ? "#" : undefined}
                              onClick={(e) => !unlocked && e.preventDefault()}
                              aria-disabled={!unlocked}
                            >
                              <ClipboardCheck className="mr-2 h-4 w-4" />
                              {unlocked ? "Rendir evaluación final" : "Rendimiento disponible próximamente"}
                            </a>
                          </Button>
                        </div>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
