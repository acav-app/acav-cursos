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
            href: "/dashboard/configuracion-cursos",
          },
        ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className=" cursor-pointer">
        <div className=" flex items-center  ">
          {/* Puedes agregar un avatar por defecto si quieres */}
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase">
            {user.displayName?.[0] || user.email?.[0] || "U"}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-0" align="end">
        <DropdownMenuLabel className="flex gap-2 items-center mb-1 p-3">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold uppercase">
            {user.displayName?.[0] || user.email?.[0] || "U"}
          </div>
          <div>
            <div className="text-sm font-medium text-default-800 capitalize ">
              {user.displayName || user.email?.split("@")[0] || "Usuario"}
            </div>
            <div className="text-xs text-default-600">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {menuItems.map((item, index) => (
            <Link
              href={localize(item.href)}
              key={`info-menu-${index}`}
              className="cursor-pointer"
            >
              <DropdownMenuItem className="flex items-center gap-2 text-sm font-medium text-default-600 capitalize px-3 py-1.5 dark:hover:bg-background cursor-pointer">
                <Icon icon={item.icon} className="w-4 h-4" />
                {item.name}
              </DropdownMenuItem>
            </Link>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSeparator className="mb-0 dark:bg-background" />
        <DropdownMenuItem
          onSelect={logout}
          className="flex items-center gap-2 text-sm font-medium text-default-600 capitalize my-1 px-3 dark:hover:bg-background cursor-pointer"
        >
          <Icon icon="heroicons:power" className="w-4 h-4" />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
export default ProfileInfo;
