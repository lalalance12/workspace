"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { RpcError, createTeam, joinTeam, messageForError } from "@/lib/rpc";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  team_id: string | null;
  display_name: string;
  message_link: string | null;
  peer_nudges_enabled: boolean;
  system_nudges_enabled: boolean;
  nudges_paused_until: string | null;
}

/**
 * Nudge preferences, pause, and the message link a peer nudge points at.
 *
 * Also the onboarding path: a fresh signup has a profile but no team, and
 * nothing works until they have one.
 */
export function MeSettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [messageLink, setMessageLink] = useState(profile.message_link ?? "");
  const [peer, setPeer] = useState(profile.peer_nudges_enabled);
  const [system, setSystem] = useState(profile.system_nudges_enabled);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createTeam(createClient(), teamName);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof RpcError ? err.message : "Couldn't create that team.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onJoinTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await joinTeam(createClient(), joinCode);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof RpcError ? err.message : "Couldn't join with that code.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    const { error: err } = await createClient()
      .from("profiles")
      .update({
        message_link: messageLink.trim() || null,
        peer_nudges_enabled: peer,
        system_nudges_enabled: system,
      })
      .eq("id", profile.id);

    setPending(false);
    if (err) setError(messageForError(err));
    else {
      setSaved(true);
      router.refresh();
    }
  }

  if (!profile.team_id) {
    return (
      <div className="flex max-w-sm flex-col gap-8">
        <form onSubmit={onJoinTeam} className="flex flex-col gap-4">
          <p className="text-sm text-[var(--ink-soft)]">
            You&rsquo;re not on a team yet. If someone sent you a join code,
            enter it here.
          </p>
          <label className="flex flex-col gap-2">
            <span className="annotation">Join code</span>
            <input
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="K7QM4RXP"
              maxLength={8}
              className="border border-[var(--ink)]/25 bg-transparent px-3 py-2 font-mono tracking-[0.2em] uppercase"
              style={{ borderRadius: "var(--radius-sheet)" }}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer self-start bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--paper)] disabled:opacity-60"
            style={{ borderRadius: "var(--radius-sheet)" }}
          >
            {pending ? "Joining…" : "Join team"}
          </button>
        </form>

        <form onSubmit={onCreateTeam} className="dimension-rule flex flex-col gap-4 pt-6">
          <p className="text-sm text-[var(--ink-soft)]">
            Or start a new one. You become its head.
          </p>
          <label className="flex flex-col gap-2">
            <span className="annotation">Team name</span>
            <input
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Product"
              className="border border-[var(--ink)]/25 bg-transparent px-3 py-2"
              style={{ borderRadius: "var(--radius-sheet)" }}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer self-start border border-[var(--ink)]/25 px-4 py-2.5 text-sm disabled:opacity-60"
            style={{ borderRadius: "var(--radius-sheet)" }}
          >
            {pending ? "Creating…" : "Create team"}
          </button>
        </form>

        {error && (
          <p role="alert" className="border-l-2 border-[var(--signal)] py-2 pl-3 text-sm">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="flex max-w-md flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="annotation">Where a nudge sends people</span>
        <input
          type="url"
          value={messageLink}
          onChange={(e) => setMessageLink(e.target.value)}
          placeholder="https://slack.com/app_redirect?channel=you"
          className="border border-[var(--ink)]/25 bg-transparent px-3 py-2"
          style={{ borderRadius: "var(--radius-sheet)" }}
        />
        <span className="text-sm text-[var(--ink-soft)]">
          Workspace never carries the conversation. This is where it points.
        </span>
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={peer}
          onChange={(e) => setPeer(e.target.checked)}
        />
        Let teammates nudge me
      </label>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={system}
          onChange={(e) => setSystem(e.target.checked)}
        />
        Ask me when my status goes stale
      </label>

      <div className="dimension-rule pt-5">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--paper)] disabled:opacity-60"
          style={{ borderRadius: "var(--radius-sheet)" }}
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>

      {saved && <p className="annotation">Saved</p>}
      {error && (
        <p role="alert" className="border-l-2 border-[var(--signal)] py-2 pl-3 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
