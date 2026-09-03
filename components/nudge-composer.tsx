"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { RpcError, sendPeerNudge } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

const MAX_NOTE = 80;

/**
 * A peer nudge is a signpost, not a message.
 *
 * Eighty characters and a link out to wherever the team actually talks. There
 * is no reply field and there must never be one — the moment this grows a
 * thread, Workspace stops being a status board and starts competing badly with
 * Slack. The character counter is not a formality: the database rejects 81.
 */
export function NudgeComposer({
  recipientId,
  recipientName,
  onSent,
  onClose,
}: {
  recipientId: string;
  recipientName: string;
  onSent: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      await sendPeerNudge(createClient(), {
        recipientId,
        note: note.trim() || null,
      });
      onSent();
    } catch (err) {
      setError(
        err instanceof RpcError
          ? err.message
          : "That nudge didn't send. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const left = MAX_NOTE - note.length;

  return (
    <form
      onSubmit={onSubmit}
      className="panel rise-in absolute top-full right-0 z-30 mt-2 w-72 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="annotation mb-2">Nudge {recipientName}</p>

      <input
        ref={inputRef}
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
        maxLength={MAX_NOTE}
        placeholder="Free to look at the deploy?"
        className="input text-sm"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className="annotation"
          style={{ color: left < 10 ? "var(--signal)" : undefined }}
        >
          {left} left
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending} className="px-3 py-2">
            {pending ? "Sending…" : "Send nudge"}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-xs text-[var(--ink-soft)]">
        Sends them to your messages. The team can see you nudged.
      </p>

      {error && (
        <p role="alert" className="error-note mt-2 text-xs">
          <span
            aria-hidden="true"
            className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--signal)]"
          />
          <span>{error}</span>
        </p>
      )}
    </form>
  );
}
