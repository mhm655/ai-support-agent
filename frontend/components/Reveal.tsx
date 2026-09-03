"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Reveals children once as they scroll into view. Compositor-friendly
 * (transform/opacity only) and IntersectionObserver-based, so there are no
 * scroll listeners on the main thread. Reduced motion is handled globally
 * in globals.css, which zeroes the transition duration.
 */
export default function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      // Transform and opacity only — deliberately no `filter`/blur. A
      // non-none filter turns this wrapper into a containing block for
      // absolutely positioned descendants, which silently re-anchors
      // anything a caller positions against an outer element.
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
