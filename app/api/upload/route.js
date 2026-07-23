import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import { COURSE_VIDEO_ALLOWED_TYPES, COURSE_VIDEO_MAX_SIZE_BYTES } from "@/lib/courses/constants";

export const runtime = "nodejs";

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

    if (host.endsWith(".r2.dev")) {
      return base;
    }
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

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const folderRaw = formData.get("folder");
    
    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    const allowedTypes = new Set([
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
    ]);
    const allowedVideoTypes = new Set(COURSE_VIDEO_ALLOWED_TYPES);
    const isImage = String(file.type || "").startsWith("image/");
    const isVideo = allowedVideoTypes.has(String(file.type || ""));
    const isAllowed = isImage || isVideo || allowedTypes.has(String(file.type || ""));
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido' },
        { status: 400 }
      );
    }

    const maxSizeBytes = isVideo ? COURSE_VIDEO_MAX_SIZE_BYTES : 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const maxSizeLabel = isVideo ? `${Math.round(COURSE_VIDEO_MAX_SIZE_BYTES / (1024 * 1024))}MB` : "10MB";
      return NextResponse.json(
        { error: `El archivo es demasiado grande. Máximo ${maxSizeLabel}` },
        { status: 400 }
      );
    }

    const bucket = String(process.env.R2_BUCKET || "").trim();
    const publicBase = buildPublicBase(process.env.R2_PUBLIC_BASE, bucket);
    if (!bucket || !publicBase) {
      return NextResponse.json({ error: "r2_not_configured" }, { status: 500 });
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const randomString = randomBytes(8).toString("hex");
    const extension = file.name.split('.').pop();
    const folder = sanitizeFolder(folderRaw, "uploads");
    const fileName = `${folder}/${timestamp}-${randomString}.${extension}`;

    const client = buildR2Client();
    const body = Buffer.from(await file.arrayBuffer());
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileName,
        Body: body,
        ContentType: file.type || "application/octet-stream",
      })
    );
    const url = `${publicBase}/${fileName}`;

    return NextResponse.json({
      url,
      fileName: fileName,
      size: file.size,
      type: file.type
    });

  } catch (error) {
    console.error('Error al subir archivo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
