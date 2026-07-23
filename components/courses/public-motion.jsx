"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const defaultViewport = { once: true, amount: 0.2 };

export function MotionReveal({
  children,
  className,
  delay = 0,
  y = 28,
  scale = 1,
  as: Component = "div",
}) {
  const shouldReduceMotion = useReducedMotion();
  const MotionComponent = motion(Component);

  return (
    <MotionComponent
      className={className}
      initial={shouldReduceMotion ? undefined : { opacity: 0, y, scale }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionComponent>
  );
}

export function MotionStagger({
  children,
  className,
  delayChildren = 0.08,
  staggerChildren = 0.08,
  as: Component = "div",
}) {
  const shouldReduceMotion = useReducedMotion();
  const MotionComponent = motion(Component);

  if (shouldReduceMotion) {
    return <Component className={className}>{children}</Component>;
  }

  return (
    <MotionComponent
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            delayChildren,
            staggerChildren,
          },
        },
      }}
    >
      {children}
    </MotionComponent>
  );
}

export function MotionStaggerItem({ children, className, y = 24, scale = 0.985 }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0, y, scale },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function MotionHoverCard({ children, className }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      whileHover={shouldReduceMotion ? undefined : { y: -6, scale: 1.01 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
