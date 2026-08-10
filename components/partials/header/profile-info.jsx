"use client";
import { useAuth } from "@/provider/auth.provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useLocalizedPath } from "@/lib/utils";
import { useCourseActor } from "@/components/courses/dashboard/use-course-actor";

const ProfileInfo = () => {
  const { user, logout } = useAuth();
  const { actor } = useCourseActor();
  const localize = useLocalizedPath();

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
            href: companyId ? `/dashboard/instituciones/${companyId}` : "/dashboard/instituciones",
          },
        ]
      : [
          {
            name: "Perfil",
            icon: "heroicons:user",
            href: "/dashboard",
          },
          {
            name: "Configuración",
            icon: "heroicons:cog-6-tooth",
            href: "/dashboard/#",
          },
        ];

  const avatarInitial = (user.displayName?.[0] || user.email?.[0] || "U").toUpperCase();
  const displayName = user.displayName || user.email?.split("@")[0] || "Usuario";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="cursor-pointer">
        <div className="flex items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 font-bold uppercase text-primary">
            {avatarInitial}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 overflow-hidden p-0" align="end">
        <DropdownMenuGroup className="px-2 pb-1 pt-2">
          {menuItems.map((item, index) => (
          <Link
            href={localize(item.href)}
            key={`info-menu-${index}`}
            className="block cursor-pointer"
          >
            <DropdownMenuItem className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium capitalize text-default-600 hover:bg-slate-50 dark:hover:bg-background cursor-pointer">
              <Icon icon={item.icon} className="h-4 w-4" />
              {item.name}
            </DropdownMenuItem>
          </Link>
        ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="mx-2" />
        <div className="px-2 pb-2 pt-1">
          <DropdownMenuItem
            onSelect={logout}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium capitalize text-rose-600 hover:bg-rose-50 dark:hover:bg-background cursor-pointer"
          >
            <Icon icon="heroicons:power" className="h-4 w-4" />
            Salir
          </DropdownMenuItem>
        </div>
        <div className="mt-auto border-t border-border/60 bg-slate-50/40 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 font-bold uppercase text-primary">
              {avatarInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium capitalize text-default-800">
                {displayName}
              </div>
              <div className="truncate text-xs text-default-600">{user.email}</div>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
export default ProfileInfo;
