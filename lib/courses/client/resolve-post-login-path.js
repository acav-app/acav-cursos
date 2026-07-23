"use client";

import { authedFetch } from "@/lib/auth/authed-fetch";
import { buildLocalizedPath } from "@/lib/utils";

export async function resolveCoursePostLoginPath(user, lang = "es") {
  try {
    const data = await authedFetch(user, "/api/courses/me", { method: "GET" });
    const role = String(data?.actor?.role || "").trim();

    if (role === "admin" || role === "empresa") {
      return buildLocalizedPath("/dashboard", lang);
    }

    return buildLocalizedPath("/mi-campus", lang);
  } catch {
    return buildLocalizedPath("/mi-campus", lang);
  }
}

export const resolvePostLoginPath = resolveCoursePostLoginPath;
