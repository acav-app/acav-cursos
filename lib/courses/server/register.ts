import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createPortalUserProfile } from "@/lib/courses/server/users";
import { err } from "@/lib/courses/server/errors";

const PublicRegisterSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  acceptedTerms: z.boolean().refine((value) => value === true, {
    message: "terms_required",
  }),
  documentNumber: z.string().min(4, { message: "document_number_required" }),
  agency: z.string().optional(),
  employeeFileNumber: z.string().optional(),
  phone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  isMember: z.boolean().default(false),
});

export async function registerCourseStudent(input: unknown) {
  const parsed = PublicRegisterSchema.parse(input);
  const auth = getAdminAuth();
  const email = String(parsed.email || "").trim().toLowerCase();
  const contactEmail = String(parsed.contactEmail || "").trim().toLowerCase() || email;
  const documentNumber = String(parsed.documentNumber || "").trim();
  const agency = String(parsed.agency || "").trim() || undefined;
  const employeeFileNumber = String(parsed.employeeFileNumber || "").trim() || undefined;
  const phone = String(parsed.phone || "").trim() || undefined;
  const isMember = typeof parsed.isMember === "boolean" ? parsed.isMember : false;

  try {
    await auth.getUserByEmail(email);
    throw err(409, "email_already_in_use");
  } catch (error: any) {
    if (error?.message === "email_already_in_use") throw error;
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }
  }

  const authUser = await auth.createUser({
    email,
    password: String(parsed.password),
    displayName: `${parsed.firstName} ${parsed.lastName}`.trim(),
    disabled: false,
  });

  try {
    const user = await createPortalUserProfile({
      uid: authUser.uid,
      email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      displayName: `${parsed.firstName} ${parsed.lastName}`.trim(),
      fullName: `${parsed.firstName} ${parsed.lastName}`.trim(),
      documentNumber,
      agency,
      employeeFileNumber,
      phone,
      contactEmail,
      isMember,
      role: "alumno",
      isActive: true,
    });

    return { user };
  } catch (error) {
    await auth.deleteUser(authUser.uid).catch(() => {});
    throw error;
  }
}
