"use client";

import { useEffect, useId, useState } from "react";
import { apiFetch } from "@/lib/api";
import CopyButton from "@/components/CopyButton";
import Skeleton from "@/components/Skeleton";
import { FormError } from "@/components/FormField";
import { useToast } from "@/components/Toast";
import { CheckIcon, CodeIcon, SpinnerIcon } from "@/lib/icons";
import type { Agent } from "./types";

const PERSONALITY_MAX = 1000;
const INSTRUCTIONS_MAX = 4000;

export default function SettingsTab({ agentId }: { agentId: string }) {
  const toast = useToast();
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

  const dirty =
    agent !== null &&
    (personality !== (agent.personality ?? "") || instructions !== (agent.instructions ?? ""));

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
      toast({ title: "Settings saved", description: "New conversations use them right away." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save changes";
      setSaveError(message);
      toast({ tone: "error", title: "Couldn't save settings", description: message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (loadError) return <FormError>{loadError}</FormError>;

  return (
    <div className="flex flex-col gap-4">
      <InstallCard agentId={agentId} />

      <form onSubmit={handleSave} className="card flex flex-col gap-7 p-6">
        <div className="flex flex-col gap-2">
          <label htmlFor={personalityId} className="label">
            Personality &amp; tone
          </label>
          <p className="hint">
            How the agent should come across, for example &ldquo;warm and casual&rdquo; or &ldquo;concise
            and professional&rdquo;.
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
            placeholder="e.g. Friendly and reassuring. Most visitors are a little anxious about their appointment."
            className="field resize-y"
          />
          <CharCount value={personality.length} max={PERSONALITY_MAX} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={instructionsId} className="label">
            Business-specific instructions
          </label>
          <p className="hint">
            Rules the agent should always follow: things it should never say, how to handle specific
            situations, escalation policy. This is added to every conversation alongside your
            uploaded documents.
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
            placeholder="e.g. Never quote a price for a procedure that isn't in the uploaded price list. Offer to have someone follow up instead."
            className="field resize-y"
          />
          <CharCount value={instructions.length} max={INSTRUCTIONS_MAX} />
        </div>

        {saveError && <FormError>{saveError}</FormError>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving || !dirty} className="btn btn-primary">
            {saving && <SpinnerIcon />}
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald">
              <CheckIcon className="h-4 w-4" />
              Saved
            </span>
          )}
          {dirty && !saving && <span className="text-sm text-dusk">Unsaved changes</span>}
        </div>
      </form>
    </div>
  );
}

/*
 * The embed snippet, filled in with this agent's real id and the API base
 * this deployment actually talks to. The landing page advertises a one-line
 * install, but the dashboard previously never handed anyone that line —
 * you had to go read widget.js to find out what attributes it wanted.
 */
function InstallCard({ agentId }: { agentId: string }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  // Read on the client only. Reading window.location during render would
  // make the server-rendered markup ("") disagree with the first client
  // render, which React reports as a hydration mismatch.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // react-hooks/set-state-in-effect can't tell this apart from a
    // cascading update. Reading a browser-only value after mount is exactly
    // what the effect is for here — doing it during render instead is the
    // thing that would actually be a bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const snippet = `<script src="${origin}/widget.js"\n        data-agent-id="${agentId}"\n        data-api-url="${apiUrl}"></script>`;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-well/50 px-5 py-3">
        <CodeIcon className="h-4 w-4 text-amber" />
        <span className="text-[13px] font-medium text-cream">Install on your site</span>
        <CopyButton value={snippet} label="Copy snippet" className="ml-auto" />
      </div>
      <div className="p-5">
        <p className="hint mb-3">
          Paste this just before the closing <code className="font-mono text-amber-soft">&lt;/body&gt;</code>{" "}
          tag on any page you want the agent to appear on.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-line bg-void p-4 font-mono text-[12px] leading-relaxed text-mist">
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
}

function CharCount({ value, max }: { value: number; max: number }) {
  const near = value > max * 0.9;
  return (
    <p className={`text-right font-mono text-[11px] ${near ? "text-amber" : "text-dusk"}`}>
      {value}/{max}
    </p>
  );
}
