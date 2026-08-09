"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  ExternalLink,
  Film,
  Loader2,
  PlayCircle,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { COURSE_VIDEO_ALLOWED_TYPES, COURSE_VIDEO_MAX_SIZE_BYTES } from "@/lib/courses/constants";
import { uploadToR2WithProgress } from "@/components/courses/dashboard/upload";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

function formatSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = Number(bytes);
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n.toFixed(n >= 100 || u === 0 ? 0 : 1)} ${units[u]}`;
}

function isEmbedUrl(url) {
  const u = String(url || "").trim().toLowerCase();
  return u.includes("youtube.com") || u.includes("youtu.be") || u.includes("vimeo.com");
}

export default function LessonVideoUploader({ value = "", onChange = () => {} }) {
  const [progress, setProgress] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [tab, setTab] = useState("upload");

  const current = String(value || "").trim();

  const handleDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;

      if (file.size > COURSE_VIDEO_MAX_SIZE_BYTES) {
        const maxMB = Math.round(COURSE_VIDEO_MAX_SIZE_BYTES / (1024 * 1024));
        toast.error(`El video no puede superar los ${maxMB}MB.`);
        return;
      }

      try {
        setUploading(true);
        setProgress({ percent: 0, loaded: 0, total: file.size });
        const rawUrl = await uploadToR2WithProgress(file, "courses/videos", (p) => setProgress(p));
        const normalized = normalizePublicR2Url(rawUrl);
        onChange(normalized, null, {
          mimeType: file.type,
          fileSize: file.size,
          originalName: file.name,
        });
        toast.success("Video cargado correctamente.");
      } catch (error) {
        toast.error(error?.message || "No pudimos subir el video. Intenta nuevamente.");
      } finally {
        setUploading(false);
        setProgress(null);
      }
    },
    [onChange]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    accept: COURSE_VIDEO_ALLOWED_TYPES.reduce((acc, mime) => {
      acc[mime] = [];
      return acc;
    }, {}),
    maxSize: COURSE_VIDEO_MAX_SIZE_BYTES,
    multiple: false,
    useFsAccessApi: false,
  });

  const handleApplyManualUrl = () => {
    const url = String(manualUrl || "").trim();
    if (!url) {
      toast.error("Pega una URL de video primero.");
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error("La URL no es válida.");
      return;
    }
    onChange(url);
    setManualUrl("");
    toast.success("URL del video actualizada.");
  };

  const handleClear = () => {
    onChange("");
  };

  const dropTone = isDragReject
    ? "border-rose-300 bg-rose-50"
    : isDragActive
      ? "border-[#2356B8] bg-[#EEF4FF]"
      : "border-border/60 bg-card hover:bg-background/60";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label>Video principal de la clase</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Sube el video MP4/WebM directamente o pega el link de YouTube / Vimeo.
            Tamaño máximo: {formatSize(COURSE_VIDEO_MAX_SIZE_BYTES)}.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-border/60 bg-background p-1">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
              tab === "upload" ? "bg-[#1B2B50] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadCloud className="h-4 w-4" />
            Subir video
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
              tab === "url" ? "bg-[#1B2B50] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            Link externo
          </button>
        </div>
      </div>

      {current ? (
        <div className="overflow-hidden rounded-[22px] border border-emerald-200 bg-emerald-50/40">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="relative aspect-video w-full overflow-hidden rounded-[18px] border border-emerald-200 bg-slate-900">
              {isEmbedUrl(current) ? (
                <iframe
                  title="Vista previa del video"
                  src={current}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  controls
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                  src={current}
                />
              )}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <Video className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">Video cargado</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Activo
                    </span>
                  </div>
                  <a
                    href={current}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground"
                  >
                    {current}
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start rounded-xl"
                >
                  <a href={current} target="_blank" rel="noreferrer">
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Abrir en nueva pestaña
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="justify-start rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={handleClear}
                  disabled={uploading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Quitar video
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : tab === "upload" ? (
        <div className="grid gap-3">
          <div
            {...getRootProps()}
            className={`group cursor-pointer rounded-[22px] border-2 border-dashed p-6 text-center transition ${dropTone}`}
          >
            <input {...getInputProps()} />
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#1B2B50] shadow-sm ring-1 ring-border/60">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#2356B8]" />
                ) : isDragActive ? (
                  <Film className="h-7 w-7" />
                ) : (
                  <UploadCloud className="h-7 w-7" />
                )}
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {uploading
                    ? `Subiendo video ${progress?.percent ? `(${progress.percent}%)` : ""}...`
                    : isDragActive
                      ? "Soltá para subir el video"
                      : "Arrastrá el video acá o hacé click para seleccionarlo"}
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  Formatos permitidos: MP4, WebM, OGG, QuickTime. Máximo{" "}
                  {formatSize(COURSE_VIDEO_MAX_SIZE_BYTES)}.
                </div>
              </div>
              {uploading && progress?.percent != null ? (
                <div className="w-full space-y-1">
                  <Progress value={progress.percent} className="h-2 bg-white" />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {formatSize(progress.loaded || 0)} / {formatSize(progress.total || 0)}
                    </span>
                    <span className="font-semibold">{progress.percent}%</span>
                  </div>
                </div>
              ) : null}
              {isDragReject ? (
                <div className="text-xs font-semibold text-rose-600">
                  Tipo de archivo no permitido o supera el tamaño máximo.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 rounded-[22px] border border-border/60 bg-card p-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2">
              <Label htmlFor="lesson-video-url">URL de YouTube / Vimeo</Label>
              <Input
                id="lesson-video-url"
                value={manualUrl}
                onChange={(event) => setManualUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleApplyManualUrl();
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <Button type="button" onClick={handleApplyManualUrl} className="h-11 rounded-2xl">
              <ExternalLink className="mr-2 h-4 w-4" />
              Aplicar URL
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: pega la URL de compartir, no el código iframe. La plataforma se encarga del embebido.
          </p>
        </div>
      )}
    </div>
  );
}
