import type { Transition, Variants } from "framer-motion";

/**
 * Standardized Framer Motion Transitions
 * Centralized here to ensure consistency across the entire application.
 */

// -----------------------------------------------------------------------------
// Springs (Physical, bouncy interactions)
// -----------------------------------------------------------------------------

/** Snappy spring: Fast, crisp, minimal bounce. Great for buttons and switches. */
export const SPRING_SNAPPY: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.2,
};

/** Stiff spring: Almost no bounce, just a fast curve. */
export const SPRING_STIFF: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.15,
};

// Shared page and toast transitions.
export const PAGE_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", bounce: 0, duration: 0.4 },
  },
};

// -----------------------------------------------------------------------------
// Toast Animations
// -----------------------------------------------------------------------------

export const TOAST_VARIANTS = {
  initial: { opacity: 0, y: -16, scale: 0.95 },
  exit: { opacity: 0, y: -16, scale: 0.95, transition: SPRING_STIFF },
};

/** Returns animate props for a toast at a given stack index (0 = front) */
export function toastAnimate(stackIndex: number) {
  return {
    opacity: 1,
    y: stackIndex * 8,
    scale: 1 - stackIndex * 0.03,
    zIndex: 100 - stackIndex,
  };
}
