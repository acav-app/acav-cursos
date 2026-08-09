"use client";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileVideo, FileText, Image as ImageIcon, AlertTriangle, CheckCircle2, Loader2, FolderUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  COURSE_DOCUMENT_MIME_TYPES,
  COURSE_RESOURCE_STATUSES,
  COURSE_VIDEO_MIME_TYPES,
} from "@/lib/courses/schemas";
import { uploadToR2WithProgress } from "@/components/courses/dashboard/upload";
import { toast } from "sonner";

export const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 200 * 1024 * 1024;

export function detectResourceKind(file) {
  const mime = file.type || "";
  const name = String(file.name || "").toLowerCase();
  if (COURSE_VIDEO_MIME_TYPES.includes(mime) || /\.(mp4|webm|mov|m4v)$/i.test(name)) {
    return "video";
  }
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(name)) {
    return "image";
  }
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "document";
  if (
    mime.includes("word") ||
    /\.(docx?|odt)$/i.test(name) ||
    COURSE_DOCUMENT_MIME_TYPES.includes(mime)
  ) {
    return "document";
  }
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return "archive";
  return "document";
}

export function detectSubKind(file) {
  const mime = file.type || "";
  const name = String(file.name || "").toLowerCase();
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (/\.docx$/i.test(name) || mime.includes("officedocument.wordprocessingml")) return "docx";
  if (/\.doc$/i.test(name)) return "doc";
  if (mime === "image/jpeg" || /\.jpe?g$/i.test(name)) return mime === "image/png" ? "png" : "jpg";
  if (mime === "image/png" || /\.png$/i.test(name)) return "png";
  if (mime === "image/webp" || /\.webp$/i.test(name)) return "webp";
  if (/\.(zip|rar)$/i.test(name)) return /\.rar$/i.test(name) ? "rar" : "zip";
  return "other";
}

export async function computeFileChecksum(file) {
  if (!window?.crypto?.subtle?.digest || typeof file?.arrayBuffer !== "function") {
    return undefined;
  }
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

export default function MediaUploader({
  mode = "any",
  accept,
  multiple = true,
  maxFiles = 20,
  onUploaded,
  folderPrefix = "courses/resources",
  value = [],
  onChange,
  compact = false,
}) {
  const [queue, setQueue] = useState([]);
  const queueRef = useRef([]);
  queueRef.current = queue;

  const acceptAttr = useMemo(() => {
    if (accept) return accept;
    if (mode === "video") {
      return {
        "video/mp4": [".mp4"],
        "video/webm": [".webm"],
        "video/quicktime": [".mov"],
      };
    }
    if (mode === "document") {
      return {
        "application/pdf": [".pdf"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
        "application/msword": [".doc"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
      };
    }
    return {
      "video/mp4": [".mp4"],
      "video/webm": [".webm"],
      "video/quicktime": [".mov"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    };
  }, [accept, mode]);

  const maxBytes = mode === "video" ? MAX_VIDEO_BYTES : MAX_DOCUMENT_BYTES;

  const isValidFile = useCallback(
    (file) => {
      if (file.size > maxBytes) {
        toast.error(
          `Archivo "${file.name}" supera el límite (${(maxBytes / 1024 / 1024).toFixed(0)} MB)`
        );
        return false;
      }
      if (mode === "video") {
        const kind = detectResourceKind(file);
        if (kind !== "video") {
          toast.error(`"${file.name}" no es un formato de video soportado (MP4 / WebM / MOV)`);
          return false;
        }
      }
      return true;
    },
    [maxBytes, mode]
  );

  const processFile = useCallback(
    async (file) => {
      const id = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const kind = detectResourceKind(file);
      const subKind = detectSubKind(file);
      const label = file.name.replace(/\.[^.]+$/, "");
      const setProgress = (percent) => {
        setQueue((prev) =>
          prev.map((q) => (q.id === id ? { ...q, progress: Math.max(0, Math.min(100, percent)) } : q))
        );
      };
      const entry = {
        id,
        file,
        kind,
        subKind,
        label,
        mimeType: file.type,
        fileSize: file.size,
        progress: 0,
        status: "uploading",
      };
      setQueue((prev) => (multiple ? [...prev, entry] : [entry]));
      try {
        const checksum = await computeFileChecksum(file);
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const extension = String(file.name || "").split(".").pop() || "bin";
        const key = `${folderPrefix}/${ts}_${id}.${extension}`;
        const { url, etag } = await uploadToR2WithProgress(file, key, (pct) => setProgress(pct * 100));
        if (!url) throw new Error("No se pudo generar la URL pública del recurso.");
        const uploadedAt = new Date().toISOString();
        const ready = {
          id,
          label,
          url,
          kind,
          subKind,
          mimeType: file.type,
          fileSize: file.size,
          status: "ready",
          checksum: checksum || etag || undefined,
          storageKey: key,
          uploadedAt,
          previewUrl: kind === "image" ? url : undefined,
        };
        setQueue((prev) => prev.filter((q) => q.id !== id));
        const nextValue = multiple ? [...(value || []), ready] : [ready];
        onChange?.(nextValue);
        onUploaded?.(ready, nextValue);
        toast.success(`Listo: ${file.name}`);
      } catch (err) {
        const error = err?.message || "Error de subida";
        toast.error(`Falló "${file.name}": ${error}`);
        setQueue((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: "corrupt", error } : q))
        );
      }
    },
    [folderPrefix, multiple, onChange, onUploaded, value]
  );

  const onDrop = useCallback(
    (acceptedFiles, rejected) => {
      if (rejected?.length) {
        toast.error(`${rejected.length} archivo(s) rechazado(s). Verificá formato / tamaño.`);
      }
      const okFiles = acceptedFiles.filter(isValidFile);
      if (!okFiles.length) return;
      if (!multiple && okFiles.length > 1) okFiles.length = 1;
      const remaining = maxFiles - (value?.length || 0);
      if (remaining <= 0) {
        toast.error(`Llegaste al máximo de ${maxFiles} archivos permitidos.`);
        return;
      }
      okFiles.slice(0, remaining).forEach((file) => {
        Promise.resolve().then(() => processFile(file));
      });
    },
    [isValidFile, maxFiles, multiple, processFile, value]
  );

  const removeUploaded = (id) => {
    const next = (value || []).filter((r) => r.id !== id);
    onChange?.(next);
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptAttr,
    multiple,
    onDrop,
    useFsAccessApi: false,
  });

  const IconMode = mode === "video" ? FileVideo : mode === "document" ? FileText : FolderUp;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed px-4 py-6 transition-all",
          isDragActive
            ? "border-[#6C5CE7] bg-[#EEF4FF]"
            : "border-slate-200 bg-slate-50/60 hover:bg-slate-50",
          compact && "py-4"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex items-start gap-4">
          <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2356B8]">
            {isDragActive ? <Upload className="h-5 w-5" /> : <IconMode className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#1B2B50]">
              {isDragActive ? "Soltá los archivos acá" : "Arrastrá archivos o hacé clic para elegir"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {mode === "video"
                ? "MP4 · WebM · MOV · hasta 4 GB"
                : mode === "document"
                  ? "PDF · DOCX · JPG · PNG · WebP · hasta 200 MB"
                  : "Videos, documentos e imágenes · formatos estándar"}
            </div>
          </div>
          <Badge variant="soft" color="secondary" className="rounded-full">
            {(value?.length || 0) + (queue?.length || 0)}/{maxFiles}
          </Badge>
        </div>
      </div>

      {(queue?.length || value?.length) ? (
        <div className="space-y-2">
          {queue.map((q) => (
            <div
              key={q.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2",
                q.status === "corrupt" ? "border-red-200 bg-red-50/60" : "border-slate-200 bg-white"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                  q.kind === "video"
                    ? "bg-violet-100 text-violet-700"
                    : q.kind === "image"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-blue-700"
                )}
              >
                {q.kind === "video" ? (
                  <FileVideo className="h-4 w-4" />
                ) : q.kind === "image" ? (
                  <ImageIcon className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[#1B2B50]">{q.label}</span>
                  {q.status === "corrupt" ? (
                    <Badge variant="soft" color="destructive" className="rounded-full">
                      <AlertTriangle className="mr-1 h-3 w-3" /> Corrupto
                    </Badge>
                  ) : (
                    <Badge variant="soft" color="info" className="rounded-full">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Subiendo {Math.round(q.progress || 0)}%
                    </Badge>
                  )}
                </div>
                <Progress className="mt-2 h-1.5" value={q.progress || 0} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setQueue((prev) => prev.filter((x) => x.id !== q.id))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {(value || []).map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                  r.kind === "video"
                    ? "bg-violet-100 text-violet-700"
                    : r.kind === "image"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-blue-100 text-blue-700"
                )}
              >
                {r.kind === "video" ? (
                  <FileVideo className="h-4 w-4" />
                ) : r.kind === "image" ? (
                  <ImageIcon className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-[#1B2B50]">{r.label}</span>
                  <Badge
                    variant="soft"
                    color={
                      r.status === "ready"
                        ? "success"
                        : COURSE_RESOURCE_STATUSES.includes(r.status)
                          ? "warning"
                          : "secondary"
                    }
                    className="rounded-full"
                  >
                    {r.status === "ready" ? (
                      <>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Listo
                      </>
                    ) : (
                      r.status
                    )}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    {r.fileSize ? `${(r.fileSize / 1024 / 1024).toFixed(2)} MB` : ""}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeUploaded(r.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
