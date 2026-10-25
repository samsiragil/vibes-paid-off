import { Suspense, ViewTransition, type ReactNode } from "react";

/*
 * View transitions (README §11). Both crossfade with the `fade` class from globals.css and stay
 * still (`default="none"`) for every other transition, so a refresh or a filter change never
 * fades the page.
 */

/**
 * Wraps everything a page.tsx returns: moving to another page crossfades. It belongs in each page,
 * not in a layout, because a layout stays mounted and never enters or exits.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="fade" exit="fade" default="none">
      {children}
    </ViewTransition>
  );
}

/** Suspense whose skeleton crossfades into the content instead of being swapped at once. */
export function Reveal({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="fade" default="none">
          {fallback}
        </ViewTransition>
      }
    >
      <ViewTransition enter="fade" default="none">
        {children}
      </ViewTransition>
    </Suspense>
  );
}
