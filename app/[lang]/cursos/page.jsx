import CourseCatalogPage from "@/components/courses/catalog-page";
import {
  getPublicCourseSettings,
  getPublicCourseStats,
  getPublicCourses,
  getPublicInstitutions,
  mapCourseForCard,
} from "@/lib/courses/public";

export const metadata = {
  title: "Cursos",
};

export default async function CursosPage({ params: { lang } }) {
  const [settings, courses, institutions, publicStats] = await Promise.all([
    getPublicCourseSettings(),
    getPublicCourses({ scope: "active" }),
    getPublicInstitutions(),
    getPublicCourseStats(),
  ]);

  return (
    <CourseCatalogPage
      lang={lang}
      settings={settings}
      activeJobs={courses.map(mapCourseForCard)}
      liveStats={{
        companies: institutions.length,
        activeJobs: courses.length,
        applications: publicStats.enrollments,
      }}
    />
  );
}
