"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { useLocalizedPath } from "@/lib/utils";
import CourseForum from "@/components/courses/course-forum";

export default function CursoForoPage({ params: { id } }) {
  const buildLocalizedPath = useLocalizedPath();
  const { user } = useAuth();
  const { actor } = useCourseActor();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function loadCourse() {
      if (!user || !id) return;
      setLoading(true);
      try {
        const data = await authedFetch(user, `/api/courses/${id}`, { method: "GET" });
        if (alive) setCourse(data?.course || null);
      } catch (_) {
        if (alive) setCourse(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadCourse();
    return () => {
      alive = false;
    };
  }, [user, id]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" asChild className="rounded-2xl">
          <Link href={buildLocalizedPath(`/dashboard/cursos/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al curso
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-10 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cargando curso...
        </div>
      ) : (
        <>
          {course?.title ? (
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {course.title}
            </h1>
          ) : null}
          {user ? <CourseForum courseId={id} user={user} actor={actor} /> : null}
        </>
      )}
    </div>
  );
}
