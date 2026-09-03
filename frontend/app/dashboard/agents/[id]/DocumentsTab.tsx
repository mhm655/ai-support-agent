"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import { ConfirmDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { DocumentIcon, SpinnerIcon, TrashIcon, UploadIcon } from "@/lib/icons";
import type { Document } from "./types";

const ACCEPT = ".pdf,.txt,.md";

export default function DocumentsTab({ agentId }: { agentId: string }) {
  const toast = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tracks which documents were still processing on the previous poll, so a
  // transition to "done" can be announced. Ingestion is a background task —
  // without this you have to sit and watch the badge to know it finished.
  const pendingIdsRef = useRef<Set<string>>(new Set());

  async function load() {
    try {
      const data = await apiFetch<Document[]>(`/agents/${agentId}/documents`);

      const stillPending = new Set(data.filter((d) => d.status === "pending").map((d) => d.id));
      for (const doc of data) {
        if (pendingIdsRef.current.has(doc.id) && doc.status !== "pending") {
          if (doc.status === "done") {
            toast({ title: `"${doc.filename}" is ready`, description: "The agent can answer from it now." });
          } else {
            toast({ tone: "error", title: `Couldn't process "${doc.filename}"` });
          }
        }
      }
      pendingIdsRef.current = stillPending;

      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // react-hooks/set-state-in-effect flags calling load() (which sets
    // state synchronously) directly in the effect body. This is the
    // standard fetch-on-mount pattern React's own docs recommend — the
    // rule can't distinguish it from an accidental cascading update, so
    // it's disabled here rather than adding an artificial async wrapper.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Poll every 3s while any document is still processing, so status
    // flips from "pending" to "done" without a manual refresh.
    const interval = setInterval(() => {
      setDocuments((current) => {
        if (current.some((d) => d.status === "pending")) load();
        return current;
      });
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  // Dropping a file assigns it to the real <input type="file">, so the
  // submit path stays identical whether the file was dropped or picked.
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !fileInputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputRef.current.files = transfer.files;
    setSelectedName(file.name);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const { supabase } = await import("@/lib/supabase/client");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${API_BASE}/agents/${agentId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Upload failed");
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedName(null);
      toast({ title: "Uploaded", description: "Processing now — this usually takes a few seconds." });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast({ tone: "error", title: "Upload failed", description: message });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/documents/${pendingDelete.id}`, { method: "DELETE" });
      const name = pendingDelete.filename;
      setPendingDelete(null);
      await load();
      toast({ title: `Deleted "${name}"` });
    } catch (err) {
      toast({
        tone: "error",
        title: "Couldn't delete document",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleUpload} className="mb-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border border-dashed p-6 text-center transition duration-200 ${
            dragging ? "scale-[1.01] border-amber bg-amber/[0.07]" : "border-line-bright bg-card/40"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mx-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-well text-amber transition ${
              dragging ? "-translate-y-0.5" : ""
            }`}
          >
            <UploadIcon className="h-5 w-5" />
          </span>

          {/* The input is visually hidden but still the real, focusable
              control — the label picks up its focus ring via `peer`, which
              only works if the input precedes it in the DOM. */}
          <input
            id="document-upload"
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => setSelectedName(e.target.files?.[0]?.name ?? null)}
            className="peer sr-only"
          />

          <p className="mt-4 text-sm text-cream">
            <label
              htmlFor="document-upload"
              className="cursor-pointer rounded px-1 font-medium text-amber underline decoration-amber/40 underline-offset-4 hover:text-amber-soft peer-focus-visible:ring-2 peer-focus-visible:ring-amber/60"
            >
              Choose a file
            </label>{" "}
            <span className="text-mist">or drag it here</span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-dusk">PDF, .txt or .md</p>

          {selectedName && (
            <div className="enter mt-5 flex flex-wrap items-center justify-center gap-3">
              <span className="badge border border-line bg-well text-mist">
                <DocumentIcon className="h-3.5 w-3.5" />
                {selectedName}
              </span>
              <button type="submit" disabled={uploading} className="btn btn-primary px-4 py-2 text-xs">
                {uploading ? <SpinnerIcon className="h-3.5 w-3.5" /> : <UploadIcon className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-4">
          <FormError>{error}</FormError>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[68px]" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<DocumentIcon className="h-5 w-5" />}
          title="No documents yet"
          description="Upload your hours, pricing, or policies. Everything the agent says comes from what you put here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc, i) => (
            <li
              key={doc.id}
              className="card enter flex items-center gap-4 p-4"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-well text-mist"
              >
                <DocumentIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-cream">{doc.filename}</p>
                <StatusBadge status={doc.status} />
              </div>
              <button
                onClick={() => setPendingDelete(doc)}
                aria-label={`Delete ${doc.filename}`}
                className="btn btn-danger shrink-0 px-3 py-1.5 text-xs"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={`Delete "${pendingDelete?.filename}"?`}
        description="The agent will no longer be able to answer from it. You can upload it again later."
        pending={deleting}
      />
    </div>
  );
}

/*
 * The dot carries the state as much as the color does, so the badge is still
 * readable if the hue is hard to distinguish — and "pending" pulses, which
 * tells you the 3s poll is still watching without needing a spinner.
 */
function StatusBadge({ status }: { status: string }) {
  const done = status === "done";
  const failed = status === "failed";
  const tone = done
    ? "border-emerald/25 bg-emerald/10 text-emerald"
    : failed
      ? "border-rose/25 bg-rose/10 text-rose"
      : "border-amber/25 bg-amber/10 text-amber";
  const dot = done ? "bg-emerald" : failed ? "bg-rose" : "bg-amber animate-pulse";

  return (
    <span className={`badge mt-1 border ${tone}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {done ? "ready" : status}
    </span>
  );
}
