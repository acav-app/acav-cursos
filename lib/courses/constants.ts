import { CANONICAL_PORTAL_ROLES } from "@/lib/courses/roles";

export const PORTAL_ROLES = CANONICAL_PORTAL_ROLES;

export const USER_ACCOUNT_STATUSES = [
  "pending_email_verification",
  "active",
  "suspended",
] as const;

export const INSTITUTION_STATUSES = ["activa", "pendiente", "inactiva"] as const;

export const COURSE_STATUSES = [
  "borrador",
  "pendiente_revision",
  "activa",
  "pausada",
  "cerrada",
  "vencida",
  "rechazada",
] as const;

export const EDUCATIONAL_ENROLLMENT_STATUSES = [
  "started",
  "waiting_payment",
  "payment_under_review",
  "active",
  "rejected",
  "cancelled",
] as const;

export const EMPLOYMENT_APPLICATION_STATUSES = [
  "recibida",
  "vista",
  "preseleccionada",
  "descartada",
  "contactada",
] as const;

export const ENROLLMENT_STATUSES = [
  ...EDUCATIONAL_ENROLLMENT_STATUSES,
  ...EMPLOYMENT_APPLICATION_STATUSES,
] as const;

export const PAYMENT_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "rejected",
] as const;

export const COURSE_COMPLETION_STATUSES = [
  "in_progress",
  "approved",
  "reproved",
  "suspended",
] as const;

export const ALLOWED_SCORE_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "image/jpg",
] as const;

export const MAX_SCORE_ATTACHMENT_SIZE_BYTES = 12 * 1024 * 1024;

export const PAYMENT_METHODS = [
  "transferencia",
  "manual",
  "pasarela",
  "otro",
] as const;

export const COURSE_CATEGORIES = [
  "Operador Mayorista",
  "Agencia Minorista Emisivo",
  "Agencia Minorista Receptivo",
  "Agencia Minorista Emisiva/Receptiva",
  "Hoteleria Cadena",
  "Hoteleria Local",
  "Hoteleria Boutique",
  "Enoturismo",
  "Bodega",
  "Eventos",
  "Gastronomia / Eventos",
  "Astroturismo",
  "Turismo Cultural",
  "Turismo Aventura",
  "Transporte / Vial",
  "Aeropuerto",
  "Compania Aerea",
  "Municipio",
  "Otro",
] as const;

export const COURSE_AREAS = [
  "Ventas",
  "Comercial",
  "Operaciones",
  "Reservas",
  "Recepcion",
  "Coordinacion de viajes",
  "Guia de turismo",
  "Estrategia",
  "Marketing",
  "Administracion",
  "Finanzas",
  "Comercio exterior / internacionalizacion",
  "Atencion al Publico",
  "Creatividad",
  "Diseno",
  "Back Office",
  "Otro",
] as const;

export const COURSE_MODALITIES = ["Presencial", "Virtual", "Hibrido", "Remoto"] as const;

export const COURSE_SALES_MODALITIES = ["100% Online", "En vivo", "Híbrido", "Presencial"] as const;

export const COURSE_LEVELS = [
  "Principiante",
  "Intermedio",
  "Avanzado",
  "Todos los niveles",
] as const;

export const COURSE_LANGUAGES = ["Español", "Inglés", "Portugués", "Francés"] as const;

export const COURSE_PUBLICATION_VISIBILITY = ["borrador", "pendiente_revision", "activa", "pausada", "cerrada"] as const;

export const COURSE_PACE_OPTIONS = [
  "Intensivo",
  "Regular",
  "Cohorte",
  "A tu ritmo",
  "Otro",
] as const;

export const COURSE_SCHEDULE_OPTIONS = [
  "Mañana",
  "Tarde",
  "Noche",
  "Fin de semana",
  "En vivo",
  "Autogestionado",
  "Otro",
] as const;

export const COURSE_VIDEO_ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
  "video/x-m4v",
  "video/avi",
  "video/x-msvideo",
] as const;

export function isExternalVideoUrl(url: unknown) {
  const s = String(url || "").trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes("youtube.com") ||
    s.includes("youtu.be") ||
    s.includes("vimeo.com") ||
    s.startsWith("https://") ||
    s.startsWith("http://")
  );
}

export const COURSE_VIDEO_MAX_SIZE_BYTES = 4 * 1024 * 1024 * 1024;

export const COURSE_CLOSE_REASONS = [
  "Cupos completos",
  "Cohorte cerrada",
  "Reprogramación",
  "Otro",
] as const;

export const COURSE_EMAIL_TEMPLATE_TYPES = [
  "course-pending-review",
  "course-approved",
  "course-rejected",
  "new-enrollment-institution",
  "new-enrollment-admin",
  "enrollment-confirmation-student",
  "institution-welcome",
] as const;
