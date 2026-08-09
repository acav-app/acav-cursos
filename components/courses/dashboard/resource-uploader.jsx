"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import {
  FileArchive,
  FileImage,
  FileVideo,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { COURSE_VIDEO_ALLOWED_TYPES, COURSE_VIDEO_MAX_SIZE_BYTES } from "@/lib/courses/constants";
import { uploadToR2WithProgress } from "@/components/courses/dashboard/upload";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

const FILE_UPLOAD_MAX_SIZE_GENERIC = 50 * 1024 * 1024;

function fileIconFor(type) {
  const t = String(type || "").toLowerCase();
  if (t.startsWith("video/")) return <FileVideo className="h-5 w-5" />;
  if (t.startsWith("image/")) return <FileImage className="h-5 w-5" />;
  return <FileArchive className="h-5 w-5" />;
}

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

function createEntityId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}${rand}`;
}

export default function ResourceUploader({ onFileReady = () => {} }) {
  const [progress, setProgress] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles?.[0];
      if (!file) return;

      const allowedVideoTypes = new Set(COURSE_VIDEO_ALLOWED_TYPES);
      const isVideo = allowedVideoTypes.has(String(file.type || ""));
      const maxSize = isVideo ? COURSE_VIDEO_MAX_SIZE_BYTES : FILE_UPLOAD_MAX_SIZE_GENERIC;
      if (file.size > maxSize) {
        const maxLabel = isVideo ? `${Math.round(COURSE_VIDEO_MAX_SIZE_BYTES / (1024 * 1024))}MB` : "50MB";
        toast.error(`El archivo no puede superar los ${maxLabel}.`);
        return;
      }

      try {
        setUploading(true);
        setProgress({ percent: 0, loaded: 0, total: file.size });
        const rawUrl = await uploadToR2WithProgress(
          file,
          isVideo ? "courses/lesson-resources/videos" : "courses/lesson-resources/files",
          (p) => setProgress(p)
        );
        const url = normalizePublicR2Url(rawUrl);
        const rawName = String(file.name || "").trim();
        const fallbackLabel = rawName
          ? rawName.replace(/\.[^.]+$/, "")
          : `Recurso ${new Date().toLocaleDateString()}`;
        const label = fallbackLabel || "Archivo adjunto";
        const entry = {
          id: createEntityId("resource"),
          label,
          url,
          kind: "file",
          mimeType: String(file.type || "application/octet-stream"),
          fileSize: Number(file.size || 0),
        };
        onFileReady(entry, file);
        toast.success("Archivo adjuntado correctamente.");
      } catch (error) {
        toast.error(error?.message || "No pudimos subir el archivo. Intenta nuevamente.");
      } finally {
        setUploading(false);
        setProgress(null);
      }
    },
    [onFileReady]
  );

  const allowedGeneric = [
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ];
  const acceptMap = allowedGeneric.reduce((acc, m) => {
    acc[m] = [];
    return acc;
  }, {});
  COURSE_VIDEO_ALLOWED_TYPES.forEach((m) => {
    acceptMap[m] = [];
  });
  const imagePrefix = new RegExp("^image/");

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop: handleDrop,
    accept: acceptMap,
    maxSize: Math.max(COURSE_VIDEO_MAX_SIZE_BYTES, FILE_UPLOAD_MAX_SIZE_GENERIC),
    multiple: false,
    noClick: true,
    noKeyboard: true,
    useFsAccessApi: false,
  });

  const dropTone = isDragReject
    ? "border-rose-300 bg-rose-50"
    : isDragActive
      ? "border-[#2356B8] bg-[#EEF4FF]"
      : "border-border/60 bg-background hover:bg-card/60";

  return (
    <div
      {...getRootProps()}
      className={`grid gap-3 rounded-[18px] border border-dashed p-3 transition ${dropTone}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4 text-[#1B2B50]" />
          <span className="text-sm text-muted-foreground">
            {uploading
              ? progress?.percent
                ? `Subiendo... ${progress.percent}%`
                : "Subiendo archivo..."
              : isDragActive
                ? "Soltá el archivo aquí"
                : "Arrastrá PDF / Excel / imágenes / videos o usá el botón."}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={(e) => {
          e.stopPropagation();
          open();
        }} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="mr-2 h-4 w-4" />
          )}
          Adjuntar archivo
        </Button>
      </div>
      {uploading && progress?.percent != null ? (
        <div className="space-y-1">
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
          Archivo no permitido o supera el tamaño máximo (50MB archivos / 250MB videos).
        </div>
      ) : null}
    </div>
  );
}

export { fileIconFor, formatSize };
