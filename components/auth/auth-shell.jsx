"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { SiteLogo } from "@/components/svg";
import { buildLocalizedPath, cn } from "@/lib/utils";

export default function AuthShell({
  lang = "es",
  eyebrow = "ACAV Cursos",
  title,
  description,
  highlights = [],
  asideTitle = "Acceso profesional para instituciones y alumnos",
  asideDescription = "Centraliza cursos, inscripciones y gestion institucional con una experiencia clara, moderna y segura.",
  children,
  className,
}) {
  const shouldReduceMotion = useReducedMotion();

  const panelMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(27,43,80,0.16),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(15,95,186,0.22),transparent_42%),linear-gradient(180deg,#050b1a_0%,#020617_100%)]">
      <div className="mx-auto grid min-h-screen max-w-[1380px] gap-8 px-4 py-6 lg:py-8">
        <motion.section
          {...(shouldReduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 14 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] },
              })}
          className={cn("flex items-center justify-center", className)}
        >
          <div className="w-full max-w-[620px] rounded-[32px] border border-white/60 bg-white/95 p-5 shadow-[0_30px_100px_rgba(15,23,42,0.1)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/90 dark:shadow-[0_30px_120px_rgba(0,0,0,0.55)] xl:p-7">
            {children}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
