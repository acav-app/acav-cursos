"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function LessonVideoUploader({
  value = "",
  asset,
  onChange = () => {},
  compact = false,
  folderPrefix = "courses/lessons/videos",
  onBeforeUpload,
}) {
  const [progress, setProgress] = useState({ percent: 0, loaded: 0, total: 0 });
  const [uploading, setUploading] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [tab, setTab] = useState("upload");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!preview || !preview.objectUrl) return;
    const url = preview.objectUrl;
    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* noop */
      }
    };
  }, [preview?.objectUrl]);

  const current = String(value || "").trim();
  const hasAsset = asset && typeof asset === "object" && (asset.url || asset.storageKey);
  const assetMime = hasAsset ? asset.mimeType : undefined;
  const assetSize = hasAsset ? asset.fileSize : undefined;
  const assetChecksum = hasAsset ? asset.checksum : undefined;
  const assetUploadedAt = hasAsset ? asset.uploadedAt : undefined;
  const assetStorageKey = hasAsset ? asset.storageKey : undefined;

  const displayUrl = useMemo(() => {
    if (current) return current;
    if (preview?.objectUrl) return preview.objectUrl;
    return "";
  }, [current, preview?.objectUrl]);

  const displayHasAssetLike = Boolean(current || (preview && preview.objectUrl));
  const displayMime = assetMime || preview?.mimeType;
  const displaySize = assetSize ?? preview?.fileSize;

  const handleDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;

      if (file.size > COURSE_VIDEO_MAX_SIZE_BYTES) {
        toast.error(`El video supera el máximo permitido de ${formatSize(COURSE_VIDEO_MAX_SIZE_BYTES)}.`);
        return;
      }

      try {
        let objectUrl = null;
        try {
          objectUrl = URL.createObjectURL(file);
        } catch {
          objectUrl = null;
        }
        setPreview({
          objectUrl,
          mimeType: file.type,
          fileSize: file.size,
          originalName: file.name,
        });

        if (typeof onBeforeUpload === "function") {
          const ok = await onBeforeUpload(file);
          if (ok === false) return;
        }
        setUploading(true);
        setProgress({ percent: 0, loaded: 0, total: file.size });
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const rand = Math.random().toString(36).slice(2, 8);
        const extension = String(file.name || "").split(".").pop() || "mp4";
        const safeFolder = String(folderPrefix || "courses/lessons/videos").replace(/\/$/, "");
        const storageKey = `${safeFolder}/${ts}_${rand}.${extension}`;

        const { url: rawUrl, etag } = await uploadToR2WithProgress(
          file,
          { folder: safeFolder, key: storageKey },
          (p) =>
            setProgress({
              loaded: p.loaded,
              total: p.total,
              percent: p.percent,
            })
        );
        const normalized = normalizePublicR2Url(rawUrl);
        const uploadedAt = new Date().toISOString();
        const assetData = {
          url: normalized,
          storageKey,
          mimeType: file.type,
          fileSize: file.size,
          status: "ready",
          checksum: etag || undefined,
          uploadedAt,
          originalName: file.name,
        };
        onChange(normalized, assetData, {
          mimeType: file.type,
          fileSize: file.size,
          originalName: file.name,
          file,
        });
        toast.success("Video cargado correctamente.");
      } catch (error) {
        toast.error(error?.message || "No pudimos subir el video. Intenta nuevamente.");
        setPreview(null);
      } finally {
        setUploading(false);
        setTimeout(() => setProgress({ percent: 0, loaded: 0, total: 0 }), 600);
      }
    },
    [folderPrefix, onChange, onBeforeUpload]
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
    setPreview(null);
    onChange("", null, null);
  };

  const dropTone = isDragReject
    ? "border-rose-300 bg-rose-50"
    : isDragActive
      ? "border-[#2356B8] bg-[#EEF4FF]"
      : "border-border/60 bg-card hover:bg-background/60";

  if (compact) {
    return (
      <div className="grid gap-3">
        <div className="inline-flex rounded-xl border border-border/60 bg-background p-1 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition md:flex-none ${
              tab === "upload" ? "bg-[#1B2B50] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Subir
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition md:flex-none ${
              tab === "url" ? "bg-[#1B2B50] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            URL
          </button>
        </div>

        {displayHasAssetLike ? (
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40">
            <div className="grid gap-3 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Video className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 grid gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">
                      {displayUrl && displayUrl.startsWith("blob:") ? "Cargando video…" : "Video cargado"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {displayUrl && displayUrl.startsWith("blob:")
                        ? uploading
                          ? "Subiendo"
                          : "Previsualizando"
                        : hasAsset
                          ? "Asset"
                          : "Activo"}
                    </span>
                    {displaySize != null ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        {formatSize(displaySize)}
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {displayUrl && displayUrl.startsWith("blob:")
                      ? preview?.originalName || "Vista previa local"
                      : displayUrl}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  {displayUrl && !displayUrl.startsWith("blob:") ? (
                    <Button asChild type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]">
                      <a href={displayUrl} target="_blank" rel="noreferrer">
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        Abrir
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={handleClear}
                    disabled={uploading}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Quitar
                  </Button>
                </div>
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-emerald-200 bg-slate-900">
                {displayUrl && isEmbedUrl(displayUrl) ? (
                  <iframe
                    title="Vista previa del video"
                    src={displayUrl}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    controls
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-contain bg-black"
                    src={displayUrl}
                  />
                )}
              </div>
              {uploading && progress?.percent != null ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin text-[#2356B8]" />
                      Subiendo video al almacenamiento…
                    </span>
                    <span>{progress.percent}%</span>
                  </div>
                  <Progress value={progress.percent} className="h-2 bg-white" />
                </div>
              ) : null}
            </div>
          </div>
        ) : tab === "upload" ? (
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed px-3 py-4 text-center transition ${dropTone}`}
          >
            <input {...getInputProps()} />
            <div className="flex items-center justify-center gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-border/60">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#2356B8]" />
                ) : isDragActive ? (
                  <Film className="h-5 w-5" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 text-left">
                <div className="text-xs font-semibold text-foreground">
                  {uploading
                    ? `Subiendo ${progress?.percent ? `(${progress.percent}%)` : ""}…`
                    : isDragActive
                      ? "Soltá para subir el video"
                      : "Arrastrá o hacé clic para elegir video"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  MP4 · WebM · MOV · MKV · M4V · hasta {formatSize(COURSE_VIDEO_MAX_SIZE_BYTES)}
                </div>
              </div>
            </div>
            {uploading && progress?.percent != null ? (
              <div className="mt-3 space-y-1">
                <Progress value={progress.percent} className="h-2 bg-white" />
              </div>
            ) : null}
            {isDragReject ? (
              <div className="mt-2 text-[11px] font-semibold text-rose-600">
                Tipo de archivo no permitido o supera el tamaño máximo.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2 rounded-2xl border border-border/60 bg-card p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
              <Input
                value={manualUrl}
                onChange={(event) => setManualUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleApplyManualUrl();
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="h-9"
              />
              <Button type="button" onClick={handleApplyManualUrl} className="h-9 rounded-xl">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Aplicar URL
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">YouTube / Vimeo. Usa la URL de compartir.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2 text-muted-foreground">
          <UploadCloud className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-5 text-muted-foreground">
            Subí archivo (MP4/WebM/MOV/MKV) o pegá un link de YouTube/Vimeo. Máximo {formatSize(COURSE_VIDEO_MAX_SIZE_BYTES)}.
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
            Subir
          </button>
          <button
            type="button"
            onClick={() => setTab("url")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
              tab === "url" ? "bg-[#1B2B50] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            URL
          </button>
        </div>
      </div>

      {displayHasAssetLike ? (
        <div className="overflow-hidden rounded-[22px] border border-emerald-200 bg-emerald-50/40">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="relative aspect-video w-full overflow-hidden rounded-[18px] border border-emerald-200 bg-slate-900">
              {displayUrl && isEmbedUrl(displayUrl) ? (
                <iframe
                  title="Vista previa del video"
                  src={displayUrl}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  controls
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                  src={displayUrl}
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
                    <span className="text-sm font-semibold text-foreground">
                      {displayUrl && displayUrl.startsWith("blob:") ? "Cargando video…" : "Video cargado"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      {displayUrl && displayUrl.startsWith("blob:")
                        ? uploading
                          ? "Subiendo"
                          : "Previsualizando"
                        : hasAsset
                          ? "Asset almacenado"
                          : "Activo"}
                    </span>
                  </div>
                  <a
                    href={displayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-muted-foreground hover:text-foreground"
                  >
                    {displayUrl && displayUrl.startsWith("blob:")
                      ? preview?.originalName || "Vista previa local"
                      : displayUrl}
                  </a>
                </div>
              </div>

              {displayMime || displaySize != null || assetChecksum || assetUploadedAt || assetStorageKey ? (
                <div className="grid gap-1.5 rounded-2xl border border-emerald-200/80 bg-white/60 p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {displayMime ? (
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                        {String(displayMime).includes("mp4")
                          ? "MP4"
                          : String(displayMime).includes("webm")
                            ? "WebM"
                            : String(displayMime).includes("quicktime") || String(displayMime).includes("mov")
                              ? "MOV"
                              : String(displayMime).includes("matroska") || String(displayMime).includes("mkv")
                                ? "MKV"
                                : String(displayMime).includes("m4v")
                                  ? "M4V"
                                  : "Video"}
                      </span>
                    ) : null}
                    {displaySize != null ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {formatSize(displaySize)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    {assetChecksum ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                        Checksum {String(assetChecksum).slice(0, 10)}…
                      </span>
                    ) : null}
                    {assetUploadedAt ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5">
                        Subido {new Date(assetUploadedAt).toLocaleDateString("es-AR")}
                      </span>
                    ) : null}
                    {assetStorageKey ? (
                      <span className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5">
                        <span className="truncate">{String(assetStorageKey).split("/").pop()}</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {uploading && progress?.percent != null ? (
                <div className="space-y-1 rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin text-[#2356B8]" />
                      Subiendo video al almacenamiento…
                    </span>
                    <span>{progress.percent}%</span>
                  </div>
                  <Progress value={progress.percent} className="h-2 bg-white" />
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      {formatSize(progress.loaded || 0)} / {formatSize(progress.total || 0)}
                    </span>
                    <span className="font-medium">R2 · {folderPrefix}</span>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2">
                {displayUrl && !displayUrl.startsWith("blob:") ? (
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-start rounded-xl"
                  >
                    <a href={displayUrl} target="_blank" rel="noreferrer">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Abrir en nueva pestaña
                    </a>
                  </Button>
                ) : null}
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
                  Formatos permitidos: MP4, WebM, MOV, MKV, M4V. Máximo{" "}
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
