"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Document } from "./types";

export default function DocumentsTab({ agentId }: { agentId: string }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Document[]>(`/agents/${agentId}/documents`);
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(documentId: string, filename: string) {
    if (!window.confirm(`Delete "${filename}"? The agent will no longer be able to answer from it.`)) {
      return;
    }
    await apiFetch(`/documents/${documentId}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <form onSubmit={handleUpload} className="mb-6 flex gap-2">
        <label htmlFor="document-upload" className="sr-only">
          Upload a document
        </label>
        <input
          id="document-upload"
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-ink/5 file:px-3 file:py-1 file:text-sm file:font-medium file:text-ink focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
        />
        <button
          type="submit"
          disabled={uploading}
          className="shrink-0 rounded-full bg-amber px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mb-4 text-sm text-rose">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 px-6 py-10 text-center">
          <p className="font-bold text-ink">No documents yet</p>
          <p className="mt-1 text-sm text-slate-onlight">
            Upload a PDF, .txt, or .md file with your hours, pricing, or policies.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{doc.filename}</p>
                <StatusBadge status={doc.status} />
              </div>
              <button
                onClick={() => handleDelete(doc.id, doc.filename)}
                className="rounded-full px-2 py-1 text-sm font-medium text-rose transition hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/40"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "done"
      ? "bg-emerald/10 text-emerald"
      : status === "failed"
        ? "bg-rose/10 text-rose"
        : "bg-amber/10 text-amber";
  return (
    <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{status}</span>
  );
}
