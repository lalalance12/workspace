"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { RpcError, sendPeerNudge } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

/**
 * Hard cap, well under the database's 80. A nudge is a signpost, not a
 * message — at this length it can only point, which is the intent.
 */
const MAX_NOTE = 11;

/**
 * A peer nudge is a signpost, not a message.
 *
 * A few characters and a link out to wherever the team actually talks. There is
 * no reply field and there must never be one — the moment this grows a thread,
 * Workspace stops being a status board and starts competing badly with Slack.
 *
 * Rendered by the board as a sibling of the card, not inside it: anything
 * absolutely positioned within the card is trapped by its bounds, which is why
 * this used to appear cut off at the card's edge.
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
      className="panel rise-in absolute top-10 right-2 z-50 w-64 p-3 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="annotation mb-2">Nudge {recipientName}</p>

      <input
        ref={inputRef}
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
        maxLength={MAX_NOTE}
        placeholder="Deploy?"
        className="input text-sm"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className="annotation"
          style={{ color: left <= 3 ? "var(--signal)" : undefined }}
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
        Points them at your messages. The team can see you nudged.
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
