import { NextResponse } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

let defaultLocale = "es";
let locales = ["es", "en", "ar", "bn"];

// Get the preferred locale, similar to above or using a library
function getLocale(request) {
  const acceptedLanguage = request.headers.get("accept-language") ?? undefined;
  let headers = { "accept-language": acceptedLanguage };
  let languages = new Negotiator({ headers }).languages();

  return match(languages, locales, defaultLocale); // -> 'en-US'
}

export function middleware(request) {
  // Check if there is any supported locale in the pathname
  const pathname = request.nextUrl.pathname;

  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // Redirect if there is no locale
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);

    const url = request.nextUrl.clone();
    if (pathname === "/") {
      url.pathname = `/${locale}`;
    } else {
      url.pathname = `/${locale}${pathname}`;
    }
    return NextResponse.redirect(url);
  }

  const parts = pathname.split("/").filter(Boolean);
  const locale = parts[0];
  const firstSegment = parts[1];
  const publicLegacyRedirects = new Map([
    ["empleos", "cursos"],
    ["empresas", "instituciones"],
    ["mi-perfil", "dashboard"],
    ["mi-campus", "dashboard"],
    ["mis-guardados", "dashboard/mis-cursos"],
    ["mis-cursos", "dashboard/mis-cursos"],
    ["mis-postulaciones", "dashboard/inscripciones"],
    ["mis-inscripciones", "dashboard/inscripciones"],
    ["mis-certificados", "dashboard/certificados"],
    ["historial-pagos", "dashboard/pagos"],
    ["publicar-puesto", "publicar-curso"],
    ["registrar-empresa", "registrar-institucion"],
  ]);
  const dashboardLegacyRedirects = new Map([
    ["busquedas", "cursos"],
    ["postulaciones", "inscripciones"],
    ["empresas", "instituciones"],
  ]);
  const allowedFirstSegments = new Set([
    "dashboard",
    "cursos",
    "instituciones",
    "empleos",
    "empresas",
    "mi-campus",
    "mis-cursos",
    "mis-inscripciones",
    "mi-perfil",
    "mis-guardados",
    "mis-postulaciones",
    "publicar-curso",
    "registrar-institucion",
    "inscribirse",
    "publicar-puesto",
    "registrar-empresa",
    "recursos",
    "postular",
    "proyectos",
    "clientes",
    "form",
    "preview",
    "auth",
  ]);
  const isLocaleRoot = parts.length === 1 && locales.includes(locale);

  if (firstSegment === "dashboard" && parts[2] && dashboardLegacyRedirects.has(parts[2])) {
    const url = request.nextUrl.clone();
    const nextParts = [...parts];
    nextParts[2] = dashboardLegacyRedirects.get(parts[2]);
    url.pathname = `/${nextParts.join("/")}`;
    return NextResponse.redirect(url, 308);
  }

  if (firstSegment && publicLegacyRedirects.has(firstSegment)) {
    const url = request.nextUrl.clone();
    const nextParts = [...parts];
    nextParts[1] = publicLegacyRedirects.get(firstSegment);
    url.pathname = `/${nextParts.join("/")}`;
    return NextResponse.redirect(url, 308);
  }

  if (!isLocaleRoot && firstSegment && !allowedFirstSegments.has(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/cursos`;
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, assets, api)
    //"/((?!api|assets|.*\\..*|_next).*)",
    "/((?!api|assets|docs|.*\\..*|_next).*)",
    // Optional: only run on root (/) URL
  ],
};
