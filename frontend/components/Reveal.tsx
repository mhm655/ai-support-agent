"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Reveals children once as they scroll into view. Compositor-friendly
 * (opacity/transform only) and IntersectionObserver-based, so there are no
 * scroll listeners on the main thread.
 *
 * The two visual states live in globals.css as `.reveal` /
 * `.reveal[data-visible]` rather than as classes toggled from here, so the
 * reduced-motion media query can pin the element to the visible state. If
 * visibility depended on this component's state alone, anything that never
 * fires the observer would leave the content permanently at opacity 0.
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

    // Very old browsers with no IntersectionObserver: reveal immediately
    // rather than never. Deferred by a tick so this isn't a synchronous
    // state write from the effect body.
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }

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
      data-visible={visible}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`reveal ${className}`}
    >
      {children}
    </div>
  );
}
