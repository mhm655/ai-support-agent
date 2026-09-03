"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SpinnerIcon } from "@/lib/icons";

/*
 * A modal dialog. This exists to retire window.confirm() and window.prompt(),
 * which the dashboard used for deleting a document and for asking a business
 * name during the login repair path. Native dialogs are unstyleable, look
 * like a browser security warning, and window.prompt() is outright blocked in
 * some embedded/mobile contexts — which meant that repair path could silently
 * fail to run at all.
 *
 * Behaviour matches the ARIA dialog pattern: focus moves in on open and back
 * to the trigger on close, Tab is trapped inside, Escape and backdrop clicks
 * dismiss, and the page behind is hidden from assistive tech.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocus = "first",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer: React.ReactNode;
  initialFocus?: "first" | "none";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    // Focus the first meaningful control (usually a text input); fall back to
    // the panel so the dialog itself is the focus context.
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    if (initialFocus === "first" && focusable?.length) focusable[0].focus();
    else panel?.focus();

    // The page behind must not scroll under the modal.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, initialFocus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Cycle focus within the panel rather than escaping to the page behind.
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" onKeyDown={handleKeyDown}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-void/80 backdrop-blur-sm motion-safe:animate-[fade-in_150ms_ease-out]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="card relative w-full max-w-md p-6 outline-none motion-safe:animate-[dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)]"
        style={{ boxShadow: "var(--shadow-lift)" }}
      >
        <h2 id={titleId} className="font-display text-lg font-bold tracking-tight text-cream">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-2 text-sm leading-relaxed text-mist">
            {description}
          </p>
        )}
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
      </div>
    </div>
  );
}

/*
 * The common case: "are you sure?" with a destructive confirm. Typing-to-
 * confirm is deliberately not used — these actions are recoverable enough
 * that it would be friction theatre.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      // Don't auto-focus the destructive button — Enter should not be able
      // to confirm a deletion the moment the dialog appears.
      initialFocus="none"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="btn bg-rose text-void hover:bg-rose/85"
          >
            {pending && <SpinnerIcon />}
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </>
      }
    />
  );
}

/*
 * Replacement for window.prompt(): a single labelled text input in a dialog.
 */
export function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  label,
  initialValue = "",
  submitLabel = "Save",
  pending = false,
  placeholder,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  description?: React.ReactNode;
  label: string;
  initialValue?: string;
  submitLabel?: string;
  pending?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const inputId = useId();

  // Re-seed when reopened for a different subject (e.g. renaming a second
  // agent) rather than keeping the previous entry. Adjusting state during
  // render on a prop change is the pattern React documents for exactly this;
  // an effect would render once with the stale value first.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(initialValue);
  }

  const submit = () => {
    if (value.trim() && !pending) onSubmit(value.trim());
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className="btn btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={pending || !value.trim()} className="btn btn-primary">
            {pending && <SpinnerIcon />}
            {pending ? "Saving…" : submitLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="label">
          {label}
        </label>
        <input
          id={inputId}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          className="field"
        />
      </div>
    </Dialog>
  );
}
