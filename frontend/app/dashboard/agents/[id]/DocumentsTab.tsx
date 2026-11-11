"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import { ConfirmDialog } from "@/components/Dialog";
import { useToast } from "@/components/Toast";
import { SpinnerIcon, UploadIcon } from "@/lib/icons";
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
      toast({ title: "Uploaded", description: "Processing now. This usually takes a few seconds." });
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
      <form onSubmit={handleUpload} className="mb-8">
        {/* A drop target has to be a visible area, so this keeps its dashed
            edge, but as a slim bar at the control radius rather than a big
            rounded box with an icon tile in the middle. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col gap-4 rounded-[var(--radius-control)] border border-dashed px-5 py-5 transition duration-200 focus-within:ring-2 focus-within:ring-volt/60 sm:flex-row sm:items-center ${
            dragging ? "border-volt bg-volt/[0.06]" : "border-edge-strong"
          }`}
        >
          {/* The input is visually hidden but still the real, focusable
              control. Its focus shows on the whole drop zone through
              focus-within. This used to be a `peer-focus-visible` ring on
              the label, which never worked: `peer` only reaches siblings,
              and the label sat inside a <p>, so keyboard users got no
              focus indicator at all. */}
          <input
            id="document-upload"
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => setSelectedName(e.target.files?.[0]?.name ?? null)}
            className="sr-only"
          />

          <p className="flex-1 text-[15px] text-ink-muted">
            {selectedName ? (
              <span className="font-medium text-ink">{selectedName}</span>
            ) : (
              <>
                Drop a PDF, .txt or .md file here, or{" "}
                <label
                  htmlFor="document-upload"
                  className="cursor-pointer rounded font-medium text-volt underline decoration-volt/40 underline-offset-4"
                >
                  choose one
                </label>
                .
              </>
            )}
          </p>

          {selectedName && (
            <span className="flex items-center gap-4">
              <label
                htmlFor="document-upload"
                className="cursor-pointer rounded text-[13px] text-ink-muted transition hover:text-ink"
              >
                Change
              </label>
              <button type="submit" disabled={uploading} className="btn btn-primary px-5 py-2 text-[14px]">
                {uploading ? <SpinnerIcon className="h-3.5 w-3.5" /> : <UploadIcon className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </span>
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
            <Skeleton key={i} className="h-[60px]" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Upload your hours, pricing, or policies. Everything the agent says comes from what you put here."
        />
      ) : (
        <ul className="divide-y divide-edge border-y border-edge">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-6 px-1 py-4">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="truncate text-[15px] font-medium text-ink">{doc.filename}</p>
                <StatusLabel status={doc.status} />
              </div>
              <button
                onClick={() => setPendingDelete(doc)}
                aria-label={`Delete ${doc.filename}`}
                className="focus-ring shrink-0 rounded text-[13px] text-ink-muted transition hover:text-bad"
              >
                Delete
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
 * Processing state is real state, which is the one case a coloured dot is
 * for. The word carries it as much as the colour does, so it still reads if
 * the hue is hard to tell apart, and "processing" pulses to show the 3s
 * poll is still watching without needing a spinner.
 */
function StatusLabel({ status }: { status: string }) {
  const done = status === "done";
  const failed = status === "failed";
  const tone = done ? "text-good" : failed ? "text-bad" : "text-volt";
  const dot = done ? "bg-good" : failed ? "bg-bad" : "bg-volt animate-pulse";
  const label = done ? "Ready" : failed ? "Failed" : "Processing";

  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] ${tone}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
