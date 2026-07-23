import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Sparkles, Target } from "lucide-react";
import PublicCoursesShell from "@/components/courses/public-shell";
import { getPublicCourseSettings } from "@/lib/courses/public";
import { getPublicEmploymentResourceBySlug, getPublicEmploymentResources } from "@/lib/courses/public-resources";

export async function generateMetadata({ params: { slug } }) {
  const resource = getPublicEmploymentResourceBySlug(slug);
  if (!resource) {
    return { title: "Recurso no encontrado" };
  }

  return {
    title: resource.title,
    description: resource.description,
  };
}

export default async function PublicResourceDetailPage({ params: { lang, slug } }) {
  const settings = await getPublicCourseSettings();
  const resource = getPublicEmploymentResourceBySlug(slug);

  if (!resource) notFound();

  const relatedResources = getPublicEmploymentResources().filter((item) => item.slug !== resource.slug);

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="bg-slate-50 pt-[68px]">
        <section className="mx-auto max-w-[1180px] px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="overflow-hidden rounded-[30px] border border-[#DCE6F4] bg-white shadow-[0_18px_48px_rgba(27,43,80,0.06)]">
              <div className="border-b border-[#E6ECF5] p-6 md:p-8">
                <Link
                  href={`/${lang}/cursos`}
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#5B6D93] transition hover:text-[#1B2B50]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver a cursos
                </Link>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#DD4913]/20 bg-[#DD4913]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#DD4913]">
                    {resource.category}
                  </span>
                  <span className="rounded-full border border-[#D8E2F1] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B6D93]">
                    {resource.readingTime}
                  </span>
                  <span className="rounded-full border border-[#D8E2F1] bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B6D93]">
                    {resource.audience}
                  </span>
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
                  <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
                  {resource.eyebrow}
                </div>
                <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#1B2B50] md:text-[2.8rem]">{resource.title}</h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600">{resource.intro}</p>
              </div>

              <div className="border-b border-[#E6ECF5] bg-[#EEF3FB] p-4 md:p-6">
                <Image
                  src={resource.image}
                  alt={resource.imageAlt}
                  width={1600}
                  height={900}
                  priority
                  sizes="(max-width: 1024px) 100vw, 70vw"
                  className="h-auto w-full rounded-[22px] object-contain"
                />
              </div>

              <div className="p-6 md:p-8">
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoCard icon={BookOpen} label="Formato" value="Guia practica" />
                  <InfoCard icon={Clock3} label="Lectura" value={resource.readingTime} />
                  <InfoCard icon={Target} label="Enfoque" value={resource.audience} />
                </div>

                <div className="mt-8 grid gap-3">
                  {resource.highlights.map((item) => (
                    <div key={item} className="flex gap-3 rounded-[22px] border border-[#E6ECF5] bg-[#F8FBFF] px-4 py-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#DD4913]" />
                      <p className="text-sm leading-7 text-slate-600">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-10 grid gap-6">
                  {resource.sections.map((section, index) => (
                    <section key={section.title} className="rounded-[26px] border border-[#E6ECF5] bg-white p-6 shadow-[0_12px_34px_rgba(27,43,80,0.04)]">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#EAF0F9] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5B6D93]">
                        Paso {index + 1}
                      </div>
                      <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-[#1B2B50]">{section.title}</h2>
                      <div className="mt-4 grid gap-4">
                        {section.paragraphs?.map((paragraph) => (
                          <p key={paragraph} className="text-sm leading-8 text-slate-600 md:text-[15px]">
                            {paragraph}
                          </p>
                        ))}
                        {section.bullets?.length ? (
                          <div className="grid gap-3">
                            {section.bullets.map((bullet) => (
                              <div key={bullet} className="rounded-2xl border border-[#E6ECF5] bg-[#F8FBFF] px-4 py-3 text-sm leading-7 text-slate-600">
                                {bullet}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ))}
                </div>

                <section className="mt-10 rounded-[28px] border border-[#F1D2C6] bg-[linear-gradient(180deg,#FFF8F5_0%,#FFFFFF_100%)] p-6">
                  <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
                    <Sparkles className="h-4 w-4" />
                    Extra tips
                  </div>
                  <div className="mt-5 grid gap-3">
                    {resource.extraTips.map((tip) => (
                      <div key={tip} className="rounded-2xl border border-[#F3DED5] bg-white px-4 py-4 text-sm leading-7 text-slate-600">
                        {tip}
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-sm leading-8 text-slate-600 md:text-[15px]">{resource.closing}</p>
                </section>
              </div>
            </article>

            <aside className="grid gap-6 lg:sticky lg:top-[96px] lg:self-start">
              <div className="rounded-[28px] border border-[#DCE6F4] bg-white p-6 shadow-[0_18px_40px_rgba(27,43,80,0.05)]">
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">Resumen rapido</div>
                <div className="mt-4 text-2xl font-extrabold tracking-tight text-[#1B2B50]">{resource.shortTitle}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{resource.description}</p>
                <Link
                  href={`/${lang}/cursos`}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-[#1B2B50] transition hover:text-[#DD4913]"
                >
                  Ver cursos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {relatedResources.length ? (
                <div className="rounded-[28px] border border-[#DCE6F4] bg-white p-6 shadow-[0_18px_40px_rgba(27,43,80,0.05)]">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">Sigue leyendo</div>
                  <div className="mt-4 grid gap-4">
                    {relatedResources.map((item) => (
                      <Link
                        key={item.slug}
                        href={`/${lang}/recursos/${item.slug}`}
                        className="rounded-[22px] border border-[#E6ECF5] bg-[#F8FBFF] px-4 py-4 transition hover:border-[#C3D2E8] hover:bg-white"
                      >
                        <div className="text-sm font-extrabold text-[#1B2B50]">{item.shortTitle}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </section>
      </main>
    </PublicCoursesShell>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[22px] border border-[#E6ECF5] bg-[#F8FBFF] p-5">
      <Icon className="h-5 w-5 text-[#1B2B50]" />
      <div className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#5B6D93]">{label}</div>
      <div className="mt-2 text-lg font-extrabold tracking-tight text-[#1B2B50]">{value}</div>
    </div>
  );
}
