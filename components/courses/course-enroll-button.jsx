"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { authedFetch } from "@/lib/auth/authed-fetch";
import { cn } from "@/lib/utils";

export const APPLICATION_CREATED_EVENT = "course-enrollment-created";

export default function CourseEnrollButton({
  lang,
  jobId,
  slug,
  href,
  className,
  appliedClassName,
  loadingClassName,
  defaultLabel = "Inscribirme ahora",
  appliedLabel = "Ya inscripto",
  checkingLabel = "",
  scroll = false,
}) {
  const { user, loading: authLoading } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [checking, setChecking] = useState(false);

  const applyPath = useMemo(() => {
    return href || `/${lang}/cursos/${slug}?inscribirse=${jobId}`;
  }, [href, jobId, lang, slug]);

  const resolvedHref = useMemo(() => {
    if (user) return applyPath;
    const registerParams = new URLSearchParams({ redirect: applyPath });
    return `/${lang}/auth/register?${registerParams.toString()}`;
  }, [applyPath, lang, user]);

  const actorRole = String(actor?.role || "").trim();
  const isStudent = actorRole === "alumno";
  const isAdmin = actorRole === "admin";
  const shouldCheck = Boolean(user) && isStudent && Boolean(jobId);

  useEffect(() => {
    let alive = true;

    async function loadStatus() {
      if (!shouldCheck) {
        setAlreadyApplied(false);
        setChecking(false);
        return;
      }

      setChecking(true);
      try {
      const data = await authedFetch(user, `/api/enrollments?courseId=${encodeURIComponent(jobId)}`, { method: "GET" });
        if (!alive) return;
        setAlreadyApplied(Array.isArray(data?.enrollments) && data.enrollments.length > 0);
      } catch {
        if (!alive) return;
        setAlreadyApplied(false);
      } finally {
        if (!alive) return;
        setChecking(false);
      }
    }

    if (authLoading || actorLoading) return;
    loadStatus();

    return () => {
      alive = false;
    };
  }, [actor?.role, actorLoading, authLoading, jobId, shouldCheck, user]);

  useEffect(() => {
    const handleCreated = (event) => {
      const createdJobId = String(event?.detail?.courseId || event?.detail?.jobId || "").trim();
      if (createdJobId && createdJobId === String(jobId || "").trim()) {
        setAlreadyApplied(true);
        setChecking(false);
      }
    };

    window.addEventListener(APPLICATION_CREATED_EVENT, handleCreated);
    return () => {
      window.removeEventListener(APPLICATION_CREATED_EVENT, handleCreated);
    };
  }, [jobId]);

  if (authLoading || (Boolean(user) && actorLoading) || checking) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[16px] border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-500",
          loadingClassName || className
        )}
        aria-disabled="true"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {checkingLabel}
      </span>
    );
  }

  if (alreadyApplied) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[16px] border border-slate-300 bg-slate-200 px-5 py-3 text-sm font-extrabold text-slate-600",
          appliedClassName || className
        )}
        aria-disabled="true"
      >
        <CheckCircle2 className="h-4 w-4" />
        {appliedLabel}
      </span>
    );
  }

  if (user && isAdmin) {
    return (
      <Link href={`/${lang}/dashboard`} scroll={scroll} className={className}>
        Ir al panel
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <Link href={resolvedHref} scroll={scroll} className={className}>
      {defaultLabel}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
