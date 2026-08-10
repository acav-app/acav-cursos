"use client";

import { useRef } from "react";
import { Award, Download, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CourseCertificateData {
  studentName: string;
  studentEmail?: string;
  courseTitle: string;
  institutionName?: string;
  courseDuration?: string;
  completionDate: string;
  certificateId: string;
  averageScore?: number;
  instructorName?: string;
  signatureImageUrl?: string;
  logoUrl?: string;
  description?: string;
}

interface CourseCertificateProps {
  open: boolean;
  onClose: () => void;
  data: CourseCertificateData;
}

function formatDateLong(iso: string): string {
  try {
    const d = new Date(String(iso || ""));
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function CourseCertificate({ open, onClose, data }: CourseCertificateProps) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank", "width=1200,height=850");
    if (!printWindow) return;
    const content = printRef.current.outerHTML;
    const styles = Array.from(document.querySelectorAll("link[rel=stylesheet], style"))
      .map((node) => node.outerHTML)
      .join("\n");
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Certificado - ${data.courseTitle || "Curso"}</title>
          ${styles}
          <style>
            @media print {
              body { margin: 0; }
              @page { size: landscape; margin: 0; }
            }
            body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
          </style>
        </head>
        <body class="bg-white">
          ${content}
          <script>
            (function(){
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                  window.close();
                }, 450);
              };
            })();
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function handleDownloadPng() {
    if (!printRef.current) return;
    handlePrint();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        hiddenCloseIcon={true}
        className="max-w-[1100px] border-slate-200 bg-[#F6F7FB] p-0 overflow-hidden rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 text-slate-900">
            <Award className="h-5 w-5 text-[#6D4CFF]" />
            <span className="text-sm font-semibold tracking-[-0.01em]">
              Certificado oficial · {data.courseTitle || "Curso"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-slate-200"
              onClick={handlePrint}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
            <Button
              type="button"
              className="rounded-2xl bg-[#6D4CFF] hover:bg-[#5E3EF0]"
              onClick={handleDownloadPng}
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar PDF
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-2xl text-slate-500"
              onClick={onClose}
              aria-label="Cerrar certificado"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="px-5 py-6 md:px-8 md:py-8 overflow-auto">
          <div
            ref={printRef}
            className={cn(
              "relative mx-auto w-full",
              "bg-white border border-slate-200 shadow-[0_30px_90px_rgba(15,23,42,0.10)]",
              "rounded-[28px] overflow-hidden",
              "aspect-[1.414/1]"
            )}
            style={{
              backgroundImage:
                "radial-gradient(circle at 0% 0%, rgba(109,76,255,0.12), transparent 50%), radial-gradient(circle at 100% 100%, rgba(139,92,246,0.12), transparent 55%)",
            }}
          >
            <div className="absolute inset-0 pointer-events-none select-none">
              <svg viewBox="0 0 1200 850" className="h-full w-full" aria-hidden="true">
                <defs>
                  <linearGradient id="certBorder" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.75" />
                    <stop offset="55%" stopColor="#A78BFA" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#24104D" stopOpacity="0.7" />
                  </linearGradient>
                </defs>
                <rect x="28" y="28" width="1144" height="794" rx="30" ry="30" fill="none" stroke="url(#certBorder)" strokeWidth="2.5" />
                <rect x="52" y="52" width="1096" height="746" rx="22" ry="22" fill="none" stroke="rgba(124,58,237,0.22)" strokeDasharray="4 6" />
                <g opacity="0.35">
                  <path d="M0 46 L210 46 C260 46 282 68 282 118 L282 0" fill="rgba(124,58,237,0.10)" />
                  <path d="M1200 804 L990 804 C940 804 918 782 918 732 L918 850" fill="rgba(124,58,237,0.10)" />
                </g>
              </svg>
            </div>
            <div className="relative z-10 grid h-full grid-rows-[auto_minmax(0,1fr)_auto] px-10 py-10 md:px-16 md:py-12">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {data.logoUrl ? (
                    <img src={data.logoUrl} alt="" className="h-14 w-14 object-contain rounded-2xl border border-slate-200 bg-white" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6D4CFF] to-[#4B2EE6] text-white shadow-[0_10px_30px_rgba(109,76,255,0.35)]">
                      <Award className="h-7 w-7" />
                    </div>
                  )}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {data.institutionName || "ACAV Cursos"}
                    </div>
                    <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-900">
                      Certificado oficial de finalización
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Certificado N°
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
                    {data.certificateId || "ACAV-CERT-000000"}
                  </div>
                  <div className="mt-2 text-xs font-medium text-slate-500">
                    {formatDateLong(data.completionDate) || "Fecha de emisión"}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center text-center px-4 md:px-8">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6D4CFF]">
                  Se certifica que
                </div>
                <div className="mt-6 text-[44px] md:text-[56px] font-semibold tracking-[-0.04em] text-slate-950 leading-tight">
                  {data.studentName || "Alumno / Alumna"}
                </div>
                {data.studentEmail ? (
                  <div className="mt-2 text-sm text-slate-500">{data.studentEmail}</div>
                ) : null}
                <div className="mt-10 max-w-3xl text-[15px] leading-7 text-slate-600">
                  {data.description || (
                    <>
                      Ha completado satisfactoriamente el programa formativo
                    </>
                  )}
                </div>
                <div className="mt-6 text-[28px] md:text-[36px] font-semibold tracking-[-0.03em] text-slate-900 max-w-3xl">
                  <span className="px-3 py-1 rounded-2xl bg-gradient-to-r from-[#6D4CFF]/10 via-[#A78BFA]/10 to-[#7C3AED]/10 text-[#4B2EE6]">
                    {data.courseTitle || "Curso"}
                  </span>
                </div>
                <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
                  {data.courseDuration ? (
                    <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Duración
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {data.courseDuration}
                      </div>
                    </div>
                  ) : null}
                  {typeof data.averageScore === "number" ? (
                    <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Rendimiento
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {data.averageScore}% · Promedio general
                      </div>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 backdrop-blur">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Fecha de finalización
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">
                      {formatDateLong(data.completionDate)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-end">
                <div>
                  <div className="h-[1px] w-40 bg-gradient-to-r from-slate-300 to-transparent" />
                  <div className="mt-3 text-xs font-medium text-slate-500">
                    {data.institutionName || "ACAV Cursos"}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    Institución certificante
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="inline-flex flex-col items-center">
                    <div className="relative">
                      <svg viewBox="0 0 120 120" className="h-20 w-20 text-[#6D4CFF]">
                        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
                        <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeDasharray="3 4" strokeWidth="2" />
                        <path d="M40 62 L54 76 L82 48" fill="none" stroke="currentColor" strokeOpacity="0.85" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                      Verificado
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-[1px] w-40 ml-auto bg-gradient-to-l from-slate-300 to-transparent" />
                  <div className="mt-3 text-xs font-medium text-slate-500">
                    {data.instructorName || "Equipo académico"}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    Firma responsable
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
