import { z } from "zod";
import {
  COURSE_AREAS,
  COURSE_CATEGORIES,
  COURSE_CLOSE_REASONS,
  COURSE_LANGUAGES,
  COURSE_LEVELS,
  COURSE_MODALITIES,
  COURSE_PUBLICATION_VISIBILITY,
  COURSE_SALES_MODALITIES,
  COURSE_PACE_OPTIONS,
  COURSE_SCHEDULE_OPTIONS,
  COURSE_STATUSES,
  COURSE_VIDEO_ALLOWED_TYPES,
  COURSE_VIDEO_MAX_SIZE_BYTES,
  ENROLLMENT_STATUSES,
  INSTITUTION_STATUSES,
  PORTAL_ROLES,
} from "@/lib/courses/constants";

export const CourseIsoDateString = z.string().min(1);

const OptionalString = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().trim().optional()
);

const OptionalUrl = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().url().optional()
);

const OptionalEmail = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.string().email().optional()
);

const StringArray = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value];
    return [];
  },
  z.array(z.string().min(1)).min(1)
);

const OptionalStringArray = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value];
    return [];
  },
  z.array(z.string().min(1)).default([])
);

const CourseModuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: OptionalString.optional(),
  lessons: z.array(z.string().min(1)).default([]),
});

export const PortalRoleSchema = z.enum(PORTAL_ROLES);
export const InstitutionStatusSchema = z.enum(INSTITUTION_STATUSES);
export const CourseStatusSchema = z.enum(COURSE_STATUSES);
export const EnrollmentStatusSchema = z.enum(ENROLLMENT_STATUSES);

export const PortalUserProfileSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: OptionalString.optional(),
  firstName: OptionalString.optional(),
  lastName: OptionalString.optional(),
  role: PortalRoleSchema,
  companyId: OptionalString.optional(),
  companyName: OptionalString.optional(),
  institutionId: OptionalString.optional(),
  institutionName: OptionalString.optional(),
  isActive: z.boolean().default(true),
  createdAt: CourseIsoDateString,
  updatedAt: CourseIsoDateString,
});

export type PortalUserProfile = z.infer<typeof PortalUserProfileSchema>;

export const InstitutionCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  businessName: OptionalString.optional(),
  cuit: OptionalString.optional(),
  description: OptionalString.optional(),
  logoUrl: OptionalUrl.optional(),
  coverUrl: OptionalUrl.optional(),
  email: z.string().email(),
  phone: OptionalString.optional(),
  website: OptionalUrl.optional(),
  linkedinUrl: OptionalUrl.optional(),
  instagramUrl: OptionalUrl.optional(),
  facebookUrl: OptionalUrl.optional(),
  address: OptionalString.optional(),
  city: OptionalString.optional(),
  province: OptionalString.optional(),
  subRubro: z.enum(COURSE_CATEGORIES),
  customSubRubro: OptionalString.optional(),
  rnvaLicense: OptionalString.optional(),
  isAcavMember: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  status: InstitutionStatusSchema.optional(),
  ownerUserId: OptionalString.optional(),
});

export const InstitutionUpdateSchema = InstitutionCreateSchema.partial();

export const InstitutionSchema = InstitutionCreateSchema.extend({
  id: z.string().min(1),
  isVerified: z.boolean().default(false),
  status: InstitutionStatusSchema,
  createdAt: CourseIsoDateString,
  updatedAt: CourseIsoDateString,
});

export type Institution = z.infer<typeof InstitutionSchema>;
export type InstitutionCreateInput = z.infer<typeof InstitutionCreateSchema>;
export type InstitutionUpdateInput = z.infer<typeof InstitutionUpdateSchema>;

export const CourseCreateSchema = z.object({
  title: z.string().min(4),
  slug: z.string().min(1).optional(),
  academyId: z.string().min(1).optional(),
  institutionId: z.string().min(1).optional(),
  institutionName: z.string().min(1).optional(),
  institutionLogoUrl: OptionalUrl.optional(),
  companyId: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  companyLogoUrl: OptionalUrl.optional(),
  subRubro: z.string().trim().min(1),
  customSubRubro: OptionalString.optional(),
  area: z.enum(COURSE_AREAS).optional(),
  customArea: OptionalString.optional(),
  initialModality: z.enum(COURSE_MODALITIES).optional(),
  modality: z.enum(COURSE_SALES_MODALITIES),
  level: z.enum(COURSE_LEVELS),
  language: z.enum(COURSE_LANGUAGES).default("Español"),
  city: OptionalString.optional(),
  contractType: z.enum(COURSE_PACE_OPTIONS).optional(),
  customContractType: OptionalString.optional(),
  workMode: z.enum(COURSE_MODALITIES).optional(),
  scheduleAvailability: OptionalStringArray.optional(),
  customScheduleAvailability: OptionalString.optional(),
  shortDescription: z.string().max(180).optional(),
  description: z.string().min(1),
  requirements: z.string().min(1),
  learningObjectives: OptionalStringArray.optional(),
  targetAudience: OptionalStringArray.optional(),
  modules: z.array(CourseModuleSchema).default([]),
  duration: OptionalString.optional(),
  classes: z.number().int().min(0).optional(),
  benefits: OptionalString.optional(),
  contactEmail: OptionalEmail.optional(),
  mustSendCvByEmail: z.boolean().optional(),
  emailSubject: OptionalString.optional(),
  flyerUrl: OptionalUrl.optional(),
  imageUrl: OptionalUrl.optional(),
  thumbnailUrl: OptionalUrl.optional(),
  videoUrl: OptionalUrl.optional(),
  videoFileName: OptionalString.optional(),
  videoMimeType: z.enum(COURSE_VIDEO_ALLOWED_TYPES).optional(),
  videoSizeBytes: z.number().int().positive().max(COURSE_VIDEO_MAX_SIZE_BYTES).optional(),
  videoDurationSeconds: z.number().min(0).max(60 * 60 * 24).optional(),
  attachments: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      url: z.string().url(),
      sizeBytes: z.number().int().min(0).optional(),
    })
  ).default([]),
  price: z.number().min(0).optional(),
  oldPrice: z.number().min(0).optional(),
  freeCourse: z.boolean().optional(),
  includesCertificate: z.boolean().optional(),
  lifetimeAccess: z.boolean().optional(),
  downloadableResources: z.boolean().optional(),
  recordedClasses: z.boolean().optional(),
  support: z.boolean().optional(),
  featured: z.boolean().optional(),
  allowEnrollment: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  publicationStatus: z.enum(COURSE_PUBLICATION_VISIBILITY).optional(),
  status: CourseStatusSchema.optional(),
  rejectionReason: OptionalString.optional(),
  closeReason: z.enum(COURSE_CLOSE_REASONS).optional(),
  closeComment: OptionalString.optional(),
  expiresAt: CourseIsoDateString,
  createdBy: z.string().min(1).optional(),
  createdByRole: PortalRoleSchema.optional(),
  publishedAt: CourseIsoDateString.optional(),
  closedAt: CourseIsoDateString.optional(),
});

export const CourseUpdateSchema = CourseCreateSchema.partial();

export const CourseSchema = CourseCreateSchema.extend({
  id: z.string().min(1),
  slug: z.string().min(1),
  institutionName: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  status: CourseStatusSchema,
  createdAt: CourseIsoDateString,
  updatedAt: CourseIsoDateString,
});

export type Course = z.infer<typeof CourseSchema>;
export type CourseCreateInput = z.infer<typeof CourseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof CourseUpdateSchema>;
export type CourseModuleInput = z.infer<typeof CourseModuleSchema>;

const EnrollmentBaseSchema = z.object({
  courseId: z.string().min(1).optional(),
  jobId: z.string().min(1).optional(),
  courseTitle: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  institutionId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  institutionName: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  studentName: OptionalString.optional(),
  candidateName: OptionalString.optional(),
  email: z.string().email(),
  phone: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  cvUrl: z.string().min(1),
  linkedinUrl: OptionalUrl.optional(),
  portfolioUrl: OptionalUrl.optional(),
  message: OptionalString.optional(),
  status: EnrollmentStatusSchema.optional(),
  acceptedPrivacy: z.boolean().refine((value) => value === true, {
    message: "privacy_required",
  }),
});

function validateEnrollmentCourseReference(
  values: z.infer<typeof EnrollmentBaseSchema>,
  ctx: z.RefinementCtx
) {
  if (!String(values.courseId || values.jobId || "").trim()) {
    ctx.addIssue({ code: "custom", message: "course_id_required", path: ["courseId"] });
  }
}

export const EnrollmentCreateSchema = EnrollmentBaseSchema.superRefine(validateEnrollmentCourseReference);

export const EnrollmentUpdateSchema = z.object({
  status: EnrollmentStatusSchema.optional(),
  message: OptionalString.optional(),
  reviewedBy: OptionalString.optional(),
});

export const EnrollmentSchema = EnrollmentBaseSchema.extend({
  id: z.string().min(1),
  courseTitle: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  institutionName: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  status: EnrollmentStatusSchema,
  createdAt: CourseIsoDateString,
  updatedAt: CourseIsoDateString,
}).superRefine(validateEnrollmentCourseReference);

export type Enrollment = z.infer<typeof EnrollmentSchema>;
export type EnrollmentCreateInput = z.infer<typeof EnrollmentCreateSchema>;
export type EnrollmentUpdateInput = z.infer<typeof EnrollmentUpdateSchema>;

export const CourseStatSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const SocialLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const LegalLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const TestimonialSchema = z.object({
  quote: z.string().min(1),
  name: z.string().min(1),
  role: OptionalString.optional(),
  city: OptionalString.optional(),
  courseTitle: OptionalString.optional(),
  avatarUrl: OptionalUrl.optional(),
});

export const CourseSettingsSchema = z.object({
  heroTitle: OptionalString.optional(),
  heroSubtitle: OptionalString.optional(),
  heroEyebrow: OptionalString.optional(),
  heroImageUrl: OptionalUrl.optional(),
  stats: z.array(CourseStatSchema).optional(),
  aboutTitle: OptionalString.optional(),
  aboutText: OptionalString.optional(),
  howItWorks: z.array(z.string().min(1)).optional(),
  footerInfo: OptionalString.optional(),
  contactEmail: OptionalEmail.optional(),
  phone: OptionalString.optional(),
  address: OptionalString.optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
  legalLinks: z.array(LegalLinkSchema).optional(),
  testimonials: z.array(TestimonialSchema).optional(),
  adminNotificationEmail: OptionalEmail.optional(),
  emailFrom: OptionalEmail.optional(),
  emailFromName: OptionalString.optional(),
  replyTo: OptionalEmail.optional(),
  notifyAdminOnNewCourse: z.boolean().optional(),
  notifyAdminOnNewEnrollment: z.boolean().optional(),
  notifyInstitutionOnCourseStatusChange: z.boolean().optional(),
  notifyInstitutionOnNewEnrollment: z.boolean().optional(),
  notifyStudentOnEnrollment: z.boolean().optional(),
  notifyAdminOnNewJob: z.boolean().optional(),
  notifyAdminOnNewApplication: z.boolean().optional(),
  notifyCompanyOnJobStatusChange: z.boolean().optional(),
  notifyCompanyOnNewApplication: z.boolean().optional(),
  notifyCandidateOnApplication: z.boolean().optional(),
  createdAt: CourseIsoDateString.optional(),
  updatedAt: CourseIsoDateString.optional(),
});

export type CourseSettings = z.infer<typeof CourseSettingsSchema>;

export const EmailLogSchema = z.object({
  type: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1),
  status: z.enum(["queued", "sent", "error"]),
  relatedCourseId: OptionalString.optional(),
  relatedEnrollmentId: OptionalString.optional(),
  relatedJobId: OptionalString.optional(),
  relatedApplicationId: OptionalString.optional(),
  errorMessage: OptionalString.optional(),
  createdAt: CourseIsoDateString,
});

export type CourseEmailLog = z.infer<typeof EmailLogSchema>;
