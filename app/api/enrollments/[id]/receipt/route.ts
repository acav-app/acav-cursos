import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { canViewEnrollment, requireCourseActor } from "@/lib/courses/server/auth";
import { getEnrollmentById, updateEnrollment } from "@/lib/courses/server/enrollments";
import { z } from "zod";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

export const runtime = "nodejs";

const ReceiptUpdateSchema = z.object({
  receiptUrl: z.string().url("URL de comprobante inválida"),
  paymentReference: z.string().trim().optional(),
});

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  try {
    const actor = await requireCourseActor(request);
    const enrollment = await getEnrollmentById(ctx.params.id);

    if (!enrollment) return errorJson("enrollment_not_found", 404, request);
    if (!canViewEnrollment(actor, enrollment)) return errorJson("forbidden", 403, request);

    const isAdmin = actor.role === "admin";
    const body = await request.json().catch(() => ({}));
    const parsed = ReceiptUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorJson(firstIssue?.message || "invalid_payload", 400, request);
    }

    const receiptUrl = normalizePublicR2Url(parsed.data.receiptUrl);
    if (!receiptUrl) return errorJson("invalid_receipt_url", 400, request);

    const currentStatus = String(enrollment.status || "").trim();
    const currentPaymentStatus = String(enrollment.paymentStatus || enrollment.payment?.status || "").trim();

    const allowedTransitions = new Set([
      "waiting_payment",
      "payment_under_review",
      "rejected",
      "started",
    ]);

    const allowAlways = isAdmin;
    const studentCanUpdate =
      actor.role === "alumno" &&
      (allowedTransitions.has(currentStatus) ||
        ["pending", "rejected", "under_review"].includes(currentPaymentStatus));

    if (!allowAlways && !studentCanUpdate) {
      return errorJson("receipt_update_not_allowed", 400, request);
    }

    const nextPaymentStatus = "under_review";
    const nextEnrollmentStatus =
      currentStatus === "active" || isAdmin
        ? currentStatus || "payment_under_review"
        : "payment_under_review";

    const payload: Record<string, unknown> = {
      paymentReceiptUrl: receiptUrl,
      paymentStatus: nextPaymentStatus,
      status: nextEnrollmentStatus,
    };

    if (parsed.data.paymentReference) {
      payload.paymentReference = parsed.data.paymentReference;
    }

    const updated = await updateEnrollment(ctx.params.id, payload);
    return json({ enrollment: updated }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
