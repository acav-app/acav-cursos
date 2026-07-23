import { z } from "zod";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { COURSE_COLLECTIONS } from "@/lib/courses/collections";
import { createInstitution } from "@/lib/courses/server/institutions";
import { createPortalUserProfile } from "@/lib/courses/server/users";
import { sendInstitutionWelcomeEmail } from "@/lib/courses/server/notifications";
import { err } from "@/lib/courses/server/errors";
import { slugify } from "@/lib/courses/server/utils";

function sanitizeLooseUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const cleaned = raw
    .replace(/^[`"'\\s]+/, "")
    .replace(/[`"'\\s]+$/, "")
    .trim();

  if (!cleaned) return "";
  return cleaned;
}

const InstitutionSignupSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  companyName: z.string().min(2).optional(),
  institutionName: z.string().min(2).optional(),
  businessName: z.string().optional(),
  cuit: z.string().optional(),
  slug: z.string().min(1).optional(),
  subRubro: z.string().min(1),
  customSubRubro: z.string().optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  rnvaLicense: z.string().optional(),
  isAcavMember: z.boolean().optional(),
  logoUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  lang: z.string().optional(),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: "terms_required",
  }),
});

export async function registerInstitution(
  input: unknown,
  options?: {
    appBaseUrl?: string;
  }
) {
  const parsed = InstitutionSignupSchema.parse(input);
  const auth = getAdminAuth();
  const db = getAdminDb();
  const email = String(parsed.email || "").trim().toLowerCase();
  const lang = String(parsed.lang || "es").trim() || "es";
  const appBaseUrl = String(options?.appBaseUrl || "").replace(/\/+$/g, "");
  const loginUrl = appBaseUrl ? `${appBaseUrl}/${lang}/auth/login` : "";
  const dashboardUrl = appBaseUrl ? `${appBaseUrl}/${lang}/dashboard` : "";
  const institutionName = String(parsed.institutionName || parsed.companyName || "").trim();
  const requestedSlug = slugify(parsed.slug || institutionName);

  try {
    await auth.getUserByEmail(email);
    throw err(409, "email_already_in_use");
  } catch (error: any) {
    if (error?.message === "email_already_in_use") throw error;
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  if (requestedSlug) {
    const existingInstitution = await db
      .collection(COURSE_COLLECTIONS.institutions)
      .where("slug", "==", requestedSlug)
      .limit(1)
      .get();

    if (!existingInstitution.empty) {
      throw err(409, "institution_already_registered");
    }
  }

  const authUser = await auth.createUser({
    email,
    password: String(parsed.password),
    displayName: `${parsed.firstName} ${parsed.lastName}`.trim(),
    disabled: false,
  });

  try {
    const actor = {
      uid: String(authUser.uid),
      email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      displayName: `${parsed.firstName} ${parsed.lastName}`.trim(),
      role: "empresa" as const,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const institution = await createInstitution(
      {
        name: institutionName,
        slug: parsed.slug || institutionName,
        businessName: parsed.businessName,
        cuit: parsed.cuit,
        description: parsed.description,
        logoUrl: sanitizeLooseUrl(parsed.logoUrl) || undefined,
        coverUrl: sanitizeLooseUrl(parsed.coverUrl) || undefined,
        email,
        phone: parsed.phone,
        website: sanitizeLooseUrl(parsed.website) || undefined,
        linkedinUrl: sanitizeLooseUrl(parsed.linkedinUrl) || undefined,
        instagramUrl: sanitizeLooseUrl(parsed.instagramUrl) || undefined,
        facebookUrl: sanitizeLooseUrl(parsed.facebookUrl) || undefined,
        address: parsed.address,
        city: parsed.city,
        province: parsed.province,
        subRubro: parsed.subRubro,
        customSubRubro: parsed.subRubro === "Otro" ? parsed.customSubRubro : undefined,
        rnvaLicense: parsed.rnvaLicense,
        isAcavMember: parsed.isAcavMember,
      },
      actor
    );

    const user = await createPortalUserProfile({
      uid: authUser.uid,
      email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      displayName: `${parsed.firstName} ${parsed.lastName}`.trim(),
      role: "empresa",
      institutionId: institution.id,
      isActive: true,
    });

    await sendInstitutionWelcomeEmail({
      to: email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      institutionName: institution.name,
      city: parsed.city,
      website: sanitizeLooseUrl(parsed.website) || undefined,
      loginUrl,
      dashboardUrl,
    });

    return { user, institution };
  } catch (error) {
    await auth.deleteUser(authUser.uid).catch(() => {});
    throw error;
  }
}
