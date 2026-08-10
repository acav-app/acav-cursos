import { NextResponse } from "next/server";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomBytes } from "crypto";
import { COURSE_VIDEO_ALLOWED_TYPES, COURSE_VIDEO_MAX_SIZE_BYTES } from "@/lib/courses/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

function normalizeBaseUrl(url) {
  const s = String(url || "").trim();
  return s ? s.replace(/\/+$/g, "") : "";
}

function ensureBucketInPublicBase(publicBase, bucket) {
  const base = normalizeBaseUrl(publicBase);
  const b = String(bucket || "").trim();
  if (!base || !b) return base;
  if (base.endsWith(`/${b}`)) return base;
  return `${base}/${b}`;
}

function buildPublicBase(publicBase, bucket) {
  const base = normalizeBaseUrl(publicBase);
  if (!base) return "";
  try {
    const url = new URL(base);
    const host = String(url.hostname || "").toLowerCase();
    if (host.endsWith(".r2.dev")) return base;
  } catch {}
  return ensureBucketInPublicBase(base, bucket);
}

function sanitizeFolder(folderRaw, fallback) {
  return (
    String(folderRaw || fallback || "")
      .replace(/[^a-zA-Z0-9/_.-]/g, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "") || fallback
  );
}

function buildR2Client() {
  const endpoint = String(process.env.R2_ENDPOINT || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("r2_not_configured");
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

const ALLOWED_GENERIC_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderRaw = searchParams.get("folder");
    const keyRaw = searchParams.get("key");
    const mimeTypeRaw = searchParams.get("mimeType");
    const sizeRaw = searchParams.get("size");
    const fileNameRaw = searchParams.get("fileName");

    const size = Number(sizeRaw) || 0;
    const mimeType = String(mimeTypeRaw || "application/octet-stream").trim();
    const originalName = String(fileNameRaw || "").trim();

    const allowedVideoTypes = new Set(COURSE_VIDEO_ALLOWED_TYPES);
    const fileExt = (originalName.split(".").pop() || "").toLowerCase();
    const isImage = mimeType.startsWith("image/");
    const isVideo = allowedVideoTypes.has(mimeType);
    const isVideoByExt = ["mp4", "mov", "m4v", "webm", "mkv", "avi"].includes(fileExt);
    const effectiveIsVideo =
      isVideo || (isVideoByExt && (!mimeType || mimeType === "application/octet-stream"));
    const isAllowed =
      isImage ||
      effectiveIsVideo ||
      ALLOWED_GENERIC_TYPES.has(mimeType) ||
      ALLOWED_GENERIC_TYPES.has(mimeType.split(";")[0].trim());

    if (!isAllowed) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido (${mimeType || "desconocido"} / ext .${fileExt || "?"})` },
        { status: 400 }
      );
    }

    const maxSizeBytes = effectiveIsVideo ? COURSE_VIDEO_MAX_SIZE_BYTES : 250 * 1024 * 1024;
    if (size > maxSizeBytes) {
      const maxSizeLabel = effectiveIsVideo
        ? `${Math.round(COURSE_VIDEO_MAX_SIZE_BYTES / (1024 * 1024))}MB`
        : "250MB";
      return NextResponse.json(
        { error: `El archivo es demasiado grande. Máximo ${maxSizeLabel}` },
        { status: 400 }
      );
    }

    if (!request.body) {
      return NextResponse.json({ error: "upload_missing_body" }, { status: 400 });
    }

    const bucket = String(process.env.R2_BUCKET || "").trim();
    const publicBase = buildPublicBase(process.env.R2_PUBLIC_BASE, bucket);
    if (!bucket || !publicBase) {
      return NextResponse.json({ error: "r2_not_configured" }, { status: 500 });
    }

    let storageKey;
    const extension = originalName ? originalName.split(".").pop() || "bin" : "bin";
    if (keyRaw && String(keyRaw).trim()) {
      const trimmed = String(keyRaw).trim();
      const clean = trimmed
        .replace(/[^a-zA-Z0-9/_.-]/g, "")
        .replace(/^\/+/, "")
        .replace(/\/+/, "/");
      if (clean && clean.split(".").length > 1) {
        storageKey = clean;
      } else {
        const timestamp = Date.now();
        const randomString = randomBytes(6).toString("hex");
        storageKey = `${sanitizeFolder(clean || folderRaw, "uploads")}/${timestamp}-${randomString}.${extension}`;
      }
    } else {
      const timestamp = Date.now();
      const randomString = randomBytes(8).toString("hex");
      const folder = sanitizeFolder(folderRaw, "uploads");
      storageKey = `${folder}/${timestamp}-${randomString}.${extension}`;
    }

    const headerMime = request.headers.get("content-type");
    const contentType =
      headerMime && headerMime !== "application/octet-stream"
        ? headerMime
        : mimeType || (effectiveIsVideo ? "video/mp4" : "application/octet-stream");

    const client = buildR2Client();
    const partSize = 8 * 1024 * 1024;
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: storageKey,
        ContentType: contentType,
        Body: request.body,
      },
      queueSize: 1,
      partSize,
      leavePartsOnError: false,
    });

    const putResult = await upload.done();
    const publicUrl = `${publicBase}/${storageKey}`;
    const etag = putResult?.ETag ? String(putResult.ETag).replace(/^"|"$/g, "") : null;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      storageKey,
      folder: sanitizeFolder(folderRaw, "uploads"),
      bucket,
      fileName: storageKey,
      type: contentType,
      mimeType: contentType,
      size: size > 0 ? size : null,
      etag,
      originalName: originalName || undefined,
    });
  } catch (error) {
    console.error("[api:upload:stream] Error streaming upload:", error);
    const msg = error?.message || String(error) || "upload_stream_failed";
    const code = error?.Code || error?.name || error?.code || null;
    return NextResponse.json(
      {
        error: `Error interno: ${msg}`,
        error_code: code,
        error_name: error?.name || null,
      },
      { status: code === "r2_not_configured" || msg.includes("r2_not_configured") ? 500 : 502 }
    );
  }
}
