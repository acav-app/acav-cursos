"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, Clock3, GraduationCap, Info, MapPin, Star } from "lucide-react";
import CourseEnrollButton from "@/components/courses/course-enroll-button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getCourseCatalogMeta,
  getCourseCatalogStatus,
} from "@/lib/courses/catalog-utils.mjs";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

const STATUS_STYLES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
};

export function JobCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-[28px] border border-[#DCE6F4] bg-white shadow-[0_18px_44px_rgba(27,43,80,0.05)]">
      <Skeleton className="h-[200px] w-full rounded-none" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="h-7 w-4/5 rounded-xl" />
        <Skeleton className="h-4 w-full rounded-xl" />
        <Skeleton className="h-4 w-3/4 rounded-xl" />
        <div className="grid gap-2">
          <Skeleton className="h-4 w-1/2 rounded-xl" />
          <Skeleton className="h-4 w-2/3 rounded-xl" />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
    </article>
  );
}

export default function CourseCard({ job, lang }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const applyHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("inscribirse", String(job?.id || ""));
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [job?.id, pathname, searchParams]);
  const category = String(job?.categoryLabel || "").trim();
  const secondaryCategory = String(job?.secondaryCategoryLabel || "").trim();
  const modality = String(job?.modalityLabel || "").trim();
  const contractType = String(job?.contractTypeLabel || "").trim();
  const city = String(job?.city || "").trim();
  const imageUrl = normalizePublicR2Url(job?.imageUrl || job?.flyerUrl || "");
  const meta = getCourseCatalogMeta(job);
  const status = getCourseCatalogStatus(job);
  const metaItems = [secondaryCategory || meta.category, modality || meta.modality, contractType || meta.level].filter(Boolean);
  const statusClassName = STATUS_STYLES[status.tone] || STATUS_STYLES.green;

  return (
    <article className="group overflow-hidden rounded-[28px] border border-[#DCE6F4] bg-white transition duration-500 hover:-translate-y-1 hover:border-[#C3D2E8] hover:shadow-[0_22px_48px_rgba(27,43,80,0.11)]">
      <div className="relative h-[200px] overflow-hidden bg-[linear-gradient(135deg,#15203B,#1B2B50)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={job?.title || ""}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
        ) : null}
        {!imageUrl ? <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(21,32,59,.94),rgba(49,69,111,.84))]" /> : null}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <span className={`rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] ${statusClassName}`}>
            {status.label}
          </span>
          {job?.isNew ? (
            <span className="rounded-full bg-[#DD4913] px-3 py-1 text-[11px] font-extrabold text-white shadow-[0_10px_24px_rgba(221,73,19,0.25)]">
              Nuevo
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          {category ? <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#DD4913]">{category}</div> : <div />}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6F4] text-[#5B6D93] transition hover:border-[#C3D2E8] hover:bg-[#F8FBFF] hover:text-[#1B2B50]"
                  aria-label="Ver detalles rápidos"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent color="secondary" className="max-w-xs text-sm leading-6">
                {meta.description}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Link href={`/${lang}/cursos/${job.slug}`} className="mt-2 block">
          <div className="text-xl font-black leading-[1.25] tracking-tight text-[#1B2B50] transition group-hover:text-[#15203B]">
            {job?.title}
          </div>
        </Link>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          {meta.description}
        </p>

        {job?.companyName || city ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-slate-500">
            {(job?.companyName || meta.instructor) ? (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                {job?.companyName || meta.instructor}
              </span>
            ) : null}
            {city ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {city}
              </span>
            ) : null}
          </div>
        ) : null}

        {metaItems.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {metaItems.map((item) => (
              <span key={item} className="rounded-full border border-[#E2EAF6] bg-[#F8FBFF] px-3 py-1 text-[11px] font-bold text-[#5B6D93]">
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 rounded-[22px] border border-[#E8EEF8] bg-[#FBFDFF] p-4">
          <div className="grid gap-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#5B6D93]" />
                Duración
              </span>
              <span className="font-semibold text-[#1B2B50]">{meta.duration}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <Star className="h-4 w-4 text-[#DD4913]" />
                Calificación
              </span>
              <span className="font-semibold text-[#1B2B50]">{meta.ratingLabel}</span>
            </div>
            {job?.publishedLabel ? (
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[#5B6D93]" />
                  Publicación
                </span>
                <span className="font-semibold text-[#1B2B50]">{job.publishedLabel}</span>
              </div>
            ) : null}
          </div>

          {typeof meta.progressValue === "number" ? (
            <div className="rounded-[18px] border border-[#E2EAF6] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-[#1B2B50]">Progreso</span>
                <span className="text-[#5B6D93]">{meta.progressValue}%</span>
              </div>
              <Progress value={meta.progressValue} size="sm" className="mt-3 bg-[#E9F0FB]" />
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
          <div className="min-h-[20px] text-[11px] font-medium text-slate-400">
            {job?.expiresLabel || ""}
          </div>
          <CourseEnrollButton
            lang={lang}
            jobId={job?.id}
            slug={job?.slug}
            href={applyHref}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#1B2B50] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#15203B]"
            appliedClassName="inline-flex items-center gap-1.5 rounded-full border border-[#D0DAEA] bg-[#EEF4FF] px-5 py-2.5 text-xs font-extrabold text-[#1B2B50]"
            loadingClassName="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-5 py-2.5 text-xs font-extrabold text-slate-500"
            checkingLabel=""
            defaultLabel="Inscribirme"
          />
        </div>
      </div>
    </article>
  );
}
