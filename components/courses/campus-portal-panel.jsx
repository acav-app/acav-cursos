"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function resolveLegacyCampusPath(lang, view, applicationId) {
  if (view === "saved") return `/${lang}/dashboard/mis-cursos`;
  if (view === "certificates") return `/${lang}/dashboard/certificados`;
  if (view === "payments") return `/${lang}/dashboard/pagos`;
  if (view === "application-detail" && applicationId) {
    return `/${lang}/dashboard/inscripciones/${applicationId}`;
  }
  return `/${lang}/dashboard/inscripciones`;
}

export default function CandidatePortalPanel({ lang, view = "profile", applicationId = "" }) {
  const router = useRouter();
  const destination = useMemo(
    () => resolveLegacyCampusPath(lang, view, String(applicationId || "").trim()),
    [applicationId, lang, view]
  );

  useEffect(() => {
    router.replace(destination);
  }, [destination, router]);

  return (
    <section className="min-h-[calc(100vh-68px)] bg-[#F8FAFC] px-6 pt-[88px]">
      <div className="mx-auto flex max-w-[980px] items-center justify-center">
        <div className="flex w-full max-w-[520px] flex-col items-center rounded-[28px] border border-[#E5E7EB] bg-white px-8 py-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF6FF] text-[#1D4ED8]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Redirigiendo</p>
          <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#0F172A]">Estamos llevando tu experiencia al dashboard</h1>
          <p className="mt-3 max-w-[360px] text-sm leading-6 text-[#64748B]">
            Esta vista legacy ya fue integrada al nuevo panel del alumno para mantener una navegación más limpia y consistente.
          </p>
        </div>
      </div>
    </section>
  );
}
