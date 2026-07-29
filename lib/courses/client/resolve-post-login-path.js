"use client";

import { authedFetch } from "@/lib/auth/authed-fetch";
import { buildLocalizedPath } from "@/lib/utils";

async function wait(ms) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function resolveCoursePostLoginPath(user, lang = "es") {
  const attempts = [
    { forceRefresh: false, delayMs: 0 },
    { forceRefresh: true, delayMs: 250 },
    { forceRefresh: true, delayMs: 600 },
  ];

  for (const attempt of attempts) {
    try {
      if (attempt.delayMs > 0) {
        await wait(attempt.delayMs);
      }
      if (attempt.forceRefresh && user?.getIdToken) {
        await user.getIdToken(true);
      }
      const data = await authedFetch(user, "/api/courses/me", { method: "GET" });
      const role = String(data?.actor?.role || "").trim();

      if (role === "admin") {
        return buildLocalizedPath("/dashboard", lang);
      }

      if (role === "alumno") {
        return buildLocalizedPath("/dashboard", lang);
      }
    } catch {
      // El actor puede tardar unos instantes en estar disponible luego del login.
    }
  }

  // Fallback conservador: enviar al dashboard y dejar que el layout resuelva el acceso final.
  return buildLocalizedPath("/dashboard", lang);
}

export const resolvePostLoginPath = resolveCoursePostLoginPath;
