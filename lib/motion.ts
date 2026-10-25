/** True when the visitor asked the system for less motion. Client only. */
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Smooth scrolling unless the visitor asked for reduced motion; then it jumps. Client only. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
