import { BadgeCheck, Ban, CircleDashed, CircleDot, Clock3, FileSearch, MessageCircle, PauseCircle, Users2, XOctagon } from "lucide-react";

export const COURSE_COMPLETION_STATUS_LABELS = {
  in_progress: { title: "En curso", description: "El alumno se encuentra cursando la materia.", tone: "info", Icon: CircleDot },
  approved: { title: "Aprobada", description: "Cursada aprobada. Certificado disponible.", tone: "success", Icon: BadgeCheck },
  reproved: { title: "Desaprobada", description: "Cursada no superada.", tone: "destructive", Icon: XOctagon },
  suspended: { title: "Suspendida", description: "Acceso temporalmente suspendido.", tone: "warning", Icon: PauseCircle },
};

export const EDUCATIONAL_STATUS_LABELS = {
  started: { title: "Iniciada", description: "El alumno comenzó el proceso de inscripción.", tone: "secondary", Icon: CircleDashed },
  waiting_payment: { title: "Esperando pago", description: "Pendiente de acreditación o envío de comprobante.", tone: "warning", Icon: Clock3 },
  payment_under_review: { title: "Comprobante en revisión", description: "El comprobante fue recibido y está siendo validado.", tone: "info", Icon: FileSearch },
  active: { title: "Curso activo", description: "El acceso al contenido del curso está habilitado.", tone: "success", Icon: BadgeCheck },
  rejected: { title: "Inscripción rechazada", description: "La solicitud fue rechazada. Consultar motivo con administración.", tone: "destructive", Icon: Ban },
  cancelled: { title: "Cancelada", description: "La inscripción fue cancelada por el alumno.", tone: "secondary", Icon: Ban },
};

export const PAYMENT_STATUS_LABELS = {
  pending: { title: "Pendiente", description: "Aún no hay datos de pago cargados.", tone: "warning", Icon: Clock3 },
  under_review: { title: "En revisión", description: "Comprobante cargado, a la espera de aprobación manual.", tone: "info", Icon: FileSearch },
  approved: { title: "Aprobado", description: "El pago fue acreditado correctamente.", tone: "success", Icon: BadgeCheck },
  rejected: { title: "Rechazado", description: "El comprobante fue invalidado. Se solicita uno nuevo.", tone: "destructive", Icon: Ban },
};

export const EMPLOYMENT_STATUS_LABELS = {
  recibida: { title: "Recibida", description: "La postulación llegó correctamente a la institución.", tone: "info", Icon: MessageCircle },
  vista: { title: "Vista por el empleador", description: "La institución revisó la postulación.", tone: "secondary", Icon: Users2 },
  preseleccionada: { title: "Preseleccionada", description: "Tu perfil está entre los candidatos destacados.", tone: "success", Icon: BadgeCheck },
  descartada: { title: "Descartada", description: "La postulación no continuó en el proceso.", tone: "destructive", Icon: Ban },
  contactada: { title: "Contactada", description: "La institución intentará contactarse próximamente.", tone: "warning", Icon: MessageCircle },
};

export function resolveEducationalStatusMeta(value) {
  const key = String(value || "").trim();
  return EDUCATIONAL_STATUS_LABELS[key] || {
    title: key || "Sin definir",
    description: "Estado actual del proceso.",
    tone: "secondary",
    Icon: CircleDashed,
  };
}

export function resolvePaymentStatusMeta(value) {
  const key = String(value || "").trim();
  return PAYMENT_STATUS_LABELS[key] || {
    title: key || "Sin datos",
    description: "Seguimiento financiero de la inscripción.",
    tone: "secondary",
    Icon: CircleDashed,
  };
}

export function resolveEmploymentStatusMeta(value) {
  const key = String(value || "").trim();
  return EMPLOYMENT_STATUS_LABELS[key] || {
    title: key || "Sin definir",
    description: "Etapa de la postulación dentro del proceso.",
    tone: "secondary",
    Icon: CircleDashed,
  };
}

export function resolveCourseCompletionStatusMeta(value) {
  const key = String(value || "").trim() || "in_progress";
  return COURSE_COMPLETION_STATUS_LABELS[key] || {
    title: key || "Sin definir",
    description: "Estado de la cursada.",
    tone: "secondary",
    Icon: CircleDashed,
  };
}
