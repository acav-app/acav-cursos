"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function CandidatePageTransition({ children }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      className="candidate-view-shell"
      style={shouldReduceMotion ? undefined : { viewTransitionName: "candidate-portal" }}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.988, filter: "blur(10px)" }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
