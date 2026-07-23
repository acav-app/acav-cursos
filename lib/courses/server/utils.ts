import { getAdminDb } from "@/lib/firebase-admin";

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
  const next = { ...value };
  Object.keys(next).forEach((key) => {
    if (next[key] === undefined) delete next[key];
  });
  return next;
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
  const todayDay = new Date().toISOString().slice(0, 10);

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
