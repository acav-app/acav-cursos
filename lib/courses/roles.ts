export const CANONICAL_PORTAL_ROLES = ["admin", "alumno"] as const;

export type CanonicalPortalRole = (typeof CANONICAL_PORTAL_ROLES)[number];

export function normalizePortalRole(role: unknown): CanonicalPortalRole {
  const value = String(role || "").trim().toLowerCase();

  if (["admin", "empresa", "institucion", "institution"].includes(value)) {
    return "admin";
  }

  if (["alumno", "candidato", "postulante", "student"].includes(value)) {
    return "alumno";
  }

  return "alumno";
}

export function isAdminRole(role: unknown) {
  return normalizePortalRole(role) === "admin";
}

export function isStudentRole(role: unknown) {
  return normalizePortalRole(role) === "alumno";
}
