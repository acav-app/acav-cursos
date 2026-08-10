"use client";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { resolveEducationalStatusMeta, resolvePaymentStatusMeta } from "@/lib/courses/status-meta";
import { Circle, Download, ExternalLink, FileText, FolderKanban } from "lucide-react";

const TONE_TO_BADGE_CLASS = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  destructive: "border-rose-200 bg-rose-50 text-rose-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  secondary: "border-slate-200 bg-slate-100 text-slate-700",
  muted: "border-slate-200 bg-slate-100 text-slate-600",
};

function badgeClassForTone(tone) {
  const key = String(tone || "").trim().toLowerCase();
  return TONE_TO_BADGE_CLASS[key] || TONE_TO_BADGE_CLASS.secondary;
}

function normalizeStatusMeta(rawMeta) {
  return {
    ...(rawMeta || {}),
    label: rawMeta?.title || "",
    description: rawMeta?.description || "",
    badgeClass: badgeClassForTone(rawMeta?.tone),
  };
}

function formatDateSafe(value) {
  if (!value) return "—";
  try {
    return new Date(String(value)).toLocaleDateString("es-AR");
  } catch {
    return "—";
  }
}

function buildSummaryFromEnrollment(enrollment, course) {
  const _e = enrollment || {};
  const _c = course || {};
  const totalLessons = Number(_e?.totalLessons || 0);
  const progress = Number(_e?.progress || 0);
  const lessonCompleted = Number(_e?.lessonsCompleted || _e?.completedLessons || 0);
  const finalEval = _e?.finalEvaluation || {};
  const finalEvalStatus = String(finalEval?.status || "").trim().toLowerCase();
  const finalEvalPct = Number(finalEval?.percentage || 0);
  const perClassTotal = Number(_e?.lessonEvaluationsTotal || _e?.lessonEvaluations?.total || 0);
  const perClassPassed = Number(_e?.lessonEvaluationsPassed || _e?.lessonEvaluations?.passed || 0);
  const finalMaxAttempts = Number(_c?.finalEvaluation?.maxAttempts || _e?.finalEvaluationMaxAttempts || 0);
  const finalUsed = Number(_e?.finalEvaluationAttemptsUsed || finalEval?.attemptsUsed || 0);
  return {
    progress,
    totalLessons,
    lessonCompleted,
    finalEvalStatus,
    finalEvalPct,
    finalRequired: Boolean(_c?.finalEvaluation?.enabled || finalEval?.enabled),
    perClassTotal,
    perClassPassed,
    finalMaxAttempts,
    finalUsed,
  };
}

export default function EnrollmentTrackingDialog({
  open,
  onOpenChange,
  trigger,
  enrollment,
  course,
}) {
  const summary = React.useMemo(
    () => (enrollment ? buildSummaryFromEnrollment(enrollment, course) : null),
    [enrollment, course]
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
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
        {enrollment && summary ? (
          (() => {
            const eduMeta = normalizeStatusMeta(resolveEducationalStatusMeta(enrollment?.status));
            const payMeta = normalizeStatusMeta(resolvePaymentStatusMeta(enrollment?.paymentStatus || enrollment?.payment?.status));
            const EduIcon = eduMeta.Icon || Circle;
            const PayIcon = payMeta.Icon || Circle;
            const _e = enrollment || {};
            const createdAtRaw =
              _e?.createdAt ||
              _e?.created_at ||
              _e?.submittedAt;
            const approvedAtRaw =
              _e?.approvedAt ||
              _e?.activatedAt ||
              _e?.validatedAt;
            const paymentNotes =
              _e?.paymentNotes ||
              _e?.payment?.notes ||
              _e?.payment?.note;
            const adminMessage =
              _e?.adminMessage ||
              _e?.notes ||
              _e?.coordinatorNote;
            const paymentRef =
              _e?.paymentReference ||
              _e?.payment?.reference ||
              _e?.ticketId;
            const receiptUrl =
              _e?.paymentReceiptUrl ||
              _e?.payment?.receiptUrl ||
              _e?.payment?.voucherUrl;
            return (
              <div className="mt-2 grid w-full gap-4 sm:grid-cols-2">
                <div className="w-full rounded-2xl border border-slate-200 bg-[#FCFCFF] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Estado académico
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        eduMeta.badgeClass
                      )}
                    >
                      <EduIcon className="h-3.5 w-3.5 shrink-0" />
                      {eduMeta.label}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Progreso cursada
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <CircularProgress size="sm" value={summary.progress} className="shrink-0" />
                        <span className="text-sm font-semibold text-slate-900">{summary.progress}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Clases completadas
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {summary.lessonCompleted} / {summary.totalLessons}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Evaluaciones clase
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {summary.perClassPassed} / {summary.perClassTotal} aprobadas
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Evaluación final
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {!summary.finalRequired
                          ? "No requiere"
                          : summary.finalEvalStatus === "passed" || summary.finalEvalPct >= 70
                            ? `Aprobada · ${summary.finalEvalPct}%`
                            : summary.finalEvalStatus
                              ? `En curso · ${summary.finalEvalPct}%`
                              : "Pendiente"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full rounded-2xl border border-slate-200 bg-[#FCFCFF] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Estado del pago
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        payMeta.badgeClass
                      )}
                    >
                      <PayIcon className="h-3.5 w-3.5 shrink-0" />
                      {payMeta.label}
                    </span>
                    {String(paymentRef).trim() ? (
                      <Badge variant="soft" color="default" className="rounded-full shrink-0">
                        <FileText className="mr-1 h-3 w-3" />
                        Ref. {String(paymentRef)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-500 break-words">
                    {payMeta.description}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Inscripción
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 break-all">
                        #{String(enrollment?.id || "").slice(0, 12)}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Fecha inicio
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatDateSafe(createdAtRaw)}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Aprobada en
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatDateSafe(approvedAtRaw)}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Intentos final
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {summary.finalRequired
                          ? `${summary.finalUsed}${summary.finalMaxAttempts ? ` / ${summary.finalMaxAttempts}` : ""}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {adminMessage || paymentNotes || receiptUrl ? (
                  <div className="w-full sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Novedades y comprobantes
                    </div>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                      {adminMessage ? (
                        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-600">
                            Mensaje de coordinación
                          </div>
                          <div className="mt-1 break-words">{String(adminMessage)}</div>
                        </div>
                      ) : null}
                      {paymentNotes ? (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                            Notas de pago
                          </div>
                          <div className="mt-1 break-words">{String(paymentNotes)}</div>
                        </div>
                      ) : null}
                      {receiptUrl ? (
                        <div>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="rounded-2xl border-slate-200"
                          >
                            <a
                              href={String(receiptUrl)}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-2"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Descargar comprobante de pago
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Cargando información de la inscripción…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
