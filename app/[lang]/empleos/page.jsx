import PublicCoursesHome from "@/components/courses/public-home";
import {
  getPublicCourseSettings,
  getPublicCourseStats,
  getPublicCourses,
  getPublicInstitutions,
  mapCourseForCard,
  mapCourseHistory,
} from "@/lib/courses/public";

export const metadata = {
  title: "Cursos",
};

export default async function EmpleosPage({ params: { lang } }) {
  const [settings, jobs, companies, history, publicStats] = await Promise.all([
    getPublicCourseSettings(),
    getPublicCourses({ scope: "active" }),
    getPublicInstitutions(),
    getPublicCourses({ scope: "history" }),
    getPublicCourseStats(),
  ]);

  return (
    <PublicCoursesHome
      lang={lang}
      settings={settings}
      activeJobs={jobs.map(mapCourseForCard)}
      companies={companies}
      historyJobs={history.map(mapCourseHistory)}
      liveStats={{
        companies: companies.length,
        activeJobs: jobs.length,
        applications: publicStats.enrollments,
      }}
    />
  );
}
