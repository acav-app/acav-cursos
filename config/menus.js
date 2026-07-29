import { BarChart3, Bookmark, Briefcase, CreditCard, FileText, Trophy, Users2 } from "lucide-react";

function withRoles(item) {
  return item;
}

function normalizeActor(actorOrRole) {
  if (actorOrRole && typeof actorOrRole === "object") {
    return actorOrRole;
  }
  return { role: actorOrRole };
}

function resolveMenuByActor(item, actor) {
  const role = String(actor?.role || "").trim().toLowerCase();

  if (role === "alumno" && item?.href === "/dashboard") {
    return {
      ...item,
      title: "Mi panel",
    };
  }

  return item;
}

export function filterMenusByRole(items = [], actorOrRole) {
  const actor = normalizeActor(actorOrRole);
  const normalizedRole = String(actor?.role || "").trim().toLowerCase();

  return (items || [])
    .filter((item) => {
      const roles = Array.isArray(item?.roles) ? item.roles : [];
      if (!roles.length) return true;
      if (!normalizedRole) return false;
      return roles.includes(normalizedRole);
    })
    .map((item) => {
      const nextItem = {
        ...item,
      };

      if (Array.isArray(item?.child)) {
        nextItem.child = filterMenusByRole(item.child, actor);
      }

      if (Array.isArray(item?.megaMenu)) {
        nextItem.megaMenu = item.megaMenu
          .filter((group) => {
            const roles = Array.isArray(group?.roles) ? group.roles : [];
            return !roles.length || (normalizedRole && roles.includes(normalizedRole));
          })
          .map((group) => {
            const nextGroup = {
              ...group,
            };

            if (Array.isArray(group?.child)) {
              nextGroup.child = filterMenusByRole(group.child, actor);
            }

            if (Array.isArray(group?.nested)) {
              nextGroup.nested = filterMenusByRole(group.nested, actor);
            }

            return nextGroup;
          });
      }

      if (Array.isArray(item?.nested)) {
        nextItem.nested = filterMenusByRole(item.nested, actor);
      }

      if (Array.isArray(item?.multi_menu)) {
        nextItem.multi_menu = filterMenusByRole(item.multi_menu, actor);
      }

      return resolveMenuByActor(nextItem, actor);
    });
}

export const menusConfig = {
  mainNav: [
    withRoles({
      title: "Panel",
      icon: BarChart3,
      href: "/dashboard",
      roles: ["admin"],
    }),
    withRoles({
      title: "Cursos",
      icon: Briefcase,
      href: "/dashboard/cursos",
      roles: ["admin"],
    }),
    withRoles({
      title: "Alumnos",
      icon: Users2,
      href: "/dashboard/usuarios",
      roles: ["admin"],
    }),
    withRoles({
      title: "Pagos",
      icon: CreditCard,
      href: "/dashboard/pagos",
      roles: ["admin"],
    }),
    withRoles({
      title: "Certificados",
      icon: Trophy,
      href: "/dashboard/certificados",
      roles: ["admin"],
    }),
    withRoles({
      title: "Contenido",
      icon: FileText,
      href: "/dashboard/contenido",
      roles: ["admin"],
    }),
    withRoles({
      title: "Mi panel",
      icon: BarChart3,
      href: "/dashboard",
      roles: ["alumno"],
    }),
    withRoles({
      title: "Mis cursos",
      icon: Bookmark,
      href: "/dashboard/mis-cursos",
      roles: ["alumno"],
    }),
    withRoles({
      title: "Inscripciones",
      icon: Briefcase,
      href: "/dashboard/inscripciones",
      roles: ["alumno"],
    }),
    withRoles({
      title: "Pagos",
      icon: CreditCard,
      href: "/dashboard/pagos",
      roles: ["alumno"],
    }),
    withRoles({
      title: "Certificados",
      icon: Trophy,
      href: "/dashboard/certificados",
      roles: ["alumno"],
    }),
  ],
  sidebarNav: {
    modern: [
      withRoles({
        isHeader: true,
        title: "Panel",
        roles: ["admin"],
      }),
      withRoles({
        title: "Panel",
        icon: BarChart3,
        href: "/dashboard",
        roles: ["admin"],
      }),
      withRoles({
        title: "Cursos",
        icon: Briefcase,
        href: "/dashboard/cursos",
        roles: ["admin"],
      }),
      withRoles({
        title: "Alumnos",
        icon: Users2,
        href: "/dashboard/usuarios",
        roles: ["admin"],
      }),
      withRoles({
        title: "Pagos",
        icon: CreditCard,
        href: "/dashboard/pagos",
        roles: ["admin"],
      }),
      withRoles({
        isHeader: true,
        title: "Herramientas",
        roles: ["admin"],
      }),
      withRoles({
        title: "Certificados",
        icon: Trophy,
        href: "/dashboard/certificados",
        roles: ["admin"],
      }),
      withRoles({
        title: "Contenido",
        icon: FileText,
        href: "/dashboard/contenido",
        roles: ["admin"],
      }),
      withRoles({
        title: "Mi panel",
        icon: BarChart3,
        href: "/dashboard",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Mis cursos",
        icon: Bookmark,
        href: "/dashboard/mis-cursos",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Inscripciones",
        icon: Briefcase,
        href: "/dashboard/inscripciones",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Pagos",
        icon: CreditCard,
        href: "/dashboard/pagos",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Certificados",
        icon: Trophy,
        href: "/dashboard/certificados",
        roles: ["alumno"],
      }),
    ],
    classic: [
      {
        isHeader: true,
        title: "ACAV Cursos",
      },
      withRoles({
        isHeader: true,
        title: "Panel",
        roles: ["admin"],
      }),
      withRoles({
        title: "Panel",
        icon: BarChart3,
        href: "/dashboard",
        roles: ["admin"],
      }),
      withRoles({
        title: "Cursos",
        icon: Briefcase,
        href: "/dashboard/cursos",
        roles: ["admin"],
      }),
      withRoles({
        title: "Alumnos",
        icon: Users2,
        href: "/dashboard/usuarios",
        roles: ["admin"],
      }),
      withRoles({
        title: "Pagos",
        icon: CreditCard,
        href: "/dashboard/pagos",
        roles: ["admin"],
      }),
      withRoles({
        isHeader: true,
        title: "Herramientas",
        roles: ["admin"],
      }),
      withRoles({
        title: "Certificados",
        icon: Trophy,
        href: "/dashboard/certificados",
        roles: ["admin"],
      }),
      withRoles({
        title: "Contenido",
        icon: FileText,
        href: "/dashboard/contenido",
        roles: ["admin"],
      }),
      withRoles({
        title: "Mi panel",
        icon: BarChart3,
        href: "/dashboard",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Mis cursos",
        icon: Bookmark,
        href: "/dashboard/mis-cursos",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Inscripciones",
        icon: Briefcase,
        href: "/dashboard/inscripciones",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Pagos",
        icon: CreditCard,
        href: "/dashboard/pagos",
        roles: ["alumno"],
      }),
      withRoles({
        title: "Certificados",
        icon: Trophy,
        href: "/dashboard/certificados",
        roles: ["alumno"],
      }),
    ],
  },
};
