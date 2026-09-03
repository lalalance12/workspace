"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RpcError, acknowledgeNudge } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

export interface PeerNudge {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  note: string | null;
  link: string | null;
  created_at: string;
}

/**
 * "Someone wants you" — shown at the top of the board when a peer nudge is
 * open against you.
 *
 * Two actions and no third: go to the conversation, or acknowledge that you
 * saw it. Acknowledging notifies the sender so they know to expect you, which
 * is the whole point of a nudge closing the loop rather than evaporating.
 *
 * Nudges stack, so this renders every open one rather than only the newest.
 */
export function NudgeBanner({
  nudges,
  nameFor,
  onAcknowledged,
}: {
  nudges: PeerNudge[];
  nameFor: (id: string | null) => string;
  onAcknowledged: (id: string) => void;
}) {
  if (nudges.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-3">
      {nudges.map((nudge) => (
        <NudgeRow
          key={nudge.id}
          nudge={nudge}
          sender={nameFor(nudge.sender_id)}
          onAcknowledged={onAcknowledged}
        />
      ))}
    </div>
  );
}

function NudgeRow({
  nudge,
  sender,
  onAcknowledged,
}: {
  nudge: PeerNudge;
  sender: string;
  onAcknowledged: (id: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function acknowledge() {
    setError(null);
    setPending(true);
    try {
      await acknowledgeNudge(createClient(), nudge.id);
      onAcknowledged(nudge.id);
    } catch (err) {
      setPending(false);
      setError(
        err instanceof RpcError ? err.message : "That didn't go through.",
      );
    }
  }

  return (
    <div
      className="rise-in flex flex-wrap items-center gap-3 border p-4"
      style={{
        borderRadius: "var(--radius-card)",
        borderColor: "color-mix(in oklab, var(--violet) 35%, transparent)",
        backgroundImage:
          "linear-gradient(120deg, color-mix(in oklab, var(--violet) 12%, var(--surface)) 0%, var(--surface) 70%)",
      }}
    >
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{sender} nudged you</p>
        <p className="mt-0.5 text-sm text-[var(--ink-soft)]">
          {nudge.note ?? "Check your messages."}
        </p>
        {error && <p className="mt-1 text-sm text-[var(--signal)]">{error}</p>}
      </div>

      <div className="flex shrink-0 gap-2">
        {nudge.link && (
          <a
            href={nudge.link}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-quiet"
            onClick={() => void acknowledge()}
          >
            Open messages
          </a>
        )}
        <Button type="button" onClick={() => void acknowledge()} disabled={pending}>
          {pending ? "…" : "Got it"}
        </Button>
      </div>
    </div>
  );
}
