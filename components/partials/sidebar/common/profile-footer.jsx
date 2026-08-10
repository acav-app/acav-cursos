"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/provider/auth.provider";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";
import { useLocalizedPath } from "@/lib/utils";
import Link from "next/link";
import { Icon } from "@iconify/react";

const SidebarProfileFooter = ({ compact = false, className = "" }) => {
  const { user, logout } = useAuth();
  const { actor } = useCourseActor();
  const localize = useLocalizedPath();
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const companyId = String(actor?.companyId || "").trim();
  const menuItems =
    actor?.role === "empresa"
      ? [
          {
            name: "Mi campus",
            icon: "heroicons:squares-2x2",
            href: "/dashboard",
          },
          {
            name: "Mi institución",
            icon: "heroicons:building-office-2",
            href: companyId
              ? `/dashboard/instituciones/${companyId}`
              : "/dashboard/instituciones",
          },
        ]
      : [
          { name: "Perfil", icon: "heroicons:user", href: "/dashboard" },
          {
            name: "Configuración",
            icon: "heroicons:cog-6-tooth",
            href: "/dashboard/#",
          },
        ];

  const avatarInitial = (
    user.displayName?.[0] ||
    user.email?.[0] ||
    "U"
  ).toUpperCase();
  const displayName =
    user.displayName || user.email?.split("@")[0] || "Usuario";

  const UserBlock = ({ onClick, showChevron = true, size = "md" }) => {
    const avatarSize = size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10";
    const nameSize =
      size === "sm" ? "text-sm font-medium" : "text-sm font-semibold";
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 text-start"
        aria-label="Opciones de usuario"
      >
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold",
            avatarSize,
          )}
        >
          {avatarInitial}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate capitalize text-default-800",
              nameSize,
            )}
          >
            {displayName}
          </span>
          <span className="block truncate text-[11px] text-default-600">
            {user.email}
          </span>
        </span>
        {showChevron ? (
          <Icon
            icon={
              open
                ? "heroicons:chevron-up-20-solid"
                : "heroicons:chevron-down-20-solid"
            }
            className="h-4 w-4 shrink-0 text-default-500"
          />
        ) : null}
      </button>
    );
  };

  if (compact) {
    return (
      <div ref={wrapperRef} className={cn("relative", className)}>
        <div className="flex flex-col items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-default-500 transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
            aria-label="Opciones de usuario"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-semibold">
              {avatarInitial}
            </span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-default-500 transition-all duration-200 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Salir"
          >
            <Icon
              icon="heroicons:arrow-right-start-on-rectangle-20-solid"
              className="h-5 w-5"
            />
          </button>
        </div>

        {open ? (
          <div className="absolute ltr:left-[calc(100%+10px)] rtl:right-[calc(100%+10px)] bottom-0 z-999 flex w-56 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex flex-col gap-0.5 p-2">
              {menuItems.map((item, i) => (
                <Link
                  key={i}
                  href={localize(item.href)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-default-600 capitalize hover:bg-slate-50"
                >
                  <Icon icon={item.icon} className="h-4 w-4" />
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="mx-2 h-px bg-slate-100" />
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-rose-600 capitalize hover:bg-rose-50"
              >
                <Icon icon="heroicons:power" className="h-4 w-4" />
                Salir
              </button>
            </div>
            <div className="mt-auto border-t border-border/60 bg-slate-50/40 p-3">
              <UserBlock
                onClick={() => setOpen(false)}
                showChevron={false}
                size="sm"
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={cn(className)}>
      <div className="flex flex-col">
        <div className="flex flex-col border-t border-border/60 bg-background/60 backdrop-blur">
          <div className="flex flex-col gap-0.5 px-3 pt-3">
            {menuItems.map((item, i) => (
              <Link
                key={i}
                href={localize(item.href)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-default-600 capitalize hover:bg-slate-50"
              >
                <Icon icon={item.icon} className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </div>
          <div className="px-3 pb-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-rose-600 capitalize hover:bg-rose-50"
            >
              <Icon icon="heroicons:power" className="h-4 w-4" />
              Salir
            </button>
          </div>
          <div className="mt-auto border border-t border-border/60 bg-slate-50/40 px-4 py-3">
            <UserBlock onClick={() => setOpen((v) => !v)} showChevron={true} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarProfileFooter;
