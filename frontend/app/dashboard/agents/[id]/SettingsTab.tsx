"use client";

import { useEffect, useId, useState } from "react";
import { apiFetch } from "@/lib/api";
import { SpinnerIcon } from "@/lib/icons";
import type { Agent } from "./types";

const PERSONALITY_MAX = 1000;
const INSTRUCTIONS_MAX = 4000;

export default function SettingsTab({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [personality, setPersonality] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const personalityId = useId();
  const instructionsId = useId();

  useEffect(() => {
    apiFetch<Agent>(`/agents/${agentId}`)
      .then((data) => {
        setAgent(data);
        setPersonality(data.personality ?? "");
        setInstructions(data.instructions ?? "");
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, [agentId]);

  const dirty = agent !== null && (personality !== (agent.personality ?? "") || instructions !== (agent.instructions ?? ""));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = await apiFetch<Agent>(`/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          personality: personality.trim() || null,
          instructions: instructions.trim() || null,
        }),
      });
      setAgent(updated);
      setPersonality(updated.personality ?? "");
      setInstructions(updated.instructions ?? "");
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="h-24 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
        <div className="h-40 animate-pulse rounded-xl border border-ink/10 bg-ink/5" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-rose">
        {loadError}
      </p>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={personalityId} className="text-sm font-medium text-ink">
          Personality &amp; tone
        </label>
        <p className="text-sm text-slate-onlight">
          How the agent should come across — e.g. &ldquo;warm and casual&rdquo; or &ldquo;concise and
          professional&rdquo;.
        </p>
        <textarea
          id={personalityId}
          rows={3}
          maxLength={PERSONALITY_MAX}
          value={personality}
          onChange={(e) => {
            setPersonality(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Friendly and reassuring — most visitors are a little anxious about their appointment."
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
        />
        <p className="text-right text-xs text-slate-onlight">
          {personality.length}/{PERSONALITY_MAX}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={instructionsId} className="text-sm font-medium text-ink">
          Business-specific instructions
        </label>
        <p className="text-sm text-slate-onlight">
          Rules the agent should always follow — things it should never say, how to handle specific
          situations, escalation policy, and so on. This gets added to every conversation alongside
          your uploaded documents.
        </p>
        <textarea
          id={instructionsId}
          rows={8}
          maxLength={INSTRUCTIONS_MAX}
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Never quote a price for a procedure that isn't in the uploaded price list — offer to have someone follow up instead."
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-onlight/60 focus-visible:border-amber focus-visible:ring-2 focus-visible:ring-amber/40"
        />
        <p className="text-right text-xs text-slate-onlight">
          {instructions.length}/{INSTRUCTIONS_MAX}
        </p>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-rose">
          {saveError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !dirty}
          className="flex items-center gap-2 rounded-full bg-amber px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <SpinnerIcon />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-emerald">Saved</span>}
      </div>
    </form>
  );
}
