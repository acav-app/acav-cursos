import { AwsClient } from "aws4fetch";
import { COURSE_VIDEO_ALLOWED_TYPES, COURSE_VIDEO_MAX_SIZE_BYTES } from "@/lib/courses/constants";

export const runtime = "edge";

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

function readEnv(request) {
  const env = process && typeof process !== "undefined" ? process.env : null;
  const endpoint =
    (env ? String(env.R2_ENDPOINT || "").trim() : "") ||
    String(request?.env?.R2_ENDPOINT || "").trim();
  const accessKeyId =
    (env ? String(env.R2_ACCESS_KEY_ID || "").trim() : "") ||
    String(request?.env?.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey =
    (env ? String(env.R2_SECRET_ACCESS_KEY || "").trim() : "") ||
    String(request?.env?.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket =
    (env ? String(env.R2_BUCKET || "").trim() : "") ||
    String(request?.env?.R2_BUCKET || "").trim();
  const publicBaseRaw =
    (env ? String(env.R2_PUBLIC_BASE || "").trim() : "") ||
    String(request?.env?.R2_PUBLIC_BASE || "").trim();
  const publicBase = buildPublicBase(publicBaseRaw, bucket);
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    throw new Error("r2_not_configured");
  }
  return { endpoint, accessKeyId, secretAccessKey, bucket, publicBase };
}

function randomBytesEdge(size) {
  const bytes = new Uint8Array(size);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
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

function jsonResponse(payload, status = 200, headers = undefined) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(headers || {}),
    },
  });
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const folderRaw = url.searchParams.get("folder");
    const keyRaw = url.searchParams.get("key");
    const mimeTypeRaw = url.searchParams.get("mimeType");
    const sizeRaw = url.searchParams.get("size");
    const fileNameRaw = url.searchParams.get("fileName");

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
      return jsonResponse(
        { error: `Tipo de archivo no permitido (${mimeType || "desconocido"} / ext .${fileExt || "?"})` },
        400
      );
    }

    const maxSizeBytes = effectiveIsVideo ? COURSE_VIDEO_MAX_SIZE_BYTES : 250 * 1024 * 1024;
    if (size > maxSizeBytes) {
      const maxSizeLabel = effectiveIsVideo
        ? `${Math.round(COURSE_VIDEO_MAX_SIZE_BYTES / (1024 * 1024))}MB`
        : "250MB";
      return jsonResponse(
        { error: `El archivo es demasiado grande. Máximo ${maxSizeLabel}` },
        400
      );
    }

    if (!request.body) {
      return jsonResponse({ error: "upload_missing_body" }, 400);
    }

    const env = readEnv(request);
    const bucket = env.bucket;
    const publicBase = env.publicBase;

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
        const randomString = randomBytesEdge(6);
        storageKey = `${sanitizeFolder(clean || folderRaw, "uploads")}/${timestamp}-${randomString}.${extension}`;
      }
    } else {
      const timestamp = Date.now();
      const randomString = randomBytesEdge(8);
      const folder = sanitizeFolder(folderRaw, "uploads");
      storageKey = `${folder}/${timestamp}-${randomString}.${extension}`;
    }

    const headerMime = request.headers.get("content-type");
    const contentType =
      headerMime && headerMime !== "application/octet-stream"
        ? headerMime
        : mimeType || (effectiveIsVideo ? "video/mp4" : "application/octet-stream");

    // Cloudflare R2 requiere Content-Length header (HTTP 411 MissingContentLength)
    // para PUTs de tamaño conocido. Edge Runtime no lo propaga si el body llega
    // como ReadableStream chunked; lo agregamos explícitamente:
    // 1) desde request.headers si el cliente lo envió (XHR/File siempre envía Content-Length)
    // 2) fallback desde query param size (cliente upload.js envía siempre size)
    const headerContentLength = Number(request.headers.get("content-length")) || 0;
    const contentLength = Number.isFinite(headerContentLength) && headerContentLength > 0
      ? headerContentLength
      : Number.isFinite(size) && size > 0
      ? size
      : 0;

    const aws = new AwsClient({
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const encodedKey = encodeURIComponent(storageKey).replace(/%2F/g, "/");
    const targetUrl = `${env.endpoint.replace(/\/$/, "")}/${bucket}/${encodedKey}`;

    // aws.sign(url, init) devuelve un Request firmado con SigV4.
    // NO pasar body a aws.sign() (riesgo de envoltura incompatible con streams).
    // Luego extraemos URL + headers firmados, y hacemos fetch() nativo con
    // body = request.body y duplex:"half", SIN usar un Request como 1er arg.
    // Pasar Request object + init con body en Vercel Edge Runtime produce
    // "FUNCTION_PAYLOAD_TOO_LARGE" porque intenta serializar/bufferear el stream.
    const baseHeaders = {
      "Content-Type": contentType,
      "X-Amz-Content-SHA256": "UNSIGNED-PAYLOAD",
    };
    if (contentLength > 0) {
      baseHeaders["Content-Length"] = String(contentLength);
    }
    const signedRequest = await aws.sign(targetUrl, {
      method: "PUT",
      headers: baseHeaders,
    });

    const signedUrl = signedRequest.url;
    const signedHeaders = {};
    signedRequest.headers.forEach((value, key) => {
      signedHeaders[key] = value;
    });

    const r2Response = await fetch(signedUrl, {
      method: "PUT",
      headers: signedHeaders,
      body: request.body,
      // @ts-ignore
      duplex: "half",
    });
    if (!r2Response.ok) {
      let r2Body = "";
      try {
        r2Body = await r2Response.text();
      } catch (_) {}
      const codeMatch = (r2Body || "").match(/<Code>([^<]+)<\/Code>/i);
      const msgMatch = (r2Body || "").match(/<Message>([^<]+)<\/Message>/i);
      const r2Code = codeMatch ? codeMatch[1] : null;
      const r2Message = msgMatch ? msgMatch[1] : r2Body.slice(0, 800);
      console.error(
        "[api:upload:stream][edge] R2 returned HTTP",
        r2Response.status,
        "code=",
        r2Code,
        "msg=",
        r2Message
      );
      return jsonResponse(
        {
          error: `Error al subir a R2 (HTTP ${r2Response.status}${
            r2Code ? ` · ${r2Code}` : ""
          }): ${r2Message || "sin cuerpo de respuesta"}`,
          r2_status: r2Response.status,
          r2_code: r2Code,
          r2_message: r2Message,
          r2_body: (r2Body || "").slice(0, 2000),
        },
        502
      );
    }

    const etagRaw = r2Response.headers.get("ETag");
    const etag = etagRaw ? String(etagRaw).replace(/^"|"$/g, "") : null;
    const publicUrl = `${publicBase}/${storageKey}`;

    return jsonResponse({
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
    console.error("[api:upload:stream][edge] Error streaming upload:", error);
    const msg = error?.message || String(error) || "upload_stream_failed";
    const code = error?.Code || error?.name || error?.code || null;
    const status =
      msg.includes("r2_not_configured") || code === "r2_not_configured" ? 500 : 502;
    return jsonResponse(
      {
        error: `Error interno: ${msg}`,
        error_code: code,
        error_name: error?.name || null,
      },
      status
    );
  }
}
