"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, startTransition } from "react";

const canHandleEvent = (event, target) => {
  if (event.defaultPrevented) return false;
  if (target === "_blank") return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  return true;
};

const supportsViewTransitions = () =>
  typeof document !== "undefined" && typeof document.startViewTransition === "function";

const ViewTransitionLink = forwardRef(function ViewTransitionLink({ href, onClick, target, children, ...props }, ref) {
  const router = useRouter();

  const handleClick = (event) => {
    onClick?.(event);
    if (!canHandleEvent(event, target)) return;
    if (!supportsViewTransitions()) return;
    if (typeof href !== "string") return;

    const destination = new URL(href, window.location.href);
    const current = new URL(window.location.href);

    if (destination.origin !== current.origin) return;
    if (destination.pathname === current.pathname && destination.search === current.search && destination.hash === current.hash) {
      return;
    }

    event.preventDefault();
    document.startViewTransition(() => {
      startTransition(() => {
        router.push(`${destination.pathname}${destination.search}${destination.hash}`);
      });
    });
  };

  return (
    <Link ref={ref} href={href} target={target} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
});

ViewTransitionLink.displayName = "ViewTransitionLink";

export default ViewTransitionLink;
