import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import {
  EnrollmentCreateSchema,
  EnrollmentUpdateSchema,
  type EnrollmentUpdateInput,
  type Payment,
  type Enrollment,
} from "@/lib/courses/schemas";
import type { CourseActor } from "@/lib/courses/server/auth";
import { isStudentRole } from "@/lib/courses/roles";
import { getCourseById } from "@/lib/courses/server/courses";
import { getInstitutionById } from "@/lib/courses/server/institutions";
import { err } from "@/lib/courses/server/errors";
import { createPayment, updatePayment } from "@/lib/courses/server/payments";
import { nowIso, removeUndefined } from "@/lib/courses/server/utils";

function normalizeEnrollment(enrollment: Record<string, any>) {
  const courseId = enrollment?.courseId || enrollment?.jobId || "";
  const courseTitle = enrollment?.courseTitle || enrollment?.jobTitle || "";
  const institutionId = enrollment?.institutionId || enrollment?.companyId || "";
  const institutionName = enrollment?.institutionName || enrollment?.companyName || "";
  const payment = enrollment?.payment && typeof enrollment.payment === "object" ? enrollment.payment : null;
  const paymentId = enrollment?.paymentId || payment?.id || "";
  const paymentStatus = enrollment?.paymentStatus || payment?.status || "";
  const paymentAmount = enrollment?.paymentAmount ?? payment?.amount;
  const paymentCurrency = enrollment?.paymentCurrency || payment?.currency || "";
  const paymentMethod = enrollment?.paymentMethod || payment?.method || "";
  const paymentReference = enrollment?.paymentReference || payment?.reference || "";
  const paymentReceiptUrl = enrollment?.paymentReceiptUrl || payment?.receiptUrl || "";
  const studentName =
    enrollment?.studentName ||
    enrollment?.candidateName ||
    [enrollment?.firstName, enrollment?.lastName].filter(Boolean).join(" ").trim();

  return removeUndefined({
    ...enrollment,
    courseId,
    courseTitle,
    institutionId,
    institutionName,
    paymentId,
    paymentStatus,
    paymentAmount,
    paymentCurrency,
    paymentMethod,
    paymentReference,
    paymentReceiptUrl,
    studentName,
    jobId: courseId || enrollment?.jobId,
    jobTitle: courseTitle || enrollment?.jobTitle,
    companyId: institutionId || enrollment?.companyId,
    companyName: institutionName || enrollment?.companyName,
    candidateName: studentName || enrollment?.candidateName,
  });
}

function toEnrollment(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return normalizeEnrollment({ id: doc.id, ...(doc.data() as any) }) as Enrollment;
}

export async function listEnrollments(options: {
  actor: CourseActor;
  filters?: Record<string, string | null | undefined>;
}) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.enrollments).orderBy("createdAt", "desc").get();
  let enrollments = snap.docs.map(toEnrollment);

  if (isStudentRole(options.actor.role)) {
    const actorEmail = String(options.actor.email || "").trim().toLowerCase();
    enrollments = enrollments.filter((enrollment) => String(enrollment.email || "").trim().toLowerCase() === actorEmail);
  }

  const filters = options.filters || {};
  const courseId = String(filters.courseId || filters.jobId || "").trim();
  const institutionId = String(filters.institutionId || filters.companyId || "").trim();
  const status = String(filters.status || "").trim();
  const email = String(filters.email || "").trim().toLowerCase();

  if (courseId) enrollments = enrollments.filter((enrollment) => enrollment.courseId === courseId);
  if (institutionId) enrollments = enrollments.filter((enrollment) => enrollment.institutionId === institutionId);
  if (status) enrollments = enrollments.filter((enrollment) => enrollment.status === status);
  if (email) enrollments = enrollments.filter((enrollment) => String(enrollment.email || "").toLowerCase().includes(email));

  return enrollments;
}

export async function getEnrollmentById(id: string) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.enrollments).doc(String(id)).get();
  if (!snap.exists) return null;
  return toEnrollment(snap);
}

export async function createEnrollment(input: unknown) {
  const parsed = EnrollmentCreateSchema.parse(input);
  const courseId = parsed.courseId || parsed.jobId || "";
  const course = await getCourseById(courseId);
  if (!course) throw err(404, "course_not_found");
  if (course.status !== "activa") throw err(400, "course_not_active");
  const normalizedEmail = String(parsed.email || "").trim().toLowerCase();
  const studentName = `${parsed.firstName} ${parsed.lastName}`.trim();
  const paymentAmount = Number(parsed.paymentAmount ?? parsed.amount ?? course.price ?? 0) || 0;
  const paymentCurrency = String(parsed.paymentCurrency || parsed.currency || "ARS").trim() || "ARS";
  const paymentMethod = String(parsed.paymentMethod || (paymentAmount > 0 ? "transferencia" : "manual")).trim();
  const paymentReference = String(parsed.paymentReference || "").trim();
  const paymentReceiptUrl = String(parsed.paymentReceiptUrl || "").trim();
  const shouldCreatePayment = Boolean(paymentAmount > 0 || paymentReceiptUrl || paymentReference);
  const hasReceipt = Boolean(paymentReceiptUrl);
  const nextPaymentStatus = parsed.paymentStatus || (paymentAmount > 0 ? (hasReceipt ? "under_review" : "pending") : "approved");
  const nextEnrollmentStatus = parsed.status || (paymentAmount > 0 ? (hasReceipt ? "payment_under_review" : "waiting_payment") : "active");

  const db = getAdminDb();
  const existingForCourse = await db
    .collection(COURSE_COLLECTIONS.enrollments)
    .where("courseId", "==", course.id)
    .get();
  const duplicateEnrollment = existingForCourse.docs.find(
    (doc) => String(doc.data()?.email || "").trim().toLowerCase() === normalizedEmail
  );
  if (duplicateEnrollment) throw err(409, "enrollment_already_exists");

  const institution = course.companyId ? await getInstitutionById(course.companyId) : null;
  const ref = db.collection(COURSE_COLLECTIONS.enrollments).doc();
  const now = nowIso();
  const payment = shouldCreatePayment
    ? await createPayment({
        enrollmentId: ref.id,
        amount: paymentAmount,
        currency: paymentCurrency,
        method: paymentMethod,
        receiptUrl: paymentReceiptUrl || undefined,
        reference: paymentReference || undefined,
        status: nextPaymentStatus,
      })
    : null;

  const payload = normalizeEnrollment(
    removeUndefined({
      userId: parsed.userId || undefined,
      courseId: course.id,
      courseTitle: course.title,
      institutionId: course.companyId,
      institutionName: course.companyName,
      institutionContactEmail: course.contactEmail,
      institutionNotificationEmail: institution?.email || course.contactEmail,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      studentName,
      email: normalizedEmail,
      phone: parsed.phone,
      city: parsed.city,
      province: parsed.province,
      cvUrl: parsed.cvUrl || undefined,
      linkedinUrl: parsed.linkedinUrl,
      portfolioUrl: parsed.portfolioUrl,
      message: parsed.message,
      status: nextEnrollmentStatus,
      paymentId: payment?.id || undefined,
      paymentStatus: nextPaymentStatus,
      paymentAmount: paymentAmount || undefined,
      paymentCurrency,
      paymentMethod,
      paymentReference: paymentReference || undefined,
      paymentReceiptUrl: paymentReceiptUrl || undefined,
      payment: payment || undefined,
      approvedAt: nextEnrollmentStatus === "active" ? now : undefined,
      acceptedPrivacy: true,
      createdAt: now,
      updatedAt: now,
    })
  );

  await ref.set(payload);
  return { id: ref.id, ...(payload as any) } as Enrollment;
}

export async function updateEnrollment(id: string, input: unknown) {
  const parsed = EnrollmentUpdateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.enrollments).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) throw err(404, "enrollment_not_found");
  const current = toEnrollment(existing);

  if (parsed.status && parsed.status !== current.status && current.institutionId) {
    const institution = await getInstitutionById(current.institutionId);
    if (!institution) throw err(404, "institution_not_found");
    if (institution.status !== "activa") throw err(400, "institution_not_active");
  }

  const reviewNow = nowIso();
  const nextStatus = parsed.status || current.status;
  const nextPaymentStatus = parsed.paymentStatus || current.paymentStatus || current.payment?.status || "";

  const payload: EnrollmentUpdateInput & {
    updatedAt: string;
    payment?: Payment;
    paymentReceiptUrl?: string;
    paymentReference?: string;
  } = removeUndefined({
    ...parsed,
    approvedAt:
      parsed.approvedAt ||
      (nextStatus === "active" && nextPaymentStatus === "approved"
        ? current.approvedAt || reviewNow
        : undefined),
    approvedBy:
      parsed.approvedBy ||
      (nextStatus === "active" && nextPaymentStatus === "approved"
        ? current.approvedBy || parsed.reviewedBy || undefined
        : undefined),
    updatedAt: reviewNow,
  });

  if (current.paymentId && (parsed.paymentStatus || parsed.reviewedBy)) {
    const nextPaymentUpdate = removeUndefined({
      status: parsed.paymentStatus,
      reviewComment: parsed.reviewComment,
      reviewedBy: parsed.reviewedBy,
      reviewedAt: parsed.paymentStatus ? reviewNow : undefined,
    });

    if (Object.keys(nextPaymentUpdate).length > 0) {
      const updatedPayment = await updatePayment(current.paymentId, nextPaymentUpdate);
      payload.payment = updatedPayment;
      payload.paymentStatus = updatedPayment.status;
      payload.paymentReceiptUrl = updatedPayment.receiptUrl || current.paymentReceiptUrl || undefined;
      payload.paymentReference = updatedPayment.reference || current.paymentReference || undefined;
    }
  }

  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return toEnrollment(updated);
}

export async function bulkPreselectInstitutionEnrollments(input: {
  institutionId?: string;
  companyId?: string;
  reviewedBy?: string;
}) {
  const institutionId = String(input.institutionId || input.companyId || "").trim();
  if (!institutionId) {
    return {
      institutionId: "",
      totalEnrollments: 0,
      eligibleEnrollments: 0,
      updatedEnrollments: 0,
      alreadyProcessedEnrollments: 0,
    };
  }

  const db = getAdminDb();
  const snap = await db
    .collection(COURSE_COLLECTIONS.enrollments)
    .where("institutionId", "==", institutionId)
    .get();

  const enrollments = snap.docs.map(toEnrollment);
  const eligibleStatuses = new Set(["recibida", "vista"]);
  const eligibleDocs = snap.docs.filter((doc) => eligibleStatuses.has(String(doc.data()?.status || "")));
  const updatedAt = nowIso();

  for (let index = 0; index < eligibleDocs.length; index += 400) {
    const chunk = eligibleDocs.slice(index, index + 400);
    const batch = db.batch();
    chunk.forEach((doc) => {
      batch.set(
        doc.ref,
        removeUndefined({
          status: "preseleccionada",
          reviewedBy: input.reviewedBy || "institution_activation",
          updatedAt,
        }),
        { merge: true }
      );
    });
    await batch.commit();
  }

  return {
    institutionId,
    totalEnrollments: enrollments.length,
    eligibleEnrollments: eligibleDocs.length,
    updatedEnrollments: eligibleDocs.length,
    alreadyProcessedEnrollments: enrollments.length - eligibleDocs.length,
  };
}
