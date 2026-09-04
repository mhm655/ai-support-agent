"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";

/*
 * Tilts its children in 3D toward the pointer, with a specular highlight
 * that tracks the same position.
 *
 * The pointer position lives in motion values, never in React state. State
 * would re-render this subtree on every pointermove, which is what makes
 * hand-rolled tilt effects stutter once the panel contains anything real.
 *
 * Pointer-driven only: it does nothing under a coarse pointer (a phone has
 * no hover, and a tilt that fires on touch just fights the scroll) and
 * nothing under prefers-reduced-motion.
 */
export default function TiltPanel({
  children,
  className = "",
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  /** Maximum rotation in degrees on either axis. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // -0.5 to 0.5, relative to the panel's centre.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const spring = { stiffness: 150, damping: 18, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), spring);

  // The highlight sweeps across the surface with the pointer, which is what
  // sells the tilt as a physical object catching light rather than a skew.
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useTransform(
    [glareX, glareY],
    ([x, y]) =>
      `radial-gradient(40% 55% at ${x} ${y}, rgb(255 255 255 / 0.22), transparent 70%)`
  );

  function handleMove(e: React.PointerEvent) {
    if (reduce || e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }

  function handleLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    // The wrapper owns the perspective so the child rotates in depth rather
    // than shearing flat.
    <div style={{ perspective: 1100 }} className={className}>
      <motion.div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        // No branch on `reduce` here. useReducedMotion() resolves
        // differently on the server than on the client's first render, so
        // branching on it inside style or JSX makes the two renders
        // disagree and hydration fails. MotionConfig reducedMotion="user"
        // (set in the root layout) strips these transforms after mount for
        // anyone who has asked for less motion, and the pointer handler
        // below never sets them in the first place.
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative"
      >
        {children}
        <motion.span
          aria-hidden="true"
          style={{ backgroundImage: glare }}
          className="pointer-events-none absolute inset-0 rounded-[20px]"
        />
      </motion.div>
    </div>
  );
}
