"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Filter,
  GraduationCap,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import CourseCard, { JobCardSkeleton } from "@/components/courses/job-card";
import EmptyState from "@/components/courses/empty-state";
import PublicCoursesShell from "@/components/courses/public-shell";
import { MotionHoverCard, MotionReveal, MotionStagger, MotionStaggerItem } from "@/components/courses/public-motion";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildCatalogOptions,
  filterCourses,
  getCourseCatalogMeta,
} from "@/lib/courses/catalog-utils.mjs";

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="max-w-3xl">
      <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
        <span className="h-0.5 w-6 rounded bg-[#DD4913]" />
        {eyebrow}
      </div>
      <h1 className="mt-4 text-[1.3rem] font-medium leading-[1.14] tracking-[-0.02em] text-[#1B2B50] md:text-[1.65rem]">
        {title}
      </h1>
      <p className="mt-3 text-[14px] leading-6 text-slate-600 md:text-[15px] md:leading-7">
        {description}
      </p>
    </div>
  );
}

function FilterSelect({ label, value, onValueChange, options, allLabel }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6D93]">
        {label}
      </span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-12 rounded-2xl border-[#D9E3F3] bg-white text-left text-sm font-medium text-[#1B2B50] shadow-none">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export default function CourseCatalogPage({ lang, settings, activeJobs, liveStats }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [modality, setModality] = useState("all");
  const [institution, setInstitution] = useState("all");
  const [level, setLevel] = useState("all");
  const [status, setStatus] = useState("all");

  const courses = useMemo(() => (Array.isArray(activeJobs) ? activeJobs : []), [activeJobs]);
  const catalogOptions = useMemo(() => buildCatalogOptions(courses), [courses]);
  const filteredCourses = useMemo(
    () =>
      filterCourses(courses, {
        query,
        category: category === "all" ? "todas" : category,
        modality: modality === "all" ? "todas" : modality,
        institution: institution === "all" ? "todas" : institution,
        level: level === "all" ? "todos" : level,
        status: status === "all" ? "todos" : status,
      }),
    [category, courses, institution, level, modality, query, status]
  );

  const highlightedCourse = filteredCourses[0] || courses[0] || null;
  const highlightMeta = highlightedCourse ? getCourseCatalogMeta(highlightedCourse) : null;
  const hasDataIssues = courses.some((course) => !course?.title || (!course?.shortDescription && !course?.description));

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="bg-[linear-gradient(180deg,#F5F8FD_0%,#FFFFFF_34%,#F8FBFF_100%)] pt-[88px]">

        <section id="catalogo" className="px-6 pb-20">
          <div className="mx-auto max-w-[1240px]">
            <MotionReveal className="rounded-[32px] border border-[#D9E3F3] bg-white p-5 shadow-[0_18px_50px_rgba(21,32,59,0.06)] md:p-6">
              <div className="flex flex-col gap-6">
                {hasDataIssues ? (
                  <div className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Algunos cursos siguen llegando con información incompleta desde el backend. La vista ya prioriza los campos disponibles y evita silencios vacíos.
                    </span>
                  </div>
                ) : null}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#DD4913]">
                      <Filter className="h-3.5 w-3.5" />
                      Búsqueda inteligente
                    </div>
                    <h2 className="mt-3 text-[1.1rem] font-medium leading-[1.14] tracking-[-0.02em] text-[#1B2B50] md:text-[1.25rem]">
                      Encuentra el curso correcto en segundos
                    </h2>
                    <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-600">
                      Filtra por categoría, modalidad, academia, nivel y estado para navegar el catálogo con mayor precisión.
                    </p>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#DCE6F4] bg-[#F8FBFF] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#5B6D93]">
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          {filteredCourses.length} resultado{filteredCourses.length === 1 ? "" : "s"}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent color="secondary" className="max-w-xs">
                        Los filtros combinan coincidencias por texto, academia, modalidad, nivel y estado visual del curso.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
                  <label className="flex flex-col gap-2 xl:col-span-1">
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B6D93]">
                      Buscar
                    </span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B6D93]" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Título, instructor, duración o categoría"
                        className="h-12 rounded-2xl border-[#D9E3F3] bg-white pl-11 text-sm text-[#1B2B50] shadow-none placeholder:text-slate-400"
                      />
                    </div>
                  </label>
                  <FilterSelect
                    label="Categoría"
                    value={category}
                    onValueChange={setCategory}
                    options={catalogOptions.categories}
                    allLabel="Todas"
                  />
                  <FilterSelect
                    label="Modalidad"
                    value={modality}
                    onValueChange={setModality}
                    options={catalogOptions.modalities}
                    allLabel="Todas"
                  />
                  <FilterSelect
                    label="Academia"
                    value={institution}
                    onValueChange={setInstitution}
                    options={catalogOptions.institutions}
                    allLabel="Todas"
                  />
                  <FilterSelect
                    label="Nivel"
                    value={level}
                    onValueChange={setLevel}
                    options={catalogOptions.levels}
                    allLabel="Todos"
                  />
                  <FilterSelect
                    label="Estado"
                    value={status}
                    onValueChange={setStatus}
                    options={catalogOptions.statuses}
                    allLabel="Todos"
                  />
                </div>
              </div>
            </MotionReveal>

            {!Array.isArray(activeJobs) ? (
              <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <JobCardSkeleton key={index} />
                ))}
              </div>
            ) : filteredCourses.length ? (
              <MotionStagger className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredCourses.map((job) => (
                  <MotionStaggerItem key={job.id}>
                    <MotionHoverCard>
                      <CourseCard job={job} lang={lang} />
                    </MotionHoverCard>
                  </MotionStaggerItem>
                ))}
              </MotionStagger>
            ) : (
              <MotionReveal className="mt-8">
                <EmptyState
                  title="No encontramos cursos con esos filtros."
                  description="Cambia la búsqueda o restablece filtros para volver a explorar el catálogo completo."
                />
              </MotionReveal>
            )}
          </div>
        </section>
      </main>
    </PublicCoursesShell>
  );
}
