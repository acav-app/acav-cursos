import { getAdminDb } from "@/lib/firebase-admin";

const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

function formatDayInTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  const day = parts.find((part) => part.type === "day")?.value || "01";

  return `${year}-${month}-${day}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function slugify(input: unknown) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function removeUndefined<T extends Record<string, any>>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return (value as any[]).map((item) =>
      item && typeof item === "object" ? removeUndefined(item as any) : item
    ) as unknown as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const keys = Object.keys(value);
  const next: Record<string, any> = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = (value as Record<string, any>)[key];
    if (val === undefined) continue;
    if (val === null) {
      next[key] = null;
      continue;
    }
    if (Array.isArray(val)) {
      next[key] = val.map((item) =>
        item && typeof item === "object" ? removeUndefined(item as any) : item
      );
      continue;
    }
    if (typeof val === "object") {
      next[key] = removeUndefined(val as any);
      continue;
    }
    next[key] = val;
  }
  return next as T;
}

export function ensureDateIsTodayOrFuture(isoDate: string) {
  const rawValue = String(isoDate || "").trim();
  const date = new Date(rawValue);
  if (!rawValue || Number.isNaN(date.getTime())) {
    const error = new Error("invalid_date") as Error & { status?: number };
    error.status = 400;
    throw error;
  }

  const inputDay = rawValue.slice(0, 10);
  const todayDay = formatDayInTimeZone(new Date());

  if (inputDay < todayDay) {
    const error = new Error("expires_at_must_be_future") as Error & { status?: number };
    error.status = 400;
    throw error;
  }
}

export async function ensureUniqueSlug(collectionName: string, rawSlug: string, excludeId?: string) {
  const db = getAdminDb();
  const base = slugify(rawSlug) || "item";
  let candidate = base;
  let suffix = 2;

  while (true) {
    const snap = await db.collection(collectionName).where("slug", "==", candidate).limit(5).get();
    const conflict = snap.docs.find((doc) => doc.id !== excludeId);
    if (!conflict) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

export function isTruthy(value: unknown) {
  return value === true || value === "true" || value === "1" || value === 1;
}
