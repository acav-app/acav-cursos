"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Receipt,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/provider/auth.provider";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { uploadToR2 } from "@/components/courses/dashboard/upload";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

function isStudentReceiptActionAllowed(status, paymentStatus) {
  const s = String(status || "").trim().toLowerCase();
  const p = String(paymentStatus || "").trim().toLowerCase();
  if (s === "active") return false;
  const allowedEnrollment = new Set([
    "waiting_payment",
    "payment_under_review",
    "rejected",
    "started",
  ]);
  const allowedPayment = new Set(["pending", "rejected", "under_review"]);
  return allowedEnrollment.has(s) || allowedPayment.has(p);
}

export default function PaymentReceiptUploader({
  enrollmentId,
  initialReceiptUrl = "",
  initialReference = "",
  enrollmentStatus = "",
  paymentStatus = "",
  variant = "default",
  onUpdated = null,
}) {
  const { user } = useAuth();
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState(initialReceiptUrl || "");
  const [reference, setReference] = useState(initialReference || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canUpload = isStudentReceiptActionAllowed(enrollmentStatus, paymentStatus);
  const hasReceipt = Boolean(receiptUrl);
  const isUrgent =
    String(paymentStatus || "").trim().toLowerCase() === "rejected" ||
    String(enrollmentStatus || "").trim().toLowerCase() === "rejected";

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!user) {
      toast.error("Necesitas iniciar sesión.", { position: "top-right" });
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("El comprobante no puede superar los 10MB.", { position: "top-right" });
      return;
    }
    const allowed = new Set([
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]);
    if (!allowed.has(file.type)) {
      toast.error("Solo se admiten PDF, JPG, PNG o WEBP.", { position: "top-right" });
      return;
    }

    try {
      setReceiptFile(file);
      setUploading(true);
      const result = await uploadToR2(file, "payment-receipts");
      const url = result?.url;
      const normalized = normalizePublicR2Url(url);
      setReceiptUrl(normalized);
      toast.success("Comprobante cargado. Guardalo para enviar al equipo.", { position: "top-right" });
    } catch (error) {
      setReceiptFile(null);
      toast.error(error?.message || "No pudimos subir el comprobante.", { position: "top-right" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setReceiptFile(null);
    setReceiptUrl("");
  };

  const handleSave = async () => {
    if (!user || !enrollmentId) return;
    if (!receiptUrl) {
      toast.error("Primero adjunta un comprobante.", { position: "top-right" });
      return;
    }
    try {
      setSaving(true);
      const payload = { receiptUrl };
      if (String(reference || "").trim()) payload.paymentReference = String(reference).trim();
      const data = await authedFetch(user, `/api/enrollments/${enrollmentId}/receipt`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Comprobante enviado a revisión.", { position: "top-right" });
      onUpdated?.(data?.enrollment || null);
    } catch (error) {
      toast.error(error?.message || "No pudimos guardar el comprobante.", { position: "top-right" });
    } finally {
      setSaving(false);
    }
  };

  if (!canUpload && !hasReceipt) return null;

  const toneClass = isUrgent
    ? "border-rose-200 bg-rose-50"
    : hasReceipt
      ? "border-emerald-200 bg-emerald-50/50"
      : "border-[#DCE6F7] bg-[#F8FBFF]";

  const wrapperClass =
    variant === "compact"
      ? "rounded-[20px] border p-5"
      : "rounded-[24px] border p-5 md:p-6";

  return (
    <section className={`${wrapperClass} ${toneClass}`}>
      <header className="flex items-start gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            isUrgent
              ? "bg-white text-rose-600"
              : hasReceipt
                ? "bg-white text-emerald-700"
                : "bg-white text-[#2356B8]"
          }`}
        >
          {isUrgent ? <AlertCircle className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1B2B50]">
              {isUrgent
                ? "Tu comprobante necesita ser actualizado"
                : hasReceipt
                  ? "Comprobante de pago"
                  : "Subir comprobante de pago"}
            </h3>
            {isUrgent ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-rose-600">
                <AlertCircle className="h-3 w-3" />
                Requiere acción
              </span>
            ) : hasReceipt ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Adjunto
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-[#52607A]">
            {isUrgent
              ? "El comprobante anterior fue rechazado. Subí una versión nueva o corregida para que el equipo lo valide."
              : hasReceipt
                ? "Podés reemplazar el archivo en cualquier momento mientras la inscripción esté pendiente."
                : "Subí el comprobante de la transferencia para que el equipo administrativo apruebe tu acceso."}
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-4">
        {hasReceipt ? (
          <div className="rounded-[18px] border border-white/70 bg-white/80 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#0F172A]">
                    {receiptFile?.name || "Comprobante enviado a revisión"}
                  </div>
                  <div className="mt-0.5 text-xs text-[#667085]">
                    {String(paymentStatus || enrollmentStatus || "").trim()
                      ? `Estado actual: ${String(
                          paymentStatus || enrollmentStatus
                        ).replaceAll("_", " ")}`
                      : "Se notificará al equipo administrativo"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-slate-200 text-[#1B2B50]"
                >
                  <a href={receiptUrl} target="_blank" rel="noreferrer">
                    Ver
                  </a>
                </Button>
                {canUpload ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={handleRemove}
                    disabled={saving || uploading}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Reemplazar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {canUpload ? (
          <>
            {!hasReceipt ? (
              <label
                className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed bg-white/70 px-6 py-7 text-center transition ${
                  uploading
                    ? "border-amber-300 bg-amber-50/50"
                    : isUrgent
                      ? "border-rose-300/70 hover:border-rose-400/70 hover:bg-rose-50/50"
                      : "border-[#DCE6F7] hover:border-[#2356B8]/40 hover:bg-white"
                }`}
              >
                <span
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                    uploading
                      ? "bg-amber-100 text-amber-700"
                      : isUrgent
                        ? "bg-white text-rose-600 shadow-sm"
                        : "bg-white text-[#2356B8] shadow-sm"
                  }`}
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1B2B50]">
                    {uploading ? "Subiendo comprobante..." : "Seleccionar archivo"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[#667085]">
                    PDF, JPG, PNG o WEBP · máximo 10MB
                  </div>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading || saving}
                  onChange={handleFileChange}
                />
              </label>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="receipt-reference" className="text-[12px] font-semibold text-[#475467]">
                Referencia (opcional)
              </Label>
              <Input
                id="receipt-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Últimos números, banco o aclaración"
                className="h-11 rounded-[14px] bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                type="button"
                onClick={handleSave}
                disabled={!receiptUrl || uploading || saving}
                className="h-11 rounded-xl bg-[#1B2B50] px-6 font-semibold text-white hover:bg-[#133778]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : hasReceipt && receiptUrl === initialReceiptUrl ? (
                  "Guardar cambios"
                ) : (
                  <>
                    <Receipt className="mr-2 h-4 w-4" />
                    Enviar comprobante
                  </>
                )}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
