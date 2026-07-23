"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, CreditCard, Presentation, Smartphone, Star, Trophy } from "lucide-react";
import EmptyState from "@/components/courses/empty-state";
import JobCard from "@/components/courses/job-card";
import { JobCardSkeleton } from "@/components/courses/job-card";
import { MotionHoverCard, MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/courses/public-motion";
import PublicCoursesShell from "@/components/courses/public-shell";

const LEGACY_EMPLOYMENT_HERO = {
  eyebrow: "Bolsa de trabajo",
  title: "Conecta talento con oportunidades reales.",
  subtitle:
    "Portal de empleo con vista publica institucional y panel privado para administrar empresas, busquedas y postulaciones.",
};

const ACAV_HERO = {
  eyebrow: "PLATAFORMA OFICIAL ACAV · Formación Turística Profesional",
  title: "Formación de élite para el turismo cordobés",
  subtitle:
    "Domina Amadeus GDS, sistemas de reservas y gestión de agencias. Cursos dictados por expertos de la industria, con certificación oficial de ACAV.",
};

const LEGACY_STATS_LABELS = new Set(["Empresas socias", "Puestos activos", "Postulaciones", "Otra estadistica"]);

function SectionTitle({ eyebrow, title, description, light = false }) {
  return (
    <div className="max-w-3xl">
      <div className={`inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] ${light ? "text-[#DD4913]" : "text-[#DD4913]"}`}>
        <span className={`h-0.5 w-6 rounded ${light ? "bg-[#DD4913]" : "bg-[#DD4913]"}`} />
        {eyebrow}
      </div>
      <h2 className={`mt-4 text-3xl font-black leading-tight tracking-tight md:text-4xl ${light ? "text-white" : "text-[#1B2B50]"}`}>{title}</h2>
      {description ? <p className={`mt-4 text-base leading-7 ${light ? "text-white/65" : "text-slate-600"}`}>{description}</p> : null}
    </div>
  );
}

function categoryMatchesFilter(job, filter) {
  const normalizedFilter = String(filter || "").toLowerCase();
  if (normalizedFilter === "todos") return true;
  const values = [
    job?.categoryLabel,
    job?.secondaryCategoryLabel,
    job?.title,
    job?.subRubro,
    job?.area,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return values.includes(normalizedFilter);
}

export default function PublicCoursesHome({ lang, settings, activeJobs, companies, liveStats }) {
  const [query, setQuery] = useState("");
  const filters = useMemo(() => {
    const dynamic = Array.from(
      new Set(
        (Array.isArray(activeJobs) ? activeJobs : [])
          .flatMap((job) => [job?.categoryLabel, job?.secondaryCategoryLabel])
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );
    return ["Todos", ...dynamic.slice(0, 6)];
  }, [activeJobs]);
  const [filter, setFilter] = useState("Todos");

  const filteredJobs = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    return (Array.isArray(activeJobs) ? activeJobs : []).filter((job) => {
      const haystack = [
        job?.title,
        job?.companyName,
        job?.city,
        job?.categoryLabel,
        job?.subRubro,
        job?.area,
        job?.secondaryCategoryLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (!q || haystack.includes(q)) && categoryMatchesFilter(job, filter);
    });
  }, [activeJobs, filter, query]);

  const heroCourse = useMemo(() => {
    return (Array.isArray(activeJobs) ? activeJobs : [])[0] || null;
  }, [activeJobs]);

  const heroCopy = useMemo(() => {
    const eyebrow = String(settings?.heroEyebrow || "").trim();
    const title = String(settings?.heroTitle || "").trim();
    const subtitle = String(settings?.heroSubtitle || "").trim();

    return {
      eyebrow: !eyebrow || eyebrow === LEGACY_EMPLOYMENT_HERO.eyebrow ? ACAV_HERO.eyebrow : eyebrow,
      title: !title || title === LEGACY_EMPLOYMENT_HERO.title ? ACAV_HERO.title : title,
      subtitle: !subtitle || subtitle === LEGACY_EMPLOYMENT_HERO.subtitle ? ACAV_HERO.subtitle : subtitle,
    };
  }, [settings?.heroEyebrow, settings?.heroSubtitle, settings?.heroTitle]);

  const heroStats = useMemo(() => {
    const configured = Array.isArray(settings?.stats)
      ? settings.stats
          .filter((item) => String(item?.label || "").trim() && String(item?.value || "").trim())
          .filter((item) => !LEGACY_STATS_LABELS.has(String(item.label || "").trim()))
      : [];

    const activeCourses = Number(liveStats?.activeJobs || activeJobs?.length || 0);
    const enrolledStudents = Number(liveStats?.applications || 0);

    return [
      {
        value: activeCourses > 0 ? `${activeCourses}+` : String(configured[0]?.value || ""),
        label: "Cursos activos",
      },
      {
        value: enrolledStudents > 0 ? String(enrolledStudents) : String(configured[1]?.value || ""),
        label: "Alumnos formados",
      },
      {
        value: String(configured[2]?.value || ""),
        label: String(configured[2]?.label || "Satisfacción"),
      },
    ].filter((item) => String(item.value || "").trim());
  }, [activeJobs?.length, liveStats?.activeJobs, liveStats?.applications, settings?.stats]);

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="anchors">
      <main>
        <section className="relative overflow-hidden bg-[linear-gradient(145deg,#15203B_0%,#1B2B50_55%,#15203B_100%)] px-6 pb-20 pt-[132px] text-white">
          <div className="pointer-events-none absolute -right-24 -top-24 h-[540px] w-[540px] rounded-full bg-[radial-gradient(circle,rgba(49,69,111,.32),transparent_70%)]" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(221,73,19,.12),transparent_70%)]" />
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-2">
            <MotionReveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DD4913]/30 bg-[#DD4913]/12 px-4 py-2 text-xs font-extrabold tracking-[0.08em] text-[#DD4913]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#DD4913]" />
                {heroCopy.eyebrow}
              </div>
              <h1 className="mt-6 max-w-[720px] text-4xl font-black leading-[1.05] md:text-6xl">
                {heroCopy.title}
              </h1>
              <p className="mt-6 max-w-[520px] text-base leading-8 text-white/72 md:text-lg">
                {heroCopy.subtitle}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#catalogo"
                  className="inline-flex items-center gap-2 rounded-full bg-[#DD4913] px-7 py-3 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#EB5B24]"
                >
                  Explorar cursos
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#porque-acav"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3 text-sm font-semibold text-white/85 transition hover:border-white/45 hover:bg-white/8"
                >
                  Ver certificaciones
                </a>
              </div>

              <div className="mt-12 flex flex-wrap gap-8">
                {heroStats.map((stat, index) => (
                  <div key={stat.label} className="flex items-center gap-8">
                    <div>
                      <div className="text-[30px] font-black leading-none md:text-[34px]">{stat.value}</div>
                      <div className="mt-1 text-xs text-white/50">{stat.label}</div>
                    </div>
                    {index < heroStats.length - 1 ? <span className="hidden h-10 w-px bg-white/12 md:block" /> : null}
                  </div>
                ))}
              </div>
            </MotionReveal>

            {heroCourse ? (
              <MotionReveal delay={0.05}>
                <div className="mx-auto w-full max-w-[430px]">
                  <JobCard job={heroCourse} lang={lang} />
                </div>
              </MotionReveal>
            ) : null}
          </div>
        </section>

        <section id="catalogo" className="bg-white py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <MotionReveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <SectionTitle eyebrow="Formación profesional" title="Catálogo de cursos" />
              <div className="flex flex-wrap gap-2">
                {filters.map((pill) => {
                  const active = filter === pill;
                  return (
                    <button
                      key={pill}
                      type="button"
                      onClick={() => setFilter(pill)}
                      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-[#1B2B50] bg-slate-100 text-[#1B2B50]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#1B2B50] hover:text-[#1B2B50]"
                      }`}
                    >
                      {pill}
                    </button>
                  );
                })}
              </div>
            </MotionReveal>

            {!Array.isArray(activeJobs) ? (
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <JobCardSkeleton key={index} />
                ))}
              </div>
            ) : filteredJobs.length ? (
              <MotionStagger className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredJobs.map((job) => (
                  <MotionStaggerItem key={job.id}>
                    <MotionHoverCard>
                      <JobCard job={job} lang={lang} />
                    </MotionHoverCard>
                  </MotionStaggerItem>
                ))}
              </MotionStagger>
            ) : (
              <MotionReveal className="mt-10">
                <EmptyState title="No hay cursos que coincidan con tu búsqueda." description="Probá con otra categoría o un término distinto." />
              </MotionReveal>
            )}
          </div>
        </section>

        <section id="porque-acav" className="bg-white py-20">
          <div className="bg-[#15203B] px-6 py-[72px]">
            <div className="mx-auto max-w-[1200px]">
              <MotionReveal className="text-center">
                <div className="inline-flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#DD4913]">
                  <span className="h-0.5 w-6 rounded bg-[#DD4913]" />
                  ¿Por qué ACAV Cursos?
                </div>
                <h2 className="mt-4 text-[1.6rem] font-extrabold leading-tight text-white">Todo lo que necesitás para crecer</h2>
                <p className="mx-auto mt-3 max-w-[760px] text-sm text-white/60">
                  La plataforma de formación más completa para profesionales del turismo en Córdoba.
                </p>
              </MotionReveal>

              <MotionStagger className="mt-[52px] grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    icon: Trophy,
                    title: "Certificación oficial",
                    text: "Certificados con aval de ACAV y reconocimiento en toda la industria turística.",
                  },
                  {
                    icon: Smartphone,
                    title: "100% online",
                    text: "Accedé desde cualquier dispositivo, a tu ritmo o en clases en vivo.",
                  },
                  {
                    icon: Presentation,
                    title: "Docentes expertos",
                    text: "Profesionales activos de la industria de viajes con años de experiencia.",
                  },
                  {
                    icon: CreditCard,
                    title: "Beneficio para socios",
                    text: "Los socios ACAV acceden a descuentos exclusivos y cuotas sin interés.",
                  },
                ].map((item) => (
                  <MotionStaggerItem
                    key={item.title}
                    className="rounded-[14px] border border-white/10 bg-white/5 px-[22px] py-7 text-center transition hover:bg-white/[0.09]"
                  >
                    <div className="mb-[14px] flex justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                        <item.icon className="h-7 w-7 text-[#DD4913]" />
                      </div>
                    </div>
                    <div className="text-[0.95rem] font-bold text-white">{item.title}</div>
                    <div className="mt-2 text-[0.8rem] leading-6 text-white/50">{item.text}</div>
                  </MotionStaggerItem>
                ))}
              </MotionStagger>
            </div>
          </div>
        </section>

        <section id="testimonios" className="bg-slate-50 py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <MotionReveal>
              <SectionTitle
                eyebrow="Lo que dicen nuestros alumnos"
                title="Lo que dicen nuestros alumnos"
                description="Más de 480 profesionales ya se formaron"
              />
            </MotionReveal>
            <MotionStagger className="mt-10 grid gap-[22px] lg:grid-cols-3">
              {[
                {
                  quote:
                    '"El curso de Amadeus me permitió conseguir trabajo en 3 meses. La plataforma es muy intuitiva y los docentes responden todas las dudas."',
                  name: "María Laura Díaz",
                  role: "Agente de Viajes · Córdoba",
                  avatar: "ML",
                  color: "bg-[#DD4913]",
                },
                {
                  quote:
                    '"Como socio de ACAV el precio es excelente. El certificado tiene peso real en las entrevistas. Lo recomiendo a todos los del sector."',
                  name: "Roberto Casas",
                  role: "Agente Senior · Villa María",
                  avatar: "RC",
                  color: "bg-[#31456F]",
                },
                {
                  quote:
                    '"La sección de materiales y el calendario de clases en vivo hacen que nunca te pierdas nada. Muy organizado y profesional."',
                  name: "Florencia Castro",
                  role: "Coordinadora · Río Cuarto",
                  avatar: "FC",
                  color: "bg-[#1B2B50]",
                },
              ].map((item) => (
                <MotionStaggerItem
                  key={item.name}
                  className="rounded-[14px] border border-slate-200 bg-white p-[26px]"
                >
                  <div className="mb-3 flex items-center gap-1 text-[#DD4913]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <div className="mb-[18px] text-[0.85rem] italic leading-[1.65] text-slate-600">{item.quote}</div>
                  <div className="flex items-center gap-[10px]">
                    <div className={`flex h-[38px] w-[38px] items-center justify-center rounded-full text-sm font-extrabold text-white ${item.color}`}>
                      {item.avatar}
                    </div>
                    <div>
                      <div className="text-[0.85rem] font-bold text-[#1B2B50]">{item.name}</div>
                      <div className="text-[0.72rem] text-slate-500">{item.role}</div>
                    </div>
                  </div>
                </MotionStaggerItem>
              ))}
            </MotionStagger>
          </div>
        </section>
      </main>
    </PublicCoursesShell>
  );
}
