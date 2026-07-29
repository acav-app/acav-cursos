import { getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import {
  InstitutionCreateSchema,
  InstitutionUpdateSchema,
  type Institution,
} from "@/lib/courses/schemas";
import type { CourseActor } from "@/lib/courses/server/auth";
import { err } from "@/lib/courses/server/errors";
import { ensureUniqueSlug, normalizeString, nowIso, removeUndefined } from "@/lib/courses/server/utils";

function toInstitution(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return { id: doc.id, ...(doc.data() as any) } as Institution;
}

export function toPublicInstitution(institution: Institution) {
  return {
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    businessName: institution.businessName || "",
    cuit: institution.cuit || "",
    description: institution.description || "",
    logoUrl: institution.logoUrl || "",
    coverUrl: institution.coverUrl || "",
    website: institution.website || "",
    linkedinUrl: institution.linkedinUrl || "",
    instagramUrl: institution.instagramUrl || "",
    facebookUrl: institution.facebookUrl || "",
    city: institution.city || "",
    province: institution.province || "",
    subRubro: institution.subRubro,
    customSubRubro: institution.customSubRubro || "",
    rnvaLicense: institution.rnvaLicense || "",
    isAcavMember: Boolean(institution.isAcavMember),
    status: institution.status,
  };
}

export async function listInstitutions(options?: {
  publicOnly?: boolean;
  actor?: CourseActor | null;
  status?: string;
  institutionId?: string;
  companyId?: string;
  slug?: string;
}) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.institutions).orderBy("createdAt", "desc").get();
  let institutions = snap.docs.map(toInstitution);

  if (options?.publicOnly) {
    institutions = institutions.filter((institution) => institution.status === "activa");
  }

  if (options?.status) {
    institutions = institutions.filter((institution) => institution.status === options.status);
  }

  const institutionId = String(options?.institutionId || options?.companyId || "").trim();
  if (institutionId) {
    institutions = institutions.filter((institution) => institution.id === institutionId);
  }

  if (options?.slug) {
    institutions = institutions.filter((institution) => institution.slug === options.slug);
  }

  return options?.publicOnly ? institutions.map(toPublicInstitution) : institutions;
}

export async function getInstitutionById(id: string) {
  const db = getAdminDb();
  const snap = await db.collection(COURSE_COLLECTIONS.institutions).doc(String(id)).get();
  if (!snap.exists) return null;
  return toInstitution(snap);
}

export async function createInstitution(input: unknown, actor: CourseActor) {
  const parsed = InstitutionCreateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.institutions).doc();
  const now = nowIso();
  const slug = await ensureUniqueSlug(COURSE_COLLECTIONS.institutions, parsed.slug || parsed.name);
  const ownerUserId = normalizeString(parsed.ownerUserId) || actor.uid;

  const payload = removeUndefined({
    name: parsed.name,
    slug,
    businessName: parsed.businessName,
    cuit: parsed.cuit,
    description: parsed.description,
    logoUrl: parsed.logoUrl,
    coverUrl: parsed.coverUrl,
    email: parsed.email,
    phone: parsed.phone,
    website: parsed.website,
    linkedinUrl: parsed.linkedinUrl,
    instagramUrl: parsed.instagramUrl,
    facebookUrl: parsed.facebookUrl,
    address: parsed.address,
    city: parsed.city,
    province: parsed.province,
    subRubro: parsed.subRubro,
    customSubRubro: parsed.customSubRubro,
    rnvaLicense: parsed.rnvaLicense,
    isAcavMember: parsed.isAcavMember,
    isVerified: parsed.isVerified ?? true,
    status: parsed.status ?? "activa",
    ownerUserId: ownerUserId || undefined,
    createdAt: now,
    updatedAt: now,
  });

  await ref.set(payload);
  return { id: ref.id, ...(payload as any) } as Institution;
}

export async function updateInstitution(
  id: string,
  input: unknown,
  options?: { actor?: CourseActor | null }
) {
  const parsed = InstitutionUpdateSchema.parse(input);
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.institutions).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) throw err(404, "institution_not_found");

  const slug = parsed.slug
    ? await ensureUniqueSlug(COURSE_COLLECTIONS.institutions, parsed.slug, id)
    : undefined;

  const payload = removeUndefined({
    ...parsed,
    slug,
    updatedAt: nowIso(),
  });

  await ref.set(payload, { merge: true });

  const updated = await ref.get();
  return {
    institution: toInstitution(updated),
    automation: {
      triggered: false,
      transition: "none",
      totalEnrollments: 0,
      eligibleEnrollments: 0,
      updatedEnrollments: 0,
      alreadyProcessedEnrollments: 0,
      totalCourses: 0,
      resumedCourses: 0,
      pausedCourses: 0,
      expiredCourses: 0,
      alreadyManagedCourses: 0,
      reviewedBy: options?.actor?.uid || "",
    },
  };
}

export async function deleteInstitution(id: string) {
  const db = getAdminDb();
  const ref = db.collection(COURSE_COLLECTIONS.institutions).doc(String(id));
  const existing = await ref.get();
  if (!existing.exists) throw err(404, "institution_not_found");
  await ref.delete();
}
