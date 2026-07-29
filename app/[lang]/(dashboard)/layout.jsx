"use client";
import DashBoardLayoutProvider from "@/provider/dashboard.layout.provider";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DashboardLayoutSkeleton } from "@/components/courses/dashboard/page-skeletons";

const Layout = ({ children, params: { lang } }) => {
  const { user, loading } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
  const router = useRouter();
  const isDashboardActor = actor?.role === "admin" || actor?.role === "alumno";

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${lang}/auth/login`);
    }
  }, [user, loading, router, lang]);

  useEffect(() => {
    if (!loading && user && !actorLoading && actor && !isDashboardActor) {
      router.replace(`/${lang}`);
    }
  }, [actor, actorLoading, isDashboardActor, lang, loading, router, user]);

  if (loading || !user || actorLoading || (user && actor && !isDashboardActor)) {
    return <DashboardLayoutSkeleton />;
  }

  // Puedes agregar aquí la lógica de traducción si lo necesitas
  return (
    <DashBoardLayoutProvider>{children}</DashBoardLayoutProvider>
  );
};

export default Layout;
