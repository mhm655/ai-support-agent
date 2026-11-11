"use client";

import { useEffect, useState } from "react";
import { MotionConfig, motion } from "motion/react";

/*
 * Motion primitives for the marketing pages. Client leaves only: the page
 * itself stays a Server Component and these wrap the pieces that move.
 *
 * Every animation here is motivated. Entry motion establishes reading order
 * in the hero (headline, then subtext, then the panel). Scroll reveals
 * sequence a section's content. Nothing loops, and nothing animates merely
 * to prove that it can.
 *
 * Reduced motion is handled once, by <MotionProvider reducedMotion="user">
 * below, rather than by each component branching on useReducedMotion(). That
 * hook returns a different value on the server than on the client's first
 * render, so branching on it inside `initial` produced markup that did not
 * match and React threw a hydration error.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  // reducedMotion="user" strips transforms from animations, which changes the
  // style attribute Motion renders. The server cannot know the preference, so
  // enabling it before hydration makes the two renders disagree. Start at
  // "never" (matching the server), then switch once mounted. Everything that
  // animates on scroll happens well after that switch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  return <MotionConfig reducedMotion={mounted ? "user" : "never"}>{children}</MotionConfig>;
}

/** Fades and lifts a block as it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
