import {
  notifyAdminNewCourse,
  notifyInstitutionCourseStatus,
  notifyInstitutionNewEnrollment,
  notifyStudentEnrollmentConfirmation,
  sendCourseEmail,
  sendInstitutionWelcomeEmail,
} from "@/lib/courses/server/email";

export const sendCourseNotification = sendCourseEmail;
export {
  notifyAdminNewCourse,
  notifyInstitutionCourseStatus,
  notifyInstitutionNewEnrollment,
  notifyStudentEnrollmentConfirmation,
  sendInstitutionWelcomeEmail,
};
