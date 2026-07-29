"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Bookmark,
  Briefcase,
  Building2,
  ChevronDown,
  Clock3,
  CreditCard,
  LogIn,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import ApplicationPublicModal from "@/components/courses/application-public-modal";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SiteLogo } from "@/components/svg";
import ViewTransitionLink from "@/components/ui/view-transition-link";
import { useAuth } from "@/provider/auth.provider";

const FALLBACK_SOCIALS = [
  { label: "Facebook", url: "" },
  { label: "Instagram", url: "" },
  { label: "LinkedIn", url: "" },
  { label: "X", url: "" },
];

function resolveSocialMeta(link) {
  const label = String(link?.label || "").toLowerCase();
  const url = String(link?.url || "").toLowerCase();
  const haystack = `${label} ${url}`;

  if (haystack.includes("instagram")) {
    return {
      icon: "ri:instagram-fill",
      hoverClass: "hover:border-[#E4405F] hover:bg-[#E4405F]",
    };
  }

  if (haystack.includes("linkedin")) {
    return {
      icon: "ri:linkedin-fill",
      hoverClass: "hover:border-[#0A66C2] hover:bg-[#0A66C2]",
    };
  }

  if (haystack.includes("facebook")) {
    return {
      icon: "ri:facebook-fill",
      hoverClass: "hover:border-[#1877F2] hover:bg-[#1877F2]",
    };
  }

  if (haystack.includes("youtube")) {
    return {
      icon: "ri:youtube-fill",
      hoverClass: "hover:border-[#FF0000] hover:bg-[#FF0000]",
    };
  }

  if (haystack.includes("tiktok")) {
    return {
      icon: "ri:tiktok-fill",
      hoverClass: "hover:border-[#111111] hover:bg-[#111111]",
    };
  }

  if (haystack.includes("whatsapp")) {
    return {
      icon: "ri:whatsapp-fill",
      hoverClass: "hover:border-[#25D366] hover:bg-[#25D366]",
    };
  }

  if (
    haystack.includes("twitter") ||
    haystack.includes("x.com") ||
    label === "x" ||
    haystack.includes(" x ")
  ) {
    return {
      icon: "ri:twitter-x-fill",
      hoverClass: "hover:border-white hover:bg-white hover:text-[#15203B]",
    };
  }

  return {
    icon: "ri:global-line",
    hoverClass: "hover:border-[#31456F] hover:bg-[#31456F]",
  };
}

export default function PublicCoursesShell({
  lang,
  settings,
  navMode = "routes",
  children,
}) {
  const catalogoHref =
    navMode === "anchors" ? "#catalogo" : `/${lang}/cursos#catalogo`;
  const porqueAcavHref =
    navMode === "anchors" ? "#porque-acav" : `/${lang}/cursos#porque-acav`;
  const testimoniosHref =
    navMode === "anchors" ? "#testimonios" : `/${lang}/cursos#testimonios`;
  const router = useRouter();
  const { user, logout, loading } = useAuth();
  const { actor, loading: actorLoading } = useCourseActor();
  const isCandidate = actor?.role === "alumno";
  const isDashboardRole = actor?.role === "admin";
  const isAccountResolving = loading || (Boolean(user) && actorLoading);
  const candidateAreaHref = `/${lang}/dashboard`;
  const accountHomeHref = isDashboardRole
    ? `/${lang}/dashboard`
    : user
      ? candidateAreaHref
      : `/${lang}/auth/login`;
  const displayName =
    actor?.firstName ||
    actor?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const avatarLetter =
    String(displayName || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";
  const socialLinks =
    Array.isArray(settings?.socialLinks) && settings.socialLinks.length
      ? settings.socialLinks
      : FALLBACK_SOCIALS;

  const handleLogout = async () => {
    await logout();
    router.replace(`/${lang}`);
    router.refresh();
  };

  return (
    <div className="public-theme min-h-screen bg-white text-[#1E3050]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#15203B]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between gap-6 px-6">
          <Link href={`/${lang}`} className="flex items-center">
            <SiteLogo
              withBg={false}
              className="h-9 w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
            />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-white/75 md:flex">
            <Link href={`/${lang}/cursos`} className="">
              <span className="text-sm font-extrabold tracking-[0.08em] text-[#DD4913]">
                Cursos
              </span>
            </Link>
            <a href={catalogoHref} className="transition hover:text-white">
              Catálogo
            </a>
            <a href={porqueAcavHref} className="transition hover:text-white">
              ¿Por qué ACAV Cursos?
            </a>
            <a href={testimoniosHref} className="transition hover:text-white">
              Lo que dicen nuestros alumnos
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAccountResolving ? (
              <div className="hidden items-center gap-3 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-white/80 md:inline-flex">
                <span className="h-9 w-9 animate-pulse rounded-full bg-white/20" />
                <span className="h-4 w-28 animate-pulse rounded-full bg-white/20" />
              </div>
            ) : isCandidate ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden items-center gap-3 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-left text-white/90 backdrop-blur transition hover:border-white/35 hover:bg-white/15 md:inline-flex"
                  >
                    <Avatar className="h-9 w-9 border border-white/15">
                      <AvatarFallback className="bg-[#DD4913] text-sm font-extrabold text-white">
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[132px] truncate text-sm font-semibold">
                      {displayName}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/65" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-2xl border border-slate-200 p-2"
                >
                  <DropdownMenuLabel className="px-3 py-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {displayName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {actor?.email || user?.email || ""}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <ViewTransitionLink href={`/${lang}/dashboard`}>
                      <User className="mr-2 h-4 w-4" />
                      Mi panel
                    </ViewTransitionLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <ViewTransitionLink href={`/${lang}/dashboard/mis-cursos`}>
                      <Bookmark className="mr-2 h-4 w-4" />
                      Mis Cursos
                    </ViewTransitionLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <ViewTransitionLink href={`/${lang}/dashboard/inscripciones`}>
                      <Briefcase className="mr-2 h-4 w-4" />
                      Mis Inscripciones
                    </ViewTransitionLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <ViewTransitionLink href={`/${lang}/dashboard/certificados`}>
                      <Award className="mr-2 h-4 w-4" />
                      Mis Certificados
                    </ViewTransitionLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <ViewTransitionLink href={`/${lang}/dashboard/pagos`}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Historial de Pagos
                    </ViewTransitionLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="rounded-xl px-3 py-2 text-red-600 focus:text-red-600"
                    onSelect={handleLogout}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : isDashboardRole ? (
              <Button
                asChild
                variant="outline"
                className="hidden rounded-full border-white/20 bg-white/5 px-4 text-white hover:bg-white/10 hover:text-white md:inline-flex"
              >
                <Link href={`/${lang}/dashboard`}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Ir al panel admin
                </Link>
              </Button>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="hidden items-center gap-3 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-left text-white/90 backdrop-blur transition hover:border-white/35 hover:bg-white/15 md:inline-flex"
                  >
                    <Avatar className="h-9 w-9 border border-white/15">
                      <AvatarFallback className="bg-[#DD4913] text-sm font-extrabold text-white">
                        {avatarLetter}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[132px] truncate text-sm font-semibold">
                      {displayName}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/65" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-60 rounded-2xl border border-slate-200 p-2"
                >
                  <DropdownMenuLabel className="px-3 py-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {displayName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {user?.email || ""}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-xl px-3 py-2">
                    <ViewTransitionLink href={candidateAreaHref}>
                      <User className="mr-2 h-4 w-4" />
                      Mi espacio
                    </ViewTransitionLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="rounded-xl px-3 py-2 text-red-600 focus:text-red-600"
                    onSelect={handleLogout}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                href={`/${lang}/auth/login`}
                className="hidden rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/50 hover:text-white md:inline-flex"
              >
                Iniciar sesión
              </Link>
            )}
            {!user ? (
              <Link
                href={`/${lang}/auth/register`}
                className="inline-flex items-center gap-2 rounded-full bg-[#DD4913] px-5 py-2.5 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[#EB5B24]"
              >
                Inscribirme
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      {children}

      <footer className="bg-[#15203B] text-white/65">
        <div className="mx-auto max-w-[1180px] px-6 py-16">
          <div className="grid gap-12 border-b border-white/10 pb-12 lg:grid-cols-[2fr_1fr_1fr_1.3fr]">
            <div>
              <SiteLogo
                withBg={false}
                className="h-10 w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
              />
              <div className="mt-4 inline-flex rounded-full border border-[#DD4913]/25 bg-[#DD4913]/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#DD4913]">
                ACAV CURSOS
              </div>
              <p className="mt-4 max-w-md text-sm leading-7">
                La plataforma de formacion virtual de la Asociacion Cordobesa de
                Agencias de Viajes. Centraliza cursos, certificaciones e
                inscripciones para el ecosistema turistico.
              </p>
              <div className="mt-6 flex gap-3">
                {socialLinks.map((social, index) => {
                  const meta = resolveSocialMeta(social);
                  const content = (
                    <span
                      className={[
                        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-sm text-white/75 transition",
                        meta.hoverClass,
                      ].join(" ")}
                      aria-label={social.label}
                      title={social.label}
                    >
                      <Icon icon={meta.icon} className="h-4 w-4" />
                    </span>
                  );

                  return social.url ? (
                    <a
                      key={`${social.label}-${index}`}
                      href={social.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {content}
                    </a>
                  ) : (
                    <span key={`${social.label}-${index}`}>{content}</span>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">
                Cursos
              </div>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <Link
                  href={`/${lang}/cursos`}
                  className="transition hover:text-white"
                >
                  Amadeus Básico
                </Link>
                <Link
                  href={`/${lang}/cursos`}
                  className="transition hover:text-white"
                >
                  Amadeus Avanzado
                </Link>
                <Link
                  href={`/${lang}/cursos`}
                  className="transition hover:text-white"
                >
                  Destinos internacionales
                </Link>
                <Link
                  href={`/${lang}/cursos`}
                  className="transition hover:text-white"
                >
                  Ventas turísticas
                </Link>
                <Link
                  href={`/${lang}/cursos`}
                  className="transition hover:text-white"
                >
                  Marketing digital
                </Link>
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">
                Plataforma
              </div>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <Link
                  href={accountHomeHref}
                  className="transition hover:text-white"
                >
                  {isDashboardRole
                    ? "Campus admin"
                    : user
                      ? "Mi panel"
                      : "Acceder"}
                </Link>
                <ViewTransitionLink
                  href={`/${lang}/dashboard/mis-cursos`}
                  className="transition hover:text-white"
                >
                  Mis cursos
                </ViewTransitionLink>
                <ViewTransitionLink
                  href={`/${lang}/dashboard/certificados`}
                  className="transition hover:text-white"
                >
                  Mis certificados
                </ViewTransitionLink>
                <ViewTransitionLink
                  href={`/${lang}/dashboard/pagos`}
                  className="transition hover:text-white"
                >
                  Historial de pagos
                </ViewTransitionLink>
                <Link
                  href="https://www.acav.com.ar"
                  className="transition hover:text-white"
                >
                  Ir a acav.com.ar →
                </Link>
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">
                Contacto
              </div>
              <div className="mt-5 grid gap-3 text-sm leading-6">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                  <span>
                    {settings?.address ||
                      "Obispo Salguero 169 1º Piso, Of. 1 y 2 — Córdoba, Argentina"}
                  </span>
                </div>
                <div className="flex gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                  <span>{settings?.phone || "+54 0351 4231643"}</span>
                </div>
                <div className="flex gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                  <span>{settings?.contactEmail || "info@acav.com.ar"}</span>
                </div>
                <div className="flex gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                  <span>Lunes a viernes · 9:30 a 18:00 hs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 text-xs md:flex-row md:items-center md:justify-between">
            <span>
              © 2026 ACAV · Asociación Cordobesa de Agencias de Viajes. Todos
              los derechos reservados.
            </span>
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white/75">
                Términos de uso
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-semibold text-white/75">
                Política de privacidad
              </span>
              <span className="text-white/45">Próximamente disponibles</span>
              <a
                href="https://www.acav.com.ar"
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-white"
              >
                Ir a acav.com.ar →
              </a>
            </div>
          </div>
        </div>
      </footer>

      <ApplicationPublicModal lang={lang} />
    </div>
  );
}
