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
});

export async function registerCourseStudent(input: unknown) {
  const parsed = PublicRegisterSchema.parse(input);
  const auth = getAdminAuth();
  const email = String(parsed.email || "").trim().toLowerCase();

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
      role: "alumno",
      isActive: true,
    });

    return { user };
  } catch (error) {
    await auth.deleteUser(authUser.uid).catch(() => {});
    throw error;
  }
}
