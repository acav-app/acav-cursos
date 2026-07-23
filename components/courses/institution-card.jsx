import Link from "next/link";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";
import { Skeleton } from "@/components/ui/skeleton";

export function CompanyCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-7">
      <Skeleton className="h-16 w-16 rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-2/3 rounded-lg" />
        <Skeleton className="h-4 w-full rounded-lg" />
        <Skeleton className="h-4 w-5/6 rounded-lg" />
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    </div>
  );
}

export default function CompanyCard({ company, lang, vacancies = 0 }) {
  const logoUrl = company?.logoUrl ? normalizePublicR2Url(company.logoUrl) : "";
  const initials = String(company?.name || "AC")
    .slice(0, 2)
    .toUpperCase();
  const vacanciesLabel = vacancies > 0 ? `${vacancies} curso${vacancies === 1 ? "" : "s"} activo${vacancies === 1 ? "" : "s"}` : "Sin cursos activos";

  return (
    <Link
      href={`/${lang}/instituciones/${company.slug}`}
      className="group flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-7 transition hover:-translate-y-1 hover:border-[#31456F] hover:shadow-[0_6px_24px_rgba(27,43,80,.13)]"
    >
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-2xl font-extrabold text-[#1B2B50]">
        {logoUrl ? <img src={logoUrl} alt={company?.name || "Institucion"} className="h-full w-full object-contain bg-white" /> : initials}
      </div>

      <div className="min-w-0">
        <div className="text-base font-extrabold text-[#1B2B50]">{company?.name || "Institucion"}</div>
        {company?.description ? <div className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{company.description}</div> : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-[#31456F]">{vacanciesLabel}</span>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm text-slate-600 transition group-hover:border-[#1B2B50] group-hover:bg-[#1B2B50] group-hover:text-white">
          →
        </span>
      </div>
    </Link>
  );
}
