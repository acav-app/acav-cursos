"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileArchive, FileImage, FileSpreadsheet, FileText, FileType2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

function formatBytes(bytes) {
  const size = Number(bytes || 0);
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(value) {
  const clean = String(value || "").split("?")[0].split("#")[0];
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return "";
  return clean.slice(lastDot + 1).toLowerCase();
}

function inferKind({ file, url, fileName }) {
  const mime = String(file?.type || "").toLowerCase();
  const ext = getExtension(file?.name || fileName || url);

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "ogg", "mov"].includes(ext)) {
    return "video";
  }
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }
  if (mime.startsWith("text/") || ["txt", "md", "csv", "json"].includes(ext)) {
    return "text";
  }
  if (
    [
      "doc",
      "docx",
      "ppt",
      "pptx",
      "odt",
    ].includes(ext) ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "office";
  }
  if (
    ["xls", "xlsx"].includes(ext) ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "spreadsheet";
  }
  if (["zip", "rar", "7z"].includes(ext) || mime.includes("zip")) {
    return "archive";
  }
  return "generic";
}

function FileKindIcon({ kind, className = "h-5 w-5" }) {
  if (kind === "image") return <FileImage className={className} />;
  if (kind === "video") return <Film className={className} />;
  if (kind === "pdf" || kind === "text") return <FileText className={className} />;
  if (kind === "spreadsheet") return <FileSpreadsheet className={className} />;
  if (kind === "archive") return <FileArchive className={className} />;
  return <FileType2 className={className} />;
}

export default function FilePreview({
  file = null,
  url = "",
  fileName = "",
  fileSize = 0,
  title = "Archivo adjunto",
  description = "",
  variant = "full",
}) {
  const [localUrl, setLocalUrl] = useState("");
  const [textPreview, setTextPreview] = useState("");
  const [textError, setTextError] = useState("");
  const remoteUrl = useMemo(() => normalizePublicR2Url(url), [url]);
  const sourceUrl = localUrl || remoteUrl;

  useEffect(() => {
    if (!file) {
      setLocalUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setLocalUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const kind = useMemo(() => inferKind({ file, url: sourceUrl || url, fileName }), [file, sourceUrl, url, fileName]);
  const displayName = file?.name || fileName || String(url || "").split("/").pop() || "archivo";
  const sizeLabel = formatBytes(file?.size || fileSize);
  const officeViewerUrl =
    sourceUrl && !file ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}` : "";
  const isCompact = variant === "compact";

  useEffect(() => {
    let cancelled = false;

    async function loadTextPreview() {
      if (kind !== "text" || !sourceUrl) {
        setTextPreview("");
        setTextError("");
        return;
      }

      try {
        const content = file ? await file.text() : await fetch(sourceUrl).then((res) => {
          if (!res.ok) throw new Error("No se pudo leer el archivo");
          return res.text();
        });
        if (cancelled) return;
        setTextPreview(content.slice(0, 5000));
        setTextError("");
      } catch (_error) {
        if (cancelled) return;
        setTextPreview("");
        setTextError("No se pudo generar una vista previa de texto.");
      }
    }

    loadTextPreview();
    return () => {
      cancelled = true;
    };
  }, [file, kind, sourceUrl]);

  return (
    <div className={cn("w-full min-w-0 overflow-hidden rounded-3xl border border-border/60 bg-background", isCompact ? "p-4" : "p-6")}>
      <div className={cn("flex gap-4", isCompact ? "flex-col" : "flex-col md:flex-row md:items-start md:justify-between")}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <FileKindIcon kind={kind} className={isCompact ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"} />
            <span className="min-w-0 flex-1 truncate">{displayName}</span>
            {sizeLabel ? <span className="shrink-0">· {sizeLabel}</span> : null}
          </div>
          {description ? <p className="mt-2 break-words text-sm text-muted-foreground">{description}</p> : null}
        </div>

        {sourceUrl && !isCompact ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline">
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Ver archivo
              </a>
            </Button>
            <Button asChild>
              <a href={sourceUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-2">
                <Download className="h-4 w-4" />
                Descargar
              </a>
            </Button>
          </div>
        ) : null}
      </div>

      <div className={cn("w-full overflow-hidden rounded-3xl border border-border/60 bg-card", isCompact ? "mt-4" : "mt-5")}>
        {kind === "image" && sourceUrl ? (
          <div className={cn("flex w-full justify-center overflow-hidden bg-slate-50 p-4", isCompact ? "h-40 items-center" : "")}>
            <img
              src={sourceUrl}
              alt={displayName}
              className={cn(
                "block rounded-2xl object-contain",
                isCompact ? "h-full w-full max-h-32 max-w-full" : "h-auto w-auto max-h-[70vh] max-w-full"
              )}
            />
          </div>
        ) : null}

        {kind === "video" && sourceUrl ? (
          <div className={cn("overflow-hidden bg-slate-950", isCompact ? "h-48" : "max-h-[70vh]")}>
            <video
              src={sourceUrl}
              controls
              muted
              preload="metadata"
              className={cn("block w-full", isCompact ? "h-48 object-contain" : "max-h-[70vh] object-contain")}
            />
          </div>
        ) : null}

        {kind === "pdf" && sourceUrl ? (
          <iframe
            src={`${sourceUrl}${sourceUrl.includes("#") ? "" : "#toolbar=0&navpanes=0&scrollbar=0"}`}
            title={displayName}
            className={cn("w-full bg-white", isCompact ? "h-48" : "h-[70vh]")}
          />
        ) : null}

        {kind === "text" ? (
          <div className={cn("overflow-auto", isCompact ? "max-h-40 p-4" : "max-h-[70vh] p-5")}>
            {textPreview ? (
              <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{textPreview}</pre>
            ) : (
              <div className="text-sm text-muted-foreground">{textError || "Preparando vista previa..."}</div>
            )}
          </div>
        ) : null}

        {kind === "office" && officeViewerUrl ? (
          <iframe src={officeViewerUrl} title={displayName} className={cn("w-full bg-white", isCompact ? "h-48" : "h-[70vh]")} />
        ) : null}

        {kind === "spreadsheet" && officeViewerUrl ? (
          <iframe src={officeViewerUrl} title={displayName} className={cn("w-full bg-white", isCompact ? "h-48" : "h-[70vh]")} />
        ) : null}

        {(kind === "generic" || kind === "archive" || ((kind === "office" || kind === "spreadsheet") && !officeViewerUrl)) ? (
          <div className={cn("flex flex-col items-center justify-center gap-3 text-center", isCompact ? "min-h-40 p-5" : "min-h-56 p-8")}>
            <FileKindIcon kind={kind} className="h-10 w-10 text-muted-foreground" />
            <div className="text-base font-semibold text-foreground">Vista previa no disponible</div>
            <p className="max-w-xl text-sm text-muted-foreground">
              Este tipo de archivo no se puede renderizar directamente en el navegador, pero ya queda disponible para abrir o descargar.
            </p>
          </div>
        ) : null}
      </div>

      {sourceUrl && isCompact ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Ver
            </a>
          </Button>
          <Button asChild size="sm">
            <a href={sourceUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              Descargar
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
