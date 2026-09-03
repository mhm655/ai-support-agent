"use client";

import { useId } from "react";
import { SearchIcon } from "@/lib/icons";

/*
 * Filter box for the leads and conversations lists. The result count is
 * announced politely rather than shouted, so a screen-reader user gets
 * "3 of 12 leads" as they type instead of silence.
 */
export default function SearchField({
  value,
  onChange,
  label,
  placeholder,
  resultCount,
  totalCount,
  noun,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  resultCount: number;
  totalCount: number;
  noun: string;
}) {
  const id = useId();
  const filtering = value.trim().length > 0;

  return (
    <div className="mb-4">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <span aria-hidden="true" className="absolute inset-y-0 left-3.5 flex items-center text-ink-faint">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="field rounded-full pl-10"
        />
        {filtering && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="focus-ring absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-full text-ink-faint transition hover:bg-paper-raised/5 hover:text-ink"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M5.5 5.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <p aria-live="polite" className="mt-2 h-4 font-mono text-[11px] text-ink-faint">
        {filtering ? `${resultCount} of ${totalCount} ${noun}${totalCount === 1 ? "" : "s"}` : ""}
      </p>
    </div>
  );
}
