"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { authedFetch, asArray } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import { DashboardPageShellSkeleton } from "@/components/courses/dashboard/page-skeletons";

function uniqueCoursesById(list) {
  const seen = new Map();
  for (const item of list) {
    const id = String(item?.id || "").trim();
    if (id && !seen.has(id)) seen.set(id, item);
  }
  return Array.from(seen.values());
}

export default function ForoIndexPage() {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!user || !actor) return;
      setLoading(true);
      try {
        if (actor.role === "admin") {
          const data = await authedFetch(user, "/api/courses", { method: "GET" });
          if (!alive) return;
          setCourses(asArray(data?.courses));
        } else {
          const data = await authedFetch(user, "/api/enrollments", { method: "GET" });
          if (!alive) return;
          const items = asArray(data?.enrollments || data?.data || data);
          const mapped = items
            .filter((item) => String(item?.status || "").trim().toLowerCase() === "active")
            .map((item) => ({
              id: item?.courseId || item?.jobId,
              title: item?.courseTitle || item?.jobTitle || "Curso",
              institutionName: item?.institutionName || item?.companyName || "",
            }));
          setCourses(uniqueCoursesById(mapped));
        }
      } catch (_) {
        if (alive) setCourses([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [user, actor]);

  if (loading || actorLoading) {
    return <DashboardPageShellSkeleton />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[#F1F5F9] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#334155]">
          <MessagesSquare className="h-3 w-3" />
          Foro
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
          Elegí un curso para ver su foro
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Cada curso tiene su propio espacio de comunidad para preguntas y respuestas.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          {actor?.role === "admin"
            ? "Todavía no hay cursos cargados."
            : "Todavía no tenés cursos con inscripción activa."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={buildLocalizedPath(`/dashboard/foro/${course.id}`)}
              className="rounded-[22px] border border-slate-200 bg-white p-4 transition hover:border-[#6D4CFF]/40 hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-slate-950">
                    {course.title || "Curso"}
                  </h2>
                  {course.institutionName ? (
                    <p className="mt-1 truncate text-xs text-slate-500">{course.institutionName}</p>
                  ) : null}
                </div>
                <Badge variant="soft" color="secondary" className="shrink-0 rounded-full">
                  Ver foro
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
