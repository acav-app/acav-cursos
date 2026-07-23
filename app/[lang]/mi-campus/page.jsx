import CampusPageTransition from "@/components/courses/campus-page-transition";
import CampusPortalPanel from "@/components/courses/campus-portal-panel";
import PublicCoursesShell from "@/components/courses/public-shell";
import { getPublicCourseSettings } from "@/lib/courses/public";

export default async function CampusPage({ params: { lang } }) {
  const settings = await getPublicCourseSettings();

  return (
    <PublicCoursesShell lang={lang} settings={settings} navMode="routes">
      <main>
        <CampusPageTransition>
          <CampusPortalPanel lang={lang} view="profile" />
        </CampusPageTransition>
      </main>
    </PublicCoursesShell>
  );
}
