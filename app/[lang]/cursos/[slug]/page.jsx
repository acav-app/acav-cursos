import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Film,
  MapPin,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import FlyerPreviewLightbox from "@/components/courses/flyer-preview-lightbox";
import CourseEnrollButton from "@/components/courses/course-enroll-button";
import CourseDetailActions from "@/components/courses/course-detail-actions";
import { MotionHoverCard, MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/courses/public-motion";
import PublicResourcesSection from "@/components/courses/public-resources-section";
import PublicCoursesShell from "@/components/courses/public-shell";
import { getPublicCourseBySlug, getPublicCourseSettings, getPublicCourses, getPublicInstitutions, mapCourseForCard } from "@/lib/courses/public";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

function CardSection({ icon: Icon, title, children }) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,.04)] md:p-7">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2356B8]">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-[22px] font-extrabold tracking-tight text-[#1B2B50]">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetaBlock({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-[#FBFCFE] p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2356B8]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
          <div className="mt-1 text-sm font-semibold leading-5 text-[#1B2B50]">{value || "No informado"}</div>
        </div>
      </div>
    </div>
  );
}

function parseLines(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-•\u2022]+/, "").trim())
    .filter(Boolean);
}

function parseSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function deriveResponsibilities(course) {
  const descriptionLines = parseLines(course?.description);
  if (descriptionLines.length >= 2) return descriptionLines.slice(1, 6);

  const sentences = parseSentences(course?.description);
  if (sentences.length >= 2) return sentences.slice(1, 6);

  return [];
}

function deriveRequirementList(course) {
  const lines = parseLines(course?.requirements);
  if (lines.length >= 2) return lines;
  return parseSentences(course?.requirements);
}

function deriveBenefits(course) {
  return parseLines(course?.benefits);
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function CursoDetailPage({ params: { lang, slug } }) {
  const [settings, rawCourse] = await Promise.all([getPublicCourseSettings(), getPublicCourseBySlug(slug)]);

  if (!rawCourse) {
    notFound();
  }

  const course = mapCourseForCard(rawCourse);
  const institutions = await getPublicInstitutions();
  const institution = institutions.find((item) => item?.id === course.companyId) || null;
  const institutionLogoUrl = normalizePublicR2Url(institution?.logoUrl || course?.companyLogoUrl || "");
  const flyerUrl = normalizePublicR2Url(course?.flyerUrl || course?.imageUrl || "");
  const relatedCourses = (await getPublicCourses({ area: course.area }))
    .map(mapCourseForCard)
    .filter((item) => item.slug !== slug)
    .slice(0, 3);

  const shortDescription =
    course?.shortDescription ||
    parseSentences(course?.description)[0] ||
    "Una propuesta formativa activa dentro del ecosistema ACAV con una experiencia de inscripcion clara y profesional.";
  const responsibilities = deriveResponsibilities(course);
  const requirementList = deriveRequirementList(course);
  const benefits = deriveBenefits(course);
  const institutionDescription =
    institution?.description ||
    "La institucion forma parte del ecosistema ACAV Cursos y publica propuestas para fortalecer la formacion del sector turistico.";
  const pricingLabel = course?.freeCourse ? "Gratuito" : formatCurrency(course?.price) || "Consultar valor";
  const oldPricingLabel = course?.oldPrice ? formatCurrency(course.oldPrice) : "";
  const learningObjectives = Array.isArray(course?.learningObjectives) ? course.learningObjectives.filter(Boolean) : [];
  const targetAudience = Array.isArray(course?.targetAudience) ? course.targetAudience.filter(Boolean) : [];
  const modules = Array.isArray(course?.modules) ? course.modules.filter((item) => item?.title || item?.description || item?.lessons?.length) : [];
  const attachments = Array.isArray(course?.attachments) ? course.attachments.filter((item) => item?.url && item?.name) : [];
  const modalityLabel = course?.modalityLabel || course?.modality || course?.modalidad || "A definir";
  const durationLabel = course?.durationLabel || course?.duration || course?.contractType || "A definir";
  const academyLabel = course?.instructorName || course?.institutionName || course?.companyName || "ACAV Cursos";

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="bg-[#F5F7FB] pt-[68px]">
        <section className="mx-auto max-w-[1240px] px-6 py-10 md:py-12">
          <MotionReveal className="mb-5">
            <Link
              href={`/${lang}/cursos`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#31456F] transition hover:text-[#1B2B50]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a cursos
            </Link>
          </MotionReveal>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <MotionStagger className="space-y-4">
              <MotionStaggerItem>
                <section className="rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,.04)] md:p-7">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#2356B8]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2356B8]" />
                    Detalle del curso
                  </div>

                  <h1 className="mt-4 text-[38px] font-extrabold tracking-tight text-[#1B2B50] md:text-[48px]">{course.title}</h1>
                  <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-600">{shortDescription}</p>

                  <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <MetaBlock icon={Building2} label="Instructor / academia" value={academyLabel} />
                    <MetaBlock icon={MapPin} label="Modalidad / sede" value={course.city || modalityLabel} />
                    <MetaBlock icon={Briefcase} label="Modalidad" value={modalityLabel} />
                    <MetaBlock icon={Clock3} label="Duración" value={durationLabel} />
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <CourseEnrollButton
                      lang={lang}
                      jobId={course.id}
                      slug={course.slug}
                      scroll={false}
                      className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#1B2B50] px-6 py-3 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(13,43,100,.14)] transition duration-500 hover:-translate-y-1 hover:bg-[#133778]"
                      appliedClassName="inline-flex items-center justify-center gap-2 rounded-[16px] border border-slate-300 bg-slate-200 px-6 py-3 text-sm font-extrabold text-slate-600"
                      loadingClassName="inline-flex items-center justify-center gap-2 rounded-[16px] border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-extrabold text-slate-500"
                    />
                    <CourseDetailActions job={course} />
                  </div>
                </section>
              </MotionStaggerItem>

              <CardSection icon={FileText} title="Descripción del curso">
                <div className="space-y-4 text-[15px] leading-8 text-slate-600">
                  {parseLines(course.description).length > 1
                    ? parseLines(course.description).map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                    : <p>{course.description}</p>}
                </div>
              </CardSection>

              {learningObjectives.length ? (
                <MotionStaggerItem>
                  <CardSection icon={Sparkles} title="¿Qué aprenderás?">
                    <ul className="grid gap-3 text-[15px] leading-7 text-slate-600 md:grid-cols-2">
                      {learningObjectives.map((item) => (
                        <li key={item} className="flex gap-3">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#2356B8]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}

              {responsibilities.length ? (
                <MotionStaggerItem>
                  <CardSection icon={Briefcase} title="Programa y objetivos">
                    <ul className="grid gap-3 text-[15px] leading-7 text-slate-600">
                      {responsibilities.map((item) => (
                        <li key={item} className="flex gap-3">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#2356B8]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}

              {modules.length ? (
                <MotionStaggerItem>
                  <CardSection icon={FileText} title="Módulos del curso">
                    <div className="grid gap-4">
                      {modules.map((module, index) => (
                        <div key={module.id || `${module.title}-${index}`} className="rounded-[20px] border border-slate-200 bg-[#FBFCFE] p-5">
                          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            Módulo {index + 1}
                          </div>
                          <h3 className="mt-2 text-lg font-bold text-[#1B2B50]">{module.title}</h3>
                          {module.description ? (
                            <p className="mt-2 text-sm leading-7 text-slate-600">{module.description}</p>
                          ) : null}
                          {Array.isArray(module.lessons) && module.lessons.filter(Boolean).length ? (
                            <ul className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
                              {module.lessons.filter(Boolean).map((lesson) => (
                                <li key={lesson} className="flex gap-3">
                                  <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2356B8]" />
                                  <span>{lesson}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}

              <MotionStaggerItem>
                <CardSection icon={ShieldCheck} title="Requisitos y alcance">
                  {requirementList.length ? (
                    <ul className="grid gap-3 text-[15px] leading-7 text-slate-600">
                      {requirementList.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2356B8]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[15px] leading-8 text-slate-600">{course.requirements}</p>
                  )}
                </CardSection>
              </MotionStaggerItem>

              {targetAudience.length ? (
                <MotionStaggerItem>
                  <CardSection icon={BadgeCheck} title="¿A quién está dirigido?">
                    <ul className="grid gap-3 text-[15px] leading-7 text-slate-600">
                      {targetAudience.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2356B8]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}

              {benefits.length ? (
                <MotionStaggerItem>
                  <CardSection icon={BadgeCheck} title="Beneficios incluidos">
                    <ul className="grid gap-3 text-[15px] leading-7 text-slate-600 md:grid-cols-2">
                      {benefits.map((item) => (
                        <li key={item} className="flex gap-3">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#2356B8]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}

              {course?.videoUrl ? (
                <MotionStaggerItem>
                  <CardSection icon={Film} title="Video de presentación">
                    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-[#0F172A]">
                      <video
                        controls
                        preload="metadata"
                        className="aspect-video w-full bg-black"
                        src={course.videoUrl}
                      />
                    </div>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}

              <MotionStaggerItem>
                <CardSection icon={Building2} title="Sobre la institución">
                  <div className="rounded-[20px] border border-slate-200 bg-[#FBFCFE] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-white">
                        {institutionLogoUrl ? (
                          <img src={institutionLogoUrl} alt={`Logo de ${course.companyName}`} className="h-full w-full object-contain p-2.5" />
                        ) : (
                          <Building2 className="h-8 w-8 text-[#1B2B50]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-bold text-[#1B2B50]">{course.companyName}</div>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{institutionDescription}</p>
                        {institution?.slug ? (
                          <Link
                            href={`/${lang}/instituciones/${institution.slug}`}
                            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#31456F] transition hover:text-[#1B2B50]"
                          >
                            Ver perfil de la institución
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardSection>
              </MotionStaggerItem>

              {attachments.length ? (
                <MotionStaggerItem>
                  <CardSection icon={FileText} title="Archivos adicionales">
                    <div className="grid gap-3">
                      {attachments.map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-4 rounded-[18px] border border-slate-200 bg-[#FBFCFE] px-4 py-3 text-sm font-medium text-[#1B2B50] transition hover:border-[#BFD1F2] hover:bg-white"
                        >
                          <span className="truncate">{item.name}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}

              {flyerUrl ? (
                <MotionStaggerItem>
                  <CardSection icon={FileText} title="Programa o ficha del curso">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,.9fr)]">
                      <FlyerPreviewLightbox
                        src={flyerUrl}
                        alt={`Flyer de ${course.title}`}
                        title={`Flyer de ${course.title}`}
                      />
                    </div>
                  </CardSection>
                </MotionStaggerItem>
              ) : null}
            </MotionStagger>

            <MotionStagger className="space-y-4 lg:sticky lg:top-24" delayChildren={0.12}>
              <MotionStaggerItem>
                <section className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,.04)]">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4FF] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#2356B8]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2356B8]" />
                    Inscripción
                  </div>
                  <h2 className="mt-4 text-[28px] font-extrabold tracking-tight text-[#1B2B50]">Inscribite al curso</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Tu inscripcion es rapida, clara y cuidada para que puedas confirmar tu interes sin friccion.
                  </p>

                  <div className="mt-6 rounded-[20px] border border-slate-200 bg-[#FBFCFE] p-5">
                    <div className="grid gap-3 text-sm text-slate-600">
                      <div className="flex items-start gap-3">
                        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-[#1B2B50]" />
                        <span>
                          {pricingLabel}
                          {oldPricingLabel ? ` · Antes ${oldPricingLabel}` : ""}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <PlayCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2356B8]" />
                        <span>{durationLabel}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#F08A00]" />
                        <span>{course.expiresLabel}</span>
                      </div>
                    </div>
                  </div>

                  <CourseEnrollButton
                    lang={lang}
                    jobId={course.id}
                    slug={course.slug}
                    scroll={false}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#1B2B50] px-5 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(13,43,100,.14)] transition duration-500 hover:-translate-y-1 hover:bg-[#133778]"
                    appliedClassName="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-slate-300 bg-slate-200 px-5 py-3.5 text-sm font-extrabold text-slate-600"
                    loadingClassName="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-[16px] border border-slate-200 bg-slate-100 px-5 py-3.5 text-sm font-extrabold text-slate-500"
                  />

                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#7A9FE8]" />
                    Tu información está protegida
                  </div>
                </section>
              </MotionStaggerItem>

              <MotionStaggerItem>
                <PublicResourcesSection
                  lang={lang}
                  variant="sidebar"
                  eyebrow="Guias para alumnos"
                  title="Preparate mejor"
                  description="Accede a guias claras para organizar tu cursado, entender la propuesta y aprovechar mejor el campus."
                />
              </MotionStaggerItem>

              {relatedCourses.length ? (
                <MotionStaggerItem>
                  <section className="rounded-[24px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,.04)]">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">También te puede interesar</div>
                    <h2 className="mt-2 text-xl font-extrabold tracking-tight text-[#1B2B50]">Cursos relacionados</h2>
                    <div className="mt-4 grid gap-3">
                      {relatedCourses.map((item) => (
                        <MotionHoverCard key={item.id}>
                          <Link
                            href={`/${lang}/cursos/${item.slug}`}
                            className="block rounded-[18px] border border-slate-200 bg-[#FBFCFE] p-4 transition duration-500 hover:border-[#BFD1F2] hover:shadow-sm"
                          >
                            <div className="text-sm font-bold text-[#1B2B50]">{item.title}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              {item.companyName} · {item.city}
                            </div>
                          </Link>
                        </MotionHoverCard>
                      ))}
                    </div>
                  </section>
                </MotionStaggerItem>
              ) : null}
            </MotionStagger>
          </div>
        </section>
      </main>
    </PublicCoursesShell>
  );
}
