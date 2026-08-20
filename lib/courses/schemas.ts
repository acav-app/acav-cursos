import { z } from "zod";
import {
  ALLOWED_SCORE_ATTACHMENT_MIME_TYPES,
  COURSE_AREAS,
  COURSE_CATEGORIES,
  COURSE_CLOSE_REASONS,
  COURSE_COMPLETION_STATUSES,
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
  MAX_SCORE_ATTACHMENT_SIZE_BYTES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PORTAL_ROLES,
  USER_ACCOUNT_STATUSES,
} from "@/lib/courses/constants";

export const COURSE_RESOURCE_STATUSES = ["pending", "uploading", "ready", "corrupt", "missing"] as const;
export type CourseResourceStatus = (typeof COURSE_RESOURCE_STATUSES)[number];

export const COURSE_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
  "video/x-m4v",
  "video/avi",
  "video/x-msvideo",
] as const;
export const COURSE_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

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

const OptionalNumber = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    const next = Number(value);
    return Number.isFinite(next) ? next : value;
  },
  z.number().optional()
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

const CourseLessonTypeSchema = z.enum(["video", "text", "live", "quiz", "assignment", "download"]);
const CourseQuestionTypeSchema = z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]);
const CourseResourceStatusSchema = z.enum(COURSE_RESOURCE_STATUSES);
const CourseResourceKindSchema = z.enum(["video", "document", "image", "archive", "link"]);

export const CourseQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  type: CourseQuestionTypeSchema.default("single_choice"),
  options: z.array(z.string().min(1)).default([]),
  correctAnswers: z.array(z.string().min(1)).default([]),
  explanation: OptionalString.optional(),
  points: OptionalNumber.optional(),
});

export const CourseEvaluationSchema = z.object({
  enabled: z.boolean().default(false),
  title: OptionalString.optional(),
  description: OptionalString.optional(),
  passingScore: OptionalNumber.optional(),
  maxAttempts: OptionalNumber.optional(),
  questions: z.array(CourseQuestionSchema).default([]),
  requireAllResourcesReady: z.boolean().default(true),
  locked: z.boolean().default(false),
});

const CourseVideoAssetSchema = z.object({
  id: z.string().min(1).optional(),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  mimeType: z.enum(COURSE_VIDEO_MIME_TYPES as unknown as [string, ...string[]]).optional(),
  fileSize: z.number().min(0).optional(),
  durationSeconds: OptionalNumber.optional(),
  width: OptionalNumber.optional(),
  height: OptionalNumber.optional(),
  status: CourseResourceStatusSchema.default("pending"),
  checksum: z.string().optional(),
  uploadedAt: CourseIsoDateString.optional(),
  originalName: z.string().optional(),
  qualities: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string().url(),
        width: OptionalNumber.optional(),
        height: OptionalNumber.optional(),
      })
    )
    .default([]),
  subtitles: z
    .array(
      z.object({
        src: z.string().url(),
        label: z.string().min(1),
        srclang: z.string().min(2).max(5),
        default: z.boolean().optional(),
      })
    )
    .default([]),
});

const CourseLessonResourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  url: z.string().url(),
  kind: CourseResourceKindSchema.default("document"),
  subKind: z.enum(["pdf", "docx", "doc", "jpg", "jpeg", "png", "webp", "zip", "rar", "other"]).optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().min(0).optional(),
  status: CourseResourceStatusSchema.default("ready"),
  checksum: z.string().optional(),
  storageKey: z.string().optional(),
  uploadedAt: CourseIsoDateString.optional(),
  previewUrl: z.string().url().optional(),
});

const CourseLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: OptionalString.optional(),
  lessonType: CourseLessonTypeSchema.default("video"),
  durationMinutes: OptionalNumber.optional(),
  videoUrl: OptionalUrl.optional(),
  videoAsset: CourseVideoAssetSchema.optional(),
  thumbnailUrl: OptionalUrl.optional(),
  content: OptionalString.optional(),
  isPreview: z.boolean().optional(),
  resources: z.array(CourseLessonResourceSchema).default([]),
  evaluation: CourseEvaluationSchema.optional(),
});

const CourseSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: OptionalString.optional(),
  lessons: z.array(CourseLessonSchema).default([]),
});

export const CourseFinalEvaluationSchema = CourseEvaluationSchema.extend({
  requireAllLessonsEvaluationsCompleted: z.boolean().default(true),
  requireAllResourcesReady: z.boolean().default(true),
});

export const PortalRoleSchema = z.enum(PORTAL_ROLES);
export const UserAccountStatusSchema = z.enum(USER_ACCOUNT_STATUSES);
export const InstitutionStatusSchema = z.enum(INSTITUTION_STATUSES);
export const CourseStatusSchema = z.enum(COURSE_STATUSES);
export const EnrollmentStatusSchema = z.enum(ENROLLMENT_STATUSES);
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export const CourseCompletionStatusSchema = z.enum(COURSE_COMPLETION_STATUSES);

export const ScoreAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: OptionalUrl.optional(),
  storagePath: OptionalString.optional(),
  mimeType: z.enum(ALLOWED_SCORE_ATTACHMENT_MIME_TYPES),
  sizeBytes: z.number().nonnegative().max(MAX_SCORE_ATTACHMENT_SIZE_BYTES),
  uploadedByUid: OptionalString.optional(),
  uploadedAt: CourseIsoDateString.optional(),
});

export const PortalUserProfileSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: OptionalString.optional(),
  firstName: OptionalString.optional(),
  lastName: OptionalString.optional(),
  fullName: OptionalString.optional(),
  documentNumber: OptionalString.optional(),
  agency: OptionalString.optional(),
  employeeFileNumber: OptionalString.optional(),
  phone: OptionalString.optional(),
  contactEmail: OptionalEmail.optional(),
  isMember: z.boolean().optional().default(false),
  city: OptionalString.optional(),
  province: OptionalString.optional(),
  avatar: OptionalUrl.optional(),
  role: PortalRoleSchema,
  companyId: OptionalString.optional(),
  companyName: OptionalString.optional(),
  institutionId: OptionalString.optional(),
  institutionName: OptionalString.optional(),
  isActive: z.boolean().default(true),
  accountStatus: UserAccountStatusSchema.default("active"),
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

export const CourseForumAnswerSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  userEmail: z.string().email(),
  userFullName: OptionalString.optional(),
  enrollmentId: z.string().min(1),
  answer: z.string().min(1),
  createdAt: CourseIsoDateString,
  updatedAt: CourseIsoDateString.optional(),
});

export const CourseForumQuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: OptionalString.optional(),
  createdAt: CourseIsoDateString,
  createdBy: z.string().min(1),
  createdByName: OptionalString.optional(),
  order: z.number().int().min(0).default(0),
  answers: z.array(CourseForumAnswerSchema).default([]),
});

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
  requirements: OptionalString.optional(),
  learningObjectives: OptionalStringArray.optional(),
  targetAudience: OptionalStringArray.optional(),
  modules: z.array(CourseModuleSchema).default([]),
  curriculum: z.array(CourseSectionSchema).default([]),
  finalEvaluation: CourseFinalEvaluationSchema.default({
    enabled: false,
    title: undefined,
    description: undefined,
    passingScore: undefined,
    maxAttempts: undefined,
    questions: [],
  }),
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
  documentationUrl: OptionalUrl.optional(),
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
  forumQuestions: z.array(CourseForumQuestionSchema).default([]),
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
export type CourseSectionInput = z.infer<typeof CourseSectionSchema>;
export type CourseLessonInput = z.infer<typeof CourseLessonSchema>;
export type CourseLessonResourceInput = z.infer<typeof CourseLessonResourceSchema>;
export type CourseQuestionInput = z.infer<typeof CourseQuestionSchema>;
export type CourseFinalEvaluationInput = z.infer<typeof CourseFinalEvaluationSchema>;

const EnrollmentBaseSchema = z.object({
  userId: z.string().min(1).optional(),
  courseId: z.string().min(1).optional(),
  jobId: z.string().min(1).optional(),
  paymentId: z.string().min(1).optional(),
  courseTitle: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  institutionId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  institutionName: z.string().min(1).optional(),
  companyName: z.string().min(1).optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  firstName: OptionalString.optional(),
  lastName: OptionalString.optional(),
  studentName: OptionalString.optional(),
  candidateName: OptionalString.optional(),
  email: z.string().email(),
  phone: OptionalString.optional(),
  city: OptionalString.optional(),
  province: OptionalString.optional(),
  cvUrl: OptionalUrl.optional(),
  linkedinUrl: OptionalUrl.optional(),
  portfolioUrl: OptionalUrl.optional(),
  message: OptionalString.optional(),
  status: EnrollmentStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  paymentReference: OptionalString.optional(),
  paymentReceiptUrl: OptionalUrl.optional(),
  paymentAmount: OptionalNumber.optional(),
  paymentCurrency: OptionalString.optional(),
  courseStatus: CourseCompletionStatusSchema.optional(),
  manualScore: z.number().min(0).max(100).optional(),
  scoreAttachments: z.array(ScoreAttachmentSchema).optional(),
  courseStatusReason: OptionalString.optional(),
  courseStatusUpdatedAt: CourseIsoDateString.optional(),
  courseStatusUpdatedBy: OptionalString.optional(),
  progress: z.number().min(0).max(100).optional(),
  lessonProgress: z
    .array(
      z.object({
        lessonId: z.string().min(1),
        completedAt: CourseIsoDateString.optional(),
      })
    )
    .optional(),
  activitySubmissions: z
    .array(
      z.object({
        lessonId: z.string().min(1),
        title: OptionalString.optional(),
        note: OptionalString.optional(),
        linkUrl: OptionalUrl.optional(),
        status: z.enum(["pending", "submitted", "reviewed"]).optional(),
        submittedAt: CourseIsoDateString.optional(),
        reviewedAt: CourseIsoDateString.optional(),
        feedback: OptionalString.optional(),
      })
    )
    .optional(),
  gradebook: z
    .array(
      z.object({
        sourceType: z.enum(["lesson", "final_evaluation"]),
        sourceId: z.string().min(1),
        title: z.string().min(1),
        score: OptionalNumber.optional(),
        maxScore: OptionalNumber.optional(),
        weight: z.number().min(0).max(1).optional(),
        status: z.enum(["pending", "graded", "passed", "failed"]).optional(),
        reviewedAt: CourseIsoDateString.optional(),
        feedback: OptionalString.optional(),
      })
    )
    .optional(),
  approvedAt: CourseIsoDateString.optional(),
  approvedBy: OptionalString.optional(),
  certificateId: OptionalString.optional(),
  certificateIssuedAt: CourseIsoDateString.optional(),
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
  paymentStatus: PaymentStatusSchema.optional(),
  message: OptionalString.optional(),
  courseStatus: CourseCompletionStatusSchema.optional(),
  manualScore: z.number().min(0).max(100).optional(),
  scoreAttachments: z.array(ScoreAttachmentSchema).optional(),
  courseStatusReason: OptionalString.optional(),
  courseStatusUpdatedAt: CourseIsoDateString.optional(),
  courseStatusUpdatedBy: OptionalString.optional(),
  progress: z.number().min(0).max(100).optional(),
  lessonProgress: z
    .array(
      z.object({
        lessonId: z.string().min(1),
        completedAt: CourseIsoDateString.optional(),
      })
    )
    .optional(),
  activitySubmissions: z
    .array(
      z.object({
        lessonId: z.string().min(1),
        title: OptionalString.optional(),
        note: OptionalString.optional(),
        linkUrl: OptionalUrl.optional(),
        status: z.enum(["pending", "submitted", "reviewed"]).optional(),
        submittedAt: CourseIsoDateString.optional(),
        reviewedAt: CourseIsoDateString.optional(),
        feedback: OptionalString.optional(),
      })
    )
    .optional(),
  gradebook: z
    .array(
      z.object({
        sourceType: z.enum(["lesson", "final_evaluation"]),
        sourceId: z.string().min(1),
        title: z.string().min(1),
        score: OptionalNumber.optional(),
        maxScore: OptionalNumber.optional(),
        weight: z.number().min(0).max(1).optional(),
        status: z.enum(["pending", "graded", "passed", "failed"]).optional(),
        reviewedAt: CourseIsoDateString.optional(),
        feedback: OptionalString.optional(),
      })
    )
    .optional(),
  reviewComment: OptionalString.optional(),
  reviewedBy: OptionalString.optional(),
  approvedBy: OptionalString.optional(),
  approvedAt: CourseIsoDateString.optional(),
  certificateId: OptionalString.optional(),
  certificateIssuedAt: CourseIsoDateString.optional(),
  paymentId: OptionalString.optional(),
  paymentReceiptUrl: OptionalUrl.optional(),
});

export const EnrollmentSchema = EnrollmentBaseSchema.extend({
  id: z.string().min(1),
  payment: z
    .object({
      id: z.string().min(1).optional(),
      amount: OptionalNumber.optional(),
      currency: OptionalString.optional(),
      method: PaymentMethodSchema.optional(),
      receiptUrl: OptionalUrl.optional(),
      reference: OptionalString.optional(),
      status: PaymentStatusSchema.optional(),
      reviewComment: OptionalString.optional(),
      reviewedBy: OptionalString.optional(),
      reviewedAt: CourseIsoDateString.optional(),
      createdAt: CourseIsoDateString.optional(),
      updatedAt: CourseIsoDateString.optional(),
    })
    .optional(),
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

const PaymentBaseSchema = z.object({
  enrollmentId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().min(1).default("ARS"),
  method: PaymentMethodSchema,
  receiptUrl: OptionalUrl.optional(),
  reference: OptionalString.optional(),
  status: PaymentStatusSchema.optional(),
  reviewComment: OptionalString.optional(),
  reviewedBy: OptionalString.optional(),
  reviewedAt: CourseIsoDateString.optional(),
});

export const PaymentCreateSchema = PaymentBaseSchema;

export const PaymentUpdateSchema = z.object({
  amount: z.number().nonnegative().optional(),
  currency: z.string().min(1).optional(),
  method: PaymentMethodSchema.optional(),
  receiptUrl: OptionalUrl.optional(),
  reference: OptionalString.optional(),
  status: PaymentStatusSchema.optional(),
  reviewComment: OptionalString.optional(),
  reviewedBy: OptionalString.optional(),
  reviewedAt: CourseIsoDateString.optional(),
});

export const PaymentSchema = PaymentBaseSchema.extend({
  id: z.string().min(1),
  status: PaymentStatusSchema.default("pending"),
  createdAt: CourseIsoDateString,
  updatedAt: CourseIsoDateString.optional(),
});

export type Payment = z.infer<typeof PaymentSchema>;
export type PaymentCreateInput = z.infer<typeof PaymentCreateSchema>;
export type PaymentUpdateInput = z.infer<typeof PaymentUpdateSchema>;

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
  paymentAlias: OptionalString.optional(),
  paymentCbu: OptionalString.optional(),
  paymentCvu: OptionalString.optional(),
  paymentAccountHolder: OptionalString.optional(),
  paymentInstructions: OptionalString.optional(),
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
