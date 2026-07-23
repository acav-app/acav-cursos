import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import PublicCoursesShell from "@/components/courses/public-shell";
import { getPublicCourseSettings } from "@/lib/courses/public";

export const metadata = {
  title: "Publicar curso",
};

export default function PublicarCursoPage({ params: { lang } }) {
  return <PublicarCursoInner lang={lang} />;
}

async function PublicarCursoInner({ lang }) {
  const settings = await getPublicCourseSettings();

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="bg-slate-50 pt-[68px]">
        <section className="mx-auto max-w-[1180px] px-6 py-16">
          <div className="rounded-[22px] bg-[linear-gradient(160deg,rgba(27,43,80,.97)_0%,rgba(49,69,111,.88)_100%)] p-10 text-white shadow-[0_16px_48px_rgba(27,43,80,.18)]">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
              <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
              Publicar curso
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight">Publicá una propuesta formativa</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/75">
              Para publicar un curso necesitás iniciar sesión como institución o administrador. Desde el panel vas a
              poder cargar la propuesta, adjuntar programa o imagen y gestionar su estado.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-[#DD4913]" />
                  <h2 className="text-xl font-extrabold">Acceso para institución o admin</h2>
                </div>
                <p className="mt-4 text-sm leading-7 text-white/75">
                  Si no estás autenticado, al intentar publicar te vamos a llevar al login automáticamente.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-6">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-[#DD4913]" />
                  <h2 className="text-xl font-extrabold">Revisión administrativa</h2>
                </div>
                <p className="mt-4 text-sm leading-7 text-white/75">
                  Los cursos cargados por instituciones quedan pendientes de revisión antes de publicarse en el catálogo
                  público.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href={`/${lang}/dashboard/cursos/nueva`}
                className="inline-flex items-center gap-2 rounded-full bg-[#DD4913] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#EB5B24]"
              >
                Publicar curso
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PublicCoursesShell>
  );
}
