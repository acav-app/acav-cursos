import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Briefcase, Sparkles } from "lucide-react";
import { getPublicCourseResources } from "@/lib/courses/public-resources";

export default function PublicResourcesSection({
  lang,
  title = "Recursos para cursar mejor",
  description = "Guias practicas para preparar tu documentacion, organizar tu cursado y aprovechar mejor cada oportunidad de formacion.",
  eyebrow = "Contenido util",
  className = "",
  variant = "default",
  limit,
}) {
  const resources = getPublicCourseResources();
  const visibleResources = typeof limit === "number" ? resources.slice(0, limit) : resources;
  const isSidebar = variant === "sidebar";

  return (
    <section className={className}>
      <div className={`rounded-[30px] border border-[#DCE6F4] bg-white shadow-[0_18px_48px_rgba(27,43,80,0.06)] ${isSidebar ? "p-6" : "p-6 md:p-8"}`}>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
            <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
            {eyebrow}
          </div>
          <h2 className={`mt-4 font-extrabold tracking-tight text-[#1B2B50] ${isSidebar ? "text-2xl leading-tight" : "text-3xl md:text-4xl"}`}>{title}</h2>
          <p className={`mt-4 text-slate-600 ${isSidebar ? "text-sm leading-7" : "text-base leading-7"}`}>{description}</p>
        </div>

        {!isSidebar ? (
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-[#E6ECF5] bg-[#F8FBFF] p-5">
              <BookOpen className="h-5 w-5 text-[#1B2B50]" />
              <div className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#5B6D93]">Lectura guiada</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Contenido pensado para leer rapido, aplicar facil y volver cuando lo necesites.</p>
            </div>
            <div className="rounded-[24px] border border-[#E6ECF5] bg-[#F8FBFF] p-5">
              <Briefcase className="h-5 w-5 text-[#1B2B50]" />
              <div className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#5B6D93]">Orientado a formacion</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Consejos aterrizados al proceso de inscripcion, cursado y seguimiento academico.</p>
            </div>
            <div className="rounded-[24px] border border-[#E6ECF5] bg-[#F8FBFF] p-5">
              <Sparkles className="h-5 w-5 text-[#1B2B50]" />
              <div className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-[#5B6D93]">Aplicacion real</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Recomendaciones claras para mejorar tu organizacion, avance y certificacion desde hoy.</p>
            </div>
          </div>
        ) : null}

        <div className={`mt-8 grid ${isSidebar ? "gap-3" : "gap-6 lg:grid-cols-2"}`}>
          {visibleResources.map((resource, index) => (
            isSidebar ? (
              <Link
                key={resource.slug}
                href={`/${lang}/recursos/${resource.slug}`}
                className="group rounded-[22px] border border-[#E6ECF5] bg-[#F8FBFF] p-4 transition duration-300 hover:border-[#C3D2E8] hover:bg-white"
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-extrabold tracking-[0.16em] text-[#DD4913] shadow-[0_8px_20px_rgba(27,43,80,0.05)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#DD4913]/20 bg-[#DD4913]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#DD4913]">
                        {resource.category}
                      </span>
                      <span className="rounded-full border border-[#D8E2F1] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B6D93]">
                        {resource.readingTime}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-extrabold leading-6 tracking-tight text-[#1B2B50]">{resource.shortTitle}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{resource.description}</p>
                    <div className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-[#1B2B50] transition group-hover:text-[#DD4913]">
                      Leer guia
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <article
                key={resource.slug}
                className="group overflow-hidden rounded-[28px] border border-[#DCE6F4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F9FBFE_100%)] shadow-[0_18px_44px_rgba(27,43,80,0.05)] transition duration-500 hover:-translate-y-1 hover:border-[#C3D2E8]"
              >
                <div className="relative aspect-[16/9] overflow-hidden border-b border-[#E6ECF5] bg-[#EEF3FB]">
                  <Image
                    src={resource.image}
                    alt={resource.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                </div>

                <div className="p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#DD4913]/20 bg-[#DD4913]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#DD4913]">
                      {resource.category}
                    </span>
                    <span className="rounded-full border border-[#D8E2F1] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B6D93]">
                      {resource.readingTime}
                    </span>
                  </div>

                  <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-[#1B2B50]">{resource.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{resource.description}</p>

                  <div className="mt-5 grid gap-2">
                    {resource.highlights.slice(0, 2).map((item) => (
                      <div key={item} className="rounded-2xl border border-[#E6ECF5] bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                        {item}
                      </div>
                    ))}
                  </div>

                  <Link
                    href={`/${lang}/recursos/${resource.slug}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#1B2B50] transition hover:text-[#DD4913]"
                  >
                    Leer guia completa
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            )
          ))}
        </div>
      </div>
    </section>
  );
}
