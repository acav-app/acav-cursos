import { Resend } from "resend";
import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import { getCourseSettings } from "@/lib/courses/server/settings";
import { nowIso, removeUndefined } from "@/lib/courses/server/utils";

function normalizeEmail(value: unknown) {
  const s = String(value || "").trim();
  return s.includes("@") ? s : "";
}

function normalizeFrom(value: string, fromName?: string) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (s.includes("<")) return s;
  const name = String(fromName || "").trim() || String(process.env.RESEND_FROM_NAME || "").trim() || "ACAV Cursos";
  return `${name} <${s}>`;
}

function safeSubject(value: unknown, fallback: string) {
  const s = String(value || "").trim();
  return s || fallback;
}

async function logEmail(entry: {
  type: string;
  to: string;
  subject: string;
  status: "queued" | "sent" | "error";
  relatedCourseId?: string;
  relatedEnrollmentId?: string;
  errorMessage?: string;
}) {
  const db = getAdminDb();
  await db.collection(COURSE_COLLECTIONS.notificationLogs).add(
    removeUndefined({
      ...entry,
      createdAt: nowIso(),
    })
  );
}

export async function sendCourseEmail(input: {
  type: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  relatedCourseId?: string;
  relatedEnrollmentId?: string;
}) {
  const settings = await getCourseSettings();
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const fromEnv = String(process.env.RESEND_FROM || "").trim();
  if (!apiKey || !fromEnv) {
    await logEmail({
      type: input.type,
      to: input.to,
      subject: input.subject,
      status: "error",
      relatedCourseId: input.relatedCourseId,
      relatedEnrollmentId: input.relatedEnrollmentId,
      errorMessage: "resend_not_configured",
    });
    return { ok: false, error: "resend_not_configured" };
  }

  const resend = new Resend(apiKey);
  const from = normalizeFrom(fromEnv, settings.emailFromName);
  const replyTo = normalizeEmail(settings.replyTo) || normalizeEmail(process.env.RESEND_REPLY_TO);

  await logEmail({
    type: input.type,
    to: input.to,
    subject: input.subject,
    status: "queued",
    relatedCourseId: input.relatedCourseId,
    relatedEnrollmentId: input.relatedEnrollmentId,
  });

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: safeSubject(input.subject, "Notificación"),
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    ...(replyTo ? { replyTo } : {}),
  });

  if (error) {
    await logEmail({
      type: input.type,
      to: input.to,
      subject: input.subject,
      status: "error",
      relatedCourseId: input.relatedCourseId,
      relatedEnrollmentId: input.relatedEnrollmentId,
      errorMessage: error.message || "email_failed",
    });
    return { ok: false, error: error.message || "email_failed" };
  }

  await logEmail({
    type: input.type,
    to: input.to,
    subject: input.subject,
    status: "sent",
    relatedCourseId: input.relatedCourseId,
    relatedEnrollmentId: input.relatedEnrollmentId,
  });

  return { ok: true, id: String(data?.id || "") };
}

export async function notifyAdminNewCourse(course: any) {
  const settings = await getCourseSettings();
  if (!settings.notifyAdminOnNewCourse) return { ok: true, skipped: true };
  const to = normalizeEmail(settings.adminNotificationEmail);
  if (!to) return { ok: true, skipped: true };

  const subject = `Nuevo curso creado: ${course.title}`;
  const text = [
    "Se creó un nuevo curso y quedó pendiente de revisión.",
    "",
    `Curso: ${course.title}`,
    `Institución: ${course.institutionName || course.companyName || "-"}`,
    `Sede: ${course.city || "-"}`,
    `Estado: ${course.status}`,
    "",
    "Ingresa al panel para revisarlo y aprobarlo o rechazarlo.",
  ].join("\n");

  return sendCourseEmail({
    type: "course-pending-review",
    to,
    subject,
    text,
    relatedCourseId: course.id,
  });
}

export async function notifyInstitutionCourseStatus(course: any, status: "aprobada" | "rechazada") {
  const settings = await getCourseSettings();
  if (!settings.notifyInstitutionOnCourseStatusChange) return { ok: true, skipped: true };
  const to = normalizeEmail(course?.contactEmail);
  if (!to) return { ok: true, skipped: true };

  const subject =
    status === "aprobada"
      ? `Curso aprobado: ${course.title}`
      : `Curso rechazado: ${course.title}`;

  const text = [
    status === "aprobada"
      ? "Tu curso fue aprobado y ya está publicado."
      : "Tu curso fue rechazado.",
    "",
    `Curso: ${course.title}`,
    `Institución: ${course.institutionName || course.companyName || "-"}`,
    `Sede: ${course.city || "-"}`,
    status === "rechazada" ? `Motivo: ${course.rejectionReason || "-"}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return sendCourseEmail({
    type: status === "aprobada" ? "course-approved" : "course-rejected",
    to,
    subject,
    text,
    relatedCourseId: course.id,
  });
}

export async function notifyInstitutionNewEnrollment(enrollment: any) {
  const settings = await getCourseSettings();
  if (!settings.notifyInstitutionOnNewEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.institutionContactEmail || enrollment?.institutionNotificationEmail);
  if (!to) return { ok: true, skipped: true };

  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.studentName ||
    enrollment?.candidateName ||
    "-";
  const subject = `Nueva inscripción: ${enrollment.courseTitle || enrollment.jobTitle}`;
  const text = [
    "Recibiste una nueva inscripción.",
    "",
    `Curso: ${enrollment.courseTitle || enrollment.jobTitle}`,
    `Alumno: ${studentName}`,
    `Email: ${enrollment.email}`,
    `Teléfono: ${enrollment.phone}`,
    `Ciudad: ${enrollment.city}`,
    `Provincia: ${enrollment.province || "-"}`,
    `Monto: ${enrollment.paymentAmount || enrollment.amount || "-"}`,
    `Estado del pago: ${enrollment.paymentStatus || enrollment?.payment?.status || "-"}`,
    `Referencia: ${enrollment.paymentReference || enrollment?.payment?.reference || "-"}`,
    "",
    `Comprobante: ${enrollment.paymentReceiptUrl || enrollment?.payment?.receiptUrl || enrollment.cvUrl || "-"}`,
  ].join("\n");

  return sendCourseEmail({
    type: "new-enrollment-institution",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}

export async function notifyStudentEnrollmentConfirmation(enrollment: any) {
  const settings = await getCourseSettings();
  if (!settings.notifyStudentOnEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.email);
  if (!to) return { ok: true, skipped: true };

  const subject = `Confirmación de inscripción: ${enrollment.courseTitle || enrollment.jobTitle}`;
  const paymentStatus = enrollment.paymentStatus || enrollment?.payment?.status || "-";
  const paymentMessage =
    paymentStatus === "pending"
      ? "Tu inscripción quedó iniciada con el pago pendiente. Puedes continuar el seguimiento desde tu panel."
      : "Recibimos tu comprobante y el equipo revisará la acreditación manualmente.";
  const text = [
    "Tu inscripción fue registrada correctamente.",
    "",
    `Curso: ${enrollment.courseTitle || enrollment.jobTitle}`,
    `Institución: ${enrollment.institutionName || enrollment.companyName || "-"}`,
    `Estado: ${enrollment.status || "-"}`,
    `Pago: ${paymentStatus}`,
    "",
    paymentMessage,
  ].join("\n");

  return sendCourseEmail({
    type: "enrollment-confirmation-student",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}

export async function notifyStudentPaymentApproved(enrollment: any) {
  const settings = await getCourseSettings();
  if (!settings.notifyStudentOnEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.email);
  if (!to) return { ok: true, skipped: true };

  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.studentName ||
    "";

  const subject = `Pago aprobado — Acceso habilitado: ${enrollment.courseTitle || enrollment.jobTitle}`;
  const text = [
    studentName ? `Hola ${studentName}.` : "Hola.",
    "",
    `Tu pago para el curso «${enrollment.courseTitle || enrollment.jobTitle}» fue aprobado y tu acceso ya está habilitado.`,
    "",
    "Podés ingresar a la cursada desde tu panel, sección Mis Cursos:",
    `${String(process.env.NEXT_PUBLIC_SITE_URL || "")}/dashboard/mis-cursos/${enrollment.id}`,
    "",
    "Cualquier duda respondé a este correo.",
  ].join("\n");

  return sendCourseEmail({
    type: "enrollment-payment-approved-student",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}

export async function notifyStudentPaymentRejected(
  enrollment: any,
  reviewComment = "",
  mode: "resubmit" | "rejected" = "rejected"
) {
  const settings = await getCourseSettings();
  if (!settings.notifyStudentOnEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.email);
  if (!to) return { ok: true, skipped: true };

  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.studentName ||
    "";

  const title = String(enrollment.courseTitle || enrollment.jobTitle || "").trim();

  if (mode === "resubmit") {
    const subject = `Tu comprobante necesita una actualización — ${title}`;
    const text = [
      studentName ? `Hola ${studentName}.` : "Hola.",
      "",
      `Revisamos tu comprobante para el curso «${title}» y necesitamos que subas una versión corregida o nueva.`,
      reviewComment ? `Observaciones: ${reviewComment}` : "",
      "",
      "Ingresá a tu inscripción y adjuntá el nuevo archivo desde el panel:",
      `${String(process.env.NEXT_PUBLIC_SITE_URL || "")}/dashboard/inscripciones/${enrollment.id}`,
    ]
      .filter(Boolean)
      .join("\n");

    return sendCourseEmail({
      type: "enrollment-payment-resubmit-student",
      to,
      subject,
      text,
      relatedEnrollmentId: enrollment.id,
      relatedCourseId: enrollment.courseId || enrollment.jobId,
    });
  }

  const subject = `Inscripción rechazada — ${title}`;
  const text = [
    studentName ? `Hola ${studentName}.` : "Hola.",
    "",
    `Lamentablemente tu inscripción al curso «${title}» fue rechazada.`,
    reviewComment ? `Motivo: ${reviewComment}` : "",
    "",
    "Si querés saber más detalles respondé a este correo.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendCourseEmail({
    type: "enrollment-rejected-student",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}

export async function notifyStudentReceiptRequested(enrollment: any, reviewComment = "") {
  const settings = await getCourseSettings();
  if (!settings.notifyStudentOnEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.email);
  if (!to) return { ok: true, skipped: true };

  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.studentName ||
    "";
  const title = String(enrollment.courseTitle || enrollment.jobTitle || "").trim();

  const subject = `Adjuntá tu comprobante para avanzar — ${title}`;
  const text = [
    studentName ? `Hola ${studentName}.` : "Hola.",
    "",
    `Tu inscripción al curso «${title}» está pendiente de comprobante de pago.`,
    reviewComment ? `Aclaración: ${reviewComment}` : "",
    "",
    "Ingresá a tu inscripción, adjuntá el comprobante y lo revisaremos a la brevedad:",
    `${String(process.env.NEXT_PUBLIC_SITE_URL || "")}/dashboard/inscripciones/${enrollment.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendCourseEmail({
    type: "enrollment-receipt-requested-student",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}

export async function sendInstitutionWelcomeEmail(input: {
  to: string;
  firstName?: string;
  lastName?: string;
  institutionName: string;
  city?: string;
  website?: string;
  loginUrl?: string;
  dashboardUrl?: string;
}) {
  const to = normalizeEmail(input.to);
  if (!to) return { ok: true, skipped: true };

  const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const subject = `Bienvenida a ACAV Cursos: ${input.institutionName}`;
  const text = [
    `Hola ${fullName || "equipo"}.`,
    "",
    "Tu cuenta institucional fue creada correctamente en ACAV Cursos.",
    "",
    "Datos registrados:",
    `Institución: ${input.institutionName}`,
    `Email de acceso: ${to}`,
    `Ciudad: ${input.city || "-"}`,
    `Sitio web: ${input.website || "-"}`,
    "",
    "Por seguridad no enviamos contraseñas ni datos sensibles por correo.",
    input.loginUrl ? `Ingresar al portal: ${input.loginUrl}` : "",
    input.dashboardUrl ? `Panel: ${input.dashboardUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return sendCourseEmail({
    type: "institution-welcome",
    to,
    subject,
    text,
  });
}

export async function notifyStudentCourseApproved(
  enrollment: any,
  options: { score?: number; reason?: string } = {}
) {
  const settings = await getCourseSettings();
  if (!settings.notifyStudentOnEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.email);
  if (!to) return { ok: true, skipped: true };

  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.studentName ||
    "";
  const title = String(enrollment.courseTitle || enrollment.jobTitle || "").trim();
  const score = typeof options.score === "number" ? `Puntaje final: ${options.score}/100.` : "";
  const subject = `Cursada aprobada — ${title}`;
  const text = [
    studentName ? `Hola ${studentName}.` : "Hola.",
    "",
    `¡Felicitaciones! Tu cursada de «${title}» fue marcada como aprobada.`,
    score,
    "",
    "Tu certificado oficial ya está disponible para descargar desde tu panel en la sección Mis Cursos:",
    `${String(process.env.NEXT_PUBLIC_SITE_URL || "")}/dashboard/mis-cursos/${enrollment.id}`,
    "",
    "Cualquier duda respondé a este correo.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendCourseEmail({
    type: "course-approved-student",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}

export async function notifyStudentCourseReproved(
  enrollment: any,
  options: { score?: number; reason?: string; retakeAvailable?: boolean } = {}
) {
  const settings = await getCourseSettings();
  if (!settings.notifyStudentOnEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.email);
  if (!to) return { ok: true, skipped: true };

  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.studentName ||
    "";
  const title = String(enrollment.courseTitle || enrollment.jobTitle || "").trim();
  const score = typeof options.score === "number" ? `Puntaje final: ${options.score}/100.` : "";
  const subject = `Resultado de cursada — ${title}`;
  const text = [
    studentName ? `Hola ${studentName}.` : "Hola.",
    "",
    `Te informamos que tu cursada de «${title}» fue marcada como desaprobada.`,
    score,
    options.reason ? `Motivo: ${options.reason}` : "",
    options.retakeAvailable
      ? "Tenés disponible una nueva instancia para recursar. Comunicate con administración o revisa tu panel para más información."
      : "Si querés conocer las instancias disponibles respondé a este correo.",
    "",
    "Podés revisar el detalle desde tu panel:",
    `${String(process.env.NEXT_PUBLIC_SITE_URL || "")}/dashboard/mis-cursos/${enrollment.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendCourseEmail({
    type: "course-reproved-student",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}

export async function notifyStudentCourseSuspended(
  enrollment: any,
  options: { reason?: string } = {}
) {
  const settings = await getCourseSettings();
  if (!settings.notifyStudentOnEnrollment) return { ok: true, skipped: true };
  const to = normalizeEmail(enrollment?.email);
  if (!to) return { ok: true, skipped: true };

  const studentName =
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim() ||
    enrollment?.studentName ||
    "";
  const title = String(enrollment.courseTitle || enrollment.jobTitle || "").trim();
  const subject = `Cursada suspendida temporalmente — ${title}`;
  const text = [
    studentName ? `Hola ${studentName}.` : "Hola.",
    "",
    `Te informamos que el acceso al curso «${title}» fue suspendido temporalmente.`,
    options.reason ? `Motivo: ${options.reason}` : "",
    "",
    "Para regularizar tu situación, por favor respondé a este correo con los datos que te solicitamos o revisa las instrucciones enviadas por la institución.",
    "",
    "Mientras la suspensión esté activa no podrás acceder al contenido del campus.",
  ]
    .filter(Boolean)
    .join("\n");

  return sendCourseEmail({
    type: "course-suspended-student",
    to,
    subject,
    text,
    relatedEnrollmentId: enrollment.id,
    relatedCourseId: enrollment.courseId || enrollment.jobId,
  });
}
