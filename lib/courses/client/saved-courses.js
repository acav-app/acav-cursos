export const SAVED_COURSES_STORAGE_KEY = "acav:public-saved-courses";

export function readSavedCourses() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(SAVED_COURSES_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSavedCourses(items) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_COURSES_STORAGE_KEY, JSON.stringify(items));
}
