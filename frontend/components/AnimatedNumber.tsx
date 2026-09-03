"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Counts up to a value once, on mount. Purely presentational — the real
 * number is always what lands, and the animation is skipped entirely under
 * prefers-reduced-motion, so nobody ever reads a number that is merely
 * on its way somewhere.
 */
export default function AnimatedNumber({
  value,
  durationMs = 900,
  className = "",
}: {
  value: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Nothing to do when there is no animation to run: `display` is already
    // seeded with the real value, so bailing out here leaves the correct
    // number on screen without a state write.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || value === 0) return;

    // The rAF callback below runs before the first paint, so resetting the
    // count to zero inside it is never visible as a flash of the end value.
    const start = performance.now();
    const from = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // easeOutExpo: fast out of the gate, settling gently on the real value.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  // The announced value is the true one; the tween is visual only.
  return (
    <span className={className} aria-label={String(value)}>
      <span aria-hidden="true">{display.toLocaleString()}</span>
    </span>
  );
}
