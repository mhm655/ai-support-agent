"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

/*
 * Copy-to-clipboard with a two-second confirmation. The label is announced
 * via aria-live rather than swapping the accessible name out from under a
 * screen reader mid-press.
 */
export default function CopyButton({
  value,
  label = "Copy",
  className = "",
  tone = "light",
}: {
  value: string;
  label?: string;
  className?: string;
  /** "dark" when this sits on an inverted slab, e.g. the embed snippet. */
  tone?: "light" | "dark";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions).
      // Nothing useful to recover with — the text is visible and
      // selectable either way, so fail quietly rather than alarming.
    }
  }

  return (
    <button type="button" onClick={handleCopy} className={`btn ${tone === "dark" ? "btn-outline-invert" : "btn-ghost"} px-3 py-1.5 text-xs ${className}`}>
      {copied ? (
        <Check weight="bold" className="h-3.5 w-3.5 text-good" />
      ) : (
        <Copy weight="bold" className="h-3.5 w-3.5" />
      )}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
