import { NextResponse } from "next/server";
import { randomBytes, createHmac, createHash } from "crypto";
import { COURSE_VIDEO_ALLOWED_TYPES, COURSE_VIDEO_MAX_SIZE_BYTES } from "@/lib/courses/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
      .replace(/[^a-zA-Z0-9/_-]/g, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "") || fallback
  );
}

function readEnv() {
  const endpoint = String(process.env.R2_ENDPOINT || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(process.env.R2_BUCKET || "").trim();
  const publicBase = buildPublicBase(process.env.R2_PUBLIC_BASE, bucket);
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    throw new Error("r2_not_configured");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket, publicBase };
}

function isoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function ymd(date) {
  return isoDate(date).slice(0, 8);
}

function uriEncodeComponent(str, encodeSlash = true) {
  return encodeURIComponent(str)
    .replace(/%2F/g, encodeSlash ? "%2F" : "/")
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmacSha256(key, data) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data) {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Firma SigV4 en modo query string compatible con Cloudflare R2.
 * Incluye X-Amz-Content-SHA256=UNSIGNED-PAYLOAD para evitar que R2 intente
 * recalcular el hash de streaming (evita el error "Unable to calculate hash
 * for flowing readable stream").
 */
function createSignedPutUrl({
  endpoint,
  bucket,
  key,
  region = "auto",
  accessKeyId,
  secretAccessKey,
  expiresInSeconds = 30 * 60,
  now = new Date(),
}) {
  const X_AMZ_ALGORITHM = "AWS4-HMAC-SHA256";
  const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

  const amzDate = isoDate(now);
  const dateStamp = ymd(now);
  const expires = Math.max(1, Math.min(604800, Number(expiresInSeconds) || 1800));
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  const urlParsed = new URL(
    endpoint.endsWith(`/${bucket}`) || endpoint.includes(`${bucket}.`)
      ? endpoint
      : `${endpoint.replace(/\/$/, "")}/${bucket}`
  );
  const finalKey = String(key || "").replace(/^\/+/, "");
  const canonicalUri = `/${uriEncodeComponent(finalKey, false)}`;

  const query = new Map();
  query.set("X-Amz-Algorithm", X_AMZ_ALGORITHM);
  query.set("X-Amz-Credential", `${accessKeyId}/${credentialScope}`);
  query.set("X-Amz-Date", amzDate);
  query.set("X-Amz-Expires", String(expires));
  query.set("X-Amz-Content-SHA256", UNSIGNED_PAYLOAD);
  query.set("X-Amz-SignedHeaders", "host;x-amz-content-sha256");

  const signedHeaders = "host;x-amz-content-sha256";
  const canonicalHeaders =
    `host:${urlParsed.host.toLowerCase()}\n` +
    `x-amz-content-sha256:${UNSIGNED_PAYLOAD}\n`;

  const canonicalQueryString = Array.from(query.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    UNSIGNED_PAYLOAD,
  ].join("\n");

  const hashedCanonical = sha256Hex(canonicalRequest);
  const stringToSign = [
    X_AMZ_ALGORITHM,
    amzDate,
    credentialScope,
    hashedCanonical,
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  const finalQuery = new URLSearchParams(canonicalQueryString);
  finalQuery.set("X-Amz-Signature", signature);

  const final = new URL(urlParsed.toString().replace(/\/?$/, "") + canonicalUri);
  final.search = finalQuery.toString();
  return final.toString();
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

    const { endpoint, accessKeyId, secretAccessKey, bucket, publicBase } = readEnv();

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

    const uploadUrl = createSignedPutUrl({
      endpoint,
      bucket,
      key: storageKey,
      region: "auto",
      accessKeyId,
      secretAccessKey,
      expiresInSeconds: 30 * 60,
    });

    const headerMime = request.headers.get("content-type");
    const contentType =
      headerMime && headerMime !== "application/octet-stream"
        ? headerMime
        : mimeType || (effectiveIsVideo ? "video/mp4" : "application/octet-stream");

    const r2Response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "X-Amz-Content-SHA256": "UNSIGNED-PAYLOAD",
      },
      // @ts-ignore - duplex es permitido en Node.js >= 18
      body: request.body,
      duplex: "half",
    });

    if (!r2Response.ok) {
      const body = await r2Response.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Error al subir a R2 (HTTP ${r2Response.status}): ${body.slice(0, 500)}`,
        },
        { status: 502 }
      );
    }

    const etagRaw = r2Response.headers.get("ETag");
    const etag = etagRaw ? String(etagRaw).replace(/^"|"$/g, "") : null;
    const publicUrl = `${publicBase}/${storageKey}`;

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
    console.error("Error al realizar upload streaming a R2:", error);
    return NextResponse.json(
      { error: `Error interno: ${error?.message || String(error)}` },
      { status: 500 }
    );
  }
}
