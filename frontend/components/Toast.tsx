"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckIcon, SpinnerIcon } from "@/lib/icons";

type Tone = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
};

type ToastInput = Omit<Toast, "id" | "tone"> & { tone?: Tone };

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/*
 * Transient feedback for things that happen away from where you are
 * looking — a save that succeeded, an upload that failed, a document that
 * finished processing while you were on another tab. Inline "Saved" text
 * next to the button only works when your eyes are already on the button.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone: "success", ...input }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {/* Bottom-centre on phones (thumb-reachable, out of the way of the
          content), bottom-right on wider screens. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TONE_STYLES: Record<Tone, { ring: string; icon: string }> = {
  success: { ring: "border-emerald/30", icon: "bg-emerald/15 text-emerald" },
  error: { ring: "border-rose/30", icon: "bg-rose/15 text-rose" },
  info: { ring: "border-line-bright", icon: "bg-amber/15 text-amber" },
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [entered, setEntered] = useState(false);
  const tone = TONE_STYLES[toast.tone];

  useEffect(() => {
    // Two frames: mount at the "from" position, then flip, so the browser
    // has something to transition between.
    const raf = requestAnimationFrame(() => setEntered(true));
    const leave = setTimeout(() => setLeaving(true), DURATION_MS);
    const remove = setTimeout(onDismiss, DURATION_MS + 220);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(leave);
      clearTimeout(remove);
    };
  }, [onDismiss]);

  return (
    <div
      // Errors interrupt; successes wait their turn.
      role={toast.tone === "error" ? "alert" : "status"}
      className={`card pointer-events-auto flex w-full max-w-sm items-start gap-3 p-4 transition-all duration-200 ease-out ${tone.ring} ${
        entered && !leaving ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      style={{ boxShadow: "var(--shadow-lift)" }}
    >
      <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${tone.icon}`}>
        {toast.tone === "success" ? <CheckIcon className="h-3.5 w-3.5" /> : <span className="text-xs font-bold">!</span>}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-cream">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-[13px] leading-relaxed text-mist">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="focus-ring -m-1 shrink-0 rounded p-1 text-dusk transition hover:text-cream"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M5.5 5.5l9 9m0-9l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/*
 * A button that shows a spinner and a "pending" label while an async action
 * is in flight. Every form in the dashboard was hand-rolling this pair of
 * states with slightly different wording.
 */
export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className = "btn btn-primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <button {...props} disabled={pending || props.disabled} className={className}>
      {pending && <SpinnerIcon />}
      {pending ? pendingLabel : children}
    </button>
  );
}
