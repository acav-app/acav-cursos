"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, FileCheck, Lock, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

function ConsentChecklist({ termsAccepted, securityAccepted, onTermsChange, onSecurityChange }) {
  return (
    <div className="grid gap-4">
      <label className="flex gap-4 rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300">
        <Checkbox
          id="apply-terms-consent"
          checked={termsAccepted}
          onCheckedChange={(checked) => onTermsChange(Boolean(checked))}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-[#1B2B50]">
            <FileCheck className="h-4 w-4 text-[#2356B8]" />
            Términos y condiciones
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Confirmo que lei y acepto las condiciones de uso de la plataforma y el envio de mi inscripcion a la institucion.
          </p>
        </div>
      </label>

      <label className="flex gap-4 rounded-[24px] border border-slate-200 bg-white p-5 transition hover:border-slate-300">
        <Checkbox
          id="apply-security-consent"
          checked={securityAccepted}
          onCheckedChange={(checked) => onSecurityChange(Boolean(checked))}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-[#1B2B50]">
            <ShieldCheck className="h-4 w-4 text-[#2356B8]" />
            Seguridad y protección de datos
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Confirmo que voy a cargar información real, cuidar mis datos personales y seguir las pautas de seguridad del sistema.
          </p>
        </div>
      </label>
    </div>
  );
}

function ConsentBody({ jobTitle, termsAccepted, securityAccepted, onTermsChange, onSecurityChange, onCancel, onContinue }) {
  const canContinue = termsAccepted && securityAccepted;

  return (
    <div className="flex flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]">
      <DialogTitle className="sr-only">Confirmacion previa a la inscripcion</DialogTitle>
      <DrawerTitle className="sr-only">Confirmacion previa a la inscripcion</DrawerTitle>
      <DialogDescription className="sr-only">Acepta los terminos y protocolos de seguridad para continuar con la inscripcion.</DialogDescription>
      <DrawerDescription className="sr-only">Acepta los terminos y protocolos de seguridad para continuar con la inscripcion.</DrawerDescription>

      <div className="border-b border-slate-200 px-6 py-6 md:px-8 md:py-7">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#2356B8]">
          <Lock className="h-3.5 w-3.5" />
          Paso previo
        </div>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#1B2B50] md:text-[30px]">
          Confirma antes de inscribirte
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Para continuar con <span className="font-semibold text-slate-800">{jobTitle || "este curso"}</span>, necesitas aceptar los terminos y las pautas de seguridad del proceso.
        </p>
      </div>

      <div className="px-6 py-6 md:px-8">
        <ConsentChecklist
          termsAccepted={termsAccepted}
          securityAccepted={securityAccepted}
          onTermsChange={onTermsChange}
          onSecurityChange={onSecurityChange}
        />

        <div className="mt-5 rounded-[20px] border border-[#DCE6F7] bg-[#F7FAFF] px-4 py-4 text-sm leading-6 text-slate-600">
          La inscripcion se habilita cuando ambas confirmaciones estan aceptadas. Esto ayuda a mantener un proceso claro, seguro y confiable para todas las partes.
        </div>

        <div className="mt-4 rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Documentación</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Términos de uso
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Política de privacidad
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Queda preparado para vincular estos documentos institucionales cuando se definan sus URLs públicas.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-end md:px-8">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-extrabold transition",
            canContinue
              ? "bg-[#1B2B50] text-white shadow-[0_12px_30px_rgba(13,43,100,.18)] hover:-translate-y-0.5 hover:bg-[#133778]"
              : "cursor-not-allowed bg-slate-200 text-slate-400"
          )}
        >
          Continuar con la inscripcion
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function PreApplyConsentDialog({ jobId, jobTitle, className, children }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [securityAccepted, setSecurityAccepted] = useState(false);

  const applyHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("inscribirse", String(jobId || ""));
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [jobId, pathname, searchParams]);

  function resetState() {
    setTermsAccepted(false);
    setSecurityAccepted(false);
  }

  function handleOpenChange(nextOpen) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  }

  function handleContinue() {
    if (!termsAccepted || !securityAccepted) return;
    setOpen(false);
    resetState();
    router.replace(applyHref, { scroll: false });
  }

  const body = (
    <ConsentBody
      jobTitle={jobTitle}
      termsAccepted={termsAccepted}
      securityAccepted={securityAccepted}
      onTermsChange={setTermsAccepted}
      onSecurityChange={setSecurityAccepted}
      onCancel={() => handleOpenChange(false)}
      onContinue={handleContinue}
    />
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="max-h-[92vh] rounded-t-[28px] border-0 bg-white p-0">
            {body}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            hiddenCloseIcon
            overlayClass="bg-black/45 backdrop-blur-[10px]"
            className="w-[min(94vw,680px)] max-w-[680px] overflow-hidden rounded-[32px] border border-[#E6EBF4] bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,.16)]"
          >
            {body}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
