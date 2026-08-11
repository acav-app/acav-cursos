import "server-only";

import { headers } from "next/headers";
import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import { DEFAULT_COURSE_SETTINGS } from "@/lib/courses/defaults";
import { normalizePublicR2Url } from "@/lib/r2/normalize-public-url";

function trimSlash(value: string) {
  return String(value || "").replace(/\/+$/g, "");
}

function getBaseUrlCandidates() {
  const candidates = new Set<string>();
  const envBase =
    trimSlash(process.env.NEXT_PUBLIC_SITE_URL || "") ||
    trimSlash(process.env.SITE_URL || "") ||
    trimSlash(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (envBase) candidates.add(envBase);

  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  candidates.add(`${proto}://${host}`);

  if (process.env.NODE_ENV !== "production") {
    candidates.add("http://localhost:3000");
    candidates.add("http://localhost:3001");
    candidates.add("http://127.0.0.1:3000");
    candidates.add("http://127.0.0.1:3001");
  }

  return Array.from(candidates);
}

async function publicFetch(pathname: string) {
  let lastStatus = "unknown";

  for (const baseUrl of getBaseUrlCandidates()) {
    try {
      const res = await fetch(`${baseUrl}${pathname}`, {
        cache: "no-store",
        headers: {
          accept: "application/json",
        },
      });

      if (res.ok) {
        return res.json();
      }

      lastStatus = String(res.status);
    } catch (error: any) {
      lastStatus = error?.message || "fetch_error";
    }
  }

  throw new Error(`public_fetch_failed:${lastStatus}`);
}

function formatDateLabel(isoDate?: string | null) {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function diffInDays(isoDate?: string | null) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function parseLines(text: string | undefined | null) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-•\u2022]+/, "").trim())
    .filter(Boolean);
}

function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function mapCourseForCard(course: any) {
  const publishedLabel = course?.publishedAt ? `Publicado el ${formatDateLabel(course.publishedAt)}` : "";
  const expiresDays = diffInDays(course?.expiresAt);
  const expiresLabel =
    typeof expiresDays === "number"
      ? expiresDays >= 0
        ? `Cierra en ${expiresDays} dia${expiresDays === 1 ? "" : "s"}`
        : "Curso finalizado"
      : "Sin fecha limite";

  const publishedDays = diffInDays(course?.publishedAt ? new Date(course.publishedAt).toISOString() : null);
  const isNew = typeof publishedDays === "number" ? publishedDays >= -7 : false;
  const instructorName = String(
    course?.instructorName ||
      course?.academyName ||
      course?.institutionName ||
      course?.companyName ||
      ""
  ).trim();
  const benefitsList = parseLines(course?.benefits);
  const requirementsList = parseLines(course?.requirements);
  const imageUrl = normalizePublicR2Url(course?.imageUrl || course?.flyerUrl || "");
  const thumbnailUrl = normalizePublicR2Url(course?.thumbnailUrl || imageUrl);
  const videoUrl = normalizePublicR2Url(course?.videoUrl || "");
  const formattedPrice = course?.freeCourse ? "Gratuito" : `Precio socios ${formatCurrency(course?.price)}`;
  const formattedOldPrice = course?.oldPrice ? `No socios ${formatCurrency(course?.oldPrice)}` : "";

  return {
    ...course,
    institutionId: course?.institutionId || course?.companyId || "",
    institutionName: course?.institutionName || course?.companyName || "",
    institutionLogoUrl: course?.institutionLogoUrl || course?.companyLogoUrl || "",
    companyName: course?.institutionName || course?.companyName || "",
    modalidad: course?.modality || course?.workMode || course?.initialModality || "",
    publishedLabel,
    expiresLabel,
    isNew,
    categoryLabel: String(course?.subRubro || course?.area || "").trim(),
    secondaryCategoryLabel:
      String(course?.subRubro || "").trim() && String(course?.subRubro || "").trim() !== String(course?.area || "").trim()
        ? String(course?.subRubro || "").trim()
        : "",
    modalityLabel: String(course?.modality || course?.workMode || course?.initialModality || "").trim(),
    contractTypeLabel: String(course?.duration || course?.contractType || "").trim(),
    instructorName,
    shortDescription: String(course?.shortDescription || "").trim(),
    excerpt:
      String(course?.shortDescription || course?.description || "")
        .replace(/\s+/g, " ")
        .trim(),
    benefitsList,
    requirementsList,
    attachments: Array.isArray(course?.attachments) ? course.attachments : [],
    modules: Array.isArray(course?.modules) ? course.modules : [],
    curriculum: Array.isArray(course?.curriculum) ? course.curriculum : [],
    finalEvaluation:
      course?.finalEvaluation && typeof course.finalEvaluation === "object"
        ? course.finalEvaluation
        : { enabled: false, questions: [] },
    learningObjectives: Array.isArray(course?.learningObjectives) ? course.learningObjectives : [],
    targetAudience: Array.isArray(course?.targetAudience) ? course.targetAudience : [],
    imageUrl,
    thumbnailUrl,
    videoUrl,
    pricingLabel: formattedPrice,
    oldPricingLabel: formattedOldPrice,
    durationLabel: String(course?.duration || "").trim(),
  };
}

export function mapCourseHistory(course: any) {
  return {
    id: course?.id,
    title: course?.title || "Curso",
    companyName: course?.institutionName || course?.companyName || "Institucion",
    city: course?.city || "Sin ciudad",
    statusLabel: course?.status === "vencida" ? "Curso finalizado" : "Curso cerrado",
  };
}

export async function getPublicCourses(options?: {
  scope?: "active" | "history";
  slug?: string;
  institutionId?: string;
  companyId?: string;
  area?: string;
  subRubro?: string;
}) {
  try {
    const params = new URLSearchParams();
    if (options?.scope) params.set("scope", options.scope);
    if (options?.slug) params.set("slug", options.slug);
    if (options?.institutionId) params.set("institutionId", options.institutionId);
    if (options?.companyId) params.set("companyId", options.companyId);
    if (options?.area) params.set("area", options.area);
    if (options?.subRubro) params.set("subRubro", options.subRubro);

    const query = params.toString();
    const data = await publicFetch(`/api/courses${query ? `?${query}` : ""}`);
    return Array.isArray(data?.courses) ? data.courses : [];
  } catch (error) {
    console.error("Error cargando cursos publicos", error);
    return [];
  }
}

export async function getPublicCourseBySlug(slug: string) {
  const courses = await getPublicCourses({ slug });
  return courses[0] || null;
}

export async function getPublicCourseById(id: string) {
  try {
    const data = await publicFetch(`/api/courses/${encodeURIComponent(id)}`);
    return data?.course || null;
  } catch (error) {
    console.error("Error cargando curso publico por id", error);
    return null;
  }
}

export async function getPublicInstitutions(options?: { slug?: string }) {
  try {
    const params = new URLSearchParams();
    if (options?.slug) params.set("slug", options.slug);
    const query = params.toString();
    const data = await publicFetch(`/api/institutions${query ? `?${query}` : ""}`);
    return Array.isArray(data?.institutions) ? data.institutions : [];
  } catch (error) {
    console.error("Error cargando instituciones publicas", error);
    return [];
  }
}

export async function getPublicInstitutionBySlug(slug: string) {
  const institutions = await getPublicInstitutions({ slug });
  return institutions[0] || null;
}

export async function getPublicCourseSettings() {
  try {
    const data = await publicFetch("/api/courses/settings");
    return { ...DEFAULT_COURSE_SETTINGS, ...(data?.settings || {}) };
  } catch (error) {
    console.error("Error cargando configuracion publica de cursos", error);
    return DEFAULT_COURSE_SETTINGS;
  }
}

export async function getPublicCourseStats() {
  try {
    const db = getAdminDb();
    const enrollmentsSnap = await db.collection(COURSE_COLLECTIONS.enrollments).get();
    return {
      enrollments: enrollmentsSnap.size,
    };
  } catch (error) {
    console.error("Error cargando estadisticas publicas de cursos", error);
    return {
      enrollments: 0,
    };
  }
}
