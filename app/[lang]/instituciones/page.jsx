import InstitutionCard from "@/components/courses/institution-card";
import EmptyState from "@/components/courses/empty-state";
import PublicResourcesSection from "@/components/courses/public-resources-section";
import PublicCoursesShell from "@/components/courses/public-shell";
import { getPublicCourseSettings, getPublicCourses, getPublicInstitutions, mapCourseForCard } from "@/lib/courses/public";

export const metadata = {
  title: "Instituciones",
};

export default async function InstitucionesPage({ params: { lang } }) {
  const [settings, institutions, courses] = await Promise.all([
    getPublicCourseSettings(),
    getPublicInstitutions(),
    getPublicCourses({ scope: "active" }),
  ]);

  const activeCourses = courses.map(mapCourseForCard);
  const vacanciesByInstitutionId = new Map();
  activeCourses.forEach((course) => {
    const institutionId = String(course?.companyId || "");
    if (!institutionId) return;
    vacanciesByInstitutionId.set(institutionId, (vacanciesByInstitutionId.get(institutionId) || 0) + 1);
  });

  const institutionCount = institutions.length;
  const courseCount = activeCourses.length;
  const citiesCount = new Set(institutions.map((institution) => String(institution?.city || "").trim()).filter(Boolean)).size;
  const categoriesCount = new Set(institutions.map((institution) => String(institution?.subRubro || "").trim()).filter(Boolean)).size;

  const eyebrow = `${institutionCount} institucion${institutionCount === 1 ? "" : "es"} activa${institutionCount === 1 ? "" : "s"}`;
  const title = `${institutionCount} institucion${institutionCount === 1 ? "" : "es"} publicada${institutionCount === 1 ? "" : "s"} en ACAV Cursos`;
  const description = courseCount
    ? `${courseCount} curso${courseCount === 1 ? "" : "s"} activo${courseCount === 1 ? "" : "s"} distribuido${courseCount === 1 ? "" : "s"} en ${citiesCount || 0} ciudad${citiesCount === 1 ? "" : "es"} y ${categoriesCount || 0} categoria${categoriesCount === 1 ? "" : "s"}.`
    : `Actualmente hay ${institutionCount} institucion${institutionCount === 1 ? "" : "es"} visible${institutionCount === 1 ? "" : "s"} en el portal y ${categoriesCount || 0} categoria${categoriesCount === 1 ? "" : "s"} representada${categoriesCount === 1 ? "" : "s"}.`;
  const emptyTitle = `${institutionCount} instituciones activas en el portal`;
  const emptyDescription = "Las nuevas instituciones aparecerán automáticamente cuando publiquen cursos visibles en el frente público.";

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main className="bg-slate-50 pt-[68px]">
        <section className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#DD4913]">
              <span className="h-0.5 w-7 rounded bg-[#DD4913]" />
              {eyebrow}
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-[#1B2B50]">{title}</h1>
            <p className="mt-5 text-base leading-7 text-slate-600">{description}</p>
          </div>

          {institutions.length ? (
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {institutions.map((institution) => (
                <InstitutionCard
                  key={institution.id}
                  company={institution}
                  lang={lang}
                  vacancies={vacanciesByInstitutionId.get(String(institution.id)) || 0}
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
