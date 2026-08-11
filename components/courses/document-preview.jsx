"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  FileArchive,
  FileVideo,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = Number(bytes);
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function getExtension(value) {
  const clean = String(value || "").split("?")[0].split("#")[0];
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return "";
  return clean.slice(lastDot + 1).toLowerCase();
}

function inferResourceMeta(resource) {
  const url = String(resource?.url || resource?.previewUrl || "");
  const mime = String(resource?.mimeType || "").toLowerCase();
  const fileName =
    resource?.name ||
    resource?.label ||
    resource?.fileName ||
    (url ? url.split("/").pop() || "" : "");
  const ext = getExtension(fileName || url);

  let kind = resource?.kind;
  let subKind = resource?.subKind;

  if (!kind || kind === "document" || kind === "file") {
    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) {
      kind = "image";
    } else if (mime.startsWith("video/") || ["mp4", "webm", "ogg", "mov", "m4v", "mkv"].includes(ext)) {
      kind = "video";
    } else if (["zip", "rar", "7z"].includes(ext) || mime.includes("zip") || mime.includes("rar") || mime.includes("compressed")) {
      kind = "archive";
    } else {
      kind = "document";
    }
  }

  if (!subKind || subKind === "other") {
    if (ext === "pdf" || mime === "application/pdf") {
      subKind = "pdf";
    } else if (["docx", "doc"].includes(ext)) {
      subKind = ext;
    } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
      subKind = ext;
    } else if (["zip", "rar"].includes(ext)) {
      subKind = ext;
    } else if (ext) {
      subKind = ext;
    }
  }

  return { kind, subKind, ext, mime, fileName };
}

export default function DocumentPreviewCard({ resource, compact = false }) {
  const [open, setOpen] = useState(false);

  const meta = useMemo(() => inferResourceMeta(resource), [resource]);
  const kind = meta.kind || "document";
  const subKind = meta.subKind || "other";
  const url = resource?.url || resource?.previewUrl;
  const label = resource?.label || resource?.name || meta.fileName || "Recurso";
  const fileSize =
    typeof resource?.fileSize === "number"
      ? resource.fileSize
      : typeof resource?.sizeBytes === "number"
        ? resource.sizeBytes
        : undefined;

  const normalizedResource = {
    ...resource,
    label,
    fileSize,
    kind,
    subKind,
  };

  if (!url) {
    return <ResourceMissingCard resource={normalizedResource} />;
  }

  if (kind === "image" || ["jpg", "jpeg", "png", "webp"].includes(subKind)) {
    return (
      <ImagePreviewCard
        resource={normalizedResource}
        compact={compact}
        open={open}
        setOpen={setOpen}
      />
    );
  }

  if (kind === "archive" || ["zip", "rar"].includes(subKind)) {
    return <ArchivePreviewCard resource={normalizedResource} compact={compact} />;
  }

  if (kind === "video") {
    return <VideoLinkCard resource={normalizedResource} compact={compact} />;
  }

  if (subKind === "pdf") {
    return (
      <PdfPreviewCard
        resource={normalizedResource}
        compact={compact}
        open={open}
        setOpen={setOpen}
      />
    );
  }

  if (["docx", "doc"].includes(subKind)) {
    return (
      <DocxPreviewCard
        resource={normalizedResource}
        compact={compact}
        open={open}
        setOpen={setOpen}
      />
    );
  }

  return <GenericDocCard resource={normalizedResource} compact={compact} />;
}

function CardShell({ resource, icon, children, compact, className, actions, footer }) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.05)] transition hover:shadow-md",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 border-b border-slate-100 px-4 py-3",
          compact ? "px-3 py-2.5" : ""
        )}
      >
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2356B8]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[#1B2B50]">
            {resource?.label || "Recurso"}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            {typeof resource?.fileSize === "number" ? (
              <span className="text-xs text-slate-500">{formatBytes(resource.fileSize)}</span>
            ) : null}
          </div>
        </div>
        {actions}
      </div>
      <div className="flex-1">{children}</div>
      {footer}
    </div>
  );
}

function CardFooter({ url, label = "Abrir en nueva pestaña" }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5">
      <span className="truncate text-xs text-slate-500">
        Previsualización instantánea sin descarga
      </span>
      <div className="flex items-center gap-1.5">
        <Button asChild variant="ghost" size="sm">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </a>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={url} target="_blank" rel="noreferrer" download>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Descargar
          </a>
        </Button>
      </div>
    </div>
  );
}

function PdfPreviewCard({ resource, compact, open, setOpen }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <CardShell
        resource={resource}
        compact={compact}
        icon={<FileText className="h-4 w-4" />}
        className="min-h-[180px]"
        actions={
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Maximize2 className="mr-1 h-3.5 w-3.5" />
              Ver PDF
            </Button>
          </DialogTrigger>
        }
        footer={<CardFooter url={resource.url} label="Abrir PDF" />}
      >
        <div className="grid flex-1 place-items-center bg-slate-50 p-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex aspect-[3/4] w-[130px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-[#2356B8]"
          >
            <div className="space-y-1 p-3 text-center">
              <FileText className="mx-auto h-7 w-7 text-[#2356B8]" />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#2356B8]">
                PDF
              </div>
            </div>
          </button>
        </div>
      </CardShell>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{resource.label}</DialogTitle>
        </DialogHeader>
        <PdfViewer url={resource.url} />
      </DialogContent>
    </Dialog>
  );
}

function PdfViewer({ url }) {
  const canvasRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const docRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pdfjsLib
      .getDocument(url)
      .promise.then((doc) => {
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPageNumber(1);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "No se pudo cargar el PDF.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!docRef.current || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const task = docRef.current.getPage(pageNumber);
    task
      .then((page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext("2d");
        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        const renderTask = page.render({ canvasContext: ctx, viewport, transform });
        renderTask.promise
          .then(() => {
            if (!cancelled) setLoading(false);
          })
          .catch((err) => {
            if (!cancelled) setError(err?.message || "Error al renderizar la página.");
          });
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Error al cargar la página.");
      });
    return () => {
      cancelled = true;
    };
  }, [pageNumber, scale]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center gap-3 rounded-xl bg-slate-50 p-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-slate-600">
            Página {pageNumber} de {numPages || "—"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!numPages || pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          >
            Siguiente
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
          >
            -
          </Button>
          <Badge variant="soft" color="secondary" className="rounded-full">
            {Math.round(scale * 100)}%
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScale((s) => Math.min(2.2, s + 0.2))}
          >
            +
          </Button>
        </div>
      </div>
      <div className="max-h-[65vh] w-full overflow-auto rounded-lg bg-white shadow-inner">
        <div className="flex justify-center p-3">
          {error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando PDF…
            </div>
          ) : (
            <canvas ref={canvasRef} />
          )}
        </div>
      </div>
    </div>
  );
}

function DocxPreviewCard({ resource, compact, open, setOpen }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <CardShell
        resource={resource}
        compact={compact}
        icon={<FileText className="h-4 w-4" />}
        className="min-h-[180px]"
        actions={
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Maximize2 className="mr-1 h-3.5 w-3.5" />
              Ver documento
            </Button>
          </DialogTrigger>
        }
        footer={<CardFooter url={resource.url} label="Abrir DOCX" />}
      >
        <div className="grid flex-1 place-items-center bg-slate-50 p-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex aspect-[3/4] w-[130px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-[#2356B8]"
          >
            <div className="space-y-1 p-3 text-center">
              <FileText className="mx-auto h-7 w-7 text-[#1B2B50]" />
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {resource.subKind ? resource.subKind.toUpperCase() : "DOCX"}
              </div>
            </div>
          </button>
        </div>
      </CardShell>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{resource.label}</DialogTitle>
        </DialogHeader>
        <DocxViewer url={resource.url} />
      </DialogContent>
    </Dialog>
  );
}

function DocxViewer({ url }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setHtml(null);
    (async () => {
      try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtml(result.value || "<p>Sin contenido.</p>");
      } catch (err) {
        if (!cancelled) setError(err?.message || "No se pudo renderizar el documento.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl bg-white p-6 shadow-inner">
      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      ) : html ? (
        <article
          className="text-[#1B2B50] [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:leading-7 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-[#2356B8] [&_strong]:font-semibold [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_td]:border [&_td]:px-3 [&_td]:py-1.5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Convirtiendo documento…
        </div>
      )}
    </div>
  );
}

function ImagePreviewCard({ resource, compact, open, setOpen }) {
  const url = resource.previewUrl || resource.url;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <CardShell
        resource={resource}
        compact={compact}
        icon={<ImageIcon className="h-4 w-4" />}
        actions={
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Maximize2 className="mr-1 h-3.5 w-3.5" />
              Ver imagen
            </Button>
          </DialogTrigger>
        }
        footer={<CardFooter url={resource.url} label="Abrir imagen" />}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative block aspect-video w-full overflow-hidden bg-slate-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={resource.label || "imagen"}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        </button>
      </CardShell>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{resource.label}</DialogTitle>
        </DialogHeader>
        <div className="grid place-items-center rounded-xl bg-slate-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={resource.label}
            className="max-h-[70vh] max-w-full rounded-lg shadow"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArchivePreviewCard({ resource, compact }) {
  return (
    <CardShell
      resource={resource}
      compact={compact}
      icon={<FileArchive className="h-4 w-4" />}
      footer={<CardFooter url={resource.url} label="Abrir enlace" />}
    >
      <div className="grid flex-1 place-items-center bg-slate-50 p-5">
        <div className="flex flex-col items-center gap-2">
          <FileArchive className="h-10 w-10 text-amber-600" />
          <p className="max-w-xs text-center text-xs text-slate-500">
            Los archivos comprimidos no admiten previsualización. Descargalos para ver el
            contenido.
          </p>
        </div>
      </div>
    </CardShell>
  );
}

function VideoLinkCard({ resource, compact }) {
  return (
    <CardShell
      resource={resource}
      compact={compact}
      icon={<FileVideo className="h-4 w-4" />}
      footer={<CardFooter url={resource.url} label="Reproducir" />}
    >
      <div className="grid flex-1 place-items-center bg-slate-50 p-5">
        <div className="flex flex-col items-center gap-2">
          <FileVideo className="h-10 w-10 text-violet-700" />
          <p className="max-w-xs text-center text-xs text-slate-500">
            Recurso de video adicional. Abrí para reproducir.
          </p>
        </div>
      </div>
    </CardShell>
  );
}

function GenericDocCard({ resource, compact }) {
  return (
    <CardShell
      resource={resource}
      compact={compact}
      icon={<FileText className="h-4 w-4" />}
      footer={<CardFooter url={resource.url} label="Abrir" />}
    >
      <div className="grid flex-1 place-items-center bg-slate-50 p-5">
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-10 w-10 text-slate-500" />
          <Badge variant="soft" color="secondary" className="rounded-full">
            {resource.subKind || resource.mimeType || "archivo"}
          </Badge>
        </div>
      </div>
    </CardShell>
  );
}

function ResourceMissingCard({ resource }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="h-4 w-4 flex-none text-amber-600" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-amber-800">
          {resource?.label || "Recurso"}
        </div>
        <div className="text-xs text-amber-700">
          Archivo no disponible o corrupto.
        </div>
      </div>
    </div>
  );
}
