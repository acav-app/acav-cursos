import {
  notifyAdminNewCourse,
  notifyInstitutionCourseStatus,
  notifyInstitutionNewEnrollment,
  notifyStudentEnrollmentConfirmation,
  notifyStudentPaymentApproved,
  notifyStudentPaymentRejected,
  notifyStudentReceiptRequested,
  sendCourseEmail,
  sendInstitutionWelcomeEmail,
} from "@/lib/courses/server/email";

export const sendCourseNotification = sendCourseEmail;
export {
  notifyAdminNewCourse,
  notifyInstitutionCourseStatus,
  notifyInstitutionNewEnrollment,
  notifyStudentEnrollmentConfirmation,
  notifyStudentPaymentApproved,
  notifyStudentPaymentRejected,
  notifyStudentReceiptRequested,
  sendInstitutionWelcomeEmail,
};
