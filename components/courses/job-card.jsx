"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, BarChart3, Bookmark, Check, Clock3, MonitorPlay } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCourseCatalogMeta,
  getCourseCatalogStatus,
} from "@/lib/courses/catalog-utils.mjs";
import { readSavedCourses, writeSavedCourses } from "@/lib/courses/client/saved-courses";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

const STATUS_STYLES = {
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-600",
};

function CourseMetaItem({ icon: Icon, label }) {
  if (!label) return null;

  return (
    <div className="flex items-center gap-2 text-[13px] font-medium text-[#5C647A]">
      <Icon className="h-4 w-4 shrink-0 text-[#7B8298]" />
      <span className="truncate">{label}</span>
    </div>
  );
}

export function JobCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-[34px] border border-black/5 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.08)]">
      <Skeleton className="h-[240px] w-full rounded-none" />
      <div className="space-y-5 p-7">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-3/4 rounded-2xl" />
        <Skeleton className="h-4 w-full rounded-xl" />
        <Skeleton className="h-4 w-5/6 rounded-xl" />
        <div className="border-t border-black/6 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 gap-4">
              <Skeleton className="h-5 w-16 rounded-xl" />
              <Skeleton className="h-5 w-24 rounded-xl" />
              <Skeleton className="h-5 w-28 rounded-xl" />
            </div>
            <Skeleton className="h-14 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CourseCard({ job, lang }) {
  const [saved, setSaved] = useState(false);
  const imageUrl = normalizePublicR2Url(job?.imageUrl || job?.flyerUrl || "");
  const meta = getCourseCatalogMeta(job);
  const status = getCourseCatalogStatus(job);
  const detailHref = `/${lang}/cursos/${job.slug}`;
  const statusClassName = STATUS_STYLES[status.tone] || STATUS_STYLES.green;
  const categoryLabel = String(job?.categoryLabel || meta.category || "").trim();
  const savePayload = useMemo(
    () => ({
      id: job?.id || "",
      slug: job?.slug || "",
      title: job?.title || "Curso",
      companyName: job?.institutionName || job?.companyName || "",
      city: job?.city || "",
      savedAt: new Date().toISOString(),
    }),
    [job?.city, job?.companyName, job?.id, job?.institutionName, job?.slug, job?.title]
  );

  useEffect(() => {
    const syncSavedState = () => {
      const items = readSavedCourses();
      setSaved(items.some((item) => String(item?.id || "") === String(savePayload.id || "")));
    };

    syncSavedState();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", syncSavedState);
      return () => window.removeEventListener("storage", syncSavedState);
    }
  }, [savePayload.id]);

  const handleSave = () => {
    const items = readSavedCourses();
    const exists = items.some((item) => String(item?.id || "") === String(savePayload.id || ""));

    if (exists) {
      const next = items.filter((item) => String(item?.id || "") !== String(savePayload.id || ""));
      writeSavedCourses(next);
      setSaved(false);
      toast("Curso removido de guardados");
      return;
    }

    writeSavedCourses([savePayload, ...items.filter((item) => String(item?.id || "") !== String(savePayload.id || ""))]);
    setSaved(true);
    toast.success("Curso guardado");
  };

  return (
    <article className="group overflow-hidden rounded-[34px] border border-black/5 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.08)] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_34px_90px_rgba(15,23,42,0.12)]">
      <div className="relative h-[240px] overflow-hidden bg-[#F4F1EC]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={job?.title || ""}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-contain transition duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),rgba(236,232,226,0.95)_55%,rgba(225,219,212,0.95))]" />
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-6">
          <span className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] ${statusClassName}`}>
            {status.label}
          </span>

          <button
            type="button"
            onClick={handleSave}
            aria-pressed={saved}
            aria-label="Guardar curso"
            className={[
              "inline-flex h-12 w-12 items-center justify-center rounded-full shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur transition",
              saved
                ? "bg-[#EEF4FF] text-[#1B2B50]"
                : "bg-white/88 text-[#1C254A] hover:bg-white",
            ].join(" ")}
          >
            {saved ? <Check className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="p-7">
        {categoryLabel ? (
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#E36A2F]">
            {categoryLabel}
          </div>
        ) : null}

        <Link href={detailHref} className="mt-4 block">
          <h3 className="text-[1.25rem] font-semibold leading-[1.2] tracking-[-0.03em] text-[#1C254A] transition group-hover:text-[#121A3B] md:text-[1.45rem]">
            {job?.title}
          </h3>
        </Link>

        <p className="mt-4 max-w-[32ch] text-[14px] leading-8 text-[#667089]">
          {meta.description}
        </p>

        <div className="mt-6 border-t border-black/6 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3">
              <CourseMetaItem icon={Clock3} label={meta.duration} />
              <span className="hidden h-6 w-px bg-black/8 md:block" />
              <CourseMetaItem icon={MonitorPlay} label={meta.modality} />
              <span className="hidden h-6 w-px bg-black/8 lg:block" />
              <CourseMetaItem icon={BarChart3} label={meta.level} />
            </div>

            <Link
              href={detailHref}
              aria-label={`Ver ${job?.title || "curso"}`}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1B2552] text-white transition hover:bg-[#121A3B]"
            >
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
