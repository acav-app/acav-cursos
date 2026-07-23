import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Globe, MapPin } from "lucide-react";
import EmptyState from "@/components/courses/empty-state";
import CourseEnrollButton from "@/components/courses/course-enroll-button";
import { MotionHoverCard, MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/courses/public-motion";
import PublicCoursesShell from "@/components/courses/public-shell";
import { getPublicCourseSettings, getPublicCourses, getPublicInstitutionBySlug, mapCourseForCard } from "@/lib/courses/public";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

export default async function EmpresaDetailPage({ params: { lang, slug } }) {
  const [settings, company] = await Promise.all([getPublicCourseSettings(), getPublicInstitutionBySlug(slug)]);

  if (!company) {
    notFound();
  }

  const companyJobs = (await getPublicCourses({ companyId: company.id })).map(mapCourseForCard);
  const coverUrl = company?.coverUrl ? normalizePublicR2Url(company.coverUrl) : "";
  const logoUrl = company?.logoUrl ? normalizePublicR2Url(company.logoUrl) : "";

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="min-h-screen bg-slate-50 pt-[68px]">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <MotionReveal className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              {coverUrl ? (
                <div className="h-56 w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                  <img src={coverUrl} alt={`Portada de ${company.name}`} className="h-full w-full object-cover transition duration-[1600ms] hover:scale-[1.04]" />
                </div>
              ) : (
                <div className="h-44 w-full border-b border-slate-200 bg-gradient-to-br from-[#1B2B50] via-[#0A4FA8] to-[#EAF2FF]" />
              )}

              <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_.6fr]">
                <div className="flex items-start gap-5">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    {logoUrl ? (
                      <img src={logoUrl} alt={`Logo de ${company.name}`} className="h-full w-full object-contain p-3" />
                    ) : (
                      <Building2 className="h-10 w-10 text-[#1B2B50]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#DD4913]">Institucion</p>
                    <h1 className="mt-2 text-4xl font-black text-[#1B2B50]">{company.name}</h1>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                      {company?.city ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2">
                          <MapPin className="h-4 w-4 text-[#31456F]" />
                          <span>{[company.city, company.province].filter(Boolean).join(", ")}</span>
                        </div>
                      ) : null}
                      {company?.website ? (
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-[#31456F] transition hover:bg-slate-200"
                        >
                          <Globe className="h-4 w-4" />
                          <span>Visitar sitio</span>
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">
                      {company.description || "La institucion todavia no completo su descripcion publica."}
                    </p>
                  </div>
                </div>

                <aside className="rounded-[22px] border border-slate-200 bg-slate-50 p-6">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#1B2B50]">Ficha pública</div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-600">
                    <div>
                      <div className="font-semibold text-slate-900">Subrubro</div>
                      <div>{company?.subRubro || "No informado"}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Ciudad / provincia</div>
                      <div>{[company?.city, company?.province].filter(Boolean).join(" / ") || "No informado"}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Cursos activos</div>
                      <div>{companyJobs.length}</div>
                    </div>
                  </div>
                </aside>
              </div>
            </MotionReveal>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-14">
          <MotionReveal>
            <h2 className="text-2xl font-bold text-[#1B2B50]">Cursos publicados</h2>
          </MotionReveal>
          {companyJobs.length ? (
            <MotionStagger className="mt-6 grid gap-4">
              {companyJobs.map((job) => {
                const previewUrl = normalizePublicR2Url(job.imageUrl || job.flyerUrl || company.logoUrl || "");
                return (
                  <MotionStaggerItem key={job.id}>
                    <MotionHoverCard>
                      <article className="rounded-3xl border border-slate-200 bg-white p-5 transition duration-500 hover:border-[#31456F]/40 hover:shadow-md">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex min-w-0 items-center gap-4">
                            <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                              {previewUrl ? (
                                <img src={previewUrl} alt={job.title} className="h-full w-full object-cover transition duration-700 hover:scale-105" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-500">ACAV</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link href={`/${lang}/cursos/${job.slug}`} className="block">
                                <h3 className="text-lg font-bold text-[#1B2B50] transition hover:text-[#31456F]">{job.title}</h3>
                              </Link>
                              <p className="text-sm text-slate-500">
                                {job.city} · {job.modalidad} · {job.contractType}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <Link href={`/${lang}/cursos/${job.slug}`} className="text-sm font-semibold text-[#31456F] transition hover:text-[#1B2B50]">
                              Ver curso
                            </Link>
                        <CourseEnrollButton
                              lang={lang}
                              jobId={job.id}
                              slug={job.slug}
                              scroll={false}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#1B2B50] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#31456F]"
                              appliedClassName="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-200 px-4 py-2 text-xs font-extrabold text-slate-600"
                              loadingClassName="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-500"
                              checkingLabel=""
                              defaultLabel="Inscribirme"
                            />
                          </div>
                        </div>
                      </article>
                    </MotionHoverCard>
                  </MotionStaggerItem>
                );
              })}
            </MotionStagger>
          ) : (
            <MotionReveal className="mt-6">
              <EmptyState
                title="No hay cursos activos por el momento."
                description="Esta institucion ya tiene su ficha publica lista, pero todavia no publico cursos visibles."
              />
            </MotionReveal>
          )}

          <MotionReveal className="mt-8" delay={0.05}>
            <Link href={`/${lang}/instituciones`} className="text-sm font-semibold text-[#31456F] transition hover:text-[#1B2B50]">
              Volver al listado de instituciones
            </Link>
          </MotionReveal>
        </section>
      </main>
    </PublicCoursesShell>
  );
}
