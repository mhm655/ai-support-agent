"use client";

import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/lib/icons";

/*
 * Text and password inputs with their label wired up. Both auth pages had
 * near-identical copies of this markup (including the show/hide toggle), so
 * a drift in one was invisible in the other. The accessible names — "Email",
 * "Password", "Show password"/"Hide password" — are load-bearing: the unit
 * and Playwright suites query the form by exactly those.
 */
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  required,
  placeholder,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: "text" | "email";
  autoComplete?: string;
  inputMode?: "email" | "text";
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        spellCheck={false}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="field"
      />
      {hint && <span className="text-xs text-ink-faint">{hint}</span>}
    </div>
  );
}

export function PasswordField({
  label = "Password",
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          spellCheck={false}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field pr-11"
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="focus-ring absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-lg text-ink-faint transition hover:bg-paper-raised/5 hover:text-ink"
        >
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

/*
 * Inline form error. role="alert" so it is announced when it appears —
 * both test suites assert on that role.
 */
export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-bad/25 bg-bad/10 px-3 py-2.5 text-sm leading-relaxed text-bad"
    >
      {children}
    </p>
  );
}
