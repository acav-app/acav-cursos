import { corsPreflight, errorJson, json } from "@/lib/api-helpers";
import { EDUCATIONAL_ENROLLMENT_STATUSES } from "@/lib/courses/constants";
import { listEnrollments } from "@/lib/courses/server/enrollments";
import { assertAdmin, requireCourseActor } from "@/lib/courses/server/auth";
import { listPortalUsers } from "@/lib/courses/server/users";

export const runtime = "nodejs";

type ContactRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  province: string;
  role: string;
  isMember: boolean;
  isActive: string;
  accountStatus: string;
  courses: Set<string>;
  enrollmentCount: number;
  lastEnrollmentAt: string;
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function firstNonEmpty(...values: unknown[]) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  try {
    const actor = await requireCourseActor(request);
    assertAdmin(actor);

    const body = await request.json().catch(() => ({}));
    const requestedEmails = new Set(
      (Array.isArray(body?.emails) ? body.emails : [])
        .map(normalizeEmail)
        .filter(Boolean)
    );
    if (!requestedEmails.size) return json({ contacts: [] }, { status: 200 }, request);

    const [users, enrollments] = await Promise.all([
      listPortalUsers({ limit: 0 }),
      listEnrollments({ actor }),
    ]);

    const contacts = new Map<string, ContactRow>();
    const getOrCreate = (email: string) => {
      let contact = contacts.get(email);
      if (!contact) {
        contact = {
          firstName: "",
          lastName: "",
          email,
          phone: "",
          city: "",
          province: "",
          role: "Alumno",
          isMember: false,
          isActive: "",
          accountStatus: "",
          courses: new Set<string>(),
          enrollmentCount: 0,
          lastEnrollmentAt: "",
        };
        contacts.set(email, contact);
      }
      return contact;
    };

    for (const user of users) {
      if (user.role !== "alumno") continue;
      const email = normalizeEmail(user.email);
      if (!email || !requestedEmails.has(email)) continue;
      const contact = getOrCreate(email);
      const profileNameParts = firstNonEmpty(user.displayName, user.fullName).split(/\s+/).filter(Boolean);
      contact.firstName = firstNonEmpty(contact.firstName, user.firstName, profileNameParts.shift());
      contact.lastName = firstNonEmpty(contact.lastName, user.lastName, profileNameParts.join(" "));
      contact.phone = firstNonEmpty(contact.phone, user.phone);
      contact.city = firstNonEmpty(contact.city, user.city);
      contact.province = firstNonEmpty(contact.province, user.province);
      contact.isMember = Boolean(user.isMember);
      contact.isActive = user.isActive === false ? "Inactivo" : "Activo";
      contact.accountStatus = String(user.accountStatus || "");
    }

    for (const enrollment of enrollments) {
      if (!EDUCATIONAL_ENROLLMENT_STATUSES.includes(enrollment.status as (typeof EDUCATIONAL_ENROLLMENT_STATUSES)[number])) {
        continue;
      }
      const email = normalizeEmail(enrollment.email);
      if (!email || !requestedEmails.has(email)) continue;
      const contact = getOrCreate(email);
      const fullName = firstNonEmpty(
        enrollment.studentName,
        [enrollment.firstName, enrollment.lastName].filter(Boolean).join(" ")
      );
      if (!contact.firstName && fullName) {
        const parts = fullName.split(/\s+/);
        contact.firstName = parts.shift() || "";
        contact.lastName = parts.join(" ");
      }
      contact.phone = firstNonEmpty(contact.phone, enrollment.phone);
      contact.city = firstNonEmpty(contact.city, enrollment.city);
      contact.province = firstNonEmpty(contact.province, enrollment.province);
      const courseTitle = firstNonEmpty(enrollment.courseTitle, enrollment.jobTitle);
      if (courseTitle) contact.courses.add(courseTitle);
      contact.enrollmentCount += 1;
      const createdAt = String(enrollment.createdAt || "");
      if (createdAt && (!contact.lastEnrollmentAt || createdAt > contact.lastEnrollmentAt)) {
        contact.lastEnrollmentAt = createdAt;
      }
    }

    const rows = Array.from(contacts.values())
      .map((contact) => ({
        ...contact,
        firstName: contact.firstName,
        lastName: contact.lastName,
        courses: Array.from(contact.courses).sort().join(", "),
      }))
      .sort((a, b) => a.email.localeCompare(b.email));

    return json({ contacts: rows }, { status: 200 }, request);
  } catch (e: any) {
    return errorJson(e?.message || "internal_error", e?.status || 500, request);
  }
}
