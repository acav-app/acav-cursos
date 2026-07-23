"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bookmark, Check, Share2 } from "lucide-react";
import { readSavedCourses, writeSavedCourses } from "@/lib/courses/client/saved-courses";

export default function JobDetailActions({ job }) {
  const [saved, setSaved] = useState(false);

  const payload = useMemo(
    () => ({
      id: job?.id || "",
      slug: job?.slug || "",
      title: job?.title || "Curso",
      companyName: job?.institutionName || job?.companyName || "",
      city: job?.city || "",
      savedAt: new Date().toISOString(),
    }),
    [job?.city, job?.companyName, job?.id, job?.institutionName, job?.slug, job?.title]
  );

  useEffect(() => {
    const items = readSavedCourses();
    setSaved(items.some((item) => String(item?.id || "") === payload.id));
  }, [payload.id]);

  const handleSave = () => {
    const items = readSavedCourses();
    const exists = items.some((item) => String(item?.id || "") === payload.id);

    if (exists) {
      const next = items.filter((item) => String(item?.id || "") !== payload.id);
      writeSavedCourses(next);
      setSaved(false);
      toast("Curso removido de guardados");
      return;
    }

    writeSavedCourses([payload, ...items.filter((item) => String(item?.id || "") !== payload.id)]);
    setSaved(true);
    toast.success("Curso guardado");
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareData = {
      title: payload.title,
      text: `${payload.title}${payload.companyName ? ` · ${payload.companyName}` : ""}`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado al portapapeles");
    } catch (error) {
      if (error?.name === "AbortError") return;

      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copiado al portapapeles");
      } catch {
        toast.error("No se pudo compartir este curso");
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleSave}
        aria-pressed={saved}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-[16px] border px-5 py-3 text-sm font-semibold transition",
          saved
            ? "border-[#BFD1F2] bg-[#EEF4FF] text-[#1B2B50]"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
        ].join(" ")}
      >
        {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        {saved ? "Guardado" : "Guardar"}
      </button>

      <button
        type="button"
        onClick={handleShare}
        className="inline-flex items-center justify-center gap-2 rounded-[16px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Share2 className="h-4 w-4" />
        Compartir
      </button>
    </>
  );
}
