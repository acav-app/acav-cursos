import InstitutionCard from "@/components/courses/institution-card";
import EmptyState from "@/components/courses/empty-state";
import PublicResourcesSection from "@/components/courses/public-resources-section";
import PublicCoursesShell from "@/components/courses/public-shell";
import { getPublicCourseSettings, getPublicCourses, getPublicInstitutions, mapCourseForCard } from "@/lib/courses/public";

export const metadata = {
  title: "Instituciones",
};

export default async function EmpresasPage({ params: { lang } }) {
  const [settings, companies, jobs] = await Promise.all([
    getPublicCourseSettings(),
    getPublicInstitutions(),
    getPublicCourses({ scope: "active" }),
  ]);

  const activeJobs = jobs.map(mapCourseForCard);
  const vacanciesByCompanyId = new Map();
  activeJobs.forEach((job) => {
    const companyId = String(job?.companyId || "");
    if (!companyId) return;
    vacanciesByCompanyId.set(companyId, (vacanciesByCompanyId.get(companyId) || 0) + 1);
  });

  const companyCount = companies.length;
  const vacancyCount = activeJobs.length;
  const citiesCount = new Set(companies.map((company) => String(company?.city || "").trim()).filter(Boolean)).size;
  const subRubrosCount = new Set(companies.map((company) => String(company?.subRubro || "").trim()).filter(Boolean)).size;

  const eyebrow = `${companyCount} institucion${companyCount === 1 ? "" : "es"} activa${companyCount === 1 ? "" : "s"}`;
  const title = `${companyCount} institucion${companyCount === 1 ? "" : "es"} publicada${companyCount === 1 ? "" : "s"} en ACAV Cursos`;
  const description = vacancyCount
    ? `${vacancyCount} curso${vacancyCount === 1 ? "" : "s"} activo${vacancyCount === 1 ? "" : "s"} distribuido${vacancyCount === 1 ? "" : "s"} en ${citiesCount || 0} ciudad${citiesCount === 1 ? "" : "es"} y ${subRubrosCount || 0} categoria${subRubrosCount === 1 ? "" : "s"}.`
    : `Actualmente hay ${companyCount} institucion${companyCount === 1 ? "" : "es"} visible${companyCount === 1 ? "" : "s"} en el portal y ${subRubrosCount || 0} categoria${subRubrosCount === 1 ? "" : "s"} representada${subRubrosCount === 1 ? "" : "s"}.`;
  const emptyTitle = `${companyCount} instituciones activas en el portal`;
  const emptyDescription = `Las nuevas instituciones aparecerán automáticamente cuando publiquen cursos visibles en el frente público.`;

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="bg-slate-50 pt-[68px]">
        <section className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
              <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
              {eyebrow}
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#1B2B50]">
              {title}
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-600">
              {description}
            </p>
          </div>

          {companies.length ? (
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {companies.map((company) => (
                <InstitutionCard
                  key={company.id}
                  company={company}
                  lang={lang}
                  vacancies={vacanciesByCompanyId.get(String(company.id)) || 0}
                />
              ))}
            </div>
          ) : (
            <div className="mt-12">
              <EmptyState title={emptyTitle} description={emptyDescription} />
            </div>
          )}
        </section>

        <section className="mx-auto max-w-[1180px] px-6 pb-20">
          <PublicResourcesSection
            lang={lang}
            eyebrow="Informacion para alumnos"
            title="Contenido util para elegir mejor tu proxima capacitacion"
            description="Aunque aqui explores instituciones, tambien puedes acceder a guias practicas para planificar mejor tu formacion y aprovechar el campus."
          />
        </section>
      </main>
    </PublicCoursesShell>
  );
}
