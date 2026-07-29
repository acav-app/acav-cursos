"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CourseCheckoutForm from "@/components/courses/course-checkout-form";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";

const APPLY_PARAMS = ["inscribirse", "postular"];

function mapJobForModal(job) {
  if (!job) return null;
  return {
    ...job,
    modalidad: job?.workMode || job?.initialModality || "",
  };
}

function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded-2xl bg-[linear-gradient(90deg,#EEF2F7_0%,#F8FAFC_50%,#EEF2F7_100%)] bg-[length:200%_100%] ${className}`} />;
}

const SKELETON_STEPS = [
  { title: "Tu perfil", description: "Confirmación de datos" },
  { title: "Pago", description: "Datos bancarios e importe" },
  { title: "Confirmación", description: "Comprobante y envío final" },
];

function ApplicationModalSkeleton({ mobile = false, step = 0 }) {
  const currentStep = Math.max(0, Math.min(step, SKELETON_STEPS.length - 1));
  const progressWidth = `${((currentStep + 1) / SKELETON_STEPS.length) * 100}%`;

  const stepCards = (
    <div className="grid grid-cols-3 gap-3">
      {SKELETON_STEPS.map((item, index) => {
        const active = index === currentStep;
        const completed = index < currentStep;
        return (
          <div
            key={item.title}
            className={[
              "rounded-[18px] border p-3 md:rounded-[22px] md:p-4",
              completed ? "border-emerald-200 bg-emerald-50" : active ? "border-[#CFE0FF] bg-[#EEF5FF]" : "border-[#EEF2F7] bg-[#FBFCFE]",
            ].join(" ")}
          >
            <SkeletonBlock className={`h-9 w-9 rounded-2xl ${completed ? "bg-emerald-200" : active ? "bg-[#D9E8FF]" : ""}`} />
            <SkeletonBlock className={`mt-3 h-4 ${mobile ? "w-4/5" : "w-24"} rounded-full ${active ? "bg-[#D9E8FF]" : ""}`} />
            <SkeletonBlock className={`mt-2 h-3 w-full rounded-full ${active ? "bg-[#E8F1FF]" : ""}`} />
          </div>
        );
      })}
    </div>
  );

  const stepLead = (
    <div className="rounded-[20px] border border-[#E5EAF2] bg-[#FAFBFD] p-5 md:rounded-[24px] md:p-6">
      <div className="flex items-start gap-3 md:gap-4">
        <SkeletonBlock className="h-11 w-11 rounded-2xl md:h-12 md:w-12" />
        <div className="min-w-0 flex-1">
          <SkeletonBlock className="h-3.5 w-24 rounded-full" />
          <SkeletonBlock className="mt-3 h-7 w-2/3 rounded-xl md:h-8 md:w-1/2" />
          <SkeletonBlock className="mt-3 h-4 w-full rounded-full md:w-5/6" />
        </div>
      </div>
    </div>
  );

  const profileFields = (
    <div className={`grid gap-4 ${mobile ? "" : "md:grid-cols-2"}`}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="grid gap-2">
          <SkeletonBlock className={`h-4 rounded-full ${index >= 4 ? "w-28" : "w-24"}`} />
          <SkeletonBlock className="h-12 w-full rounded-[14px]" />
        </div>
      ))}
    </div>
  );

  const cvFields = (
    <div className="grid gap-4 md:gap-5">
      <div className="rounded-[18px] border border-dashed border-[#D6DEEA] bg-[#FCFDFE] p-4 md:rounded-[22px] md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <SkeletonBlock className="h-11 w-11 rounded-2xl md:h-12 md:w-12" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-24 rounded-full" />
              <SkeletonBlock className="h-3 w-40 rounded-full md:w-44" />
            </div>
          </div>
          <SkeletonBlock className="h-10 w-28 rounded-xl md:h-11 md:w-36" />
        </div>
        <div className="mt-4 rounded-[14px] border border-[#E5EAF2] bg-white px-3 py-3 md:rounded-[16px] md:px-4">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-8 w-8 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-2/3 rounded-full" />
              <SkeletonBlock className="h-3 w-24 rounded-full" />
            </div>
            <SkeletonBlock className="h-4 w-4 rounded-full" />
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${mobile ? "" : "md:grid-cols-2"}`}>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="grid gap-2">
            <SkeletonBlock className="h-4 w-32 rounded-full" />
            <SkeletonBlock className="h-12 w-full rounded-[14px]" />
          </div>
        ))}
      </div>

      <div className="rounded-[18px] border border-[#E5EAF2] bg-white p-4 md:rounded-[22px] md:p-5">
        <SkeletonBlock className="h-4 w-40 rounded-full" />
        <SkeletonBlock className="mt-4 h-28 w-full rounded-[16px]" />
      </div>
    </div>
  );

  const confirmationFields = (
    <div className="grid gap-4 md:gap-5">
      <div className="rounded-[18px] border border-[#E5EAF2] bg-[#FAFBFD] p-4 md:rounded-[22px] md:p-5">
        <SkeletonBlock className="h-4 w-32 rounded-full" />
        <div className={`mt-4 grid gap-3 ${mobile ? "" : "md:grid-cols-2"}`}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonBlock key={index} className={`h-4 rounded-full ${index === 4 ? "w-full md:col-span-2" : "w-full"}`} />
          ))}
        </div>
      </div>

      <div className="rounded-[18px] border border-[#DCE6F7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-4 shadow-[0_10px_30px_rgba(37,99,235,.06)] md:rounded-[22px] md:p-5">
        <div className="flex items-start gap-3">
          <SkeletonBlock className="h-11 w-11 rounded-2xl md:h-12 md:w-12" />
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-4 w-36 rounded-full" />
            <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
          </div>
        </div>

        <div className={`mt-4 grid gap-3 ${mobile ? "" : "md:grid-cols-2"}`}>
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
              <div className="flex items-start gap-3">
                <SkeletonBlock className="h-10 w-10 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-4 w-28 rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-4/5 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-[16px] border border-[#E5EAF2] bg-white p-4">
              <div className="flex items-start gap-3">
                <SkeletonBlock className="mt-0.5 h-5 w-5 rounded-md" />
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-4 w-40 rounded-full" />
                  <SkeletonBlock className="mt-2 h-3 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <SkeletonBlock className="h-7 w-28 rounded-full" />
            <SkeletonBlock className="h-7 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );

  const mainContent = currentStep === 0 ? profileFields : currentStep === 1 ? cvFields : confirmationFields;

  if (mobile) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="border-b border-[#EEF2F7] px-5 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <SkeletonBlock className="h-14 w-14 rounded-[20px]" />
              <div className="min-w-0 flex-1 space-y-3">
                <SkeletonBlock className="h-4 w-28 rounded-full" />
                <SkeletonBlock className="h-8 w-4/5 max-w-[260px]" />
                <div className="grid grid-cols-2 gap-2">
                  <SkeletonBlock className="h-9 w-full rounded-xl" />
                  <SkeletonBlock className="h-9 w-full rounded-xl" />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <SkeletonBlock className="h-3 w-24 rounded-full" />
                <SkeletonBlock className="h-3 w-10 rounded-full" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#EEF2F7]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#D9E8FF_0%,#B9D2FF_100%)]" style={{ width: progressWidth }} />
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-[#EEF2F7] px-5 py-4">
          {stepCards}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            {stepLead}
            {mainContent}
          </div>
        </div>

        <div className="border-t border-[#EEF2F7] bg-[#FCFDFE] px-5 py-4">
          <div className="flex flex-col gap-3">
            <SkeletonBlock className="h-4 w-4/5" />
            <div className="grid grid-cols-2 gap-3">
              <SkeletonBlock className="h-11 w-full rounded-xl" />
              <SkeletonBlock className="h-11 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <div className="border-b border-[#EEF2F7] px-6 py-6 md:px-7">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-5">
            <SkeletonBlock className="h-16 w-16 rounded-[22px]" />
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-32 rounded-full" />
              <SkeletonBlock className="mt-4 h-10 w-3/5 max-w-[420px]" />
              <div className="mt-4 flex flex-wrap gap-2">
                <SkeletonBlock className="h-9 w-36 rounded-xl" />
                <SkeletonBlock className="h-9 w-28 rounded-xl" />
                <SkeletonBlock className="h-9 w-32 rounded-xl" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-5">
            <div className="space-y-2">
              <SkeletonBlock className="h-3 w-28 rounded-full" />
              <div className="h-2.5 w-52 rounded-full bg-[#EEF2F7]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#D9E8FF_0%,#B9D2FF_100%)]" style={{ width: progressWidth }} />
              </div>
            </div>
            <SkeletonBlock className="h-3 w-12 rounded-full" />
          </div>
        </div>
      </div>

      <div className="border-b border-[#EEF2F7] px-6 py-4 md:px-7">
        {stepCards}
      </div>

      <div className="min-h-0 flex-1">
        <div className="min-h-0 overflow-y-auto px-6 py-6 md:px-7">
          <div className="grid gap-5">
            {stepLead}
            {mainContent}
          </div>
        </div>
      </div>

      <div className="border-t border-[#EEF2F7] bg-[#FCFDFE] px-6 py-4 md:px-7">
        <div className="flex items-center justify-between gap-4">
          <SkeletonBlock className="h-4 w-64" />
          <div className="flex gap-3">
            <SkeletonBlock className="h-11 w-28 rounded-xl" />
            <SkeletonBlock className="h-11 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationPublicModal({ lang }) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = String(APPLY_PARAMS.map((param) => searchParams.get(param)).find(Boolean) || "").trim();
  const open = Boolean(jobId);

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedView, setSubmittedView] = useState(false);
  const [skeletonStep, setSkeletonStep] = useState(0);

  const closeHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    APPLY_PARAMS.forEach((param) => params.delete(param));
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    let ignore = false;

    async function loadJob() {
      if (!jobId) {
        setJob(null);
        setError("");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/courses/${encodeURIComponent(jobId)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.course) {
          throw new Error(data?.error || "course_not_found");
        }
        if (!ignore) {
          setJob(mapJobForModal(data.course));
        }
      } catch (e) {
        if (!ignore) {
          setJob(null);
          setError(e?.message || "No pudimos cargar el curso.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadJob();

    return () => {
      ignore = true;
    };
  }, [jobId]);

  useEffect(() => {
    setSubmittedView(false);
  }, [jobId]);

  useEffect(() => {
    if (!open || !loading) {
      setSkeletonStep(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setSkeletonStep((value) => (value + 1) % SKELETON_STEPS.length);
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [loading, open]);

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      router.replace(closeHref, { scroll: false });
    }
  };

  const body = (
    <div className={`flex flex-col overflow-hidden bg-white ${submittedView ? "h-auto" : "h-full"}`}>
      <DialogTitle className="sr-only">{job?.title || "Inscripcion"}</DialogTitle>
      <DrawerTitle className="sr-only">{job?.title || "Inscripcion"}</DrawerTitle>
      <DialogDescription className="sr-only">Confirma tu perfil, revisa el pago y completa tu inscripción.</DialogDescription>
      <DrawerDescription className="sr-only">Confirma tu perfil, revisa el pago y completa tu inscripción.</DrawerDescription>

{loading ? (
          <ApplicationModalSkeleton mobile={isMobile} step={skeletonStep} />
        ) : error ? (
          <div className="mx-auto flex max-w-3xl px-4 py-6 md:px-6 md:py-8">
            <div className="w-full rounded-[24px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              No pudimos abrir esta inscripcion. {error}
            </div>
          </div>
        ) : job ? (
          <CourseCheckoutForm
            lang={lang}
            job={job}
            variant="modal"
            onClose={() => handleOpenChange(false)}
            onSubmittedChange={setSubmittedView}
          />
        ) : null}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent
          className={[
            "border-0 bg-white p-0",
            submittedView ? "max-h-[78vh] rounded-t-[28px]" : "max-h-[94vh] rounded-t-[28px]",
          ].join(" ")}
        >
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        size="4xl"
        hiddenCloseIcon
        overlayClass="bg-black/45 backdrop-blur-[10px]"
        className={[
          "overflow-hidden rounded-[30px] border border-[#E6EBF4] bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,.16)]",
          submittedView
            ? "h-auto max-h-[560px] w-[min(92vw,720px)] max-w-[720px]"
            : "h-[92vh] max-h-[92vh] w-[min(96vw,860px)] max-w-[860px]",
        ].join(" ")}
      >
        {body}
      </DialogContent>
    </Dialog>
  );
}
